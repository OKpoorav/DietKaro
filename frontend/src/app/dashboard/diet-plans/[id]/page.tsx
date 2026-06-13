'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDietPlan, usePublishDietPlan, useUpdateDietPlan, useExtendDietPlan } from '@/lib/hooks/use-diet-plans';
import { ErrorBoundary } from '@/components/error-boundary';
import { ArrowLeft, Calendar, User, FileText, Utensils, Loader2, Clock, AlertCircle, Pencil, Download, Printer, RefreshCw, SquarePen, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';
import { useApiClient } from '@/lib/api/use-api-client';
import { toast } from 'sonner';
import { WhatsAppShareModal } from '@/components/diet-plan/whatsapp-share-modal';
import type { LocalMeal, LocalFoodItem } from '@/lib/types/diet-plan.types';
import { timeToMin } from '@/lib/utils/meal-order';

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
                    <Clock className="w-3 h-3 inline" /> {meal.timeOfDay}
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

function MealsSpreadsheet({ meals, startDate, dayNotes }: { meals: any[]; startDate: string; dayNotes?: Record<string, string> | null }) {
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

export default function DietPlanDetailPage() {
    const params = useParams();
    const router = useRouter();
    const planId = params.id as string;

    const api = useApiClient();
    const { data: plan, isLoading, error, refetch } = useDietPlan(planId);
    const publishMutation = usePublishDietPlan();
    const updateMutation = useUpdateDietPlan();

    const extendMutation = useExtendDietPlan();
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState('');
    const [showExtendModal, setShowExtendModal] = useState(false);
    const [extensionStartDate, setExtensionStartDate] = useState('');
    const [extendMode, setExtendMode] = useState<'repeat' | 'custom'>('repeat');
    const [extendWeeks, setExtendWeeks] = useState(1);
    const [showWhatsApp, setShowWhatsApp] = useState(false);

    // Build weeklyMeals from plan.meals for WhatsApp share
    const whatsAppData = useMemo(() => {
        if (!plan || !plan.meals || plan.meals.length === 0) {
            return { weeklyMeals: {} as Record<number, LocalMeal[]>, numDays: 0, startDate: new Date() };
        }
        const startDate = new Date(plan.startDate);
        const weeklyMeals: Record<number, LocalMeal[]> = {};
        let maxDay = 0;
        for (const meal of plan.meals) {
            let dayIdx = meal.dayOfWeek ?? 0;
            if (meal.mealDate) {
                const d = new Date(meal.mealDate);
                dayIdx = Math.floor((d.getTime() - startDate.getTime()) / 86400000);
            }
            if (dayIdx < 0) dayIdx = 0;
            if (dayIdx > maxDay) maxDay = dayIdx;
            if (!weeklyMeals[dayIdx]) weeklyMeals[dayIdx] = [];
            const foods: LocalFoodItem[] = (meal.foodItems || []).map((fi, idx) => ({
                id: fi.foodItem.id,
                tempId: `${fi.foodItem.id}-${idx}`,
                name: fi.foodItem.name,
                quantity: fi.notes || `${fi.quantityG}g`,
                quantityValue: fi.quantityG,
                calories: fi.foodItem.calories,
                protein: fi.foodItem.proteinG,
                carbs: fi.foodItem.carbsG,
                fat: fi.foodItem.fatsG,
                hasWarning: false,
                optionGroup: fi.optionGroup ?? 0,
                optionLabel: fi.optionLabel,
            }));
            weeklyMeals[dayIdx].push({
                id: meal.id,
                name: meal.name,
                type: meal.mealType,
                time: meal.timeOfDay || '',
                description: meal.description,
                instructions: meal.instructions,
                foods,
            });
        }
        return { weeklyMeals, numDays: maxDay + 1, startDate };
    }, [plan]);

    const handlePublish = async () => {
        if (!plan) return;
        try {
            await publishMutation.mutateAsync({ id: planId });
            await refetch(); // Refetch to update UI immediately
        } catch (err) {
            toast.error('Failed to publish plan');
        }
    };

    const handleSaveName = async () => {
        if (!editedName.trim() || !plan) return;
        try {
            await updateMutation.mutateAsync({ id: planId, name: editedName });
            setIsEditingName(false);
            await refetch();
        } catch (err) {
            toast.error('Failed to update name');
        }
    };

    const handleDownloadPdf = async () => {
        try {
            const response = await api.get(`/share/diet-plans/${planId}/pdf`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `${plan?.name || 'diet-plan'}.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            toast.error('Failed to download PDF');
        }
    };

    const handlePrint = async () => {
        try {
            const response = await api.get(`/share/diet-plans/${planId}/print`);
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(response.data);
                printWindow.document.close();
                printWindow.focus();
                printWindow.print();
            }
        } catch (err) {
            toast.error('Failed to get print view');
        }
    };

    const handleExtend = async () => {
        const startDate = extendMode === 'repeat' ? defaultExtensionDate : extensionStartDate;
        if (!startDate) return;
        try {
            if (extendMode === 'repeat' && extendWeeks > 1) {
                // Call extend once per week, sequentially
                for (let w = 0; w < extendWeeks; w++) {
                    // Refetch plan to get updated endDate after each extension
                    const freshPlan = w === 0 ? plan : (await refetch()).data;
                    const freshEndDate = freshPlan?.endDate;
                    const nextStart = freshEndDate
                        ? new Date(new Date(freshEndDate).getTime() + 86400000).toISOString().slice(0, 10)
                        : startDate;
                    await extendMutation.mutateAsync({ id: planId, extensionStartDate: nextStart });
                }
            } else {
                await extendMutation.mutateAsync({ id: planId, extensionStartDate: startDate });
            }
            await refetch();
            setShowExtendModal(false);
            setExtensionStartDate('');
            setExtendMode('repeat');
            setExtendWeeks(1);
            toast.success('Plan extended successfully');
        } catch {
            toast.error('Failed to extend plan');
        }
    };

    // Default extension start date to day after current end date
    const defaultExtensionDate = plan?.endDate
        ? new Date(new Date(plan.endDate).getTime() + 86400000).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

    // Number of unique days in the plan (for preview)
    const planDayCount = plan?.meals
        ? new Set(plan.meals.map((m: any) => m.mealDate?.slice(0, 10) ?? 'x')).size
        : 0;

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-brand" />
            </div>
        );
    }

    if (error || !plan) {
        return (
            <div className="text-center py-20">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Plan not found</h2>
                <p className="text-gray-500 mb-4">The diet plan you&apos;re looking for doesn&apos;t exist.</p>
                <Link href="/dashboard/diet-plans" className="text-brand hover:underline">
                    ← Back to Diet Plans
                </Link>
            </div>
        );
    }

    const statusColor = plan.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div>
                        {isEditingName ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={editedName}
                                    onChange={(e) => setEditedName(e.target.value)}
                                    className="text-2xl font-bold text-gray-900 border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveName();
                                        if (e.key === 'Escape') setIsEditingName(false);
                                    }}
                                />
                                <button
                                    onClick={handleSaveName}
                                    disabled={updateMutation.isPending}
                                    className="px-3 py-1 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50"
                                >
                                    {updateMutation.isPending ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                    onClick={() => setIsEditingName(false)}
                                    className="px-3 py-1 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold text-gray-900">
                                    {plan.name || 'Diet Plan'}
                                </h1>
                                <button
                                    onClick={() => {
                                        setEditedName(plan.name || '');
                                        setIsEditingName(true);
                                    }}
                                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                                    title="Edit name"
                                >
                                    <Pencil className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                                </button>
                            </div>
                        )}
                        <p className="text-gray-500">
                            For {plan.client?.fullName || 'Unknown Client'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => {
                            const params = new URLSearchParams({ editId: planId });
                            if (plan.clientId) params.set('clientId', plan.clientId);
                            window.open(`/dashboard/diet-plans/new?${params.toString()}`, '_blank');
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-brand/10 hover:bg-brand/20 text-brand text-sm font-medium rounded-lg transition-colors"
                        title="Edit plan in meal builder"
                    >
                        <SquarePen className="w-4 h-4" />
                        Edit Plan
                    </button>
                    {plan.status === 'active' && (
                        <button
                            onClick={() => {
                                setExtensionStartDate(defaultExtensionDate);
                                setShowExtendModal(true);
                            }}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                            title="Extend plan"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Extend
                        </button>
                    )}
                    <button
                        onClick={handleDownloadPdf}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Download PDF"
                    >
                        <Download className="w-5 h-5 text-gray-600" />
                    </button>
                    <button
                        onClick={handlePrint}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Print"
                    >
                        <Printer className="w-5 h-5 text-gray-600" />
                    </button>
                    {plan.client?.phone && (
                        <button
                            onClick={() => setShowWhatsApp(true)}
                            className="flex items-center gap-2 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 text-sm font-medium rounded-lg transition-colors"
                            title="Share on WhatsApp"
                        >
                            <MessageCircle className="w-4 h-4" />
                            Share on WhatsApp
                        </button>
                    )}
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor}`}>
                        {plan.status === 'active' ? 'Active' : 'Draft'}
                    </span>
                    {plan.status !== 'active' && (
                        <button
                            onClick={handlePublish}
                            disabled={publishMutation.isPending}
                            className="px-4 py-2 bg-brand text-white font-medium rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-50"
                        >
                            {publishMutation.isPending ? 'Publishing...' : 'Publish Plan'}
                        </button>
                    )}
                </div>
            </div>

            {/* Plan Details Card */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Plan Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Start Date</p>
                            <p className="font-medium text-gray-900">
                                {new Date(plan.startDate).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                            <User className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Client</p>
                            <p className="font-medium text-gray-900">{plan.client?.fullName || 'N/A'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                            <Utensils className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Target Calories</p>
                            <p className="font-medium text-gray-900">
                                {plan.targetCalories || 'Not set'} {plan.targetCalories && 'kcal'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Meals</p>
                            <p className="font-medium text-gray-900">{plan.meals?.length || 0} meals</p>
                        </div>
                    </div>
                </div>

                {plan.description && (
                    <div className="mt-6 pt-6 border-t border-gray-100">
                        <p className="text-sm text-gray-500 mb-2">Description</p>
                        <p className="text-gray-700">{plan.description}</p>
                    </div>
                )}
            </div>

            {/* General Guidelines — plan-level, shown under the date range before Day 1 */}
            {plan.notesForClient && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-amber-800 mb-1">
                        📅 {new Date(plan.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        {plan.endDate ? ` – ${new Date(plan.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}
                    </p>
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">General Guidelines</p>
                    <p className="text-sm text-amber-900 whitespace-pre-wrap">{plan.notesForClient}</p>
                </div>
            )}

            {/* Meals Spreadsheet */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900">Meals Schedule</h2>
                </div>
                <ErrorBoundary
                    fallback={
                        <div className="text-center py-8 text-red-500 px-6">
                            <p className="font-medium">Could not display meals</p>
                            <p className="text-sm text-gray-500 mt-1">The plan data may be corrupted. Try refreshing.</p>
                        </div>
                    }
                >
                {plan.meals && plan.meals.length > 0 ? (
                    <MealsSpreadsheet meals={plan.meals} startDate={plan.startDate} dayNotes={plan.dayNotes} />
                ) : (
                    <div className="text-center py-12 text-gray-500">
                        <Utensils className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p>No meals added yet</p>
                    </div>
                )}
                </ErrorBoundary>
            </div>

            {/* Extend Modal */}
            {showExtendModal && (() => {
                const effectiveStart = extendMode === 'repeat' ? defaultExtensionDate : extensionStartDate;
                const totalDays = extendMode === 'repeat' ? planDayCount * extendWeeks : planDayCount;
                const canExtend = extendMode === 'repeat' ? !!defaultExtensionDate : !!extensionStartDate;

                return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">Extend Plan</h3>
                        <p className="text-sm text-gray-500 mb-5">
                            The existing {planDayCount}-day meal rotation will be repeated.
                            Day 1 maps to the start date, Day 2 to the next day, and so on.
                        </p>

                        {/* Mode selection */}
                        <div className="space-y-3 mb-5">
                            <label
                                className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                                    extendMode === 'repeat' ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-gray-300'
                                }`}
                                onClick={() => setExtendMode('repeat')}
                            >
                                <input
                                    type="radio"
                                    name="extendMode"
                                    checked={extendMode === 'repeat'}
                                    onChange={() => setExtendMode('repeat')}
                                    className="mt-0.5 accent-brand"
                                />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">Quick repeat</p>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        Continue from{' '}
                                        <span className="font-medium text-gray-700">
                                            {new Date(defaultExtensionDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                        </span>
                                    </p>
                                    {extendMode === 'repeat' && (
                                        <div className="mt-2 flex items-center gap-2">
                                            <span className="text-sm text-gray-600">Repeat for</span>
                                            <select
                                                value={extendWeeks}
                                                onChange={e => setExtendWeeks(Number(e.target.value))}
                                                className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                                            >
                                                {[1, 2, 3, 4].map(w => (
                                                    <option key={w} value={w}>{w} week{w > 1 ? 's' : ''}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </label>

                            <label
                                className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                                    extendMode === 'custom' ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-gray-300'
                                }`}
                                onClick={() => setExtendMode('custom')}
                            >
                                <input
                                    type="radio"
                                    name="extendMode"
                                    checked={extendMode === 'custom'}
                                    onChange={() => setExtendMode('custom')}
                                    className="mt-0.5 accent-brand"
                                />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">Custom start date</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Pick a specific date to start the extension</p>
                                    {extendMode === 'custom' && (
                                        <input
                                            type="date"
                                            value={extensionStartDate}
                                            min={new Date().toISOString().slice(0, 10)}
                                            onChange={e => setExtensionStartDate(e.target.value)}
                                            className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                                        />
                                    )}
                                </div>
                            </label>
                        </div>

                        {effectiveStart && totalDays > 0 && (
                            <p className="text-xs text-gray-400 mb-5">
                                Will add meals from{' '}
                                <span className="font-medium text-gray-600">
                                    {new Date(effectiveStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                                {' '}({totalDays} day{totalDays !== 1 ? 's' : ''} total)
                            </p>
                        )}

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => { setShowExtendModal(false); setExtendMode('repeat'); setExtendWeeks(1); }}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleExtend}
                                disabled={!canExtend || extendMutation.isPending}
                                className="px-4 py-2 text-sm font-medium text-white bg-brand hover:bg-brand/90 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {extendMutation.isPending ? 'Extending…' : 'Extend Plan'}
                            </button>
                        </div>
                    </div>
                </div>
                );
            })()}

            {/* WhatsApp share modal */}
            {showWhatsApp && plan.client?.phone && (
                <WhatsAppShareModal
                    phone={plan.client.phone}
                    clientName={plan.client.fullName}
                    planName={plan.name}
                    startDate={whatsAppData.startDate}
                    numDays={whatsAppData.numDays}
                    weeklyMeals={whatsAppData.weeklyMeals}
                    dayNotes={plan.dayNotes
                        ? Object.fromEntries(Object.entries(plan.dayNotes).map(([k, v]) => [Number(k), v]))
                        : undefined}
                    generalGuidelines={plan.notesForClient ?? undefined}
                    onClose={() => setShowWhatsApp(false)}
                />
            )}
        </div>
    );
}
