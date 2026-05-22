/**
 * Tools the meal-plan agent calls to discover food items, validate them
 * against the client, and create new ones when needed.
 *
 * Each tool is a thin function that:
 *   1. Validates its inputs via Zod (the AI SDK enforces this).
 *   2. Performs a single side-effect or read.
 *   3. Returns a minimal JSON payload the model can reason about.
 *
 * The factory pattern (`makeXTool(ctx)`) injects per-request context
 * (clientId, orgId, mutable draft slot) without exposing it to the model.
 */

import { tool } from 'ai';
import { z } from 'zod';
import prisma from '../../../utils/prisma';
import { foodItemService } from '../../foodItem.service';
import { foodTaggingService } from '../../foodTagging.service';
import { validationEngine } from '../../validationEngine.service';
import { ValidationSeverity } from '../../../types/validation.types';
import type { AgentDraftPayload, DraftDay } from '../../../types/aiMealPlan.types';
import logger from '../../../utils/logger';

export interface AgentToolContext {
    clientId: string;
    orgId: string;
    userId: string;
    /** Mutated by submit_draft. Read by the orchestrator after the agent finishes. */
    draft: AgentDraftPayload | null;
    /** IDs of FoodItems created during this run (so we can list them in the response). */
    createdFoodIds: Set<string>;
}

// ─── Tool schemas ────────────────────────────────────────────────────────────

// Loose schema — the model wins more often when constraints are minimal.
// Tight validation runs server-side (orchestrator + validationEngine) anyway.
const draftDaySchema = z.object({
    dayNumber: z.number().int(),
    meals: z.array(
        z.object({
            sequenceNumber: z.number().int(),
            mealType: z.enum(['breakfast', 'lunch', 'snack', 'dinner']),
            name: z.string(),
            timeOfDay: z.string().nullable(),
            instructions: z.string().nullable(),
            items: z.array(
                z.object({
                    foodId: z.string(),
                    foodName: z.string(),
                    quantityG: z.number(),
                    quantityLabel: z.string(),
                    notes: z.string().nullable(),
                    optionGroup: z.number().int(),
                    wasCreated: z.boolean(),
                }),
            ),
        }),
    ),
});
// Compile-time sanity that the runtime shape still matches the TS type.
type _DraftDayCheck = z.infer<typeof draftDaySchema> extends DraftDay ? true : false;
const _draftDayCheck: _DraftDayCheck = true;
void _draftDayCheck;

// ─── Tool: get_client_context ────────────────────────────────────────────────

export const makeGetClientContextTool = (ctx: AgentToolContext) =>
    tool({
        description:
            'Returns the client\'s preferences, allergies, intolerances, diet pattern, ' +
            'dislikes, and other restrictions. Call this ONCE at the start so you know ' +
            'which foods are safe.',
        inputSchema: z.object({}),
        execute: async () => {
            const client = await prisma.client.findFirst({
                where: { id: ctx.clientId, orgId: ctx.orgId },
                select: {
                    fullName: true,
                    dietPattern: true,
                    allergies: true,
                    intolerances: true,
                    dislikes: true,
                    likedFoods: true,
                    avoidCategories: true,
                    medicalConditions: true,
                    preferredCuisines: true,
                    eggAllowed: true,
                    eggAvoidDays: true,
                },
            });
            if (!client) throw new Error('Client not found');
            return {
                fullName: client.fullName,
                dietPattern: client.dietPattern,
                allergies: client.allergies,
                intolerances: client.intolerances,
                dislikes: client.dislikes,
                likedFoods: client.likedFoods,
                avoidCategories: client.avoidCategories,
                medicalConditions: client.medicalConditions,
                preferredCuisines: client.preferredCuisines,
                eggAllowed: client.eggAllowed,
                eggAvoidDays: client.eggAvoidDays,
            };
        },
    });

// ─── Tool: search_food_items ─────────────────────────────────────────────────

export const makeSearchFoodItemsTool = (ctx: AgentToolContext) =>
    tool({
        description:
            'Search the food database (case-insensitive substring on name + brand). ' +
            'Returns up to `limit` candidate matches. Use this before deciding whether ' +
            'to reuse an existing FoodItem or call create_food_item.',
        inputSchema: z.object({
            query: z.string().min(1).max(80).describe('food name to search for'),
            limit: z.number().int().min(1).max(10).default(5),
        }),
        execute: async ({ query, limit }) => {
            const items = await prisma.foodItem.findMany({
                where: {
                    OR: [{ orgId: null }, { orgId: ctx.orgId }],
                    AND: [
                        {
                            OR: [
                                { name: { contains: query, mode: 'insensitive' } },
                                { brand: { contains: query, mode: 'insensitive' } },
                            ],
                        },
                    ],
                },
                take: limit,
                orderBy: [{ isVerified: 'desc' }, { name: 'asc' }],
                select: {
                    id: true,
                    name: true,
                    brand: true,
                    category: true,
                    servingSizeG: true,
                    servingUnit: true,
                    calories: true,
                    allergenFlags: true,
                    dietaryCategory: true,
                    dietaryTags: true,
                    isVerified: true,
                    isBaseIngredient: true,
                },
            });
            // Keep payload tight — the model only needs ID + name + a quick fitness signal.
            return {
                count: items.length,
                items: items.map((i) => ({
                    foodId: i.id,
                    name: i.name,
                    category: i.category,
                    allergenFlags: i.allergenFlags,
                    dietaryCategory: i.dietaryCategory,
                })),
            };
        },
    });

// ─── Tool: create_food_item ──────────────────────────────────────────────────

const FOOD_CATEGORIES = [
    'vegetable',
    'fruit',
    'grain',
    'protein',
    'dairy',
    'fat',
    'beverage',
    'spice',
    'sweet',
    'snack',
    'prepared_meal',
    'other',
] as const;

export const makeCreateFoodItemTool = (ctx: AgentToolContext) =>
    tool({
        description:
            'Create a new FoodItem when search_food_items returns no good match. ' +
            'Provide your best estimate of nutrition per 100g and tag allergens accurately ' +
            '(milk, egg, peanut, tree_nuts, soy, wheat, gluten, fish, shellfish, sesame). ' +
            'The item is auto-flagged as unverified so the dietitian can review later.',
        inputSchema: z.object({
            name: z.string().min(1).max(120).describe('canonical food name, Title Case'),
            category: z.enum(FOOD_CATEGORIES),
            servingSizeG: z.number().positive().max(2000).default(100),
            servingUnit: z
                .enum(['g', 'ml', 'oz', 'cup', 'tbsp', 'tsp', 'piece', 'serving'])
                .default('g'),
            calories: z.number().int().min(0).max(2000).describe('kcal per serving'),
            proteinG: z.number().min(0).max(200).nullable(),
            carbsG: z.number().min(0).max(200).nullable(),
            fatsG: z.number().min(0).max(200).nullable(),
            fiberG: z.number().min(0).max(50).nullable(),
            allergenFlags: z
                .array(z.string())
                .default([])
                .describe('lower-case allergen names: milk, egg, peanut, tree_nuts, soy, wheat, gluten, fish, shellfish, sesame'),
            dietaryTags: z
                .array(z.string())
                .default([])
                .describe('e.g. vegetarian, vegan, gluten_free, low_carb, high_protein'),
        }),
        execute: async (input) => {
            const created = await foodItemService.createFoodItem(
                {
                    name: input.name,
                    category: input.category,
                    servingSizeG: input.servingSizeG,
                    servingUnit: input.servingUnit,
                    calories: input.calories,
                    proteinG: input.proteinG ?? undefined,
                    carbsG: input.carbsG ?? undefined,
                    fatsG: input.fatsG ?? undefined,
                    fiberG: input.fiberG ?? undefined,
                    allergenFlags: input.allergenFlags,
                    dietaryTags: input.dietaryTags,
                    isBaseIngredient: false,
                    ingredientIds: [],
                },
                ctx.orgId,
                ctx.userId,
            );
            ctx.createdFoodIds.add(created.id);
            // Auto-tag in background — non-blocking
            foodTaggingService
                .autoTagFood(created.id)
                .catch((err) =>
                    logger.warn('Auto-tag failed for AI-created food', {
                        foodId: created.id,
                        error: err instanceof Error ? err.message : String(err),
                    }),
                );
            return {
                foodId: created.id,
                name: created.name,
                allergenFlags: created.allergenFlags,
            };
        },
    });

// ─── Tool: validate_food ─────────────────────────────────────────────────────

export const makeValidateFoodTool = (ctx: AgentToolContext) =>
    tool({
        description:
            'Validate a FoodItem against this client\'s restrictions. Returns severity ' +
            '(RED = blocked, YELLOW = warning, GREEN = ok) and the reasons. Use this to ' +
            'avoid putting a hard-blocked food into the draft.',
        inputSchema: z.object({
            foodId: z.string().uuid(),
            mealType: z.enum(['breakfast', 'lunch', 'snack', 'dinner']).default('lunch'),
            dayOfWeek: z
                .enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
                .default('monday'),
        }),
        execute: async ({ foodId, mealType, dayOfWeek }) => {
            try {
                const result = await validationEngine.validate(ctx.clientId, foodId, {
                    currentDay: dayOfWeek,
                    mealType,
                });
                return {
                    severity: result.severity,
                    canAdd: result.canAdd,
                    alerts: result.alerts.map((a) => ({
                        type: a.type,
                        severity: a.severity,
                        message: a.message,
                    })),
                };
            } catch (err) {
                return {
                    severity: ValidationSeverity.YELLOW,
                    canAdd: true,
                    alerts: [{ type: 'preference_match', severity: 'YELLOW', message: 'validation error — proceeding with caution' }],
                    error: err instanceof Error ? err.message : 'unknown',
                };
            }
        },
    });

// ─── Tool: submit_draft (terminal) ───────────────────────────────────────────

export const makeSubmitDraftTool = (ctx: AgentToolContext) =>
    tool({
        description:
            'TERMINAL TOOL — call this exactly ONCE when you have built the complete ' +
            'meal plan draft. Every item must reference a real foodId returned by ' +
            'search_food_items or create_food_item. Quantities must already be in grams.',
        inputSchema: z.object({
            days: z.array(draftDaySchema),
        }),
        execute: async ({ days }) => {
            ctx.draft = { days };
            return { received: true, days: days.length };
        },
    });

// ─── Bundle ──────────────────────────────────────────────────────────────────

export function buildFoodToolset(ctx: AgentToolContext) {
    return {
        get_client_context: makeGetClientContextTool(ctx),
        search_food_items: makeSearchFoodItemsTool(ctx),
        create_food_item: makeCreateFoodItemTool(ctx),
        validate_food: makeValidateFoodTool(ctx),
        submit_draft: makeSubmitDraftTool(ctx),
    };
}
