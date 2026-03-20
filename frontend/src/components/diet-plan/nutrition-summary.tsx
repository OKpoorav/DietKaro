'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { AlertTriangle, Pencil, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { DayNutrition } from '@/lib/types/diet-plan.types';

interface NutritionTargets {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

interface ClientMeasurements {
    heightCm?: number;
    currentWeightKg?: number;
    targetWeightKg?: number;
    gender?: string;
    activityLevel?: string;
    dateOfBirth?: string;
    latestMeasurement?: {
        logDate: string;
        chestCm: number | null;
        waistCm: number | null;
        hipsCm: number | null;
        thighsCm: number | null;
        armsCm: number | null;
        bodyFatPercentage: number | null;
    } | null;
}

interface NutritionSummaryProps {
    dayNutrition: DayNutrition;
    targets: NutritionTargets;
    hasAllergyWarning: boolean;
    onTargetsChange?: (targets: NutritionTargets) => void;
    client?: ClientMeasurements | null;
}

const FIELD_CONFIG: { key: keyof NutritionTargets; label: string; unit: string; min: number; max: number }[] = [
    { key: 'calories', label: 'Calories', unit: 'kcal', min: 500, max: 10000 },
    { key: 'protein', label: 'Protein', unit: 'g', min: 0, max: 500 },
    { key: 'carbs', label: 'Carbs', unit: 'g', min: 0, max: 1000 },
    { key: 'fat', label: 'Fat', unit: 'g', min: 0, max: 500 },
];

export function NutritionSummary({ dayNutrition, targets, hasAllergyWarning, onTargetsChange, client }: NutritionSummaryProps) {
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
                                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-brand focus:border-brand outline-none"
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
                                            className={`h-2 rounded-full transition-all ${isOver ? 'bg-red-500' : 'bg-brand'}`}
                                            style={{ width: `${barWidth}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Client Measurements */}
            {client && (client.heightCm || client.currentWeightKg) && (
                <MeasurementsCard client={client} />
            )}
        </aside>
    );
}

function MeasurementsCard({ client }: { client: ClientMeasurements }) {
    const { stats, logDate } = useMemo(() => {
        const m = client.latestMeasurement;
        const bmi = client.heightCm && client.currentWeightKg
            ? client.currentWeightKg / ((client.heightCm / 100) ** 2)
            : null;
        const bmiColor = bmi
            ? bmi < 18.5 ? 'text-yellow-600' : bmi < 25 ? 'text-green-600' : bmi < 30 ? 'text-orange-600' : 'text-red-600'
            : '';
        const bmiLabel = bmi
            ? bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese'
            : '';

        const s: { label: string; value: string; color?: string }[] = [];
        if (client.heightCm) s.push({ label: 'Height', value: `${client.heightCm} cm` });
        if (client.currentWeightKg) s.push({ label: 'Weight', value: `${client.currentWeightKg} kg` });
        if (client.targetWeightKg) s.push({ label: 'Goal', value: `${client.targetWeightKg} kg` });
        if (bmi) s.push({ label: 'BMI', value: `${bmi.toFixed(1)} ${bmiLabel}`, color: bmiColor });
        if (m?.chestCm) s.push({ label: 'Chest', value: `${m.chestCm} cm` });
        if (m?.waistCm) s.push({ label: 'Waist', value: `${m.waistCm} cm` });
        if (m?.hipsCm) s.push({ label: 'Hips', value: `${m.hipsCm} cm` });
        if (m?.thighsCm) s.push({ label: 'Thighs', value: `${m.thighsCm} cm` });
        if (m?.armsCm) s.push({ label: 'Arms', value: `${m.armsCm} cm` });
        if (m?.bodyFatPercentage) s.push({ label: 'Body Fat', value: `${m.bodyFatPercentage}%` });

        return { stats: s, logDate: m?.logDate };
    }, [client.heightCm, client.currentWeightKg, client.targetWeightKg, client.latestMeasurement]);

    return (
        <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-gray-900 font-medium">Measurements</h3>
                {logDate && (
                    <span className="text-xs text-gray-400">
                        {new Date(logDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                )}
            </div>
            <div className="grid grid-cols-2 gap-2">
                {stats.map(({ label, value, color }) => (
                    <div key={label} className="bg-gray-50 rounded-lg px-2.5 py-2">
                        <span className="text-xs text-gray-500 block">{label}</span>
                        <span className={`text-sm font-semibold ${color || 'text-gray-900'}`}>{value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
