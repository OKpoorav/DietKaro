'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { AiDraftItemRow } from './ai-draft-item-row';
import type { MealPlanDraftResult, DraftFoodItem } from '@/lib/hooks/use-ai-meal-plan-draft';

interface AiDraftPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    draft: MealPlanDraftResult | null;
    /** Called with the filtered draft after the dietitian confirms. Only includes checked, non-blocked items. */
    onApply: (filtered: MealPlanDraftResult) => void;
}

/** dayNumber:sequenceNumber:foodId — unique within a draft. */
function itemKey(dayNumber: number, sequenceNumber: number, item: DraftFoodItem) {
    return `${dayNumber}:${sequenceNumber}:${item.foodId}:${item.optionGroup}`;
}

export function AiDraftPreviewModal({ isOpen, onClose, draft, onApply }: AiDraftPreviewModalProps) {
    const [selected, setSelected] = useState<Set<string>>(() => new Set());

    // Reset selection every time the draft changes — pre-check every non-blocked item.
    // useEffect (not in-render) avoids the race where Apply could fire before the
    // selection state had a chance to populate from a freshly-arrived draft.
    useEffect(() => {
        if (!draft) {
            setSelected(new Set());
            return;
        }
        const set = new Set<string>();
        for (const day of draft.days) {
            for (const meal of day.meals) {
                for (const item of meal.items) {
                    if (!item.validation.blocked) {
                        set.add(itemKey(day.dayNumber, meal.sequenceNumber, item));
                    }
                }
            }
        }
        setSelected(set);
    }, [draft]);

    if (!draft) return null;

    const toggle = (key: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const handleApply = () => {
        const filtered: MealPlanDraftResult = {
            ...draft,
            days: draft.days
                .map((day) => ({
                    ...day,
                    meals: day.meals
                        .map((meal) => ({
                            ...meal,
                            items: meal.items.filter((item) =>
                                selected.has(itemKey(day.dayNumber, meal.sequenceNumber, item)),
                            ),
                        }))
                        .filter((meal) => meal.items.length > 0),
                }))
                .filter((day) => day.meals.length > 0),
        };
        onApply(filtered);
    };

    const { summary } = draft;
    const acceptedCount = selected.size;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="AI Draft Preview" size="xl">
            <div className="p-5 space-y-4">
                {/* Summary strip */}
                <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                        {summary.totalItems} item{summary.totalItems === 1 ? '' : 's'} parsed
                    </span>
                    {summary.createdItems > 0 && (
                        <span className="px-2 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                            {summary.createdItems} new food{summary.createdItems === 1 ? '' : 's'} created
                        </span>
                    )}
                    {summary.warningItems > 0 && (
                        <span className="px-2 py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
                            {summary.warningItems} warning{summary.warningItems === 1 ? '' : 's'}
                        </span>
                    )}
                    {summary.blockedItems > 0 && (
                        <span className="px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                            {summary.blockedItems} blocked
                        </span>
                    )}
                </div>

                {/* Blocked list — informational */}
                {draft.blocked.length > 0 && (
                    <div className="rounded-md bg-red-50 border border-red-200 p-3">
                        <p className="text-xs font-semibold text-red-700 mb-1">Blocked due to client restrictions:</p>
                        <ul className="text-xs text-red-600 space-y-0.5">
                            {draft.blocked.map((b, i) => (
                                <li key={i}>
                                    <span className="font-medium">{b.name}</span> — {b.reason}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Days */}
                <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                    {draft.days.map((day) => (
                        <section key={day.dayNumber} className="border border-gray-200 rounded-lg">
                            <header className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                                <h3 className="text-sm font-semibold text-gray-800">Day {day.dayNumber}</h3>
                            </header>
                            <div className="p-3 space-y-3">
                                {day.meals.map((meal) => (
                                    <div key={meal.sequenceNumber}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-semibold text-gray-700 capitalize">
                                                {meal.name || meal.mealType}
                                            </span>
                                            {meal.timeOfDay && (
                                                <span className="text-[11px] text-gray-400">{meal.timeOfDay}</span>
                                            )}
                                        </div>
                                        <ul className="space-y-1">
                                            {meal.items.map((item) => {
                                                const key = itemKey(day.dayNumber, meal.sequenceNumber, item);
                                                return (
                                                    <AiDraftItemRow
                                                        key={key}
                                                        item={item}
                                                        selected={selected.has(key)}
                                                        onToggle={() => toggle(key)}
                                                    />
                                                );
                                            })}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                        {acceptedCount} item{acceptedCount === 1 ? '' : 's'} will be added · this replaces the current builder
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 rounded-md hover:bg-gray-100"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApply}
                            disabled={acceptedCount === 0}
                            className="px-3 py-1.5 text-sm font-medium bg-brand text-white rounded-md hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Apply to builder
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
