'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDietPlan, usePublishDietPlan, useUpdateDietPlan } from '@/lib/hooks/use-diet-plans';
import { ErrorBoundary } from '@/components/error-boundary';
import { ArrowLeft, Calendar, User, FileText, Utensils, Loader2, Clock, AlertCircle, Pencil, Download, Printer } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useApiClient } from '@/lib/api/use-api-client';
import { toast } from 'sonner';

export default function DietPlanDetailPage() {
    const params = useParams();
    const router = useRouter();
    const planId = params.id as string;

    const api = useApiClient();
    const { data: plan, isLoading, error, refetch } = useDietPlan(planId);
    const publishMutation = usePublishDietPlan();
    const updateMutation = useUpdateDietPlan();

    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState('');

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

            {/* Meals Section */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Meals</h2>
                <ErrorBoundary
                    fallback={
                        <div className="text-center py-8 text-red-500">
                            <p className="font-medium">Could not display meals</p>
                            <p className="text-sm text-gray-500 mt-1">The plan data may be corrupted. Try refreshing.</p>
                        </div>
                    }
                >
                {plan.meals && plan.meals.length > 0 ? (
                    <div className="space-y-4">
                        {plan.meals.map((meal, index) => {
                            // Group food items by optionGroup
                            const optionGroups = new Map<number, typeof meal.foodItems>();
                            (meal.foodItems || []).forEach((fi: any) => {
                                const g = fi.optionGroup ?? 0;
                                if (!optionGroups.has(g)) optionGroups.set(g, []);
                                optionGroups.get(g)!.push(fi);
                            });
                            const sortedGroups = Array.from(optionGroups.entries()).sort(([a], [b]) => a - b);
                            const hasAlts = sortedGroups.length > 1;

                            return (
                                <div key={meal.id || index} className="p-4 bg-gray-50 rounded-lg">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="font-medium text-gray-900">{meal.name}</h3>
                                        <div className="flex items-center gap-2">
                                            {hasAlts && (
                                                <span className="text-xs font-medium text-blue-500 bg-blue-50 px-2 py-0.5 rounded">
                                                    {sortedGroups.length} options
                                                </span>
                                            )}
                                            <span className="text-sm text-gray-500 capitalize">{meal.mealType}</span>
                                        </div>
                                    </div>
                                    {meal.timeOfDay && (
                                        <p className="text-sm text-gray-500 flex items-center gap-1">
                                            <Clock className="w-4 h-4" />
                                            {meal.timeOfDay}
                                        </p>
                                    )}
                                    {sortedGroups.length > 0 && (
                                        <div className="mt-3">
                                            {sortedGroups.map(([groupNum, foods], gIdx) => (
                                                <div key={groupNum}>
                                                    {hasAlts && gIdx > 0 && (
                                                        <div className="flex items-center gap-2 my-2">
                                                            <div className="flex-grow border-t border-dashed border-gray-300" />
                                                            <span className="text-xs font-bold text-gray-400 tracking-wider">OR</span>
                                                            <div className="flex-grow border-t border-dashed border-gray-300" />
                                                        </div>
                                                    )}
                                                    {hasAlts && (
                                                        <p className="text-xs font-semibold text-brand mb-1">
                                                            {(foods as any)[0]?.optionLabel || `Option ${String.fromCharCode(65 + gIdx)}`}
                                                        </p>
                                                    )}
                                                    <div className="space-y-1">
                                                        {(foods as any[]).map((food: any, fi: number) => (
                                                            <div key={fi} className="text-sm text-gray-600 flex justify-between">
                                                                <span>{food.foodItem?.name || 'Unknown'}</span>
                                                                <span>{food.quantityG}g</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500">
                        <Utensils className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p>No meals added yet</p>
                    </div>
                )}
                </ErrorBoundary>
            </div>
        </div>
    );
}
