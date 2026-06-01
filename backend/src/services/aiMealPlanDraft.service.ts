/**
 * Orchestrator for the AI meal-plan draft feature.
 *
 * Composes:
 *   - meal-plan-agent (parse + match/create + assemble draft)
 *   - validationEngine (ground-truth re-validation of every drafted item)
 *
 * The agent does its own validation inside the loop, but we never trust that
 * as final — we re-run server-side so the response carries authoritative
 * severity + alerts.
 */

import { runMealPlanAgent } from './ai/meal-plan-agent';
import { validationEngine } from './validationEngine.service';
import { ValidationSeverity } from '../types/validation.types';
import prisma from '../utils/prisma';
import { scaleNutrition } from '../utils/nutritionCalculator';
import type {
    AgentDraftPayload,
    DraftDay,
    DraftMeal,
    DraftFoodItem,
    ItemNutrition,
    ResolvedDay,
    ResolvedFoodItem,
    MealPlanDraftResult,
    DraftSummary,
} from '../types/aiMealPlan.types';
import logger from '../utils/logger';

const DAY_OF_WEEK: Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'> = [
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

type FoodNutritionRow = {
    id: string;
    calories: number;
    proteinG: import('@prisma/client').Prisma.Decimal | null;
    carbsG: import('@prisma/client').Prisma.Decimal | null;
    fatsG: import('@prisma/client').Prisma.Decimal | null;
    fiberG: import('@prisma/client').Prisma.Decimal | null;
    servingSizeG: import('@prisma/client').Prisma.Decimal;
};

/** Map a 1-indexed day number from the prompt to a weekday name for validation context. */
function dayNumberToWeekday(dayNumber: number): typeof DAY_OF_WEEK[number] {
    const idx = ((dayNumber - 1) % 7 + 7) % 7;
    return DAY_OF_WEEK[idx];
}

export interface GenerateDraftInput {
    prompt: string;
    /** Null in template mode — validation against client allergies/diet is skipped. */
    clientId: string | null;
    templateMode: boolean;
    orgId: string;
    userId: string;
}

export class AiMealPlanDraftService {
    async generateDraft(input: GenerateDraftInput): Promise<MealPlanDraftResult> {
        const { draft: agentDraft, createdFoodIds } = await runMealPlanAgent(input);

        if (agentDraft.days.length === 0) {
            return this.emptyResult(createdFoodIds);
        }

        this.normalizeOptionGroups(agentDraft);

        const nutritionByFoodId = await this.loadNutrition(agentDraft);
        this.dropInvalidItems(agentDraft, nutritionByFoodId);
        const resolvedDays = await this.resolveDays(agentDraft, input.clientId, nutritionByFoodId);
        const summary = this.summarize(resolvedDays, createdFoodIds.length);
        const blocked = this.collectBlocked(resolvedDays);

        logger.info('AI meal-plan draft assembled', {
            clientId: input.clientId,
            templateMode: input.templateMode,
            ...summary,
        });

        return {
            days: resolvedDays,
            summary,
            blocked,
            createdFoodIds,
        };
    }

    /**
     * Drop items whose foodId either isn't a valid UUID or doesn't resolve to an
     * actual FoodItem row. The AI sometimes hallucinates an ID for an item it
     * never searched/created — those would crash diet-plan creation later.
     * Also prunes empty meals/days that result.
     */
    private dropInvalidItems(
        payload: AgentDraftPayload,
        nutritionByFoodId: Map<string, unknown>,
    ): void {
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        let dropped = 0;
        for (const day of payload.days) {
            for (const meal of day.meals) {
                meal.items = meal.items.filter((item) => {
                    const ok = UUID_RE.test(item.foodId) && nutritionByFoodId.has(item.foodId);
                    if (!ok) dropped += 1;
                    return ok;
                });
            }
            day.meals = day.meals.filter((m) => m.items.length > 0);
        }
        payload.days = payload.days.filter((d) => d.meals.length > 0);
        if (dropped > 0) {
            logger.warn('AI draft: dropped items with unresolved foodIds', { dropped });
        }
    }

    /**
     * The AI sometimes emits optionGroup=1 (or higher) for every item in a meal,
     * leaving no "primary" group. Downstream consumers (publish empty-slot check,
     * WhatsApp share, PDF generator) only show items with optionGroup=0, so those
     * items would render as "no items". Subtract the per-meal minimum so the
     * lowest group becomes 0 — preserves alternative ordering.
     */
    private normalizeOptionGroups(payload: AgentDraftPayload): void {
        for (const day of payload.days) {
            for (const meal of day.meals) {
                if (meal.items.length === 0) continue;
                const min = meal.items.reduce((m, i) => Math.min(m, i.optionGroup ?? 0), Infinity);
                if (min === 0 || !Number.isFinite(min)) continue;
                for (const item of meal.items) {
                    item.optionGroup = (item.optionGroup ?? 0) - min;
                }
            }
        }
    }

    private emptyResult(createdFoodIds: string[]): MealPlanDraftResult {
        return {
            days: [],
            summary: { totalItems: 0, matchedItems: 0, createdItems: 0, blockedItems: 0, warningItems: 0 },
            blocked: [],
            createdFoodIds,
        };
    }

    /** Batch-load nutrition rows for every foodId referenced by the agent. */
    private async loadNutrition(payload: AgentDraftPayload) {
        const ids = new Set<string>();
        for (const d of payload.days) for (const m of d.meals) for (const i of m.items) ids.add(i.foodId);
        if (ids.size === 0) return new Map<string, FoodNutritionRow>();

        const rows = await prisma.foodItem.findMany({
            where: { id: { in: Array.from(ids) } },
            select: { id: true, calories: true, proteinG: true, carbsG: true, fatsG: true, fiberG: true, servingSizeG: true },
        });
        return new Map<string, FoodNutritionRow>(rows.map((r) => [r.id, r]));
    }

    /** Re-validate every item server-side and attach severity/alerts + scaled nutrition. */
    private async resolveDays(
        payload: AgentDraftPayload,
        clientId: string | null,
        nutritionByFoodId: Map<string, FoodNutritionRow>,
    ): Promise<ResolvedDay[]> {
        const days: ResolvedDay[] = [];

        for (const day of payload.days) {
            const meals = await Promise.all(
                day.meals.map((meal) => this.resolveMeal(meal, day, clientId, nutritionByFoodId)),
            );
            days.push({
                dayNumber: day.dayNumber,
                note: day.note?.trim() ? day.note.trim() : null,
                meals,
            });
        }

        return days;
    }

    private async resolveMeal(
        meal: DraftMeal,
        day: DraftDay,
        clientId: string | null,
        nutritionByFoodId: Map<string, FoodNutritionRow>,
    ) {
        const items = await Promise.all(
            meal.items.map((item) => this.resolveItem(item, meal, day, clientId, nutritionByFoodId)),
        );
        return {
            sequenceNumber: meal.sequenceNumber,
            mealType: meal.mealType,
            name: meal.name,
            timeOfDay: meal.timeOfDay,
            instructions: meal.instructions,
            items,
        };
    }

    private async resolveItem(
        item: DraftFoodItem,
        meal: DraftMeal,
        day: DraftDay,
        clientId: string | null,
        nutritionByFoodId: Map<string, FoodNutritionRow>,
    ): Promise<ResolvedFoodItem> {
        const nutrition = this.scaleItemNutrition(item, nutritionByFoodId);
        // Template mode — no client to validate against. Pass everything as GREEN.
        if (!clientId) {
            return {
                ...item,
                nutrition,
                validation: { severity: ValidationSeverity.GREEN, alerts: [], blocked: false },
            };
        }
        try {
            const result = await validationEngine.validate(clientId, item.foodId, {
                currentDay: dayNumberToWeekday(day.dayNumber),
                mealType: meal.mealType,
            });
            const blocked =
                result.severity === ValidationSeverity.RED &&
                result.alerts.some(
                    (a) => a.type === 'allergy' || a.type === 'diet_pattern' || a.type === 'intolerance',
                );
            return {
                ...item,
                nutrition,
                validation: { severity: result.severity, alerts: result.alerts, blocked },
            };
        } catch (err) {
            logger.warn('Validation failed for drafted item', {
                foodId: item.foodId,
                error: err instanceof Error ? err.message : String(err),
            });
            return {
                ...item,
                nutrition,
                validation: { severity: ValidationSeverity.YELLOW, alerts: [], blocked: false },
            };
        }
    }

    private scaleItemNutrition(item: DraftFoodItem, byFoodId: Map<string, FoodNutritionRow>): ItemNutrition {
        const row = byFoodId.get(item.foodId);
        if (!row) return { calories: 0, proteinG: 0, carbsG: 0, fatsG: 0, fiberG: 0 };
        const scaled = scaleNutrition(row, item.quantityG);
        return {
            calories: scaled.calories,
            proteinG: scaled.proteinG ?? 0,
            carbsG: scaled.carbsG ?? 0,
            fatsG: scaled.fatsG ?? 0,
            fiberG: scaled.fiberG ?? 0,
        };
    }

    private summarize(days: ResolvedDay[], createdCount: number): DraftSummary {
        let totalItems = 0;
        let blockedItems = 0;
        let warningItems = 0;
        for (const d of days) {
            for (const m of d.meals) {
                for (const item of m.items) {
                    totalItems += 1;
                    if (item.validation.blocked) blockedItems += 1;
                    else if (item.validation.severity === ValidationSeverity.YELLOW) warningItems += 1;
                }
            }
        }
        return {
            totalItems,
            matchedItems: totalItems - createdCount,
            createdItems: createdCount,
            blockedItems,
            warningItems,
        };
    }

    private collectBlocked(days: ResolvedDay[]): MealPlanDraftResult['blocked'] {
        const out: MealPlanDraftResult['blocked'] = [];
        for (const d of days) {
            for (const m of d.meals) {
                for (const item of m.items) {
                    if (item.validation.blocked) {
                        const reason = item.validation.alerts[0]?.message ?? 'restricted for this client';
                        out.push({ name: item.foodName, reason });
                    }
                }
            }
        }
        return out;
    }
}

export const aiMealPlanDraftService = new AiMealPlanDraftService();
