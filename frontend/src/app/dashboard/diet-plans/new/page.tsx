'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Send, Loader2 } from 'lucide-react';
import { AddFoodModal } from '@/components/modals/add-food-modal';
import { ClientSelector } from '@/components/diet-plan/client-selector';
import { ClientInfoCard } from '@/components/diet-plan/client-info-card';
import { DayNavigator } from '@/components/diet-plan/day-navigator';
import { MealEditor } from '@/components/diet-plan/meal-editor';
import { NutritionSummary } from '@/components/diet-plan/nutrition-summary';
import { TemplateSidebar } from '@/components/diet-plan/template-sidebar';
import { useClient } from '@/lib/hooks/use-clients';
import { useDietPlans } from '@/lib/hooks/use-diet-plans';
import { useMealBuilder } from '@/lib/hooks/use-meal-builder';

function BuilderContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const clientId = searchParams.get('clientId');
    const isTemplateMode = searchParams.get('template') === 'true';

    const { data: client, isLoading: clientLoading } = useClient(
        !isTemplateMode && clientId ? clientId : ''
    );

    // Fetch templates for sidebar
    const { data: templatesData } = useDietPlans({ isTemplate: true, pageSize: 50 });
    const templates = templatesData?.data || [];

    const builder = useMealBuilder({
        clientId,
        isTemplateMode,
        client,
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

    // Client selection screen
    if (!isTemplateMode && !clientId) {
        return <ClientSelector />;
    }

    if (!isTemplateMode && clientLoading) {
        return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;
    }

    if (!isTemplateMode && !client) {
        return <div className="p-8 text-center text-red-500">Client not found.</div>;
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
                                <span className="text-gray-600 text-sm">
                                    {client.fullName} ({client.dateOfBirth ?
                                        Math.floor((new Date().getTime() - new Date(client.dateOfBirth).getTime()) / 3.15576e10) :
                                        '?'
                                    } yrs)
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
                    {isTemplateMode ? (
                        <button
                            onClick={() => builder.save(false)}
                            disabled={builder.isSaving}
                            className="flex items-center gap-2 h-10 px-4 bg-[#17cf54] hover:bg-[#17cf54]/90 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {builder.isSaving ? 'Saving...' : 'Save Template'}
                        </button>
                    ) : (
                        <>
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
                                className="flex items-center gap-2 h-10 px-4 bg-[#17cf54] hover:bg-[#17cf54]/90 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
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
                {/* Left Sidebar */}
                <aside className="col-span-3 flex flex-col gap-4 overflow-y-auto pr-2">
                    <ClientInfoCard client={client} isTemplateMode={isTemplateMode} />
                    <TemplateSidebar
                        templates={templates}
                        applyingTemplateId={builder.applyingTemplateId}
                        onApplyTemplate={builder.applyTemplate}
                    />
                </aside>

                {/* Center - Meal Editor */}
                <section className="col-span-6 flex flex-col gap-4 overflow-y-auto">
                    <DayNavigator
                        planDates={builder.planDates}
                        selectedDayIndex={builder.selectedDayIndex}
                        onSelectDay={builder.setSelectedDayIndex}
                        isTemplateMode={isTemplateMode}
                    />
                    <MealEditor
                        meals={builder.currentMeals}
                        onAddMeal={builder.addMeal}
                        onRemoveMeal={builder.removeMeal}
                        onOpenAddFood={builder.openAddFood}
                        onRemoveFood={builder.removeFood}
                        onUpdateFoodQuantity={builder.updateFoodQuantity}
                        onUpdateMealField={builder.updateMealField}
                    />
                </section>

                {/* Right Sidebar - Nutrition Summary */}
                <NutritionSummary
                    dayNutrition={builder.dayNutrition}
                    targets={builder.targets}
                    hasAllergyWarning={builder.hasAllergyWarning}
                />
            </main>

            {/* Add Food Modal */}
            <AddFoodModal
                isOpen={builder.showAddFoodModal}
                onClose={() => builder.setShowAddFoodModal(false)}
                mealType={builder.currentMeals.find(m => m.id === builder.activeMealId)?.name || 'Meal'}
                clientId={clientId}
                currentDay={builder.planDates[builder.selectedDayIndex]?.day.toLowerCase()}
                onAddFood={builder.addFood}
            />
        </div>
    );
}

export default function DietPlanBuilderPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-[#17cf54]" /></div>}>
            <BuilderContent />
        </Suspense>
    );
}
