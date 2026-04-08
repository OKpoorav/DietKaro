'use client';

import { useState, useMemo } from 'react';
import { BookOpen, Loader2, Search, LayoutTemplate } from 'lucide-react';
import type { TemplateData, LocalMeal } from '@/lib/types/diet-plan.types';

export interface MealSlotPreset {
    label: string;
    description: string;
    slots: Pick<LocalMeal, 'name' | 'type' | 'time'>[];
}

export const MEAL_SLOT_PRESETS: MealSlotPreset[] = [
    {
        label: '3 Meals',
        description: 'Breakfast, Lunch, Dinner',
        slots: [
            { name: 'Breakfast', type: 'breakfast', time: '08:00' },
            { name: 'Lunch', type: 'lunch', time: '13:00' },
            { name: 'Dinner', type: 'dinner', time: '19:30' },
        ],
    },
    {
        label: '4 Meals',
        description: 'Breakfast, Lunch, Snack, Dinner',
        slots: [
            { name: 'Breakfast', type: 'breakfast', time: '08:00' },
            { name: 'Lunch', type: 'lunch', time: '13:00' },
            { name: 'Snack', type: 'snack', time: '16:00' },
            { name: 'Dinner', type: 'dinner', time: '19:30' },
        ],
    },
    {
        label: '5 Meals',
        description: 'Breakfast, Mid-morning, Lunch, Snack, Dinner',
        slots: [
            { name: 'Breakfast', type: 'breakfast', time: '08:00' },
            { name: 'Mid-morning', type: 'snack', time: '11:00' },
            { name: 'Lunch', type: 'lunch', time: '13:00' },
            { name: 'Evening Snack', type: 'snack', time: '16:00' },
            { name: 'Dinner', type: 'dinner', time: '19:30' },
        ],
    },
    {
        label: '6 Meals',
        description: 'Breakfast, Mid-morning, Lunch, Snack, Dinner, Post-dinner',
        slots: [
            { name: 'Breakfast', type: 'breakfast', time: '08:00' },
            { name: 'Mid-morning', type: 'snack', time: '11:00' },
            { name: 'Lunch', type: 'lunch', time: '13:00' },
            { name: 'Evening Snack', type: 'snack', time: '16:00' },
            { name: 'Dinner', type: 'dinner', time: '19:30' },
            { name: 'Post-dinner', type: 'snack', time: '21:00' },
        ],
    },
];

interface TemplateSidebarProps {
    templates: TemplateData[];
    applyingTemplateId: string | null;
    onApplyTemplate: (id: string) => void;
    onApplyPreset?: (preset: MealSlotPreset) => void;
}

export function TemplateSidebar({ templates, applyingTemplateId, onApplyTemplate, onApplyPreset }: TemplateSidebarProps) {
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        if (!search.trim()) return templates;
        const q = search.toLowerCase();
        return templates.filter(t => t.name?.toLowerCase().includes(q));
    }, [templates, search]);

    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col h-full min-h-0">
            <h3 className="text-gray-900 font-medium px-4 pt-4 pb-2 flex-shrink-0 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-brand" />
                Templates
            </h3>
            <div className="px-4 pb-2 flex-shrink-0">
                <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search templates..."
                        className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand focus:border-brand outline-none"
                    />
                </div>
            </div>
            <div className="overflow-y-auto px-4 pb-4 pr-3 space-y-2 flex-1 min-h-0">
                {/* Meal Slot Presets */}
                {onApplyPreset && !search.trim() && (
                    <>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-1 flex items-center gap-1.5">
                            <LayoutTemplate className="w-3.5 h-3.5" />
                            Meal Structures
                        </p>
                        {MEAL_SLOT_PRESETS.map((preset) => (
                            <button
                                key={preset.label}
                                onClick={() => onApplyPreset(preset)}
                                className="w-full text-left p-3 rounded-lg border border-dashed border-gray-200 hover:border-brand hover:bg-brand/5 transition-all group"
                            >
                                <span className="font-medium text-gray-800 text-sm group-hover:text-brand">
                                    {preset.label}
                                </span>
                                <p className="text-xs text-gray-500 mt-0.5">{preset.description}</p>
                            </button>
                        ))}
                        {templates.length > 0 && (
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">
                                Saved Templates
                            </p>
                        )}
                    </>
                )}

                {/* Saved Templates */}
                {filtered.length === 0 && (search.trim() || !onApplyPreset) ? (
                    <p className="text-sm text-gray-500 italic text-center py-4">
                        {search.trim() ? 'No matching templates' : 'No templates found'}
                    </p>
                ) : (
                    filtered.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => onApplyTemplate(t.id)}
                            disabled={applyingTemplateId === t.id}
                            className="w-full text-left p-3 rounded-lg border border-gray-100 hover:border-brand hover:bg-brand/5 transition-all group"
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-gray-800 text-sm group-hover:text-brand line-clamp-1">
                                        {t.name}
                                    </span>
                                    {t.templateCategory === 'slot_template' && (
                                        <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full shrink-0">
                                            Slots
                                        </span>
                                    )}
                                </div>
                                {applyingTemplateId === t.id && (
                                    <Loader2 className="w-3 h-3 animate-spin text-brand" />
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                <span>{t.checkInFrequency || 'Flexible'}</span>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
