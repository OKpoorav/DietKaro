'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDietPlan, usePublishDietPlan, useUpdateDietPlan, useExtendDietPlan } from '@/lib/hooks/use-diet-plans';
import { ErrorBoundary } from '@/components/error-boundary';
import { ArrowLeft, Calendar, User, FileText, Utensils, Loader2, Clock, AlertCircle, Pencil, Download, Printer, RefreshCw, SquarePen } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useApiClient } from '@/lib/api/use-api-client';
import { toast } from 'sonner';

// Default column ordering — meals whose name matches get this priority, rest sorted by time
const KNOWN_MEAL_ORDER: Record<string, number> = {
    'breakfast': 0, 'early morning': 0,
    'mid-morning': 1, 'mid morning': 1,
    'lunch': 2,
    'snack': 3, 'evening snack': 3,
    'dinner': 4,
    'post dinner': 5, 'post-dinner': 5,
};

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
                            <span className="text-gray-400 whitespace-nowrap shrink-0">{food.quantityG}g</span>
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

function MealsSpreadsheet({ meals, startDate }: { meals: any[]; startDate: string }) {
    // Build date → mealName → meal[] map, using meal name as the column key
    const dateMap = new Map<string, Map<string, any[]>>();
    const columnSet = new Map<string, { time: string }>(); // track earliest time per column

    for (const meal of meals) {
        const d = getMealDate(meal, startDate);
        const key = formatDateKey(d);
        const colName = (meal.name || meal.mealType || 'Other').trim();
        const colKey = colName.toLowerCase();

        if (!columnSet.has(colKey)) {
            columnSet.set(colKey, { time: meal.timeOfDay || '99:99' });
        } else if (meal.timeOfDay && meal.timeOfDay < columnSet.get(colKey)!.time) {
            columnSet.get(colKey)!.time = meal.timeOfDay;
        }

        if (!dateMap.has(key)) dateMap.set(key, new Map());
        const nameMap = dateMap.get(key)!;
        if (!nameMap.has(colKey)) nameMap.set(colKey, []);
        nameMap.get(colKey)!.push(meal);
    }

    const sortedDates = Array.from(dateMap.keys()).sort();

    // Sort columns: known meals first by priority, then by earliest time
    const columns = Array.from(columnSet.entries())
        .sort(([aKey, aInfo], [bKey, bInfo]) => {
            const aOrder = KNOWN_MEAL_ORDER[aKey] ?? 50;
            const bOrder = KNOWN_MEAL_ORDER[bKey] ?? 50;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return (aInfo.time || '99:99').localeCompare(bInfo.time || '99:99');
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

                        return (
                            <tr key={dateKey} className={isEven ? 'bg-white' : 'bg-gray-50/50'}>
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

    const handlePublish = async () => {
        if (!plan) return;
        try {
            await publishMutation.mutateAsync(planId);
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
        if (!extensionStartDate) return;
        try {
            await extendMutation.mutateAsync({ id: planId, extensionStartDate });
            await refetch();
            setShowExtendModal(false);
            setExtensionStartDate('');
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
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
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
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            const params = new URLSearchParams({ editId: planId });
                            if (plan.clientId) params.set('clientId', plan.clientId);
                            router.push(`/dashboard/diet-plans/new?${params.toString()}`);
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
                    <MealsSpreadsheet meals={plan.meals} startDate={plan.startDate} />
                ) : (
                    <div className="text-center py-12 text-gray-500">
                        <Utensils className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p>No meals added yet</p>
                    </div>
                )}
                </ErrorBoundary>
            </div>

            {/* Extend Modal */}
            {showExtendModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">Extend Plan</h3>
                        <p className="text-sm text-gray-500 mb-5">
                            The existing {planDayCount}-day meal rotation will be repeated starting from the date you choose.
                            Day 1 → selected date, Day 2 → next day, and so on.
                        </p>

                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Extension start date
                        </label>
                        <input
                            type="date"
                            value={extensionStartDate}
                            min={new Date().toISOString().slice(0, 10)}
                            onChange={e => setExtensionStartDate(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand focus:border-transparent outline-none mb-2"
                        />

                        {extensionStartDate && planDayCount > 0 && (
                            <p className="text-xs text-gray-400 mb-5">
                                Will add meals from{' '}
                                <span className="font-medium text-gray-600">
                                    {new Date(extensionStartDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                                {' '}to{' '}
                                <span className="font-medium text-gray-600">
                                    {new Date(new Date(extensionStartDate + 'T00:00:00').getTime() + (planDayCount - 1) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                                {' '}({planDayCount} day{planDayCount !== 1 ? 's' : ''})
                            </p>
                        )}

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowExtendModal(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleExtend}
                                disabled={!extensionStartDate || extendMutation.isPending}
                                className="px-4 py-2 text-sm font-medium text-white bg-brand hover:bg-brand/90 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {extendMutation.isPending ? 'Extending…' : 'Extend Plan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
