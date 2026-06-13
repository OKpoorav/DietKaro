'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Modal } from '@/components/ui/modal';
import { Calendar, AlertTriangle, Clock, Utensils, Loader2, Pin, Search } from 'lucide-react';
import { useClientActiveRange, ClientPlanRange } from '@/lib/hooks/use-diet-plans';
import type { TemplateData } from '@/lib/types/diet-plan.types';

// Shared with template-sidebar — same key keeps pins in sync
const PINS_KEY = 'meal-structure-pins';

function loadPins(): Set<string> {
    try {
        const raw = localStorage.getItem(PINS_KEY);
        return new Set(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
}

function savePins(pins: Set<string>) {
    try { localStorage.setItem(PINS_KEY, JSON.stringify(Array.from(pins))); } catch { /* ignore */ }
}

function autoGeneratePlanName(clientName: string, startDate: Date, endDate: Date): string {
    const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${clientName}'s Plan – ${startStr} to ${endStr}`;
}

const BUILT_IN_OPTIONS = [
    { label: '3 Meals', count: 3, description: 'Breakfast, Lunch, Dinner' },
    { label: '4 Meals', count: 4, description: 'Breakfast, Lunch, Snack, Dinner' },
    { label: '5 Meals', count: 5, description: 'Breakfast, Mid-morning, Lunch, Snack, Dinner' },
    { label: '6 Meals', count: 6, description: 'Breakfast, Mid-morning, Lunch, Snack, Dinner, Post-dinner' },
];

const BLANK_OPTION = { label: 'Blank', count: 0, description: 'Start from scratch — add meals manually or use AI Draft' };

export interface PlanSetupResult {
    planName: string;
    startDate: Date;
    numDays: number;
    mealCount: number;
    overlapStrategy: 'overwrite' | 'end_previous' | 'update';
    overlappingPlanIds?: string[];
    slotTemplateId?: string;
    applyTemplateId?: string;
}

interface PlanSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientId: string;
    clientName: string;
    slotTemplates?: TemplateData[];
    fullTemplates?: TemplateData[];
    onConfirm: (result: PlanSetupResult) => void;
    /** When true, skips the meal-slot selection step and goes straight to plan details */
    skipSlotSelection?: boolean;
    /** Pre-fill the plan name input */
    defaultPlanName?: string;
}

function formatDate(d: Date) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toDateInputValue(d: Date) {
    return d.toISOString().split('T')[0];
}

function datesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
    return aStart <= bEnd && bStart <= aEnd;
}

export function PlanSetupModal({ isOpen, onClose, clientId, clientName, slotTemplates = [], fullTemplates = [], onConfirm, skipSlotSelection, defaultPlanName }: PlanSetupModalProps) {
    const { data: existingPlans, isLoading } = useClientActiveRange(clientId);

    const smartStartDate = useMemo(() => {
        if (!existingPlans?.length) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            return tomorrow;
        }
        const latestEnd = existingPlans.reduce((latest, p) => {
            if (!p.endDate) return latest;
            const d = new Date(p.endDate);
            return d > latest ? d : latest;
        }, new Date());
        const dayAfter = new Date(latestEnd);
        dayAfter.setDate(dayAfter.getDate() + 1);
        return dayAfter;
    }, [existingPlans]);

    // Step 1 state
    const [pins, setPins] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState('');
    const [selectedSlotTemplateId, setSelectedSlotTemplateId] = useState<string | null>(null);
    const [selectedApplyTemplateId, setSelectedApplyTemplateId] = useState<string | null>(null);

    useEffect(() => { setPins(loadPins()); }, []);

    const togglePin = useCallback((key: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setPins(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            savePins(next);
            return next;
        });
    }, []);

    const q = search.trim().toLowerCase();

    const filteredBuiltIn = useMemo(() => {
        const list = q ? BUILT_IN_OPTIONS.filter(o => o.label.toLowerCase().includes(q) || o.description.toLowerCase().includes(q)) : BUILT_IN_OPTIONS;
        return list.slice().sort((a, b) => (pins.has(a.label) ? 0 : 1) - (pins.has(b.label) ? 0 : 1));
    }, [q, pins]);

    const filteredSlotTemplates = useMemo(() => {
        const list = q ? slotTemplates.filter(t => t.name?.toLowerCase().includes(q)) : slotTemplates;
        return list.slice().sort((a, b) => (pins.has(a.id) ? 0 : 1) - (pins.has(b.id) ? 0 : 1));
    }, [q, slotTemplates, pins]);

    const filteredFullTemplates = useMemo(() => {
        const list = q ? fullTemplates.filter(t => t.name?.toLowerCase().includes(q)) : fullTemplates;
        return list.slice().sort((a, b) => (pins.has(a.id) ? 0 : 1) - (pins.has(b.id) ? 0 : 1));
    }, [q, fullTemplates, pins]);

    // Step 2 state
    const [mealCount, setMealCount] = useState<number | null>(skipSlotSelection ? 3 : null);
    const [planName, setPlanName] = useState('');
    const [planNameError, setPlanNameError] = useState('');
    const nameManuallyEdited = useRef(false);
    const [startDateStr, setStartDateStr] = useState('');
    const [numDays, setNumDays] = useState(3);
    const [overlapStrategy, setOverlapStrategy] = useState<'overwrite' | 'end_previous' | 'update'>('end_previous');

    const startDate = startDateStr ? new Date(startDateStr + 'T00:00:00') : smartStartDate;
    const endDate = useMemo(() => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + numDays - 1);
        return d;
    }, [startDate, numDays]);

    // Auto-generate plan name from client + dates; stops updating once user manually edits
    useEffect(() => {
        if (nameManuallyEdited.current) return;
        setPlanName(autoGeneratePlanName(clientName, startDate, endDate));
    }, [clientName, startDate, endDate]);

    const overlappingPlans = useMemo(() => {
        if (!existingPlans?.length) return [];
        return existingPlans.filter(p => {
            const pStart = new Date(p.startDate);
            const pEnd = p.endDate ? new Date(p.endDate) : pStart;
            return datesOverlap(startDate, endDate, pStart, pEnd);
        });
    }, [existingPlans, startDate, endDate]);

    const hasOverlap = overlappingPlans.length > 0;

    const selectOption = (count: number, slotTemplateId?: string) => {
        setMealCount(count);
        setSelectedSlotTemplateId(slotTemplateId || null);
        setSelectedApplyTemplateId(null);
        setSearch('');
    };

    const selectFullTemplate = (t: TemplateData) => {
        setMealCount(t.mealCount ?? 3);
        setSelectedApplyTemplateId(t.id);
        setSelectedSlotTemplateId(null);
        setSearch('');
    };

    const handleConfirm = () => {
        if (!planName.trim()) { setPlanNameError('Plan name is required'); return; }
        onConfirm({
            planName,
            startDate,
            numDays,
            mealCount: mealCount ?? 3,
            overlapStrategy: hasOverlap ? overlapStrategy : 'overwrite',
            overlappingPlanIds: hasOverlap ? overlappingPlans.map(p => p.id) : undefined,
            slotTemplateId: selectedSlotTemplateId || undefined,
            applyTemplateId: selectedApplyTemplateId || undefined,
        });
    };

    // Step 1 — meal structure selection
    if (mealCount === null) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Plan Setup" size="md">
                <div className="p-5 space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand font-semibold">
                            {clientName.charAt(0)}
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">{clientName}</p>
                            <p className="text-xs text-gray-500">Choose a template or meal structure</p>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search templates & meal slots..."
                            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand focus:border-brand outline-none"
                        />
                    </div>

                    {/* All options — flat list, tagged; scrollable after ~5 items */}
                    {(filteredFullTemplates.length > 0 || filteredBuiltIn.length > 0 || filteredSlotTemplates.length > 0) && (
                        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                            {/* Blank / Start-from-scratch — always shown unless search hides it */}
                            {(!q || BLANK_OPTION.label.toLowerCase().includes(q) || BLANK_OPTION.description.toLowerCase().includes(q)) && (
                                <BlankCard onSelect={() => selectOption(0)} />
                            )}
                            {filteredFullTemplates.map(t => {
                                const isPinned = pins.has(t.id);
                                return (
                                    <TemplateCard
                                        key={t.id}
                                        template={t}
                                        isPinned={isPinned}
                                        onSelect={() => selectFullTemplate(t)}
                                        onTogglePin={(e) => togglePin(t.id, e)}
                                    />
                                );
                            })}
                            {filteredBuiltIn.map(opt => {
                                const isPinned = pins.has(opt.label);
                                return (
                                    <BuiltInCard
                                        key={opt.label}
                                        opt={opt}
                                        isPinned={isPinned}
                                        onSelect={() => selectOption(opt.count)}
                                        onTogglePin={(e) => togglePin(opt.label, e)}
                                    />
                                );
                            })}
                            {filteredSlotTemplates.map(t => {
                                const isPinned = pins.has(t.id);
                                return (
                                    <SavedStructureCard
                                        key={t.id}
                                        template={t}
                                        isPinned={isPinned}
                                        onSelect={() => selectOption(t.mealCount ?? 3, t.id)}
                                        onTogglePin={(e) => togglePin(t.id, e)}
                                    />
                                );
                            })}
                        </div>
                    )}

                    {filteredFullTemplates.length === 0 && filteredBuiltIn.length === 0 && filteredSlotTemplates.length === 0 && (
                        <p className="text-sm text-gray-500 italic text-center py-4">No matching templates or structures</p>
                    )}

                    <div className="flex justify-end pt-1">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
                    </div>
                </div>
            </Modal>
        );
    }

    // Step 2 — plan details
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Plan Setup" size="md">
            <div className="p-5 space-y-5">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand font-semibold">
                        {clientName.charAt(0)}
                    </div>
                    <div className="flex-1">
                        <p className="font-semibold text-gray-900">{clientName}</p>
                        <p className="text-xs text-gray-500">Setting up new diet plan</p>
                    </div>
                    <button onClick={() => { setMealCount(null); setSelectedApplyTemplateId(null); setSelectedSlotTemplateId(null); }}
                        className="flex items-center gap-1 text-xs text-brand hover:underline">
                        <Utensils className="w-3.5 h-3.5" />
                        {selectedApplyTemplateId
                            ? fullTemplates.find(t => t.id === selectedApplyTemplateId)?.name || 'Full Template'
                            : selectedSlotTemplateId
                                ? slotTemplates.find(t => t.id === selectedSlotTemplateId)?.name || 'Saved'
                                : mealCount === 0 ? 'Blank' : `${mealCount} meals/day`}
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />Loading existing plans...
                    </div>
                ) : existingPlans && existingPlans.length > 0 ? (
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700">Current Plans</p>
                        {existingPlans.map(p => <PlanRangeCard key={p.id} plan={p} />)}
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 italic">No existing plans for this client.</p>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <Calendar className="w-3.5 h-3.5 inline mr-1" />Start Date
                        </label>
                        <input
                            type="date"
                            value={startDateStr || toDateInputValue(smartStartDate)}
                            onChange={e => setStartDateStr(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <Clock className="w-3.5 h-3.5 inline mr-1" />Duration
                        </label>
                        <select
                            value={numDays}
                            onChange={e => setNumDays(parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none bg-white"
                        >
                            {[1, 2, 3, 4, 5, 6, 7, 14, 21, 28, 30].map(d => (
                                <option key={d} value={d}>
                                    {d === 1 ? '1 day' : d <= 7 ? `${d} days` : d === 14 ? '14 days (2 weeks)' : d === 21 ? '21 days (3 weeks)' : '30 days (4 weeks)'}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <p className="text-xs text-gray-500">
                    Plan period: <span className="font-medium text-gray-700">{formatDate(startDate)}</span>
                    {' → '}
                    <span className="font-medium text-gray-700">{formatDate(endDate)}</span>
                </p>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        value={planName}
                        onChange={e => {
                            nameManuallyEdited.current = true;
                            setPlanName(e.target.value);
                            setPlanNameError('');
                        }}
                        className={`w-full px-3 py-2 border rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none ${planNameError ? 'border-red-400' : 'border-gray-300'}`}
                        placeholder="e.g. Weight Loss Week 4"
                    />
                    {planNameError && <p className="mt-1 text-xs text-red-500">{planNameError}</p>}
                </div>

                {hasOverlap && (
                    <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-amber-800">Date Overlap Detected</p>
                                <p className="text-xs text-amber-700 mt-0.5">
                                    Overlaps with: {Array.from(new Set(overlappingPlans.map(p => p.name))).map(n => `"${n}"`).join(', ')}
                                </p>
                            </div>
                        </div>
                        <div className="space-y-2 ml-6">
                            {([
                                { value: 'end_previous', label: 'End previous plan early', desc: 'Previous plan ends the day before this one starts' },
                                { value: 'overwrite', label: 'Overwrite overlapping days', desc: 'Deactivate old plan, pending logs removed' },
                                { value: 'update', label: 'Update existing plan', desc: 'Copy overlapping days\' meals into new plan' },
                            ] as const).map(opt => (
                                <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                                    <input type="radio" name="overlap" value={opt.value}
                                        checked={overlapStrategy === opt.value}
                                        onChange={() => setOverlapStrategy(opt.value)}
                                        className="mt-0.5 accent-brand" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                                        <p className="text-xs text-gray-500">{opt.desc}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
                    <button onClick={handleConfirm} disabled={!planName.trim()}
                        className="px-5 py-2 text-sm font-medium text-white bg-brand hover:bg-brand/90 rounded-lg transition-colors disabled:opacity-50">
                        Start Building
                    </button>
                </div>
            </div>
        </Modal>
    );
}

function Badge({ label, variant }: { label: string; variant: 'full' | 'slot' }) {
    return (
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
            variant === 'full'
                ? 'bg-brand/10 text-brand'
                : 'bg-gray-100 text-gray-500'
        }`}>
            {label}
        </span>
    );
}

function TemplateCard({ template, isPinned, onSelect, onTogglePin }: {
    template: TemplateData;
    isPinned: boolean;
    onSelect: () => void;
    onTogglePin: (e: React.MouseEvent) => void;
}) {
    const [hovered, setHovered] = useState(false);
    return (
        <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
            <button onClick={onSelect}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all ${isPinned ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-brand hover:bg-brand/5'}`}>
                <div className="flex items-center gap-2 pr-5">
                    <Utensils className={`w-4 h-4 flex-shrink-0 ${isPinned ? 'text-brand' : 'text-gray-400'}`} />
                    <span className={`text-sm font-semibold truncate ${isPinned ? 'text-brand' : 'text-gray-900'}`}>{template.name}</span>
                    <Badge label="Full Template" variant="full" />
                </div>
                <p className="text-xs text-gray-400 mt-0.5 ml-6">
                    {template.day0MealNames?.join(', ') || `${template.numDays ?? 7} days · ${template.mealCount ?? 3} meals/day`}
                </p>
            </button>
            {(hovered || isPinned) && (
                <button onClick={onTogglePin} title={isPinned ? 'Unpin' : 'Pin'}
                    className={`absolute top-2.5 right-2 p-0.5 rounded transition-colors ${isPinned ? 'text-brand' : 'text-gray-300 hover:text-brand'}`}>
                    <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} />
                </button>
            )}
        </div>
    );
}

function BuiltInCard({ opt, isPinned, onSelect, onTogglePin }: {
    opt: typeof BUILT_IN_OPTIONS[0];
    isPinned: boolean;
    onSelect: () => void;
    onTogglePin: (e: React.MouseEvent) => void;
}) {
    const [hovered, setHovered] = useState(false);
    return (
        <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
            <button onClick={onSelect}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all ${isPinned ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-brand hover:bg-brand/5'}`}>
                <div className="flex items-center gap-2 pr-5">
                    <Utensils className={`w-4 h-4 flex-shrink-0 ${isPinned ? 'text-brand' : 'text-gray-400'}`} />
                    <span className={`text-sm font-semibold ${isPinned ? 'text-brand' : 'text-gray-900'}`}>{opt.label}</span>
                    <Badge label="Meal Slots" variant="slot" />
                </div>
                <p className="text-xs text-gray-400 mt-0.5 ml-6">{opt.description}</p>
            </button>
            {(hovered || isPinned) && (
                <button onClick={onTogglePin} title={isPinned ? 'Unpin' : 'Pin as default'}
                    className={`absolute top-2.5 right-2 p-0.5 rounded transition-colors ${isPinned ? 'text-brand' : 'text-gray-300 hover:text-brand'}`}>
                    <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} />
                </button>
            )}
        </div>
    );
}

function SavedStructureCard({ template, isPinned, onSelect, onTogglePin }: {
    template: TemplateData;
    isPinned: boolean;
    onSelect: () => void;
    onTogglePin: (e: React.MouseEvent) => void;
}) {
    const [hovered, setHovered] = useState(false);
    return (
        <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
            <button onClick={onSelect}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all ${isPinned ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-brand hover:bg-brand/5'}`}>
                <div className="flex items-center gap-2 pr-5">
                    <Utensils className={`w-4 h-4 flex-shrink-0 ${isPinned ? 'text-brand' : 'text-gray-400'}`} />
                    <span className={`text-sm font-semibold truncate ${isPinned ? 'text-brand' : 'text-gray-900'}`}>{template.name}</span>
                    <Badge label="Meal Slots" variant="slot" />
                </div>
                <p className="text-xs text-gray-400 mt-0.5 ml-6">
                    {template.day0MealNames?.join(', ') || 'Saved structure'}
                </p>
            </button>
            {(hovered || isPinned) && (
                <button onClick={onTogglePin} title={isPinned ? 'Unpin' : 'Pin'}
                    className={`absolute top-2.5 right-2 p-0.5 rounded transition-colors ${isPinned ? 'text-brand' : 'text-gray-300 hover:text-brand'}`}>
                    <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} />
                </button>
            )}
        </div>
    );
}

function BlankCard({ onSelect }: { onSelect: () => void }) {
    return (
        <button
            onClick={onSelect}
            className="w-full text-left p-3 rounded-xl border-2 border-dashed border-gray-300 hover:border-brand hover:bg-brand/5 transition-all"
        >
            <div className="flex items-center gap-2">
                <Utensils className="w-4 h-4 flex-shrink-0 text-gray-400" />
                <span className="text-sm font-semibold text-gray-700">Blank</span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">Fresh Start</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5 ml-6">{BLANK_OPTION.description}</p>
        </button>
    );
}

function PlanRangeCard({ plan }: { plan: ClientPlanRange }) {
    const start = new Date(plan.startDate);
    const end = plan.endDate ? new Date(plan.endDate) : null;
    return (
        <div className="flex items-center gap-3 p-2.5 bg-white border border-gray-200 rounded-lg">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${plan.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{plan.name}</p>
                <p className="text-xs text-gray-500">
                    {formatDate(start)}{end ? ` → ${formatDate(end)}` : ''} &middot; {plan.mealCount} meals
                </p>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${plan.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {plan.status}
            </span>
        </div>
    );
}
