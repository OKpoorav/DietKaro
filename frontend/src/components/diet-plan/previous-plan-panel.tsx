'use client';

import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/lib/api/use-api-client';
import { Loader2, CalendarDays, Copy, ClipboardCopy } from 'lucide-react';
import type { LocalMeal, LocalFoodItem } from '@/lib/types/diet-plan.types';

interface FoodItemData {
    id: string;
    name: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatsG: number;
}

interface MealFoodItem {
    id: string;
    quantityG: number;
    notes?: string | null;
    foodItem: FoodItemData;
}

interface PlanMeal {
    id: string;
    name: string;
    mealType: string;
    timeOfDay: string | null;
    dayOfWeek: number | null;
    mealDate: string | null;
    sequenceNumber: number | null;
    foodItems: MealFoodItem[];
}

interface PreviousPlanData {
    id: string;
    name: string;
    startDate: string;
    endDate: string | null;
    status: string;
    notesForClient: string | null;
    meals: PlanMeal[];
}

function makeId() {
    return Math.random().toString(36).substr(2, 9);
}

function planMealToLocalMeal(meal: PlanMeal): LocalMeal {
    return {
        id: makeId(),
        name: meal.name || (meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1)),
        type: meal.mealType as LocalMeal['type'],
        time: meal.timeOfDay || '',
        foods: meal.foodItems.map((fi): LocalFoodItem => ({
            id: fi.foodItem.id,
            tempId: makeId(),
            name: fi.foodItem.name,
            quantity: fi.notes || `${fi.quantityG}g`,
            quantityValue: fi.quantityG,
            calories: fi.foodItem.calories,
            protein: fi.foodItem.proteinG,
            carbs: fi.foodItem.carbsG,
            fat: fi.foodItem.fatsG,
            hasWarning: false,
            optionGroup: 0,
        })),
    };
}

function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dayKcal(meals: PlanMeal[]): number {
    return meals.reduce((sum, m) =>
        sum + m.foodItems.reduce((s, fi) => s + (fi.foodItem.calories * fi.quantityG) / 100, 0), 0);
}

export interface PreviousPlanCopyCallbacks {
    onCopyMeal: (meal: LocalMeal) => void;
    onCopyDay: (meals: LocalMeal[]) => void;
    onCopyEntirePlan: (daysByIndex: Record<number, LocalMeal[]>, planName: string, generalGuidelines?: string) => void;
}

interface PreviousPlanPanelProps {
    clientId: string;
    excludePlanId?: string;
    copyCallbacks?: PreviousPlanCopyCallbacks;
}

export function PreviousPlanPanel({ clientId, excludePlanId, copyCallbacks }: PreviousPlanPanelProps) {
    const api = useApiClient();

    const { data: plan, isLoading } = useQuery<PreviousPlanData | null>({
        queryKey: ['diet-plans', 'previous', clientId, excludePlanId],
        queryFn: async () => {
            const params: Record<string, string> = {};
            if (excludePlanId) params.excludeId = excludePlanId;
            const { data } = await api.get(`/diet-plans/client/${clientId}/previous`, { params });
            return data.data ?? null;
        },
        enabled: !!clientId,
        staleTime: 60_000,
    });

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!plan) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <CalendarDays className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No previous plan</p>
            </div>
        );
    }

    // Group by mealDate (date-based plans) or dayOfWeek (template-based plans)
    const dayMap = new Map<string, PlanMeal[]>();
    plan.meals.forEach(m => {
        const key = m.mealDate
            ? m.mealDate.slice(0, 10)
            : String(m.dayOfWeek ?? 0).padStart(3, '0');
        if (!dayMap.has(key)) dayMap.set(key, []);
        dayMap.get(key)!.push(m);
    });
    const days = Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(0, 3);

    const handleCopyEntirePlan = () => {
        if (!copyCallbacks) return;
        const allDays = Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        const daysByIndex: Record<number, LocalMeal[]> = {};
        allDays.forEach(([, meals], i) => {
            daysByIndex[i] = meals
                .sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0))
                .map(planMealToLocalMeal);
        });
        copyCallbacks.onCopyEntirePlan(daysByIndex, plan.name, plan.notesForClient ?? undefined);
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Plan header */}
            <div className="px-3 py-2 border-b border-gray-100 flex-shrink-0 bg-gray-50">
                <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-800 truncate">{plan.name}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                            {fmtDate(plan.startDate)}{plan.endDate ? ` → ${fmtDate(plan.endDate)}` : ''} · first 3 days
                        </p>
                    </div>
                    {copyCallbacks && (
                        <button
                            onClick={handleCopyEntirePlan}
                            title="Copy entire plan (replaces current)"
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-brand bg-brand/5 hover:bg-brand/10 border border-brand/20 rounded-md transition-colors flex-shrink-0"
                        >
                            <ClipboardCopy className="w-3 h-3" />
                            Copy Plan
                        </button>
                    )}
                </div>
            </div>

            <div className="overflow-y-auto flex-1 p-2 space-y-2">
                {days.length === 0 ? (
                    <p className="text-xs text-gray-400 italic text-center pt-6">No meals recorded</p>
                ) : (
                    days.map(([dayKey, meals], i) => (
                        <DayCard
                            key={dayKey}
                            dayKey={dayKey}
                            dayNumber={i + 1}
                            meals={meals}
                            copyCallbacks={copyCallbacks}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function DayCard({ dayKey, dayNumber, meals, copyCallbacks }: {
    dayKey: string;
    dayNumber: number;
    meals: PlanMeal[];
    copyCallbacks?: PreviousPlanCopyCallbacks;
}) {
    const isDate = /^\d{4}-\d{2}-\d{2}$/.test(dayKey);
    const label = isDate
        ? new Date(dayKey + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        : `Day ${parseInt(dayKey, 10) + 1}`;
    const totalKcal = dayKcal(meals);

    const handleCopyDay = () => {
        if (!copyCallbacks) return;
        const localMeals = [...meals]
            .sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0))
            .map(planMealToLocalMeal);
        copyCallbacks.onCopyDay(localMeals);
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">Day {dayNumber} · {label}</span>
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400 font-medium">{Math.round(totalKcal)} kcal</span>
                    {copyCallbacks && (
                        <button
                            onClick={handleCopyDay}
                            title="Copy this day"
                            className="p-0.5 rounded text-gray-400 hover:text-brand hover:bg-brand/5 transition-colors"
                        >
                            <Copy className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>
            <div className="divide-y divide-gray-50">
                {[...meals].sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0)).map(meal => (
                    <MealRow key={meal.id} meal={meal} copyCallbacks={copyCallbacks} />
                ))}
            </div>
        </div>
    );
}

function MealRow({ meal, copyCallbacks }: { meal: PlanMeal; copyCallbacks?: PreviousPlanCopyCallbacks }) {
    const kcal = meal.foodItems.reduce((s, fi) => s + (fi.foodItem.calories * fi.quantityG) / 100, 0);

    const handleCopyMeal = () => {
        if (!copyCallbacks) return;
        copyCallbacks.onCopyMeal(planMealToLocalMeal(meal));
    };

    return (
        <div className="px-3 py-2">
            <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs font-semibold text-gray-800">{meal.name}</span>
                <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                    <span className="text-[10px] text-gray-400">{Math.round(kcal)} kcal</span>
                    {copyCallbacks && (
                        <button
                            onClick={handleCopyMeal}
                            title="Copy this meal"
                            className="p-0.5 rounded text-gray-400 hover:text-brand hover:bg-brand/5 transition-colors"
                        >
                            <Copy className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>
            {meal.foodItems.length > 0 ? (
                <ul className="space-y-0.5">
                    {meal.foodItems.map(fi => (
                        <li key={fi.id} className="flex items-baseline justify-between text-[10px] text-gray-500">
                            <span className="truncate pr-2">{fi.foodItem.name}</span>
                            <span className="flex-shrink-0 text-gray-400">{fi.notes || `${fi.quantityG}g`}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-[10px] text-gray-400 italic">No foods</p>
            )}
        </div>
    );
}
