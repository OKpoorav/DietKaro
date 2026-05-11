'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Ruler } from 'lucide-react';
import { calculateAge, getInitials } from '@/lib/utils/formatters';
import type { ClientData } from '@/lib/types/diet-plan.types';
import { ClientRestrictionsSummary } from './client-restrictions-summary';

interface NutritionTargets {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

interface DayNutrition {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

function calcBMI(heightCm?: number | null, weightKg?: number | null): string {
    if (!heightCm || !weightKg) return '—';
    const h = heightCm / 100;
    return (weightKg / (h * h)).toFixed(1);
}

function bmiColor(bmi: string): string {
    const n = parseFloat(bmi);
    if (isNaN(n)) return 'text-gray-900';
    if (n < 18.5) return 'text-blue-600';
    if (n < 25) return 'text-green-600';
    if (n < 30) return 'text-amber-600';
    return 'text-red-600';
}

interface ClientStatsStripProps {
    client: ClientData | null | undefined;
    dayNutrition?: DayNutrition;
    targets?: NutritionTargets;
    hasAllergyWarning?: boolean;
}

function MeasurementsDropdown({ m }: { m: NonNullable<ClientData['latestMeasurement']> }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const rows: { label: string; value: number | null; unit: string }[] = [
        { label: 'Chest', value: m.chestCm, unit: 'cm' },
        { label: 'Waist', value: m.waistCm, unit: 'cm' },
        { label: 'Hips', value: m.hipsCm, unit: 'cm' },
        { label: 'Thigh', value: m.thighsCm, unit: 'cm' },
        { label: 'Arms', value: m.armsCm, unit: 'cm' },
        { label: 'Body Fat', value: m.bodyFatPercentage, unit: '%' },
    ].filter(r => r.value !== null);

    if (rows.length === 0) return null;

    const logDate = new Date(m.logDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <div className="relative flex-shrink-0" ref={ref}>
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
                <Ruler className="w-3 h-3" />
                Body
                {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {open && (
                <div className="absolute top-full left-0 mt-1.5 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-44">
                    <p className="text-[10px] text-gray-400 mb-2">Logged {logDate}</p>
                    <div className="space-y-1.5">
                        {rows.map(r => (
                            <div key={r.label} className="flex items-baseline justify-between">
                                <span className="text-xs text-gray-500">{r.label}</span>
                                <span className="text-xs font-bold text-gray-900">{r.value} {r.unit}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export function ClientStatsStrip({ client, dayNutrition, targets, hasAllergyWarning }: ClientStatsStripProps) {
    const [expanded, setExpanded] = useState(false);

    if (!client) return null;

    const age = calculateAge(client.dateOfBirth);
    const bmi = calcBMI(client.heightCm, client.currentWeightKg);
    const initials = getInitials(client.fullName || '');
    const hasDetails =
        (client.allergies?.length ?? 0) > 0 ||
        (client.intolerances?.length ?? 0) > 0 ||
        client.dietPattern ||
        (client.medicalProfile?.conditions?.length ?? client.medicalConditions?.length ?? 0) > 0 ||
        (client.foodRestrictions?.length ?? 0) > 0 ||
        (client.dislikes?.length ?? 0) > 0 ||
        (client.likedFoods?.length ?? 0) > 0;

    return (
        <div className="bg-white border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-3 px-4 lg:px-6 py-2 flex-wrap">
                {/* Avatar + name */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-6 h-6 rounded-full bg-brand/20 flex items-center justify-center text-brand text-[10px] font-bold">
                        {initials}
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                        {client.fullName}{age ? <span className="text-gray-400 font-normal">, {age}yr</span> : null}
                    </span>
                </div>

                <div className="w-px h-4 bg-gray-200 flex-shrink-0 hidden sm:block" />

                {/* Key measurements */}
                <div className="flex items-center gap-3 text-xs flex-wrap">
                    <span className="text-gray-500">
                        Ht <span className="font-bold text-gray-900">{client.heightCm ?? '—'} cm</span>
                    </span>
                    <span className="text-gray-500">
                        Wt <span className="font-bold text-gray-900">{client.currentWeightKg ?? '—'} kg</span>
                    </span>
                    <span className="text-gray-300">→</span>
                    <span className="text-gray-500">
                        Goal <span className="font-bold text-gray-900">{client.targetWeightKg ?? '—'} kg</span>
                    </span>
                    <span className="text-gray-500">
                        BMI <span className={`font-bold ${bmiColor(bmi)}`}>{bmi}</span>
                    </span>
                    {/* Body measurements dropdown — only when data exists */}
                    {client.latestMeasurement && (
                        <MeasurementsDropdown m={client.latestMeasurement} />
                    )}
                </div>

                {/* Nutrition totals */}
                {dayNutrition && targets && (
                    <>
                        <div className="w-px h-4 bg-gray-200 flex-shrink-0 hidden sm:block" />
                        <div className="flex items-center gap-2 text-xs flex-wrap">
                            {[
                                { label: 'Cal', value: Math.round(dayNutrition.calories), target: targets.calories, unit: 'kcal' },
                                { label: 'Protein', value: Math.round(dayNutrition.protein), target: targets.protein, unit: 'g' },
                                { label: 'Carbs', value: Math.round(dayNutrition.carbs), target: targets.carbs, unit: 'g' },
                                { label: 'Fat', value: Math.round(dayNutrition.fat), target: targets.fat, unit: 'g' },
                            ].map((n, i) => (
                                <span key={n.label} className="flex items-center gap-1.5">
                                    {i > 0 && <span className="text-gray-200">|</span>}
                                    <span className="text-gray-500">
                                        {n.label}:{' '}
                                        <span className={`font-bold ${n.target > 0 && n.value > n.target ? 'text-red-600' : 'text-gray-900'}`}>
                                            {n.value}
                                        </span>
                                        {n.target > 0 && <span className="text-gray-400">/{n.target}{n.unit}</span>}
                                    </span>
                                </span>
                            ))}
                        </div>
                    </>
                )}

                {/* Allergy warning badge */}
                {hasAllergyWarning && (
                    <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full flex-shrink-0">
                        <AlertTriangle className="w-3 h-3" />
                        Allergy
                    </span>
                )}

                {/* Details expand — shows likes/dislikes/allergies */}
                {hasDetails && (
                    <button
                        onClick={() => setExpanded(e => !e)}
                        className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-2 py-0.5 rounded-full transition-colors flex-shrink-0"
                    >
                        Preferences {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                )}
            </div>

            {expanded && (
                <div className="px-4 lg:px-6 pb-3 border-t border-gray-100 pt-2">
                    <ClientRestrictionsSummary
                        compact
                        allergies={client.medicalProfile?.allergies || client.allergies || []}
                        intolerances={client.intolerances || []}
                        dietPattern={client.dietPattern}
                        medicalConditions={client.medicalProfile?.conditions || client.medicalConditions || []}
                        foodRestrictions={client.foodRestrictions || []}
                        dislikes={client.dislikes || []}
                        likedFoods={client.likedFoods || []}
                    />
                </div>
            )}
        </div>
    );
}
