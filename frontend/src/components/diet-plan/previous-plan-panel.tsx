'use client';

import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/lib/api/use-api-client';
import { Loader2, CalendarDays } from 'lucide-react';

interface FoodItemData {
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
    meals: PlanMeal[];
}

function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dayKcal(meals: PlanMeal[]): number {
    return meals.reduce((sum, m) =>
        sum + m.foodItems.reduce((s, fi) => s + (fi.foodItem.calories * fi.quantityG) / 100, 0), 0);
}

interface PreviousPlanPanelProps {
    clientId: string;
    excludePlanId?: string;
}

export function PreviousPlanPanel({ clientId, excludePlanId }: PreviousPlanPanelProps) {
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
    // Use a string key so both types sort correctly
    const dayMap = new Map<string, PlanMeal[]>();
    plan.meals.forEach(m => {
        const key = m.mealDate
            ? m.mealDate.slice(0, 10)                          // "YYYY-MM-DD"
            : String(m.dayOfWeek ?? 0).padStart(3, '0');       // "000", "001", ...
        if (!dayMap.has(key)) dayMap.set(key, []);
        dayMap.get(key)!.push(m);
    });
    const days = Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(0, 3);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Plan header */}
            <div className="px-3 py-2 border-b border-gray-100 flex-shrink-0 bg-gray-50">
                <p className="text-xs font-semibold text-gray-800 truncate">{plan.name}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                    {fmtDate(plan.startDate)}{plan.endDate ? ` → ${fmtDate(plan.endDate)}` : ''} · first 3 days
                </p>
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
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function DayCard({ dayKey, dayNumber, meals }: { dayKey: string; dayNumber: number; meals: PlanMeal[] }) {
    // dayKey is either "YYYY-MM-DD" (date-based) or "000"/"001" (index-based)
    const isDate = /^\d{4}-\d{2}-\d{2}$/.test(dayKey);
    const label = isDate
        ? new Date(dayKey + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        : `Day ${parseInt(dayKey, 10) + 1}`;
    const totalKcal = dayKcal(meals);

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">Day {dayNumber} · {label}</span>
                <span className="text-[10px] text-gray-400 font-medium">{Math.round(totalKcal)} kcal</span>
            </div>
            <div className="divide-y divide-gray-50">
                {[...meals].sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0)).map(meal => (
                    <MealRow key={meal.id} meal={meal} />
                ))}
            </div>
        </div>
    );
}

function MealRow({ meal }: { meal: PlanMeal }) {
    const kcal = meal.foodItems.reduce((s, fi) => s + (fi.foodItem.calories * fi.quantityG) / 100, 0);
    return (
        <div className="px-3 py-2">
            <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs font-semibold text-gray-800">{meal.name}</span>
                <span className="text-[10px] text-gray-400 ml-2 flex-shrink-0">{Math.round(kcal)} kcal</span>
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
