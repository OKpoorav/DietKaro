'use client';

import { useState } from 'react';
import {
    Camera,
    ArrowRight,
    Check,
    X,
    RefreshCw,
    Loader2,
} from 'lucide-react';
import { useMealLogs, useReviewMealLog, MealLog } from '@/lib/hooks/use-meal-logs';

type FilterType = 'all' | 'pending' | 'reviewed';
type MealStatus = 'eaten' | 'skipped' | 'substituted';

export default function MealReviewPage() {
    const [filter, setFilter] = useState<FilterType>('pending');
    const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
    const [mealStatus, setMealStatus] = useState<MealStatus | null>(null);
    const [feedback, setFeedback] = useState('');

    // API hooks
    const { data, isLoading, error, refetch } = useMealLogs({
        status: filter === 'all' ? undefined : filter === 'pending' ? 'pending' : undefined,
        pageSize: 50,
    });
    const reviewMutation = useReviewMealLog();

    const mealLogs = data?.data || [];
    const selectedMeal = mealLogs.find(m => m.id === selectedMealId) || mealLogs[0];

    const handleReviewSubmit = async () => {
        if (!selectedMeal || !mealStatus) return;

        try {
            await reviewMutation.mutateAsync({
                id: selectedMeal.id,
                status: mealStatus,
                dietitianFeedback: feedback || undefined,
            });

            // Move to next meal
            const currentIndex = mealLogs.findIndex(m => m.id === selectedMeal.id);
            if (currentIndex < mealLogs.length - 1) {
                setSelectedMealId(mealLogs[currentIndex + 1].id);
            }
            setMealStatus(null);
            setFeedback('');
        } catch (err) {
            console.error('Failed to review meal:', err);
        }
    };

    const getInitials = (name?: string) => {
        if (!name) return '??';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const formatDate = (date: string) => {
        const d = new Date(date);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (d.toDateString() === today.toDateString()) return 'Today';
        if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return d.toLocaleDateString();
    };

    return (
        <div className="flex h-[calc(100vh-5rem)] -m-6">
            {/* Left Column: Meal Queue */}
            <div className="w-80 flex-shrink-0 flex flex-col bg-white border-r border-gray-200 h-full overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-gray-200">
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                        Meal Photo Review
                    </h1>
                </div>

                {/* Filters */}
                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex h-10 w-full items-center justify-center rounded-lg bg-[#17cf54]/10 p-1">
                        {(['all', 'pending', 'reviewed'] as FilterType[]).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`flex-1 h-full rounded-md text-sm font-medium transition-colors capitalize ${filter === f
                                    ? 'bg-white shadow-sm text-gray-900'
                                    : 'text-[#4e9767] hover:text-gray-900'
                                    }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Loading */}
                {isLoading && (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-[#17cf54]" />
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="p-4 text-sm text-red-600">
                        Failed to load meal logs.
                    </div>
                )}

                {/* Empty */}
                {!isLoading && !error && mealLogs.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                        No meals to review
                    </div>
                )}

                {/* Meal List */}
                <div className="flex-1 overflow-y-auto divide-y divide-gray-200">
                    {mealLogs.map((meal: MealLog) => (
                        <button
                            key={meal.id}
                            onClick={() => {
                                setSelectedMealId(meal.id);
                                setMealStatus(null);
                                setFeedback('');
                            }}
                            className={`w-full flex items-center gap-4 px-6 py-4 text-left transition-colors ${selectedMeal?.id === meal.id
                                ? 'bg-[#17cf54]/10'
                                : 'hover:bg-gray-50'
                                }`}
                        >
                            <div className="w-12 h-12 rounded-full bg-[#17cf54]/20 flex items-center justify-center text-[#17cf54] font-bold flex-shrink-0">
                                {getInitials(meal.client?.fullName)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 truncate">{meal.client?.fullName || 'Unknown'}</p>
                                <p className="text-sm text-[#4e9767] truncate">
                                    {meal.meal?.mealType || 'Meal'} - {formatDate(meal.scheduledDate)}, {meal.scheduledTime}
                                </p>
                            </div>
                            <div className="flex-shrink-0">
                                <div
                                    className={`w-3 h-3 rounded-full ${meal.status === 'pending' ? 'bg-yellow-500 animate-pulse' : 'bg-green-600'
                                        }`}
                                />
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Right Column: Review Panel */}
            <div className="flex-1 p-8 overflow-y-auto bg-gray-50">
                {selectedMeal ? (
                    <div className="max-w-2xl mx-auto space-y-6">
                        {/* Image */}
                        <div className="w-full aspect-[4/3] bg-gradient-to-br from-[#17cf54]/20 to-[#17cf54]/5 rounded-xl flex items-center justify-center border border-gray-200 overflow-hidden">
                            {selectedMeal.mealPhotoUrl ? (
                                <img
                                    src={selectedMeal.mealPhotoUrl}
                                    alt="Meal photo"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="text-center">
                                    <Camera className="w-16 h-16 text-[#17cf54]/50 mx-auto mb-2" />
                                    <p className="text-[#4e9767]">No photo uploaded</p>
                                </div>
                            )}
                        </div>

                        {/* Client Info */}
                        <div>
                            <p className="text-sm text-gray-500">
                                Reviewing {selectedMeal.client?.fullName}&apos;s {selectedMeal.meal?.mealType || 'Meal'}
                            </p>
                            <h2 className="text-2xl font-bold text-gray-900 mt-1">
                                {selectedMeal.meal?.name || 'Meal Log'}
                            </h2>
                            {selectedMeal.clientNotes && (
                                <p className="text-sm text-gray-600 mt-2 italic">
                                    &quot;{selectedMeal.clientNotes}&quot;
                                </p>
                            )}
                        </div>

                        {/* Action Radio Group */}
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-gray-700">Mark as:</p>
                            <div className="grid grid-cols-3 gap-3">
                                {(['eaten', 'skipped', 'substituted'] as MealStatus[]).map((status) => (
                                    <button
                                        key={status}
                                        onClick={() => setMealStatus(status)}
                                        className={`flex items-center justify-center gap-2 rounded-lg p-3 text-center border transition-colors capitalize ${mealStatus === status
                                            ? 'bg-[#17cf54]/20 border-[#17cf54] text-gray-900'
                                            : 'border-gray-200 hover:border-[#17cf54] text-gray-700 bg-white'
                                            }`}
                                    >
                                        {status === 'eaten' && <Check className="w-4 h-4" />}
                                        {status === 'skipped' && <X className="w-4 h-4" />}
                                        {status === 'substituted' && <RefreshCw className="w-4 h-4" />}
                                        <span className="text-sm font-medium">{status}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Feedback Text Area */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700" htmlFor="feedback">
                                Feedback
                            </label>
                            <textarea
                                id="feedback"
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                className="w-full p-3 border border-gray-200 rounded-lg bg-white text-gray-900 focus:ring-[#17cf54] focus:border-[#17cf54] placeholder-gray-400"
                                placeholder="Provide feedback or suggestions..."
                                rows={5}
                            />
                        </div>

                        {/* Action Button */}
                        <button
                            onClick={handleReviewSubmit}
                            disabled={!mealStatus || reviewMutation.isPending}
                            className="flex w-full items-center justify-center gap-2 h-12 px-4 bg-[#17cf54] text-white rounded-lg text-base font-bold transition-colors hover:bg-[#17cf54]/90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {reviewMutation.isPending ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <span>Mark as Reviewed & Next</span>
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        Select a meal to review
                    </div>
                )}
            </div>
        </div>
    );
}
