'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { BookOpen, Loader2, Search, LayoutTemplate, Pin } from 'lucide-react';
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

const PINS_KEY = 'meal-structure-pins';

function loadPins(): Set<string> {
    try {
        const raw = localStorage.getItem(PINS_KEY);
        return new Set(raw ? JSON.parse(raw) : []);
    } catch {
        return new Set();
    }
}

function savePins(pins: Set<string>) {
    try {
        localStorage.setItem(PINS_KEY, JSON.stringify(Array.from(pins)));
    } catch { /* ignore */ }
}

function PresetCard({ preset, isPinned, onApply, onTogglePin }: {
    preset: MealSlotPreset;
    isPinned: boolean;
    onApply: () => void;
    onTogglePin: (e: React.MouseEvent) => void;
}) {
    const [hovered, setHovered] = useState(false);
    return (
        <div className="relative"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <button
                onClick={onApply}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                    isPinned
                        ? 'border-brand/40 bg-brand/5'
                        : 'border-dashed border-gray-200 hover:border-brand hover:bg-brand/5'
                }`}
            >
                <span className={`font-medium text-sm ${isPinned ? 'text-brand' : 'text-gray-800'}`}>
                    {preset.label}
                </span>
                <p className="text-xs text-gray-500 mt-0.5 pr-5">{preset.description}</p>
            </button>
            {(hovered || isPinned) && (
                <button
                    onClick={onTogglePin}
                    title={isPinned ? 'Unpin' : 'Pin to top'}
                    className={`absolute top-2.5 right-2 p-0.5 rounded transition-colors ${isPinned ? 'text-brand' : 'text-gray-400 hover:text-brand'}`}
                >
                    <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} />
                </button>
            )}
        </div>
    );
}

function SlotTemplateCard({ t, isPinned, applyingTemplateId, onApply, onTogglePin }: {
    t: TemplateData;
    isPinned: boolean;
    applyingTemplateId: string | null;
    onApply: () => void;
    onTogglePin: (e: React.MouseEvent) => void;
}) {
    const [hovered, setHovered] = useState(false);
    return (
        <div className="relative"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <button
                onClick={onApply}
                disabled={applyingTemplateId === t.id}
                className={`w-full text-left p-3 rounded-lg border border-dashed transition-all ${
                    isPinned ? 'border-brand/40 bg-brand/5' : 'border-gray-200 hover:border-brand hover:bg-brand/5'
                }`}
            >
                <div className="flex justify-between items-start pr-5">
                    <span className={`font-medium text-sm line-clamp-1 ${isPinned ? 'text-brand' : 'text-gray-800'}`}>{t.name}</span>
                    {applyingTemplateId === t.id && <Loader2 className="w-3 h-3 animate-spin text-brand flex-shrink-0" />}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Saved structure</p>
            </button>
            {(hovered || isPinned) && (
                <button
                    onClick={onTogglePin}
                    title={isPinned ? 'Unpin' : 'Pin to top'}
                    className={`absolute top-2.5 right-2 p-0.5 rounded transition-colors ${isPinned ? 'text-brand' : 'text-gray-400 hover:text-brand'}`}
                >
                    <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} />
                </button>
            )}
        </div>
    );
}

interface TemplateSidebarProps {
    templates: TemplateData[];
    applyingTemplateId: string | null;
    onApplyTemplate: (id: string) => void;
    onApplyPreset?: (preset: MealSlotPreset) => void;
}

function TemplateCard({ t, applyingTemplateId, onApplyTemplate }: {
    t: TemplateData;
    applyingTemplateId: string | null;
    onApplyTemplate: (id: string) => void;
}) {
    return (
        <button
            onClick={() => onApplyTemplate(t.id)}
            disabled={applyingTemplateId === t.id}
            className="w-full text-left p-3 rounded-lg border border-gray-100 hover:border-brand hover:bg-brand/5 transition-all group"
        >
            <div className="flex justify-between items-start">
                <span className="font-medium text-gray-800 text-sm group-hover:text-brand line-clamp-1">{t.name}</span>
                {applyingTemplateId === t.id && <Loader2 className="w-3 h-3 animate-spin text-brand" />}
            </div>
            <div className="mt-1 text-xs text-gray-500">
                {t.checkInFrequency || 'Flexible'}
            </div>
        </button>
    );
}

export function TemplateSidebar({ templates, applyingTemplateId, onApplyTemplate, onApplyPreset }: TemplateSidebarProps) {
    const [search, setSearch] = useState('');
    const [pins, setPins] = useState<Set<string>>(new Set());

    // Load pins from localStorage on mount (client-only)
    useEffect(() => {
        setPins(loadPins());
    }, []);

    const togglePin = useCallback((label: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setPins(prev => {
            const next = new Set(prev);
            if (next.has(label)) next.delete(label);
            else next.add(label);
            savePins(next);
            return next;
        });
    }, []);

    const q = search.trim().toLowerCase();

    // Filter & sort meal structures: pinned first, then by original order
    const filteredPresets = useMemo(() => {
        const list = q
            ? MEAL_SLOT_PRESETS.filter(p =>
                p.label.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
            )
            : MEAL_SLOT_PRESETS;
        return list.slice().sort((a, b) => {
            const ap = pins.has(a.label) ? 0 : 1;
            const bp = pins.has(b.label) ? 0 : 1;
            return ap - bp;
        });
    }, [q, pins]);

    const { slotTemplates, userTemplates, masterTemplates } = useMemo(() => {
        const list = q ? templates.filter(t => t.name?.toLowerCase().includes(q)) : templates;
        const slots = list.filter(t => t.templateCategory === 'slot_template');
        slots.sort((a, b) => (pins.has(a.id) ? 0 : 1) - (pins.has(b.id) ? 0 : 1));
        return {
            slotTemplates: slots,
            userTemplates: list.filter(t => t.visibility !== 'public' && t.templateCategory !== 'slot_template'),
            masterTemplates: list.filter(t => t.visibility === 'public'),
        };
    }, [templates, q, pins]);

    const showPresets = (onApplyPreset && filteredPresets.length > 0) || slotTemplates.length > 0;
    const showTemplates = userTemplates.length > 0 || masterTemplates.length > 0;

    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col h-full min-h-0">
            <h3 className="text-gray-900 font-medium px-4 pt-4 pb-2 flex-shrink-0 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-brand" />
                Structures & Templates
            </h3>
            <div className="px-4 pb-2 flex-shrink-0">
                <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search meal structures & templates..."
                        className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand focus:border-brand outline-none"
                    />
                </div>
            </div>

            <div className="overflow-y-auto px-4 pb-4 pr-3 space-y-2 flex-1 min-h-0">

                {/* ── Meal Structures ── */}
                {showPresets && (
                    <>
                        <div className="flex items-center gap-1.5 pt-1">
                            <LayoutTemplate className="w-3.5 h-3.5 text-brand" />
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Meal Structures</span>
                        </div>
                        <p className="text-[11px] text-gray-400 -mt-1">Applies slot layout to all days — keeps your day count</p>
                        {onApplyPreset && filteredPresets.map((preset) => (
                            <PresetCard
                                key={preset.label}
                                preset={preset}
                                isPinned={pins.has(preset.label)}
                                onApply={() => onApplyPreset(preset)}
                                onTogglePin={(e) => togglePin(preset.label, e)}
                            />
                        ))}
                        {slotTemplates.map((t) => (
                            <SlotTemplateCard
                                key={t.id}
                                t={t}
                                isPinned={pins.has(t.id)}
                                applyingTemplateId={applyingTemplateId}
                                onApply={() => onApplyTemplate(t.id)}
                                onTogglePin={(e) => togglePin(t.id, e)}
                            />
                        ))}
                    </>
                )}

                {/* ── Full Templates ── */}
                {showTemplates && (
                    <>
                        <div className={`flex items-center gap-1.5 ${showPresets ? 'pt-3 border-t border-gray-100 mt-1' : 'pt-1'}`}>
                            <BookOpen className="w-3.5 h-3.5 text-brand" />
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Templates</span>
                        </div>
                        <p className="text-[11px] text-gray-400 -mt-1">Replaces all days and meals with the template</p>

                        {userTemplates.length > 0 && (
                            <>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-1">My Templates</p>
                                {userTemplates.map((t) => (
                                    <TemplateCard key={t.id} t={t} applyingTemplateId={applyingTemplateId} onApplyTemplate={onApplyTemplate} />
                                ))}
                            </>
                        )}
                        {masterTemplates.length > 0 && (
                            <>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-1">Master Templates</p>
                                {masterTemplates.map((t) => (
                                    <TemplateCard key={t.id} t={t} applyingTemplateId={applyingTemplateId} onApplyTemplate={onApplyTemplate} />
                                ))}
                            </>
                        )}
                    </>
                )}

                {!showPresets && !showTemplates && q && (
                    <p className="text-sm text-gray-500 italic text-center py-4">No matching results</p>
                )}
            </div>
        </div>
    );
}
