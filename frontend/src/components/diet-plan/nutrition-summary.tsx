'use client';

import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Pencil, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { DayNutrition } from '@/lib/types/diet-plan.types';

interface NutritionTargets {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

interface NutritionSummaryProps {
    dayNutrition: DayNutrition;
    targets: NutritionTargets;
    hasAllergyWarning: boolean;
    onTargetsChange?: (targets: NutritionTargets) => void;
}

const FIELD_CONFIG: { key: keyof NutritionTargets; label: string; unit: string; min: number; max: number }[] = [
    { key: 'calories', label: 'Calories', unit: 'kcal', min: 500, max: 10000 },
    { key: 'protein', label: 'Protein', unit: 'g', min: 0, max: 500 },
    { key: 'carbs', label: 'Carbs', unit: 'g', min: 0, max: 1000 },
    { key: 'fat', label: 'Fat', unit: 'g', min: 0, max: 500 },
];

export function NutritionSummary({ dayNutrition, targets, hasAllergyWarning, onTargetsChange }: NutritionSummaryProps) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<NutritionTargets>(targets);

    // Toast when any nutrient exceeds target (non-blocking, once per field)
    const toastedRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        FIELD_CONFIG.forEach(({ key, label, unit }) => {
            const value = dayNutrition[key];
            const target = targets[key];
            if (target > 0 && value > target && !toastedRef.current.has(key)) {
                toastedRef.current.add(key);
                toast.warning(`${label} is over target: ${Math.round(value)} / ${target} ${unit}`);
            }
            // Reset if it goes back under so it can fire again
            if (target > 0 && value <= target) {
                toastedRef.current.delete(key);
            }
        });
    }, [dayNutrition, targets]);

    const startEdit = () => {
        setDraft(targets);
        setEditing(true);
    };

    const saveEdit = () => {
        onTargetsChange?.(draft);
        setEditing(false);
    };

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
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Target: {targets.calories} Kcal</span>
                        {onTargetsChange && (
                            editing ? (
                                <button
                                    onClick={saveEdit}
                                    className="p-1 rounded hover:bg-green-50 text-green-600"
                                    title="Save targets"
                                >
                                    <Check className="w-3.5 h-3.5" />
                                </button>
                            ) : (
                                <button
                                    onClick={startEdit}
                                    className="p-1 rounded hover:bg-gray-100 text-gray-400"
                                    title="Edit targets"
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                </button>
                            )
                        )}
                    </div>
                </div>

                {editing ? (
                    <div className="space-y-3">
                        {FIELD_CONFIG.map(({ key, label, unit, min, max }) => (
                            <div key={key}>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">{label} ({unit})</label>
                                <input
                                    type="number"
                                    min={min}
                                    max={max}
                                    value={draft[key]}
                                    onChange={e => setDraft(prev => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
                                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-[#17cf54] focus:border-[#17cf54] outline-none"
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {FIELD_CONFIG.map(({ key, label, unit }) => {
                            const value = dayNutrition[key];
                            const target = targets[key] || 100;
                            const rawPercent = target > 0 ? (value / target) * 100 : 0;
                            const isOver = rawPercent > 100;
                            const barWidth = Math.min(rawPercent, 100);
                            return (
                                <div key={key}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-medium text-gray-800">{label}</span>
                                        <span className={`font-medium ${isOver ? 'text-red-600' : 'text-gray-600'}`}>
                                            {Math.round(value)} / {target} {unit}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full transition-all ${isOver ? 'bg-red-500' : 'bg-[#17cf54]'}`}
                                            style={{ width: `${barWidth}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </aside>
    );
}
