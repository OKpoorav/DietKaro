'use client';

import { AlertTriangle } from 'lucide-react';
import type { DayNutrition } from '@/lib/types/diet-plan.types';

interface NutritionSummaryProps {
    dayNutrition: DayNutrition;
    targets: { calories: number; protein: number; carbs: number; fat: number };
    hasAllergyWarning: boolean;
}

export function NutritionSummary({ dayNutrition, targets, hasAllergyWarning }: NutritionSummaryProps) {
    return (
        <aside className="col-span-3 flex flex-col gap-4 overflow-y-auto pl-2">
            {/* Allergy Warning */}
            {hasAllergyWarning && (
                <div className="bg-red-50 border border-red-300 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                        <div>
                            <h4 className="font-bold text-red-700">Allergy Warning</h4>
                            <p className="text-sm text-red-600">
                                One or more food items conflict with the client&apos;s allergies.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Nutrition Summary */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 sticky top-0">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-gray-900 font-medium">Daily Summary</h3>
                    <span className="text-xs text-gray-500">Target: {targets.calories} Kcal</span>
                </div>
                <div className="space-y-4">
                    {Object.entries(dayNutrition).map(([key, value]) => {
                        const target = targets[key as keyof typeof targets] || 100;
                        const percent = Math.min((value / target) * 100, 100);
                        return (
                            <div key={key}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-gray-800 capitalize">
                                        {key === 'calories' ? "Calories" : key}
                                    </span>
                                    <span className="font-medium text-gray-600">
                                        {Math.round(value)} / {target} {key === 'calories' ? 'kcal' : 'g'}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full transition-all ${percent > 100 ? 'bg-red-500' : 'bg-[#17cf54]'}`}
                                        style={{ width: `${percent}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </aside>
    );
}
