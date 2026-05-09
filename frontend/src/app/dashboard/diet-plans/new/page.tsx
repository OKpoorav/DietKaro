'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Send, Loader2, LayoutTemplate, SlidersHorizontal, Copy, ClipboardPaste, Eraser, Columns2, Square, Clock } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { AddFoodModal } from '@/components/modals/add-food-modal';
import { ClientSelector } from '@/components/diet-plan/client-selector';
import { ClientInfoCard, ClientRestrictionsCard } from '@/components/diet-plan/client-info-card';
import { MedicalSidebar } from '@/components/diet-plan/medical-sidebar';
import { DayNavigator } from '@/components/diet-plan/day-navigator';
import { MealEditor } from '@/components/diet-plan/meal-editor';
import { NutritionSummary } from '@/components/diet-plan/nutrition-summary';
import { TemplateSidebar, type MealSlotPreset } from '@/components/diet-plan/template-sidebar';
import { PlanSetupModal, PlanSetupResult } from '@/components/diet-plan/plan-setup-modal';
import { BulkPortionModal } from '@/components/diet-plan/bulk-portion-modal';
import { useClient } from '@/lib/hooks/use-clients';
import { calculateAge } from '@/lib/utils/formatters';
import { useDietPlans } from '@/lib/hooks/use-diet-plans';
import { useMealBuilder } from '@/lib/hooks/use-meal-builder';

interface BuilderPaneProps {
    dayIndex: number;
    setDayIndex: (n: number) => void;
    paneLabel?: string; // e.g. "A" / "B" — only shown in split mode
    otherPaneDay?: number;
    builder: ReturnType<typeof useMealBuilder>;
    isTemplateMode: boolean;
}

function BuilderPane({ dayIndex, setDayIndex, paneLabel, otherPaneDay, builder, isTemplateMode }: BuilderPaneProps) {
    const sameDay = otherPaneDay !== undefined && otherPaneDay === dayIndex;
    const dayMeals = builder.getDayMeals(dayIndex);
    const dayKcal = builder.getDayNutrition(dayIndex).calories;

    return (
        <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-y-auto pr-1">
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
                        title="Copy Day"
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

    // Plan setup state — modal shown after client selection, before builder (non-template only)
    const [setupResult, setSetupResult] = useState<PlanSetupResult | null>(editId ? { planName: '', startDate: new Date(), numDays: 1, mealCount: 3, overlapStrategy: 'overwrite' } : null);
    const [showSetupModal, setShowSetupModal] = useState(false);
    const [showBulkModal, setShowBulkModal] = useState(false);

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
        onSaved: (isTemplate) => {
            if (isTemplate) {
                router.push('/dashboard/diet-plans?tab=templates');
            } else if (clientId) {
                router.push(`/dashboard/clients/${clientId}`);
            } else {
                router.push('/dashboard/diet-plans');
            }
        },
    });

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

    // Auto-show plan setup modal once client is ready — must be before early returns (Rules of Hooks)
    useEffect(() => {
        if (!isTemplateMode && !editId && !setupResult && client && !showSetupModal) {
            setShowSetupModal(true);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client]);

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
                    onClose={() => router.back()}
                    clientId={clientId!}
                    clientName={client?.fullName || ''}
                    slotTemplates={templates.filter(t => t.templateCategory === 'slot_template')}
                    onConfirm={(result) => {
                        setSetupResult(result);
                        setShowSetupModal(false);
                    }}
                />
            </>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-5rem)] -m-6">
            {/* Top Header */}
            <header className="flex items-center justify-between border-b border-gray-200 px-6 py-3 bg-white flex-shrink-0">
                <div className="flex items-center gap-6">
                    <Link
                        href={isTemplateMode ? '/dashboard/diet-plans' : `/dashboard/clients/${clientId}`}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {isTemplateMode ? 'Back to Templates' : 'Back to Client'}
                    </Link>
                    <div className="flex items-center gap-2">
                        <input
                            value={builder.planName}
                            onChange={e => builder.setPlanName(e.target.value)}
                            className="text-gray-900 text-sm font-medium border-none focus:ring-0"
                        />
                        {!isTemplateMode && client && (
                            <>
                                <span className="text-gray-400">|</span>
                                <span className="text-gray-800 text-sm font-bold">
                                    {client.fullName} ({calculateAge(client.dateOfBirth) ?? '?'} yrs)
                                </span>
                            </>
                        )}
                        {isTemplateMode && (
                            <>
                                <span className="text-gray-400">|</span>
                                <span className="text-purple-600 text-sm font-medium">Template</span>
                            </>
                        )}
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setSplitMode(s => !s)}
                        className={`h-10 px-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                            splitMode ? 'bg-brand/10 text-brand hover:bg-brand/20' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                        title={splitMode ? 'Exit split view' : 'Split builder into two panes'}
                    >
                        {splitMode ? <Square className="w-4 h-4" /> : <Columns2 className="w-4 h-4" />}
                        {splitMode ? 'Single' : 'Split'}
                    </button>
                    {isTemplateMode ? (
                        <div className="flex gap-2">
                            <button
                                onClick={() => builder.save(false, true)}
                                disabled={builder.isSaving}
                                className="flex items-center gap-2 h-10 px-4 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                            >
                                <LayoutTemplate className="w-4 h-4" />
                                Save as Meal Structure
                            </button>
                            <button
                                onClick={() => builder.save(false)}
                                disabled={builder.isSaving}
                                className="flex items-center gap-2 h-10 px-4 bg-brand hover:bg-brand/90 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                {builder.isSaving ? 'Saving...' : (builder.isEditMode ? 'Update Template' : 'Save Template')}
                            </button>
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={() => setShowBulkModal(true)}
                                className="flex items-center gap-2 h-10 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                                title="Adjust Portions"
                            >
                                <SlidersHorizontal className="w-4 h-4" />
                                Portions
                            </button>
                            <button
                                onClick={() => builder.save(false)}
                                disabled={builder.isSaving}
                                className="flex items-center gap-2 h-10 px-4 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                Save Draft
                            </button>
                            <button
                                onClick={() => builder.save(true)}
                                disabled={builder.isSaving}
                                className="flex items-center gap-2 h-10 px-4 bg-brand hover:bg-brand/90 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                            >
                                <Send className="w-4 h-4" />
                                Publish
                            </button>
                        </>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-grow grid grid-cols-12 gap-4 p-4 overflow-hidden bg-gray-50">
                {/* Left Sidebar — scrolls as one column, each card has min-height */}
                <aside className="col-span-3 flex flex-col overflow-y-auto overflow-x-hidden pr-2 gap-3 pb-4">
                    <div className="flex-shrink-0">
                        <ClientInfoCard client={client} isTemplateMode={isTemplateMode} />
                    </div>

                    {!isTemplateMode && client && (
                        <div className="flex-shrink-0 min-h-[160px]">
                            <ClientRestrictionsCard client={client} />
                        </div>
                    )}

                    {!isTemplateMode && clientId && (
                        <div className="flex-shrink-0 min-h-[280px]">
                            <MedicalSidebar clientId={clientId} />
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
                </aside>

                {/* Center — Meal Editor (single or split) */}
                <section className="col-span-6 flex overflow-hidden gap-3">
                    <BuilderPane
                        dayIndex={selectedDayA}
                        setDayIndex={setSelectedDayA}
                        paneLabel={splitMode ? 'A' : undefined}
                        otherPaneDay={splitMode ? selectedDayB : undefined}
                        builder={builder}
                        isTemplateMode={isTemplateMode}
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
                </section>

                {/* Right Sidebar - Nutrition Summary (bound to pane A) */}
                <NutritionSummary
                    dayNutrition={builder.getDayNutrition(selectedDayA)}
                    targets={builder.targets}
                    hasAllergyWarning={builder.getHasAllergyWarning(selectedDayA)}
                    onTargetsChange={builder.setTargets}
                    client={client}
                    hideCaloriesFromClient={builder.hideCaloriesFromClient}
                    onHideCaloriesChange={builder.setHideCaloriesFromClient}
                    meals={builder.getDayMeals(selectedDayA)}
                />
            </main>

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
                        <p className="text-sm text-gray-600">Where should this meal structure be applied?</p>
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
