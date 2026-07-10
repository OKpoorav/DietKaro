'use client';

import { Fragment } from 'react';
import { Clock } from 'lucide-react';
import { timeToMin } from '@/lib/utils/meal-order';
import { formatTime12h } from '@/lib/utils/formatters';

function getMealDate(meal: any, startDate: string): Date {
    if (meal.mealDate) return new Date(meal.mealDate);
    const d = new Date(startDate);
    d.setUTCDate(d.getUTCDate() + (meal.dayOfWeek ?? 0));
    return d;
}

function formatDateKey(d: Date): string {
    return d.toISOString().slice(0, 10);
}

function MealCell({ meal }: { meal: any }) {
    const optionGroups = new Map<number, any[]>();
    (meal.foodItems || []).forEach((fi: any) => {
        const g = fi.optionGroup ?? 0;
        if (!optionGroups.has(g)) optionGroups.set(g, []);
        optionGroups.get(g)!.push(fi);
    });
    const sortedGroups = Array.from(optionGroups.entries()).sort(([a], [b]) => a - b);
    const hasAlts = sortedGroups.length > 1;

    return (
        <div className="min-w-0">
            {meal.timeOfDay && (
                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 inline" /> {formatTime12h(meal.timeOfDay)}
                </p>
            )}
            {meal.description && (
                <p className="text-xs text-gray-500 italic mb-1">{meal.description}</p>
            )}
            {meal.instructions && (
                <p className="text-xs text-gray-400 mb-1 border-l-2 border-gray-200 pl-2">{meal.instructions}</p>
            )}
            {/* Name is already the column header — no need to repeat it */}
            {sortedGroups.map(([groupNum, foods], gIdx) => (
                <div key={groupNum}>
                    {hasAlts && gIdx > 0 && (
                        <p className="text-xs text-gray-300 font-bold my-1">— OR —</p>
                    )}
                    {hasAlts && (
                        <p className="text-xs font-semibold text-brand mb-0.5">
                            {foods[0]?.optionLabel || `Option ${String.fromCharCode(65 + gIdx)}`}
                        </p>
                    )}
                    {foods.map((food: any, fi: number) => (
                        <div key={fi} className="flex justify-between items-baseline gap-2 text-xs text-gray-600">
                            <span className="truncate">{food.foodItem?.name || 'Unknown'}</span>
                            <span className="text-gray-400 whitespace-nowrap shrink-0">{food.notes || `${food.quantityG}g`}</span>
                        </div>
                    ))}
                </div>
            ))}
            {sortedGroups.length === 0 && (
                <p className="text-xs text-gray-300 italic">No items</p>
            )}
        </div>
    );
}

/**
 * Date × meal-name grid for a plan's meals. Columns are derived from meal names
 * (ordered by earliest time-of-day, then authored sequence); rows are dates.
 * Used on the diet-plan detail page and the client profile's Diet Plan tab.
 */
export function MealsSpreadsheet({ meals, startDate, dayNotes }: { meals: any[]; startDate: string; dayNotes?: Record<string, string> | null }) {
    /** Resolve the per-day note for a given date key (YYYY-MM-DD). */
    const noteForDate = (dateKey: string): string | null => {
        if (!dayNotes) return null;
        const start = new Date(startDate);
        start.setUTCHours(0, 0, 0, 0);
        const d = new Date(dateKey + 'T00:00:00Z');
        const idx = Math.round((d.getTime() - start.getTime()) / 86400000);
        if (idx < 0) return null;
        const v = dayNotes[String(idx)];
        return typeof v === 'string' && v.trim() ? v.trim() : null;
    };
    // Build date → mealName → meal[] map, using meal name as the column key
    const dateMap = new Map<string, Map<string, any[]>>();
    const columnSet = new Map<string, { time: string; seq: number }>(); // earliest time + min sequence per column

    for (const meal of meals) {
        const d = getMealDate(meal, startDate);
        const key = formatDateKey(d);
        const colName = (meal.name || meal.mealType || 'Other').trim();
        const colKey = colName.toLowerCase();
        const seq = meal.sequenceNumber ?? Number.MAX_SAFE_INTEGER;

        if (!columnSet.has(colKey)) {
            columnSet.set(colKey, { time: meal.timeOfDay || '99:99', seq });
        } else {
            const info = columnSet.get(colKey)!;
            if (meal.timeOfDay && meal.timeOfDay < info.time) info.time = meal.timeOfDay;
            if (seq < info.seq) info.seq = seq;
        }

        if (!dateMap.has(key)) dateMap.set(key, new Map());
        const nameMap = dateMap.get(key)!;
        if (!nameMap.has(colKey)) nameMap.set(colKey, []);
        nameMap.get(colKey)!.push(meal);
    }

    const sortedDates = Array.from(dateMap.keys()).sort();

    // Chronological column order: earliest time-of-day per column, then authored sequence.
    const columns = Array.from(columnSet.entries())
        .sort(([, aInfo], [, bInfo]) => {
            const t = timeToMin(aInfo.time) - timeToMin(bInfo.time);
            if (t !== 0) return t;
            return aInfo.seq - bInfo.seq;
        })
        .map(([colKey]) => colKey);

    // Build display names (capitalize first letter of each word)
    const columnDisplayNames: Record<string, string> = {};
    for (const meal of meals) {
        const colKey = (meal.name || meal.mealType || 'Other').trim().toLowerCase();
        if (!columnDisplayNames[colKey]) {
            columnDisplayNames[colKey] = (meal.name || meal.mealType || 'Other').trim();
        }
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
                <thead>
                    <tr className="bg-gray-50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-r border-gray-200 w-36 sticky left-0 bg-gray-50 z-10">
                            Date
                        </th>
                        {columns.map(col => (
                            <th key={col} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-r border-gray-200 min-w-[160px]">
                                {columnDisplayNames[col] || col}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {sortedDates.map((dateKey, rowIdx) => {
                        const nameMap = dateMap.get(dateKey)!;
                        const date = new Date(dateKey + 'T00:00:00Z');
                        const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
                        const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
                        const isEven = rowIdx % 2 === 0;
                        const note = noteForDate(dateKey);
                        const totalCols = columns.length + 1;

                        return (
                            <Fragment key={dateKey}>
                                {note && (
                                    <tr className="bg-amber-50">
                                        <td colSpan={totalCols} className="px-4 py-2 border-b border-amber-200 text-xs font-semibold text-amber-800 sticky left-0">
                                            <span className="mr-1.5">★</span>{note}
                                        </td>
                                    </tr>
                                )}
                                <tr className={isEven ? 'bg-white' : 'bg-gray-50/50'}>
                                    <td className={`px-4 py-3 border-b border-r border-gray-200 sticky left-0 z-10 ${isEven ? 'bg-white' : 'bg-gray-50/50'}`}>
                                        <p className="font-semibold text-gray-800 text-sm">{dayLabel}</p>
                                        <p className="text-xs text-gray-400">{dateLabel}</p>
                                    </td>
                                    {columns.map(col => {
                                        const cellMeals = nameMap.get(col) || [];
                                        return (
                                            <td key={col} className="px-4 py-3 border-b border-r border-gray-200 align-top">
                                                {cellMeals.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {cellMeals.map((meal: any, mi: number) => (
                                                            <MealCell key={meal.id || mi} meal={meal} />
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-200 text-xs">—</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            </Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
