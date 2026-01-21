'use client';

import { AlertTriangle, Ban, Heart, Shield, Calendar, Scale, Info } from 'lucide-react';
import type { FoodRestriction } from '@/lib/hooks/use-validation';

interface ClientRestrictionsSummaryProps {
    allergies?: string[];
    intolerances?: string[];
    dietPattern?: string | null;
    medicalConditions?: string[];
    foodRestrictions?: FoodRestriction[];
    dislikes?: string[];
    likedFoods?: string[];
    className?: string;
}

// Map diet pattern to display
const DIET_PATTERN_DISPLAY: Record<string, { label: string; color: string }> = {
    vegetarian: { label: 'Vegetarian', color: 'bg-green-100 text-green-700' },
    vegan: { label: 'Vegan', color: 'bg-emerald-100 text-emerald-700' },
    non_veg: { label: 'Non-Vegetarian', color: 'bg-orange-100 text-orange-700' },
    pescatarian: { label: 'Pescatarian', color: 'bg-blue-100 text-blue-700' },
    eggetarian: { label: 'Eggetarian', color: 'bg-yellow-100 text-yellow-700' },
};

// Format restriction for display
const formatRestriction = (r: FoodRestriction): string => {
    const target = r.foodCategory || r.foodName || 'Food';

    if (r.restrictionType === 'day_based') {
        const days = r.avoidDays?.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ') || '';
        return `No ${target} on ${days}`;
    }
    if (r.restrictionType === 'always') {
        return `Never ${target}`;
    }
    if (r.restrictionType === 'quantity') {
        return `${target}: max ${r.maxGramsPerMeal}g/meal`;
    }
    if (r.restrictionType === 'time_based') {
        return `No ${target} during ${r.avoidMeals?.join(', ') || 'certain meals'}`;
    }
    if (r.restrictionType === 'frequency') {
        return `${target}: max ${r.maxPerWeek || r.maxPerDay}/week`;
    }
    return `${target} restricted`;
};

export function ClientRestrictionsSummary({
    allergies = [],
    intolerances = [],
    dietPattern,
    medicalConditions = [],
    foodRestrictions = [],
    dislikes = [],
    likedFoods = [],
    className = ''
}: ClientRestrictionsSummaryProps) {
    const hasAnyRestrictions =
        allergies.length > 0 ||
        intolerances.length > 0 ||
        dietPattern ||
        medicalConditions.length > 0 ||
        foodRestrictions.length > 0 ||
        dislikes.length > 0;

    if (!hasAnyRestrictions && likedFoods.length === 0) {
        return (
            <div className={`p-4 bg-gray-50 rounded-lg text-center text-gray-500 text-sm ${className}`}>
                <Info className="w-5 h-5 mx-auto mb-1 opacity-50" />
                No dietary restrictions recorded
            </div>
        );
    }

    return (
        <div className={`space-y-3 ${className}`}>
            {/* Allergies - RED */}
            {allergies.length > 0 && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                    <div className="flex items-center gap-2 mb-2">
                        <Ban className="w-4 h-4 text-red-500" />
                        <span className="text-sm font-medium text-red-700">Allergies</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {allergies.map((allergy, i) => (
                            <span
                                key={i}
                                className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full"
                            >
                                {allergy}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Intolerances - RED */}
            {intolerances.length > 0 && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span className="text-sm font-medium text-red-700">Intolerances</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {intolerances.map((intolerance, i) => (
                            <span
                                key={i}
                                className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full"
                            >
                                {intolerance}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Diet Pattern - BLUE */}
            {dietPattern && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium text-blue-700">Diet Pattern</span>
                    </div>
                    <span className={`mt-2 inline-block px-2 py-0.5 text-xs rounded-full ${DIET_PATTERN_DISPLAY[dietPattern]?.color || 'bg-gray-100 text-gray-700'
                        }`}>
                        {DIET_PATTERN_DISPLAY[dietPattern]?.label || dietPattern}
                    </span>
                </div>
            )}

            {/* Food Restrictions - ORANGE */}
            {foodRestrictions.length > 0 && (
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                    <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-4 h-4 text-orange-500" />
                        <span className="text-sm font-medium text-orange-700">Food Restrictions</span>
                    </div>
                    <ul className="space-y-1">
                        {foodRestrictions.map((restriction, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-orange-700">
                                <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${restriction.severity === 'strict' ? 'bg-red-400' : 'bg-yellow-400'
                                    }`} />
                                <span>
                                    {formatRestriction(restriction)}
                                    {restriction.excludes && restriction.excludes.length > 0 && (
                                        <span className="text-green-600"> (except {restriction.excludes.join(', ')})</span>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Medical Conditions - YELLOW */}
            {medicalConditions.length > 0 && (
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                    <div className="flex items-center gap-2 mb-2">
                        <Scale className="w-4 h-4 text-yellow-600" />
                        <span className="text-sm font-medium text-yellow-700">Medical Conditions</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {medicalConditions.map((condition, i) => (
                            <span
                                key={i}
                                className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full"
                            >
                                {condition.replace(/_/g, ' ')}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Dislikes - GRAY */}
            {dislikes.length > 0 && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-600">Dislikes</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {dislikes.slice(0, 5).map((dislike, i) => (
                            <span
                                key={i}
                                className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full"
                            >
                                {dislike}
                            </span>
                        ))}
                        {dislikes.length > 5 && (
                            <span className="px-2 py-0.5 text-gray-500 text-xs">
                                +{dislikes.length - 5} more
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Liked Foods - GREEN */}
            {likedFoods.length > 0 && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                    <div className="flex items-center gap-2 mb-2">
                        <Heart className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium text-green-700">Favorites</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {likedFoods.slice(0, 5).map((food, i) => (
                            <span
                                key={i}
                                className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full"
                            >
                                {food}
                            </span>
                        ))}
                        {likedFoods.length > 5 && (
                            <span className="px-2 py-0.5 text-green-600 text-xs">
                                +{likedFoods.length - 5} more
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
