'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Send, Loader2, LayoutTemplate, SlidersHorizontal, Copy, CopyPlus, Files, ClipboardPaste, Eraser, Columns2, Square, Clock, CalendarDays, BookOpen, AlertTriangle, ChevronDown, Sparkles, StickyNote, X as XIcon } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { AddFoodModal } from '@/components/modals/add-food-modal';
import { ClientSelector } from '@/components/diet-plan/client-selector';
import { ClientStatsStrip } from '@/components/diet-plan/client-stats-strip';
import { ClientRestrictionsSummary } from '@/components/diet-plan/client-restrictions-summary';
import { MedicalSidebar } from '@/components/diet-plan/medical-sidebar';
import { DayNavigator } from '@/components/diet-plan/day-navigator';
import { MealEditor } from '@/components/diet-plan/meal-editor';
import { TemplateSidebar, type MealSlotPreset } from '@/components/diet-plan/template-sidebar';
import { PreviousPlanPanel, type PreviousPlanCopyCallbacks } from '@/components/diet-plan/previous-plan-panel';
import { PlanSetupModal, PlanSetupResult } from '@/components/diet-plan/plan-setup-modal';
import { BulkPortionModal } from '@/components/diet-plan/bulk-portion-modal';
import { CallNotesDock } from '@/components/diet-plan/call-notes-dock';
import { WhatsAppShareModal } from '@/components/diet-plan/whatsapp-share-modal';
import { useClient } from '@/lib/hooks/use-clients';
import { useDietPlans } from '@/lib/hooks/use-diet-plans';
import { useMealBuilder } from '@/lib/hooks/use-meal-builder';
import { AiDraftPanel } from '@/components/diet-plan/ai-draft/ai-draft-panel';
import type { MealPlanDraftResult } from '@/lib/hooks/use-ai-meal-plan-draft';
import type { LocalMeal } from '@/lib/types/diet-plan.types';
import { toast } from 'sonner';

function ClientPreferencesCard({ client }: { client: NonNullable<ReturnType<typeof useClient>['data']> }) {
    const [open, setOpen] = useState(false);
    const hasAny =
        (client.allergies?.length ?? 0) > 0 ||
        (client.intolerances?.length ?? 0) > 0 ||
        client.dietPattern ||
        (client.dislikes?.length ?? 0) > 0 ||
        (client.likedFoods?.length ?? 0) > 0 ||
        (client.foodRestrictions?.length ?? 0) > 0;

    if (!hasAny) return null;

    return (
        <div className="flex-shrink-0 bg-white rounded-lg border border-gray-200 overflow-hidden">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
                <span>Likes, Dislikes & Allergies</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="px-4 pb-3 border-t border-gray-100">
                    <ClientRestrictionsSummary
                        compact
                        allergies={client.medicalProfile?.allergies || client.allergies || []}
                        intolerances={client.intolerances || []}
                        dietPattern={client.dietPattern}
                        medicalConditions={client.medicalProfile?.conditions || client.medicalConditions || []}
                        foodRestrictions={client.foodRestrictions || []}
                        dislikes={client.dislikes || []}
                        likedFoods={client.likedFoods || []}
                    />
                </div>
            )}
        </div>
    );
}

/**
 * Per-day note card shown above the meal editor. Only rendered when the day
 * already has a note (AI drafts and plans created before plan-level General
 * Guidelines existed) — new notes go through GeneralGuidelinesCard instead.
 * Visible to the client after publish (PDF, WhatsApp, mobile app).
 */
function DayNoteCard({ value, onChange, onClear }: {
    value: string;
    onChange: (v: string) => void;
    onClear: () => void;
}) {
    const hasValue = value.trim().length > 0;

    return (
        <div className="flex-shrink-0 bg-amber-50/70 border border-amber-200 rounded-lg p-2">
            <div className="flex items-center gap-1.5 mb-1.5">
                <StickyNote className="w-3.5 h-3.5 text-amber-700" />
                <span className="text-[11px] font-semibold text-amber-800">Day-specific note</span>
                <span className="text-[10px] text-amber-600">visible to client</span>
                {hasValue && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="ml-auto text-amber-500 hover:text-amber-700 p-0.5"
                        title="Clear note"
                    >
                        <XIcon className="w-3 h-3" />
                    </button>
                )}
            </div>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="e.g. Hydration day — drink 3L water. 30-min walk after dinner."
                rows={2}
                maxLength={500}
                className="w-full text-sm text-amber-900 bg-white/60 placeholder:text-amber-400 border border-amber-200 rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 resize-y"
            />
        </div>
    );
}

/**
 * Plan-level "General Guidelines" card shown under the plan date range, above
 * the day navigator. Persisted as notesForClient. Visible to the client after
 * publish (PDF, WhatsApp, mobile app) ahead of Day 1.
 */
function GeneralGuidelinesCard({ value, onChange }: {
    value: string;
    onChange: (v: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const hasValue = value.trim().length > 0;
    const showEditor = expanded || hasValue;

    if (!showEditor) {
        return (
            <button
                type="button"
                onClick={() => setExpanded(true)}
                className="flex-shrink-0 w-full flex items-center gap-2 px-3 py-1.5 bg-amber-50/60 hover:bg-amber-50 border border-dashed border-amber-300 text-amber-700 text-xs font-medium rounded-lg transition-colors"
                title="Add guidelines that apply to the entire plan"
            >
                <StickyNote className="w-3.5 h-3.5" />
                Add general guidelines for this plan
                <span className="ml-auto text-[10px] text-amber-500 hidden md:inline">visible to client</span>
            </button>
        );
    }

    return (
        <div className="flex-shrink-0 bg-amber-50/70 border border-amber-200 rounded-lg p-2">
            <div className="flex items-center gap-1.5 mb-1.5">
                <StickyNote className="w-3.5 h-3.5 text-amber-700" />
                <span className="text-[11px] font-semibold text-amber-800">General Guidelines</span>
                <span className="text-[10px] text-amber-600">visible to client</span>
                {hasValue && (
                    <button
                        type="button"
                        onClick={() => onChange('')}
                        className="ml-auto text-amber-500 hover:text-amber-700 p-0.5"
                        title="Clear guidelines"
                    >
                        <XIcon className="w-3 h-3" />
                    </button>
                )}
            </div>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="e.g. Drink 3–4L water daily. 30-min walk after dinner. Early dinner before 8pm."
                rows={2}
                maxLength={2000}
                onBlur={() => { if (!hasValue) setExpanded(false); }}
                className="w-full text-sm text-amber-900 bg-white/60 placeholder:text-amber-400 border border-amber-200 rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 resize-y"
            />
        </div>
    );
}

function formatPlanRange(start: Date, numDays: number): string {
    const end = new Date(start);
    end.setDate(end.getDate() + numDays - 1);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    return numDays > 1 ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

interface BuilderPaneProps {
    dayIndex: number;
    setDayIndex: (n: number) => void;
    paneLabel?: string; // e.g. "A" / "B" — only shown in split mode
    otherPaneDay?: number;
    builder: ReturnType<typeof useMealBuilder>;
    isTemplateMode: boolean;
    planHeader?: React.ReactNode; // scrolls away with content; the day navigator below it stays sticky
}

function BuilderPane({ dayIndex, setDayIndex, paneLabel, otherPaneDay, builder, isTemplateMode, planHeader }: BuilderPaneProps) {
    const sameDay = otherPaneDay !== undefined && otherPaneDay === dayIndex;
    const dayMeals = builder.getDayMeals(dayIndex);
    const dayKcal = builder.getDayNutrition(dayIndex).calories;
    const [showCopyAllConfirm, setShowCopyAllConfirm] = useState(false);
    const [showCopyToSelected, setShowCopyToSelected] = useState(false);
    const [copyToSelection, setCopyToSelection] = useState<Set<number>>(() => new Set());

    const sourceIsEmpty = dayMeals.length === 0 || dayMeals.every(m => m.foods.length === 0);
    const canBulkCopy = builder.numDays > 1 && !sourceIsEmpty;

    const handleCopyToAll = () => {
        builder.copyDayToAll(dayIndex);
        setShowCopyAllConfirm(false);
    };
    const openCopyToSelected = () => {
        setCopyToSelection(new Set());
        setShowCopyToSelected(true);
    };
    const toggleSelection = (i: number) => {
        setCopyToSelection(prev => {
            const next = new Set(prev);
            if (next.has(i)) next.delete(i);
            else next.add(i);
            return next;
        });
    };
    const handleCopyToSelectedConfirm = () => {
        builder.copyDayToSelected(dayIndex, Array.from(copyToSelection));
        setShowCopyToSelected(false);
    };

    return (
        <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-y-auto pr-1">
            {planHeader}
            {/* Pane header — label + inline day actions */}
            <div className="flex items-center justify-between gap-2 flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    {paneLabel && (
                        <span className="text-xs font-bold px-1.5 py-0.5 bg-brand/10 text-brand rounded">
                            Pane {paneLabel}
                        </span>
                    )}
                    <span className="text-xs text-gray-500 truncate">
                        {Math.round(dayKcal)} kcal
                    </span>
                    {sameDay && (
                        <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded" title="Both panes show the same day — edits sync">
                            same day
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => builder.copyDay(dayIndex)}
                        className="h-8 px-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md transition-colors"
                        title="Copy Day (to clipboard)"
                    >
                        <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => builder.pasteDay(dayIndex)}
                        disabled={!builder.clipboardDay}
                        className="h-8 px-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md transition-colors disabled:opacity-30"
                        title="Paste Day"
                    >
                        <ClipboardPaste className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setShowCopyAllConfirm(true)}
                        disabled={!canBulkCopy}
                        className="h-8 px-2 inline-flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md transition-colors disabled:opacity-30"
                        title={sourceIsEmpty ? 'Day is empty' : `Copy Day ${dayIndex + 1} to all other days`}
                    >
                        <CopyPlus className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-medium hidden md:inline">All</span>
                    </button>
                    <button
                        onClick={openCopyToSelected}
                        disabled={!canBulkCopy}
                        className="h-8 px-2 inline-flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md transition-colors disabled:opacity-30"
                        title={sourceIsEmpty ? 'Day is empty' : `Copy Day ${dayIndex + 1} to selected days`}
                    >
                        <Files className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-medium hidden md:inline">Selected</span>
                    </button>
                    <button
                        onClick={() => builder.clearDay(dayIndex)}
                        className="h-8 px-2 bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 rounded-md transition-colors"
                        title="Clear Day"
                    >
                        <Eraser className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            <DayNavigator
                planDates={builder.planDates}
                selectedDayIndex={dayIndex}
                onSelectDay={setDayIndex}
                isTemplateMode={isTemplateMode}
                onAddDay={() => {
                    const newIdx = builder.numDays; // pre-increment index becomes the new day
                    builder.addDay();
                    setDayIndex(newIdx);
                }}
                onRemoveDay={builder.removeDay}
            />

            {(builder.dayNotes[dayIndex] ?? '').trim().length > 0 && (
                <DayNoteCard
                    value={builder.dayNotes[dayIndex] ?? ''}
                    onChange={(v) => builder.updateDayNote(dayIndex, v)}
                    onClear={() => builder.clearDayNote(dayIndex)}
                />
            )}

            <ErrorBoundary
                fallback={
                    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl border border-red-200">
                        <p className="text-red-600 font-medium mb-2">Failed to render meal editor</p>
                        <p className="text-gray-500 text-sm mb-4">Your other data is preserved. Try refreshing the page.</p>
                        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium">Refresh Page</button>
                    </div>
                }
            >
                <MealEditor
                    meals={dayMeals}
                    onAddMeal={() => builder.addMeal(dayIndex)}
                    onRemoveMeal={(id) => builder.removeMeal(dayIndex, id)}
                    onOpenAddFood={(mealId, group) => builder.openAddFood(dayIndex, mealId, group)}
                    onRemoveFood={(mealId, tempId) => builder.removeFood(dayIndex, mealId, tempId)}
                    onUpdateFoodQuantity={(mealId, tempId, val) => builder.updateFoodQuantity(dayIndex, mealId, tempId, val)}
                    onUpdateFoodQuantityValue={(mealId, tempId, grams) => builder.updateFoodQuantityValue(dayIndex, mealId, tempId, grams)}
                    onUpdateMealField={(mealId, field, value) => builder.updateMealField(dayIndex, mealId, field, value)}
                    onAddAlternative={(mealId) => builder.addMealOption(dayIndex, mealId)}
                    onRemoveOption={(mealId, group) => builder.removeOption(dayIndex, mealId, group)}
                    onUpdateOptionLabel={(mealId, group, label) => builder.updateOptionLabel(dayIndex, mealId, group, label)}
                    onCopyMeal={(mealId) => builder.copyMeal(dayIndex, mealId)}
                    onPasteMeal={(mealId) => builder.pasteMeal(dayIndex, mealId)}
                    hasMealClipboard={!!builder.clipboardMeal}
                />
            </ErrorBoundary>

            {/* Copy-to-all confirmation */}
            {showCopyAllConfirm && (
                <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                        <h3 className="text-base font-bold text-gray-900">Overwrite all other days with Day {dayIndex + 1}?</h3>
                        <p className="text-sm text-gray-600">
                            This replaces every other day's meals with a copy of Day {dayIndex + 1}. It can't be undone.
                        </p>
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowCopyAllConfirm(false)}
                                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleCopyToAll}
                                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-brand rounded-xl hover:bg-brand/90 transition-colors shadow-sm"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Copy-to-selected days modal */}
            {showCopyToSelected && (
                <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-gray-900">Copy Day {dayIndex + 1} to selected days</h3>
                            <button onClick={() => setShowCopyToSelected(false)} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
                        </div>
                        <p className="text-xs text-gray-500">Select days to copy to (will overwrite):</p>
                        <div className="grid grid-cols-2 gap-2">
                            {Array.from({ length: builder.numDays }, (_, i) => i).filter(i => i !== dayIndex).map(i => (
                                <label key={i} className="flex items-center gap-2 px-2.5 py-2 rounded-md border border-gray-200 hover:border-brand hover:bg-brand/5 cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={copyToSelection.has(i)}
                                        onChange={() => toggleSelection(i)}
                                        className="w-3.5 h-3.5 accent-brand"
                                    />
                                    <span className="text-sm text-gray-700">Day {i + 1}</span>
                                </label>
                            ))}
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowCopyToSelected(false)}
                                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleCopyToSelectedConfirm}
                                disabled={copyToSelection.size === 0}
                                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-brand rounded-xl hover:bg-brand/90 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Copy to {copyToSelection.size} day{copyToSelection.size === 1 ? '' : 's'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function BuilderContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const clientId = searchParams.get('clientId');
    const isTemplateMode = searchParams.get('template') === 'true';
    const editId = searchParams.get('editId');

    // Template setup: read from URL params so useMealBuilder initialises correctly on first mount
    const templateNumDays = isTemplateMode && !editId ? (parseInt(searchParams.get('numDays') || '0') || null) : null;
    const templatePlanName = isTemplateMode && !editId ? (searchParams.get('planName') || null) : null;
    const showTemplateSetup = isTemplateMode && !editId && !templateNumDays;

    // Plan setup state — read from URL params if present (persists through refresh)
    const applyTemplateId = searchParams.get('applyTemplateId');
    const setupStart = searchParams.get('setupStart');
    const setupDays = searchParams.get('setupDays');
    const setupMeals = searchParams.get('setupMeals');
    const setupFromUrl: PlanSetupResult | null = (!isTemplateMode && !editId && setupStart && setupDays && setupMeals)
        ? {
            planName: searchParams.get('setupPlanName') || 'New Diet Plan',
            startDate: new Date(setupStart),
            numDays: parseInt(setupDays),
            mealCount: parseInt(setupMeals),
            overlapStrategy: (searchParams.get('setupStrategy') as PlanSetupResult['overlapStrategy']) || 'overwrite',
            overlappingPlanIds: searchParams.get('overlappingPlanIds')?.split(',').filter(Boolean) || undefined,
            slotTemplateId: searchParams.get('setupSlot') || undefined,
        }
        : null;

    // When assigning a template, skip Plan Setup — template defines the structure
    const setupFromTemplate: PlanSetupResult | null = (!isTemplateMode && !editId && applyTemplateId)
        ? { planName: 'New Diet Plan', startDate: new Date(), numDays: 7, mealCount: 3, overlapStrategy: 'overwrite' }
        : null;

    const [setupResult, setSetupResult] = useState<PlanSetupResult | null>(
        editId ? { planName: '', startDate: new Date(), numDays: 1, mealCount: 3, overlapStrategy: 'overwrite' }
        : setupFromUrl ?? setupFromTemplate
    );
    const [showSetupModal, setShowSetupModal] = useState(false);
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [showPrevPlan, setShowPrevPlan] = useState(false);
    const [showPublishWarning, setShowPublishWarning] = useState(false);
    const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);
    const [templateNameInput, setTemplateNameInput] = useState('');
    const [copyPlanConfirm, setCopyPlanConfirm] = useState<{ daysByIndex: Record<number, LocalMeal[]>; planName: string; generalGuidelines?: string } | null>(null);
    const [whatsAppNav, setWhatsAppNav] = useState<string | null>(null);
    const [showAiDraft, setShowAiDraft] = useState(false);
    const [aiReplaceConfirmDraft, setAiReplaceConfirmDraft] = useState<MealPlanDraftResult | null>(null);

    // Preset scope dialog — shown when user clicks a meal structure in the sidebar
    const [presetScope, setPresetScope] = useState<{ preset: MealSlotPreset } | null>(null);

    // Split-pane state — max 2 panes, each picks its own day.
    const [splitMode, setSplitMode] = useState(false);
    const [selectedDayA, setSelectedDayA] = useState(0);
    const [selectedDayB, setSelectedDayB] = useState(0);

    // Hydrate split toggle from localStorage (client-only)
    useEffect(() => {
        if (typeof window === 'undefined') return;
        setSplitMode(localStorage.getItem('builder-split') === '1');
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        localStorage.setItem('builder-split', splitMode ? '1' : '0');
    }, [splitMode]);

    const { data: client, isLoading: clientLoading } = useClient(
        !isTemplateMode && clientId ? clientId : ''
    );

    // Fetch templates for sidebar
    const { data: templatesData } = useDietPlans({ isTemplate: true, pageSize: 50 });
    const templates = templatesData?.data || [];

    const builder = useMealBuilder({
        clientId,
        isTemplateMode,
        editId,
        client,
        initialStartDate: setupResult?.startDate,
        initialNumDays: templateNumDays ?? setupResult?.numDays,
        initialMealCount: setupResult?.mealCount,
        initialPlanName: templatePlanName ?? setupResult?.planName,
        overlapStrategy: setupResult?.overlapStrategy,
        overlappingPlanIds: setupResult?.overlappingPlanIds,
        onSaved: (isTemplate, published) => {
            const navTarget = isTemplate
                ? '/dashboard/diet-plans?tab=templates'
                : clientId
                    ? `/dashboard/clients/${clientId}`
                    : '/dashboard/diet-plans';

            if (published && !isTemplate && client?.phone) {
                setWhatsAppNav(navTarget);
            } else {
                router.push(navTarget);
            }
        },
    });

    // Unsaved-changes guard — intercepts ALL navigation (sidebar links, back button, etc.)
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const pendingNavRef = useRef<string | null>(null);
    // builder active = builder UI is rendered and plan not yet persisted (new) or has unsaved edits
    const builderReadyRef = useRef(false);
    const guardActiveRef = useRef(false);

    // Mark builder as active once past all the early-return gates
    useEffect(() => {
        const builderIsShowing = (isTemplateMode || !!setupResult) && !builder.editLoading && (isTemplateMode || !!client);
        if (builderIsShowing) {
            builderReadyRef.current = true;
        }
        // Guard: new unsaved plan OR dirty edits on any plan
        guardActiveRef.current = builderReadyRef.current && (builder.isDirty || !builder.isEditMode) && !builder.isSaving;
    });

    // Warn on browser refresh/close whenever builder is active
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (!guardActiveRef.current) return;
            e.preventDefault();
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, []);

    // Capture-phase click listener catches every <a> in the page (sidebar, header, etc.)
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (!guardActiveRef.current) return;
            let el = e.target as HTMLElement | null;
            while (el && el.tagName !== 'A') el = el.parentElement;
            if (!el) return;
            const href = (el as HTMLAnchorElement).getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto')) return;
            const targetPath = href.split('?')[0];
            if (targetPath !== window.location.pathname) {
                e.preventDefault();
                e.stopImmediatePropagation();
                pendingNavRef.current = href;
                setShowLeaveConfirm(true);
            }
        };
        document.addEventListener('click', handleClick, true);
        return () => document.removeEventListener('click', handleClick, true);
    }, []);

    const guardedNavigate = useCallback((href: string) => {
        if (guardActiveRef.current) {
            pendingNavRef.current = href;
            setShowLeaveConfirm(true);
        } else {
            router.push(href);
        }
    }, [router]);

    // Clamp pane days whenever the plan shrinks
    useEffect(() => {
        if (selectedDayA >= builder.numDays) setSelectedDayA(Math.max(0, builder.numDays - 1));
        if (selectedDayB >= builder.numDays) setSelectedDayB(Math.max(0, builder.numDays - 1));
    }, [builder.numDays, selectedDayA, selectedDayB]);

    // Auto-apply slot template selected during setup (skip confirm since plan is new)
    const slotApplied = useRef(false);
    useEffect(() => {
        if (!setupResult?.slotTemplateId || slotApplied.current || builder.editLoading) return;
        slotApplied.current = true;
        builder.applyTemplate(setupResult.slotTemplateId, { skipConfirm: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setupResult?.slotTemplateId, builder.editLoading]);

    // Auto-apply full template from "Assign to Client" flow (?applyTemplateId=...)
    const fullTemplateApplied = useRef(false);
    useEffect(() => {
        if (!applyTemplateId || fullTemplateApplied.current || builder.editLoading || !setupResult) return;
        fullTemplateApplied.current = true;
        builder.applyTemplate(applyTemplateId, { skipConfirm: true, startDayIndex: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [applyTemplateId, builder.editLoading, setupResult]);

    // Cancelling setup must leave the page — the builder can't render without a setup
    // result. router.back() is a no-op in a fresh tab (most entry points use
    // window.open), so fall back to an explicit destination.
    const setupCancelledRef = useRef(false);
    const handleSetupCancel = useCallback(() => {
        setupCancelledRef.current = true;
        setShowSetupModal(false);
        if (window.history.length > 1) {
            router.back();
        } else {
            router.replace(clientId ? `/dashboard/clients/${clientId}` : '/dashboard/diet-plans');
        }
    }, [router, clientId]);

    // Auto-show plan setup modal once client is ready — must be before early returns (Rules of Hooks)
    useEffect(() => {
        if (!isTemplateMode && !editId && !setupResult && client && !showSetupModal && !setupCancelledRef.current) {
            setShowSetupModal(true);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client]);

    // ── AI Draft → builder state ─────────────────────────────────────────────
    const applyAiDraft = useCallback((draft: MealPlanDraftResult) => {
        const makeTempId = () => Math.random().toString(36).slice(2, 11);
        const defaultTime: Record<'breakfast' | 'lunch' | 'snack' | 'dinner', string> = {
            breakfast: '08:00', lunch: '13:00', snack: '17:00', dinner: '19:30',
        };

        // Smarter time guess from meal name when the AI didn't fill timeOfDay.
        const inferTimeFromName = (name: string, type: 'breakfast' | 'lunch' | 'snack' | 'dinner'): string => {
            const n = name.toLowerCase();
            if (/empty stomach|detox|early morning|wake/.test(n)) return '06:30';
            if (/mid[- ]?morning|mid[- ]?meal/.test(n)) return '11:00';
            if (/evening|tea time/.test(n)) return '17:00';
            if (/pre[- ]?dinner/.test(n)) return '19:00';
            if (/post[- ]?dinner|bed[- ]?time/.test(n)) return '21:00';
            return defaultTime[type];
        };

        const timeKey = (t: string | null | undefined, type: 'breakfast' | 'lunch' | 'snack' | 'dinner'): number => {
            const src = t ?? defaultTime[type];
            const [h, m] = src.split(':').map(Number);
            if (Number.isFinite(h) && Number.isFinite(m)) return h * 60 + m;
            return Infinity;
        };

        const map: Record<number, LocalMeal[]> = {};
        const notes: Record<number, string> = {};
        for (const day of draft.days) {
            // Sort meals chronologically — the agent assigns sequenceNumber in
            // parse order (the order it encountered text), which jumbles
            // morning snacks below dinner in the UI / PDF / WhatsApp share.
            const meals: LocalMeal[] = [...day.meals]
                .sort((a, b) => timeKey(a.timeOfDay, a.mealType) - timeKey(b.timeOfDay, b.mealType))
                .map((meal) => ({
                    id: makeTempId(),
                    name: meal.name || meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1),
                    type: meal.mealType,
                    time: meal.timeOfDay ?? inferTimeFromName(meal.name, meal.mealType),
                    description: '',
                    instructions: meal.instructions ?? '',
                    foods: meal.items.map((item) => ({
                        id: item.foodId,
                        tempId: makeTempId(),
                        name: item.foodName,
                        quantity: item.quantityLabel,
                        quantityValue: item.quantityG,
                        calories: item.nutrition.calories,
                        protein: item.nutrition.proteinG,
                        carbs: item.nutrition.carbsG,
                        fat: item.nutrition.fatsG,
                        hasWarning: item.validation.severity !== 'GREEN',
                        validationSeverity: item.validation.severity,
                        validationAlerts: item.validation.alerts,
                        optionGroup: item.optionGroup,
                    })),
                }));
            map[day.dayNumber - 1] = meals;
            if (day.note && day.note.trim()) notes[day.dayNumber - 1] = day.note.trim();
        }

        builder.replaceAllDays(map, notes);

        const { summary } = draft;
        const parts: string[] = [`${summary.totalItems - summary.blockedItems} added`];
        if (summary.createdItems > 0) parts.push(`${summary.createdItems} new food${summary.createdItems === 1 ? '' : 's'}`);
        if (summary.blockedItems > 0) parts.push(`${summary.blockedItems} blocked`);
        if (summary.warningItems > 0) parts.push(`${summary.warningItems} warning${summary.warningItems === 1 ? '' : 's'}`);
        toast.success(`AI draft applied — ${parts.join(', ')}`);
    }, [builder]);

    const handleAiDraftApply = useCallback((draft: MealPlanDraftResult) => {
        const hasExistingFoods = Object.values(builder.weeklyMeals).some((meals) =>
            meals.some((m) => m.foods.length > 0),
        );
        if (hasExistingFoods) {
            setAiReplaceConfirmDraft(draft);
        } else {
            applyAiDraft(draft);
        }
    }, [builder.weeklyMeals, applyAiDraft]);

    // Step 1: Client selection screen
    if (!isTemplateMode && !clientId) {
        return <ClientSelector />;
    }

    if ((!isTemplateMode && clientLoading) || builder.editLoading) {
        return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;
    }

    if (!isTemplateMode && !client) {
        return <div className="p-8 text-center text-red-500">Client not found.</div>;
    }

    // Template setup gate — name + days before entering builder
    if (showTemplateSetup) {
        return (
            <TemplateSetupModal
                isOpen={true}
                onClose={() => router.back()}
                onConfirm={(result) => {
                    // Pass via URL so useMealBuilder initialises with the correct numDays on first mount
                    const params = new URLSearchParams(searchParams.toString());
                    params.set('numDays', String(result.numDays));
                    params.set('planName', result.planName);
                    router.replace(`/dashboard/diet-plans/new?${params.toString()}`);
                }}
            />
        );
    }

    // Step 2: Plan setup modal — shown once after client loads, skipped for templates/edits
    if (!isTemplateMode && !editId && !setupResult) {
        return (
            <>
                <div className="flex justify-center p-12">
                    <Loader2 className="animate-spin" />
                </div>
                <PlanSetupModal
                    isOpen={showSetupModal}
                    onClose={handleSetupCancel}
                    clientId={clientId!}
                    clientName={client?.fullName || ''}
                    slotTemplates={templates.filter(t => t.templateCategory === 'slot_template')}
                    fullTemplates={templates.filter(t => t.templateCategory !== 'slot_template')}
                    onConfirm={(result) => {
                        // Persist setup to URL so refresh skips the modal
                        const params = new URLSearchParams(searchParams.toString());
                        params.set('setupPlanName', result.planName);
                        params.set('setupStart', result.startDate.toISOString().slice(0, 10));
                        params.set('setupDays', String(result.numDays));
                        params.set('setupMeals', String(result.mealCount));
                        params.set('setupStrategy', result.overlapStrategy);
                        if (result.slotTemplateId) params.set('setupSlot', result.slotTemplateId);
                        if (result.applyTemplateId) params.set('applyTemplateId', result.applyTemplateId);
                        router.replace(`/dashboard/diet-plans/new?${params.toString()}`);
                        setSetupResult(result);
                        setShowSetupModal(false);
                    }}
                />
            </>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-5rem)] -m-4 lg:-m-6">
            {/* Top Header */}
            <header className="flex items-center justify-between border-b border-gray-200 px-3 lg:px-6 py-2 bg-white flex-shrink-0 gap-2 overflow-x-auto">
                <div className="flex items-center gap-3 lg:gap-6 flex-shrink-0">
                    <button
                        onClick={() => guardedNavigate(isTemplateMode ? '/dashboard/diet-plans' : `/dashboard/clients/${clientId}`)}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium flex-shrink-0"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="hidden sm:inline">{isTemplateMode ? 'Back to Templates' : 'Back to Client'}</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <input
                            value={builder.planName}
                            onChange={e => builder.setPlanName(e.target.value)}
                            className="text-gray-900 text-sm font-medium px-2 py-1 rounded border border-gray-300 bg-gray-50 hover:border-brand hover:bg-white focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20 outline-none transition-colors min-w-[180px]"
                        />
                        {isTemplateMode && (
                            <>
                                <span className="text-gray-400">|</span>
                                <span className="text-purple-600 text-sm font-medium">Template</span>
                            </>
                        )}
                    </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                    <button
                        onClick={() => setSplitMode(s => !s)}
                        className={`h-9 px-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                            splitMode ? 'bg-brand/10 text-brand hover:bg-brand/20' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                        title={splitMode ? 'Exit split view' : 'Split builder into two panes'}
                    >
                        {splitMode ? <Square className="w-4 h-4" /> : <Columns2 className="w-4 h-4" />}
                        <span className="hidden sm:inline">{splitMode ? 'Single' : 'Split'}</span>
                    </button>
                    {isTemplateMode ? (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowAiDraft(true)}
                                className="flex items-center gap-2 h-9 px-3 lg:px-4 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium transition-colors"
                                title="Draft this template from a free-form prompt"
                            >
                                <Sparkles className="w-4 h-4" />
                                <span className="hidden sm:inline">AI Draft</span>
                            </button>
                            <button
                                onClick={() => builder.save(false, true)}
                                disabled={builder.isSaving}
                                className="flex items-center gap-2 h-9 px-3 lg:px-4 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                            >
                                <LayoutTemplate className="w-4 h-4" />
                                <span className="hidden sm:inline">Save as Meal Slots</span>
                            </button>
                            <button
                                onClick={() => builder.save(false)}
                                disabled={builder.isSaving}
                                className="flex items-center gap-2 h-9 px-3 lg:px-4 bg-brand hover:bg-brand/90 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                <span className="hidden sm:inline">{builder.isSaving ? 'Saving...' : (builder.isEditMode ? 'Update Template' : 'Save Template')}</span>
                            </button>
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={() => setShowAiDraft(true)}
                                className="flex items-center gap-2 h-9 px-3 lg:px-4 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium transition-colors"
                                title="Draft this plan from a free-form prompt"
                            >
                                <Sparkles className="w-4 h-4" />
                                <span className="hidden sm:inline">AI Draft</span>
                            </button>
                            <button
                                onClick={() => setShowBulkModal(true)}
                                className="flex items-center gap-2 h-9 px-3 lg:px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                                title="Adjust Portions"
                            >
                                <SlidersHorizontal className="w-4 h-4" />
                                <span className="hidden sm:inline">Portions</span>
                            </button>
                            <button
                                onClick={() => { setTemplateNameInput(''); setShowSaveAsTemplate(true); }}
                                disabled={builder.isSaving}
                                className="flex items-center gap-2 h-9 px-3 lg:px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                title="Save this plan as a reusable template"
                            >
                                <LayoutTemplate className="w-4 h-4" />
                                <span className="hidden sm:inline">Save as Template</span>
                            </button>
                            <button
                                onClick={() => builder.save(false)}
                                disabled={builder.isSaving}
                                className="flex items-center gap-2 h-9 px-3 lg:px-4 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                <span className="hidden sm:inline">Save Draft</span>
                            </button>
                            <button
                                onClick={() => {
                                    const emptySlots = Object.values(builder.weeklyMeals)
                                        .flat()
                                        .filter(m => m.foods.filter(f => f.optionGroup === 0).length === 0);
                                    if (emptySlots.length > 0) {
                                        setShowPublishWarning(true);
                                    } else {
                                        builder.save(true);
                                    }
                                }}
                                disabled={builder.isSaving}
                                className="flex items-center gap-2 h-9 px-3 lg:px-4 bg-brand hover:bg-brand/90 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                            >
                                <Send className="w-4 h-4" />
                                <span className="hidden sm:inline">Publish</span>
                            </button>
                        </>
                    )}
                </div>
            </header>

            {/* Client stats strip — compact bar with measurements + nutrition totals */}
            {!isTemplateMode && client && (
                <ClientStatsStrip
                    client={client}
                    dayNutrition={builder.getDayNutrition(selectedDayA)}
                    targets={builder.targets}
                    hasAllergyWarning={builder.getHasAllergyWarning(selectedDayA)}
                />
            )}

            {/* Main Content */}
            <div className="flex-grow overflow-x-auto bg-gray-50">
            <div className="flex-1 flex min-h-0 h-full">
            <main className="flex-1 min-w-0 grid grid-cols-12 gap-4 p-4 h-full overflow-hidden bg-gray-50">
                {/* Left Sidebar */}
                <aside className="col-span-3 flex flex-col overflow-y-auto overflow-x-hidden pr-2 gap-3 pb-4">

                    {/* Sidebar tab toggle — only shown for client plans, not templates */}
                    {!isTemplateMode && clientId && (
                        <div className="flex-shrink-0 flex rounded-lg border border-gray-200 overflow-hidden bg-white">
                            <button
                                onClick={() => setShowPrevPlan(false)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                                    !showPrevPlan ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                <BookOpen className="w-3.5 h-3.5" />
                                Templates
                            </button>
                            <button
                                onClick={() => setShowPrevPlan(true)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                                    showPrevPlan ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                <CalendarDays className="w-3.5 h-3.5" />
                                Prev Plan
                            </button>
                        </div>
                    )}

                    {/* Previous plan panel */}
                    {showPrevPlan && !isTemplateMode && clientId && (
                        <div className="flex-1 min-h-0 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
                            <PreviousPlanPanel
                                clientId={clientId}
                                excludePlanId={editId || undefined}
                                copyCallbacks={{
                                    onCopyMeal: (meal) => {
                                        builder.setClipboardMeal(meal);
                                        toast.success('Meal copied — click paste (clipboard icon) on any meal slot');
                                    },
                                    onCopyDay: (meals) => {
                                        builder.setClipboardDay(meals);
                                        toast.success('Day copied — click paste on any day in the navigator');
                                    },
                                    onCopyEntirePlan: (daysByIndex, planName, generalGuidelines) => {
                                        setCopyPlanConfirm({ daysByIndex, planName, generalGuidelines });
                                    },
                                } satisfies PreviousPlanCopyCallbacks}
                            />
                        </div>
                    )}

                    {/* Templates + Medical — hidden when prev plan is active */}
                    {!showPrevPlan && (
                        <>
                    {isTemplateMode && (
                        <div className="flex-shrink-0 bg-purple-50 p-4 rounded-lg border border-purple-200">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">T</div>
                                <div>
                                    <p className="text-gray-900 font-medium">Template</p>
                                    <p className="text-gray-500 text-sm">Create reusable diet plan</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {!isTemplateMode && clientId && (
                        <div className="flex-shrink-0 min-h-[280px]">
                            <MedicalSidebar
                                clientId={clientId}
                                clientRemarks={client?.remarks}
                                clientExtractedNotes={client?.extractedNotes?.extracted}
                            />
                        </div>
                    )}

                    <div className="flex-shrink-0 min-h-[260px]">
                        <TemplateSidebar
                            templates={templates}
                            applyingTemplateId={builder.applyingTemplateId}
                            onApplyTemplate={(id) => builder.applyTemplate(id, { startDayIndex: selectedDayA })}
                            onApplyPreset={(preset) => setPresetScope({ preset })}
                        />
                    </div>
                        </>
                    )}
                </aside>

                {/* Center — Meal Editor, expanded to fill full remaining width */}
                <section className="col-span-9 flex flex-col overflow-hidden gap-3">
                    {/* Plan-level header: date range + General Guidelines. In single-pane
                        mode it lives inside the pane's scroller so it hides on scroll
                        while the day navigator stays sticky; in split mode it sits above
                        both panes. */}
                    {(() => {
                        const planHeader = (
                            <div className="flex-shrink-0 space-y-1.5">
                                {!isTemplateMode && (
                                    <p className="text-xs font-semibold text-gray-600">
                                        📅 {formatPlanRange(builder.startDate, builder.numDays)}
                                    </p>
                                )}
                                <GeneralGuidelinesCard
                                    value={builder.generalGuidelines}
                                    onChange={builder.updateGeneralGuidelines}
                                />
                            </div>
                        );
                        return (
                            <>
                                {splitMode && planHeader}
                                <div className="flex-1 min-h-0 flex overflow-hidden gap-3">
                                    <BuilderPane
                                        dayIndex={selectedDayA}
                                        setDayIndex={setSelectedDayA}
                                        paneLabel={splitMode ? 'A' : undefined}
                                        otherPaneDay={splitMode ? selectedDayB : undefined}
                                        builder={builder}
                                        isTemplateMode={isTemplateMode}
                                        planHeader={splitMode ? undefined : planHeader}
                                    />
                                    {splitMode && (
                                        <>
                                            <div className="w-px bg-gray-200 flex-shrink-0" />
                                            <BuilderPane
                                                dayIndex={selectedDayB}
                                                setDayIndex={setSelectedDayB}
                                                paneLabel="B"
                                                otherPaneDay={selectedDayA}
                                                builder={builder}
                                                isTemplateMode={isTemplateMode}
                                            />
                                        </>
                                    )}
                                </div>
                            </>
                        );
                    })()}
                </section>

            </main>
            {clientId && client && !isTemplateMode && (
                <CallNotesDock clientId={clientId} clientName={client.fullName} clientPhone={client.phone} />
            )}
            </div>
            </div>

            {/* Add Food Modal — targets whichever pane/day triggered it */}
            <AddFoodModal
                isOpen={builder.showAddFoodModal}
                onClose={() => builder.setShowAddFoodModal(false)}
                mealType={builder.getDayMeals(builder.activeDayIndex).find(m => m.id === builder.activeMealId)?.name || 'Meal'}
                optionLabel={
                    builder.activeOptionGroup > 0
                        ? builder.getDayMeals(builder.activeDayIndex).find(m => m.id === builder.activeMealId)?.foods
                            .find(f => f.optionGroup === builder.activeOptionGroup)?.optionLabel
                            || `Option ${String.fromCharCode(65 + builder.activeOptionGroup)}`
                        : undefined
                }
                clientId={clientId}
                currentDay={builder.planDates[builder.activeDayIndex]?.day.toLowerCase()}
                onAddFood={builder.addFood}
            />

            {/* Copy entire plan — confirmation modal */}
            {copyPlanConfirm && (() => {
                const src = copyPlanConfirm.daysByIndex;
                const prevDayCount = Object.keys(src).reduce((m, k) => Math.max(m, Number(k) + 1), 0) || 1;
                const currentDays = builder.numDays;
                const extendTo = Math.min(prevDayCount, 7); // client plans cap at 7 days
                const sameLength = prevDayCount === currentDays;
                const canExtend = extendTo > currentDays;

                const finish = () => {
                    if (copyPlanConfirm.generalGuidelines?.trim()) {
                        builder.updateGeneralGuidelines(copyPlanConfirm.generalGuidelines);
                    }
                    setCopyPlanConfirm(null);
                    toast.success(`Plan replaced with "${copyPlanConfirm.planName}"`);
                };
                // Fit: keep the current plan's length, take the previous plan's first X days.
                const copyFirstX = () => {
                    const map: Record<number, LocalMeal[]> = {};
                    for (let i = 0; i < currentDays; i += 1) map[i] = src[i] ?? [];
                    builder.replaceAllDays(map);
                    finish();
                };
                // All: replaceAllDays resizes the plan to fit every day of the previous plan.
                const copyAll = () => {
                    builder.replaceAllDays(src);
                    finish();
                };
                const plural = (n: number) => (n === 1 ? 'day' : 'days');

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                            <div>
                                <h3 className="text-base font-bold text-gray-900">Copy from this plan</h3>
                                <p className="text-sm font-semibold text-brand mt-1 truncate">&ldquo;{copyPlanConfirm.planName}&rdquo;</p>
                                <p className="text-sm text-gray-500 mt-1">
                                    It has <span className="font-medium text-gray-700">{prevDayCount} {plural(prevDayCount)}</span>. This replaces your current plan&rsquo;s meals.
                                </p>
                            </div>

                            <div className="space-y-2">
                                {sameLength ? (
                                    <button
                                        onClick={copyAll}
                                        className="w-full px-4 py-2.5 text-sm font-bold bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors"
                                    >
                                        Copy all {currentDays} {plural(currentDays)}
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={copyFirstX}
                                            className="w-full text-left px-4 py-2.5 bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors"
                                        >
                                            <span className="block text-sm font-bold">Copy first {currentDays} {plural(currentDays)}</span>
                                            <span className="block text-xs text-white/80 mt-0.5">Fits your current {currentDays}-{plural(currentDays)} plan</span>
                                        </button>
                                        <button
                                            onClick={copyAll}
                                            className="w-full text-left px-4 py-2.5 border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-50 transition-colors"
                                        >
                                            <span className="block text-sm font-bold">
                                                {canExtend ? `Extend to ${extendTo} ${plural(extendTo)} & copy all` : `Copy all ${prevDayCount} ${plural(prevDayCount)}`}
                                            </span>
                                            <span className="block text-xs text-gray-400 mt-0.5">
                                                {canExtend
                                                    ? `Adds ${extendTo - currentDays} ${plural(extendTo - currentDays)} to your plan`
                                                    : `Your plan becomes ${extendTo} ${plural(extendTo)}`}
                                            </span>
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={() => setCopyPlanConfirm(null)}
                                    className="w-full px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Save as Template modal */}
            {showSaveAsTemplate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                                <LayoutTemplate className="w-5 h-5 text-brand" />
                                <h3 className="text-base font-bold text-gray-900">Save as Template</h3>
                            </div>
                            <button onClick={() => setShowSaveAsTemplate(false)} className="text-gray-400 hover:text-gray-600 p-1">
                                <XIcon className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-sm text-gray-500">
                            The template name can be different from the plan name. All meal structures and food items are saved; client-specific data (allergies, targets) is not included.
                        </p>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Template Name <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={templateNameInput}
                                onChange={e => setTemplateNameInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && templateNameInput.trim()) { setShowSaveAsTemplate(false); builder.saveAsTemplate(templateNameInput.trim()); } }}
                                placeholder="e.g. Weight Loss 1500 kcal"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                                autoFocus
                            />
                        </div>
                        <div className="flex gap-3 pt-1">
                            <button
                                onClick={() => setShowSaveAsTemplate(false)}
                                className="flex-1 px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => { if (!templateNameInput.trim()) return; setShowSaveAsTemplate(false); builder.saveAsTemplate(templateNameInput.trim()); }}
                                disabled={!templateNameInput.trim() || builder.isSaving}
                                className="flex-1 px-4 py-2 text-sm font-bold bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-50"
                            >
                                Save Template
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Publish warning — empty meal slots detected */}
            {showPublishWarning && (() => {
                const emptySlots = Object.entries(builder.weeklyMeals)
                    .flatMap(([day, meals]) =>
                        meals
                            .filter(m => m.foods.filter(f => f.optionGroup === 0).length === 0)
                            .map(m => ({ day: Number(day) + 1, name: m.name }))
                    );
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-gray-900">Empty meal slots</h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        {emptySlots.length} meal{emptySlots.length > 1 ? 's' : ''} have no food items:
                                    </p>
                                </div>
                            </div>
                            <ul className="bg-amber-50 rounded-lg px-4 py-2 space-y-1 max-h-36 overflow-y-auto">
                                {emptySlots.map((s, i) => (
                                    <li key={i} className="text-sm text-amber-800 flex justify-between">
                                        <span>{s.name}</span>
                                        <span className="text-amber-500">Day {s.day}</span>
                                    </li>
                                ))}
                            </ul>
                            <p className="text-sm text-gray-500">These slots will be visible to the client but empty. Continue anyway?</p>
                            <div className="flex gap-3 pt-1">
                                <button
                                    onClick={() => setShowPublishWarning(false)}
                                    className="flex-1 px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => { setShowPublishWarning(false); builder.save(true); }}
                                    className="flex-1 px-4 py-2 text-sm font-medium bg-brand hover:bg-brand/90 text-white rounded-lg transition-colors"
                                >
                                    Publish Anyway
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* WhatsApp share modal — shown after successful publish */}
            {whatsAppNav && client?.phone && (
                <WhatsAppShareModal
                    phone={client.phone}
                    clientName={client.fullName}
                    planName={builder.planName}
                    startDate={builder.startDate}
                    numDays={builder.numDays}
                    weeklyMeals={builder.weeklyMeals}
                    dayNotes={builder.dayNotes}
                    generalGuidelines={builder.generalGuidelines}
                    onClose={() => {
                        // Navigate FIRST, then clear state. Doing it in the
                        // opposite order caused the modal-close click to be
                        // batched with the state update and the navigation
                        // got dropped on some renders. Wrap in setTimeout so
                        // React commits the state change before the route
                        // transition starts.
                        const target = whatsAppNav;
                        setWhatsAppNav(null);
                        setTimeout(() => {
                            if (target) router.push(target);
                        }, 0);
                    }}
                />
            )}

            {/* Bulk Portion Modal — day-scope adjustments target pane A */}
            <BulkPortionModal
                isOpen={showBulkModal}
                onClose={() => setShowBulkModal(false)}
                currentCalories={builder.getDayNutrition(selectedDayA).calories}
                onApply={(factor, scope) => builder.bulkAdjust(factor, scope, selectedDayA)}
            />

            {/* Template scope confirmation modal */}
            {builder.templateScopePrompt && (() => {
                const { templateName, templateDayCount, mealsPerDay, startDayIndex, endDayIndex, planDayCount } = builder.templateScopePrompt;
                const daysFilled = endDayIndex - startDayIndex + 1;
                const clipped = templateDayCount > daysFilled;
                const rangeLabel = daysFilled > 1 ? `Days ${startDayIndex + 1}–${endDayIndex + 1}` : `Day ${startDayIndex + 1}`;
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                            <h3 className="text-base font-bold text-gray-900">Apply &quot;{templateName}&quot;</h3>
                            <div className="text-sm text-gray-600 space-y-1.5">
                                <p>
                                    This is a <span className="font-semibold text-gray-800">{templateDayCount}-day template</span>
                                    {mealsPerDay > 0 && <> with <span className="font-semibold text-gray-800">{mealsPerDay} meals/day</span></>}.
                                </p>
                                {clipped ? (
                                    <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">
                                        Starting from Day {startDayIndex + 1}, only {rangeLabel} will be filled ({daysFilled} of {templateDayCount} template days fit in your {planDayCount}-day plan).
                                    </p>
                                ) : (
                                    <p>
                                        It will fill <span className="font-semibold text-gray-800">{rangeLabel}</span> in your {planDayCount}-day plan.
                                        {daysFilled < planDayCount && <span className="text-gray-400"> Other days are unchanged.</span>}
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => builder.dismissTemplateApply()}
                                    className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => builder.confirmTemplateApply()}
                                    className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-brand rounded-xl hover:bg-brand/90 transition-colors shadow-sm"
                                >
                                    Continue
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Scaling confirmation modal */}
            {builder.scalingPrompt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                        <h3 className="text-base font-bold text-gray-900">Scale Portions?</h3>
                        <p className="text-sm text-gray-600">
                            Template is <span className="font-semibold">{builder.scalingPrompt.templateCal} kcal</span> but
                            client target is <span className="font-semibold">{builder.scalingPrompt.clientCal} kcal</span>.
                        </p>
                        <p className="text-sm text-gray-600">
                            Scale all portions by <span className="font-semibold text-brand">{builder.scalingPrompt.pct}%</span> to match?
                        </p>
                        <div className="flex flex-col gap-2 pt-2">
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => builder.confirmScaling(false)}
                                    className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                                >
                                    Apply as-is
                                </button>
                                <button
                                    type="button"
                                    onClick={() => builder.confirmScaling(true)}
                                    className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-brand rounded-xl hover:bg-brand/90 transition-colors shadow-sm"
                                >
                                    Scale to proportions
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => builder.dismissScaling()}
                                className="w-full px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Preset scope dialog — ask "this day" or "all days" */}
            {presetScope && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                        <h3 className="text-base font-bold text-gray-900">Apply "{presetScope.preset.label}"</h3>
                        <p className="text-sm text-gray-600">Where should this meal slots be applied?</p>
                        <div className="flex flex-col gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => {
                                    builder.applyPreset(presetScope.preset, selectedDayA);
                                    setPresetScope(null);
                                }}
                                className="w-full px-4 py-3 text-sm font-semibold text-white bg-brand rounded-xl hover:bg-brand/90 transition-colors"
                            >
                                Day {selectedDayA + 1} only
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    builder.applyPreset(presetScope.preset, 'all');
                                    setPresetScope(null);
                                }}
                                className="w-full px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                All {builder.numDays} days
                            </button>
                            <button
                                type="button"
                                onClick={() => setPresetScope(null)}
                                className="w-full px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Replace confirmation modal */}
            {builder.replacePrompt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                        <h3 className="text-base font-bold text-gray-900">Replace Meals?</h3>
                        <p className="text-sm text-gray-600">{builder.replacePrompt}</p>
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => builder.dismissReplace()}
                                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => builder.confirmReplace()}
                                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-brand rounded-xl hover:bg-brand/90 transition-colors shadow-sm"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Unsaved changes — leave confirmation modal */}
            {showLeaveConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                        <h3 className="text-base font-bold text-gray-900">Unsaved Changes</h3>
                        <p className="text-sm text-gray-600">
                            You have unsaved changes. Leaving now will permanently discard all your work on this plan.
                        </p>
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowLeaveConfirm(false);
                                    pendingNavRef.current = null;
                                }}
                                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                Keep Editing
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const href = pendingNavRef.current;
                                    setShowLeaveConfirm(false);
                                    pendingNavRef.current = null;
                                    if (href) router.push(href);
                                }}
                                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors shadow-sm"
                            >
                                Discard & Leave
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Draft — chat + preview */}
            <AiDraftPanel
                clientId={clientId}
                templateMode={isTemplateMode}
                isOpen={showAiDraft}
                onClose={() => setShowAiDraft(false)}
                onApply={handleAiDraftApply}
            />

            {/* Replace-confirm dialog (only shown when the builder already has foods) */}
            {aiReplaceConfirmDraft && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                        <h3 className="text-base font-bold text-gray-900">Replace current meals?</h3>
                        <p className="text-sm text-gray-600">
                            The builder already has meals. Applying the AI draft will discard them and replace with {aiReplaceConfirmDraft.summary.totalItems - aiReplaceConfirmDraft.summary.blockedItems} new item(s).
                        </p>
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setAiReplaceConfirmDraft(null)}
                                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    applyAiDraft(aiReplaceConfirmDraft);
                                    setAiReplaceConfirmDraft(null);
                                }}
                                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-brand rounded-xl hover:bg-brand/90 transition-colors shadow-sm"
                            >
                                Replace
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function TemplateSetupModal({ isOpen, onClose, onConfirm }: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (result: PlanSetupResult) => void;
}) {
    const [name, setName] = useState('');
    const [nameError, setNameError] = useState('');
    const [numDays, setNumDays] = useState(7);

    const handleConfirm = () => {
        if (!name.trim()) { setNameError('Template name is required'); return; }
        onConfirm({ planName: name.trim(), startDate: new Date(), numDays, mealCount: 3, overlapStrategy: 'overwrite' });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
                <h2 className="text-lg font-bold text-gray-900">Template Setup</h2>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Template Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        autoFocus
                        value={name}
                        onChange={(e) => { setName(e.target.value); setNameError(''); }}
                        className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand ${nameError ? 'border-red-400' : 'border-gray-300'}`}
                        placeholder="e.g. PCOD 1200 kcal, Weight Loss 7-day"
                    />
                    {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-gray-400" /> Duration
                    </label>
                    <select
                        value={numDays}
                        onChange={(e) => setNumDays(parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none bg-white"
                    >
                        {[1, 2, 3, 4, 5, 6, 7, 14, 21, 28, 30].map((d) => (
                            <option key={d} value={d}>
                                {d === 1 ? '1 day' : d <= 7 ? `${d} days` : d === 14 ? '14 days (2 weeks)' : d === 21 ? '21 days (3 weeks)' : '28 days (4 weeks)'}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleConfirm} className="px-5 py-2 text-sm font-medium text-white bg-brand hover:bg-brand/90 rounded-lg transition-colors">
                        Start Building
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function DietPlanBuilderPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-brand" /></div>}>
            <BuilderContent />
        </Suspense>
    );
}
