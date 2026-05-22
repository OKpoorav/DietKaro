'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useApiClient } from '../api/use-api-client';
import { useCreateDietPlan, usePublishDietPlan, useUpdateDietPlan, CreateDietPlanInput } from './use-diet-plans';
import { toast } from 'sonner';
import type { LocalMeal, LocalFoodItem, DayNutrition, FoodItemData } from '../types/diet-plan.types';
import type { Client } from './use-clients';
import { MEAL_SLOT_PRESETS, type MealSlotPreset } from '@/components/diet-plan/template-sidebar';

// Re-export types used by components
export type { LocalMeal, LocalFoodItem, DayNutrition };

interface UseMealBuilderOptions {
    clientId: string | null;
    isTemplateMode: boolean;
    editId?: string | null; // If set, load existing plan/template for editing
    client: Client | null | undefined;
    onSaved: (isTemplate: boolean, published: boolean) => void;
    initialStartDate?: Date;
    initialNumDays?: number;
    initialMealCount?: number;
    initialPlanName?: string;
    overlapStrategy?: 'overwrite' | 'end_previous' | 'update';
    overlappingPlanIds?: string[];
}

function makeId() { return Math.random().toString(36).substr(2, 9); }

/** Format date as YYYY-MM-DD in local timezone (avoids UTC shift from toISOString) */
function toLocalDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** Infer a DB-compatible mealType from the free-form meal name. */
function inferMealType(name: string): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
    const n = name.toLowerCase().trim();
    if (n.includes('breakfast') || n === 'early morning') return 'breakfast';
    if (n.includes('lunch')) return 'lunch';
    if (n.includes('dinner')) return 'dinner';
    // Everything else (snack, mid-morning, post dinner, pre-workout, etc.) → snack
    return 'snack';
}

function defaultMeals(prefs?: { breakfastTime?: string | null; lunchTime?: string | null; dinnerTime?: string | null; snackTime?: string | null } | null): LocalMeal[] {
    return [
        { id: makeId(), name: 'Breakfast', type: 'breakfast', time: prefs?.breakfastTime || '08:00', foods: [] },
        { id: makeId(), name: 'Lunch',     type: 'lunch',     time: prefs?.lunchTime     || '13:00', foods: [] },
        { id: makeId(), name: 'Dinner',    type: 'dinner',    time: prefs?.dinnerTime    || '19:30', foods: [] },
    ];
}

// Helper to generate dates for keys
export const getDates = (startDate: Date, days: number) => {
    return Array.from({ length: days }, (_, i) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        return {
            date: d,
            label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            day: d.toLocaleDateString('en-US', { weekday: 'short' })
        };
    });
};

export function useMealBuilder({ clientId, isTemplateMode, editId, client, onSaved, initialStartDate, initialNumDays, initialMealCount, initialPlanName, overlapStrategy, overlappingPlanIds }: UseMealBuilderOptions) {
    const api = useApiClient();
    const createMutation = useCreateDietPlan();
    const updateMutation = useUpdateDietPlan();
    const publishMutation = usePublishDietPlan();

    const isEditMode = !!editId;

    // State — use initial values from PlanSetupModal when provided
    const [startDate, setStartDate] = useState(initialStartDate || new Date());
    const [selectedDayIndex, setSelectedDayIndex] = useState(0);
    const [planName, setPlanName] = useState(initialPlanName || (isTemplateMode ? 'New Template' : 'New Diet Plan'));
    const [planDescription, setPlanDescription] = useState('');
    const [weeklyMeals, setWeeklyMeals] = useState<Record<number, LocalMeal[]>>(() => {
        const days = initialNumDays || (isTemplateMode ? 7 : 1);
        const preset = initialMealCount
            ? MEAL_SLOT_PRESETS.find(p => p.slots.length === initialMealCount)
            : null;
        const baseMeals = preset
            ? preset.slots.map(s => ({ id: makeId(), name: s.name, type: s.type, time: s.time, foods: [] as LocalMeal['foods'] }))
            : defaultMeals(client?.preferences);
        const meals: Record<number, LocalMeal[]> = {};
        for (let i = 0; i < days; i++) {
            meals[i] = baseMeals.map(m => ({ ...m, id: makeId() }));
        }
        return meals;
    });
    const [showAddFoodModal, setShowAddFoodModal] = useState(false);
    const [activeMealId, setActiveMealId] = useState<string | null>(null);
    const [activeOptionGroup, setActiveOptionGroup] = useState<number>(0);
    const [activeDayIndex, setActiveDayIndex] = useState<number>(0);
    const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);
    const [hideCaloriesFromClient, setHideCaloriesFromClient] = useState(false);
    const [numDays, setNumDays] = useState(initialNumDays || (isTemplateMode ? 7 : 1));
    const [editLoading, setEditLoading] = useState(!!editId);
    const [isDirty, setIsDirty] = useState(false);
    const [clipboardDay, setClipboardDay] = useState<LocalMeal[] | null>(null);
    const [clipboardMeal, setClipboardMeal] = useState<LocalMeal | null>(null);
    const [scalingPrompt, setScalingPrompt] = useState<{
        templateCal: number;
        clientCal: number;
        pct: number;
        ratio: number;
    } | null>(null);
    const pendingApplyRef = useRef<((factor: number) => void) | null>(null);
    const [replacePrompt, setReplacePrompt] = useState<string | null>(null);
    const pendingReplaceRef = useRef<(() => void) | null>(null);
    const [templateScopePrompt, setTemplateScopePrompt] = useState<{
        templateName: string;
        templateDayCount: number;
        mealsPerDay: number;
        startDayIndex: number;
        endDayIndex: number;
        planDayCount: number;
    } | null>(null);
    const pendingTemplateRef = useRef<(() => void) | null>(null);

    // Sync state when PlanSetupModal results arrive (initial values only run once in useState)
    const [setupApplied, setSetupApplied] = useState(false);
    useEffect(() => {
        if (setupApplied || isEditMode) return;
        if (!initialNumDays && !initialStartDate && !initialPlanName) return;
        setSetupApplied(true);

        if (initialStartDate) setStartDate(initialStartDate);
        if (initialPlanName) setPlanName(initialPlanName);
        if (initialNumDays && initialNumDays >= 1) {
            setNumDays(initialNumDays);
            const preset = initialMealCount
                ? MEAL_SLOT_PRESETS.find(p => p.slots.length === initialMealCount)
                : null;
            setWeeklyMeals(() => {
                const meals: Record<number, LocalMeal[]> = {};
                for (let i = 0; i < initialNumDays; i++) {
                    meals[i] = preset
                        ? preset.slots.map(s => ({ id: makeId(), name: s.name, type: s.type, time: s.time, foods: [] as LocalMeal['foods'] }))
                        : defaultMeals(client?.preferences);
                }
                return meals;
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialNumDays, initialStartDate, initialPlanName, initialMealCount]);

    // "Update existing plan" strategy: fetch overlapping plan meals and copy into matching days
    useEffect(() => {
        if (overlapStrategy !== 'update' || !overlappingPlanIds?.length || !initialStartDate || !initialNumDays) return;
        let cancelled = false;

        async function loadOverlappingMeals() {
            try {
                // Fetch all overlapping plans
                const allMeals: Record<string, LocalMeal[]> = {}; // dateStr → meals

                for (const planId of overlappingPlanIds!) {
                    const { data } = await api.get(`/diet-plans/${planId}`);
                    const plan = data.data;
                    if (!plan.meals?.length) continue;

                    for (const tm of plan.meals) {
                        const mealDateStr = tm.mealDate
                            ? toLocalDateStr(new Date(tm.mealDate))
                            : null;
                        if (!mealDateStr) continue;
                        if (!allMeals[mealDateStr]) allMeals[mealDateStr] = [];

                        const localFoods: LocalFoodItem[] = (tm.foodItems || []).map((f: any) => {
                            const ratio = (f.quantityG || 100) / 100;
                            return {
                                id: f.foodItem.id,
                                tempId: makeId(),
                                name: f.foodItem.name,
                                quantity: f.notes || `${f.quantityG}g`,
                                quantityValue: f.quantityG || 100,
                                calories: f.foodItem.calories * ratio,
                                protein: (Number(f.foodItem.proteinG) || 0) * ratio,
                                carbs: (Number(f.foodItem.carbsG) || 0) * ratio,
                                fat: (Number(f.foodItem.fatsG) || 0) * ratio,
                                hasWarning: false,
                                optionGroup: f.optionGroup ?? 0,
                                optionLabel: f.optionLabel ?? undefined,
                            };
                        });

                        allMeals[mealDateStr].push({
                            id: makeId(),
                            name: tm.name || tm.mealType,
                            type: tm.mealType,
                            time: tm.timeOfDay || '08:00',
                            description: tm.description || '',
                            instructions: tm.instructions || '',
                            foods: localFoods,
                        });
                    }
                }

                if (cancelled) return;

                // Map fetched meals into day indices based on new plan's startDate
                const numD = initialNumDays!;
                const startD = initialStartDate!;
                setWeeklyMeals(prev => {
                    const updated = { ...prev };
                    for (let i = 0; i < numD; i++) {
                        const dayDate = new Date(startD);
                        dayDate.setDate(dayDate.getDate() + i);
                        const dayStr = toLocalDateStr(dayDate);
                        if (allMeals[dayStr]?.length) {
                            updated[i] = allMeals[dayStr];
                        }
                        // Non-overlapping days keep their default meals
                    }
                    return updated;
                });
            } catch {
                toast.error('Failed to load meals from existing plan');
            }
        }

        loadOverlappingMeals();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [overlapStrategy, overlappingPlanIds]);

    // Warn before leaving with unsaved changes
    useEffect(() => {
        if (!isDirty) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty]);

    const planDates = getDates(startDate, numDays);
    const currentMeals = useMemo(() => weeklyMeals[selectedDayIndex] || [], [weeklyMeals, selectedDayIndex]);

    // Pane-friendly selectors — callers pass the day they want to read.
    const getDayMeals = useCallback((dayIndex: number): LocalMeal[] => weeklyMeals[dayIndex] || [], [weeklyMeals]);

    const getDayNutrition = useCallback((dayIndex: number): DayNutrition => {
        const meals = weeklyMeals[dayIndex] || [];
        let calories = 0, protein = 0, carbs = 0, fat = 0;
        meals.forEach(m => {
            const hasAlternatives = m.foods.some(f => f.optionGroup > 0);
            const foodsToCount = hasAlternatives
                ? m.foods.filter(f => f.optionGroup === 0)
                : m.foods;
            foodsToCount.forEach(f => {
                calories += f.calories;
                protein += f.protein;
                carbs += f.carbs;
                fat += f.fat;
            });
        });
        return { calories, protein, carbs, fat };
    }, [weeklyMeals]);

    const getHasAllergyWarning = useCallback((dayIndex: number): boolean =>
        (weeklyMeals[dayIndex] || []).some(m => m.foods.some(f => f.hasWarning)),
    [weeklyMeals]);

    // Dirty-tracking wrapper
    const setWeeklyMealsDirty = useCallback((updater: Parameters<typeof setWeeklyMeals>[0]) => {
        setWeeklyMeals(updater);
        setIsDirty(true);
    }, []);

    /**
     * Bulk-replace all days from an external source (e.g. AI draft).
     * Resizes numDays to fit the largest provided dayIndex. Indices not in the
     * map become empty days. Clamps to the plan-type limit (7 for plans,
     * 30 for templates).
     */
    const replaceAllDays = useCallback((daysByIndex: Record<number, LocalMeal[]>) => {
        const indices = Object.keys(daysByIndex).map((k) => parseInt(k, 10)).filter((n) => Number.isFinite(n));
        const maxIndex = indices.length > 0 ? Math.max(...indices) : 0;
        const cap = isTemplateMode ? 30 : 7;
        const nextNumDays = Math.min(cap, Math.max(1, maxIndex + 1));
        setNumDays(nextNumDays);
        setWeeklyMealsDirty(() => {
            const next: Record<number, LocalMeal[]> = {};
            for (let i = 0; i < nextNumDays; i += 1) {
                next[i] = daysByIndex[i] ?? [];
            }
            return next;
        });
        setSelectedDayIndex(0);
    }, [isTemplateMode, setWeeklyMealsDirty]);

    // Handlers — all take explicit dayIndex so multiple panes can target different days.
    const addMeal = useCallback((dayIndex: number) => {
        const existing = weeklyMeals[dayIndex] || [];
        const existingTypes = new Set(existing.map(m => m.type));

        const defaults: { type: LocalMeal['type']; name: string; time: string }[] = [
            { type: 'breakfast', name: 'Breakfast', time: client?.preferences?.breakfastTime || '08:00' },
            { type: 'lunch', name: 'Lunch', time: client?.preferences?.lunchTime || '13:00' },
            { type: 'dinner', name: 'Dinner', time: client?.preferences?.dinnerTime || '19:30' },
            { type: 'snack', name: 'Snack', time: client?.preferences?.snackTime || '16:00' },
        ];

        const pick = defaults.find(d => !existingTypes.has(d.type)) || defaults[3];

        const newMeal: LocalMeal = {
            id: Math.random().toString(36).substr(2, 9),
            name: pick.name,
            type: pick.type,
            time: pick.time,
            foods: []
        };
        setWeeklyMealsDirty(prev => ({
            ...prev,
            [dayIndex]: [...(prev[dayIndex] || []), newMeal]
        }));
    }, [weeklyMeals, client]);

    const removeMeal = useCallback((dayIndex: number, id: string) => {
        setWeeklyMealsDirty(prev => ({
            ...prev,
            [dayIndex]: (prev[dayIndex] || []).filter(m => m.id !== id)
        }));
    }, []);

    const openAddFood = useCallback((dayIndex: number, mealId: string, optionGroup: number = 0) => {
        setActiveDayIndex(dayIndex);
        setActiveMealId(mealId);
        setActiveOptionGroup(optionGroup);
        setShowAddFoodModal(true);
    }, []);

    const addFood = useCallback((food: FoodItemData) => {
        if (!activeMealId) return;

        const newFood: LocalFoodItem = {
            id: food.id,
            tempId: Math.random().toString(36).substr(2, 9),
            name: food.name,
            quantity: '1 serving',
            quantityValue: 100,
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
            hasWarning: food.validationSeverity === 'RED' || food.validationSeverity === 'YELLOW' ||
                client?.medicalProfile?.allergies?.some((a: string) => food.name.toLowerCase().includes(a.toLowerCase())) || false,
            validationSeverity: food.validationSeverity,
            validationAlerts: food.validationAlerts,
            optionGroup: activeOptionGroup,
        };

        setWeeklyMealsDirty(prev => ({
            ...prev,
            [activeDayIndex]: (prev[activeDayIndex] || []).map(m => {
                if (m.id === activeMealId) {
                    return { ...m, foods: [...m.foods, newFood] };
                }
                return m;
            })
        }));
        setShowAddFoodModal(false);
    }, [activeMealId, activeOptionGroup, activeDayIndex, client]);

    const removeFood = useCallback((dayIndex: number, mealId: string, tempId: string) => {
        setWeeklyMealsDirty(prev => ({
            ...prev,
            [dayIndex]: (prev[dayIndex] || []).map(m => {
                if (m.id === mealId) {
                    return { ...m, foods: m.foods.filter(f => f.tempId !== tempId) };
                }
                return m;
            })
        }));
    }, []);

    const updateFoodQuantity = useCallback((dayIndex: number, mealId: string, tempId: string, val: string) => {
        setWeeklyMealsDirty(prev => ({
            ...prev,
            [dayIndex]: (prev[dayIndex] || []).map(m => {
                if (m.id === mealId) {
                    return { ...m, foods: m.foods.map(f => f.tempId === tempId ? { ...f, quantity: val } : f) };
                }
                return m;
            })
        }));
    }, []);

    const updateFoodQuantityValue = useCallback((dayIndex: number, mealId: string, tempId: string, newGrams: number) => {
        setWeeklyMealsDirty(prev => ({
            ...prev,
            [dayIndex]: (prev[dayIndex] || []).map(m => {
                if (m.id !== mealId) return m;
                return {
                    ...m,
                    foods: m.foods.map(f => {
                        if (f.tempId !== tempId) return f;
                        const oldGrams = f.quantityValue || 100;
                        if (oldGrams === 0 || newGrams === oldGrams) return f;
                        const ratio = newGrams / oldGrams;
                        return {
                            ...f,
                            quantityValue: newGrams,
                            calories: Math.round(f.calories * ratio),
                            protein: Math.round(f.protein * ratio * 10) / 10,
                            carbs: Math.round(f.carbs * ratio * 10) / 10,
                            fat: Math.round(f.fat * ratio * 10) / 10,
                        };
                    })
                };
            })
        }));
    }, []);

    const updateMealField = useCallback((dayIndex: number, mealId: string, field: 'name' | 'time' | 'type' | 'description' | 'instructions', value: string) => {
        setWeeklyMealsDirty(prev => ({
            ...prev,
            [dayIndex]: (prev[dayIndex] || []).map(m => m.id === mealId ? { ...m, [field]: value } : m)
        }));
    }, []);

    // Option group actions
    const addMealOption = useCallback((dayIndex: number, mealId: string) => {
        const meals = weeklyMeals[dayIndex] || [];
        const meal = meals.find(m => m.id === mealId);
        if (!meal) return;

        // Find the next optionGroup number
        const maxGroup = meal.foods.length > 0
            ? Math.max(...meal.foods.map(f => f.optionGroup))
            : -1;
        const newGroup = maxGroup + 1;

        // Auto-label existing option 0 foods as "Option A" if not already labeled
        if (newGroup === 1) {
            setWeeklyMealsDirty(prev => ({
                ...prev,
                [dayIndex]: (prev[dayIndex] || []).map(m => {
                    if (m.id !== mealId) return m;
                    return {
                        ...m,
                        foods: m.foods.map(f =>
                            f.optionGroup === 0 && !f.optionLabel
                                ? { ...f, optionLabel: 'Option A' }
                                : f
                        )
                    };
                })
            }));
        }

        // Open add food modal targeting the new group
        setActiveDayIndex(dayIndex);
        setActiveMealId(mealId);
        setActiveOptionGroup(newGroup);
        setShowAddFoodModal(true);
    }, [weeklyMeals]);

    const removeOption = useCallback((dayIndex: number, mealId: string, optionGroup: number) => {
        setWeeklyMealsDirty(prev => ({
            ...prev,
            [dayIndex]: (prev[dayIndex] || []).map(m => {
                if (m.id !== mealId) return m;
                const remaining = m.foods.filter(f => f.optionGroup !== optionGroup);
                // If only one option group left, clear all labels
                const groups = new Set(remaining.map(f => f.optionGroup));
                if (groups.size <= 1) {
                    return { ...m, foods: remaining.map(f => ({ ...f, optionLabel: undefined })) };
                }
                return { ...m, foods: remaining };
            })
        }));
    }, []);

    const updateOptionLabel = useCallback((dayIndex: number, mealId: string, optionGroup: number, label: string) => {
        setWeeklyMealsDirty(prev => ({
            ...prev,
            [dayIndex]: (prev[dayIndex] || []).map(m => {
                if (m.id !== mealId) return m;
                return {
                    ...m,
                    foods: m.foods.map(f =>
                        f.optionGroup === optionGroup ? { ...f, optionLabel: label } : f
                    )
                };
            })
        }));
    }, []);

    // Day management
    const addDay = useCallback(() => {
        if (numDays >= (isTemplateMode ? 30 : 7)) return;
        const newIndex = numDays;
        setNumDays(prev => prev + 1);
        setWeeklyMealsDirty(prev => ({ ...prev, [newIndex]: defaultMeals(client?.preferences) }));
        setSelectedDayIndex(newIndex);
    }, [numDays, client]);

    const removeDay = useCallback(() => {
        if (numDays <= 1) return;
        const lastIndex = numDays - 1;
        setWeeklyMealsDirty(prev => {
            const next = { ...prev };
            delete next[lastIndex];
            return next;
        });
        if (selectedDayIndex >= lastIndex) {
            setSelectedDayIndex(lastIndex - 1);
        }
        setNumDays(prev => prev - 1);
    }, [numDays, selectedDayIndex]);

    const copyDay = useCallback((dayIndex: number) => {
        const meals = weeklyMeals[dayIndex] || [];
        setClipboardDay(JSON.parse(JSON.stringify(meals)));
        toast.success('Day copied');
    }, [weeklyMeals]);

    const pasteDay = useCallback((dayIndex: number) => {
        if (!clipboardDay) return;
        // Deep clone and assign new IDs
        const pasted: LocalMeal[] = clipboardDay.map(m => ({
            ...m,
            id: Math.random().toString(36).substr(2, 9),
            foods: m.foods.map(f => ({ ...f, tempId: Math.random().toString(36).substr(2, 9) })),
        }));
        setWeeklyMealsDirty(prev => ({ ...prev, [dayIndex]: pasted }));
        toast.success('Day pasted');
    }, [clipboardDay]);

    const clearDay = useCallback((dayIndex: number) => {
        setWeeklyMealsDirty(prev => ({ ...prev, [dayIndex]: defaultMeals(client?.preferences) }));
        toast.success('Day cleared');
    }, [client]);

    // Per-meal clipboard — independent of clipboardDay.
    const copyMeal = useCallback((dayIndex: number, mealId: string) => {
        const meal = (weeklyMeals[dayIndex] || []).find(m => m.id === mealId);
        if (!meal) return;
        setClipboardMeal(JSON.parse(JSON.stringify(meal)));
        toast.success('Meal copied');
    }, [weeklyMeals]);

    // Paste replaces the target meal's foods + options. Keeps target's name/time/notes
    // so pasting across slot types (e.g. breakfast → dinner) preserves the slot label.
    const pasteMeal = useCallback((dayIndex: number, targetMealId: string) => {
        if (!clipboardMeal) return;
        setWeeklyMealsDirty(prev => ({
            ...prev,
            [dayIndex]: (prev[dayIndex] || []).map(m => {
                if (m.id !== targetMealId) return m;
                return {
                    ...m,
                    foods: clipboardMeal.foods.map(f => ({
                        ...f,
                        tempId: Math.random().toString(36).substr(2, 9),
                    })),
                };
            }),
        }));
        toast.success('Meal pasted');
    }, [clipboardMeal]);

    // Bulk portion adjustment
    const [showBulkPortionModal, setShowBulkPortionModal] = useState(false);

    const bulkAdjust = useCallback((factor: number, scope: 'meal' | 'day' | 'plan', dayIndex?: number) => {
        const adjustFoods = (foods: LocalFoodItem[]): LocalFoodItem[] =>
            foods.map(f => ({
                ...f,
                quantityValue: Math.round(f.quantityValue * factor / 5) * 5, // round to nearest 5g
                calories: Math.round(f.calories * factor),
                protein: Math.round(f.protein * factor * 10) / 10,
                carbs: Math.round(f.carbs * factor * 10) / 10,
                fat: Math.round(f.fat * factor * 10) / 10,
            }));

        if (scope === 'day') {
            const targetDay = dayIndex ?? 0;
            setWeeklyMealsDirty(prev => ({
                ...prev,
                [targetDay]: (prev[targetDay] || []).map(m => ({
                    ...m, foods: adjustFoods(m.foods)
                })),
            }));
        } else {
            // entire plan
            setWeeklyMealsDirty(prev => {
                const updated: Record<number, LocalMeal[]> = {};
                Object.entries(prev).forEach(([key, meals]) => {
                    updated[parseInt(key)] = meals.map(m => ({
                        ...m, foods: adjustFoods(m.foods)
                    }));
                });
                return updated;
            });
        }
        toast.success(`Portions adjusted by ${Math.round((factor - 1) * 100)}%`);
    }, []);

    // Nutrition calculation — only count option 0 for day totals (client eats one option)
    const dayNutrition = useMemo<DayNutrition>(() => {
        let calories = 0, protein = 0, carbs = 0, fat = 0;
        currentMeals.forEach(m => {
            const hasAlternatives = m.foods.some(f => f.optionGroup > 0);
            const foodsToCount = hasAlternatives
                ? m.foods.filter(f => f.optionGroup === 0)
                : m.foods;
            foodsToCount.forEach(f => {
                calories += f.calories;
                protein += f.protein;
                carbs += f.carbs;
                fat += f.fat;
            });
        });
        return { calories, protein, carbs, fat };
    }, [currentMeals]);

    const [targets, setTargets] = useState(() => ({
        calories: Number(client?.targetCalories) || (client?.targetWeightKg ? Math.round(Number(client.targetWeightKg) * 30) : 2000),
        protein: Number(client?.targetProteinG) || 150,
        carbs: Number(client?.targetCarbsG) || 200,
        fat: Number(client?.targetFatsG) || 70,
    }));

    // Auto-save drafts to sessionStorage every 30 seconds
    useEffect(() => {
        if (!isDirty || !clientId || isTemplateMode) return;
        const key = `diet-plan-draft-${clientId}`;
        const timer = setInterval(() => {
            try {
                const draft = JSON.stringify({
                    weeklyMeals,
                    planName,
                    planDescription,
                    startDate: startDate.toISOString(),
                    numDays,
                    targets,
                    hideCaloriesFromClient,
                    savedAt: Date.now(),
                });
                sessionStorage.setItem(key, draft);
            } catch { /* sessionStorage full or unavailable */ }
        }, 30000);
        return () => clearInterval(timer);
    }, [isDirty, clientId, isTemplateMode, weeklyMeals, planName, planDescription, startDate, numDays, targets, hideCaloriesFromClient]);

    // Clear draft on successful save

    // Load existing plan/template for editing
    useEffect(() => {
        if (!editId) return;
        let cancelled = false;

        async function loadExisting() {
            setEditLoading(true);
            try {
                const { data } = await api.get(`/diet-plans/${editId}`);
                const plan = data.data;
                if (cancelled) return;

                setPlanName(plan.name || '');
                setPlanDescription(plan.description || '');
                if (plan.startDate) setStartDate(new Date(plan.startDate));

                if (plan.meals?.length) {
                    const mealsByDay: Record<number, any[]> = {};
                    const planStartDate = plan.startDate ? new Date(plan.startDate) : new Date();
                    planStartDate.setUTCHours(0, 0, 0, 0);

                    // Check if this is a date-based plan (has mealDate) or dayOfWeek-based
                    const hasDateBasedMeals = plan.meals.some((tm: any) => tm.mealDate);

                    plan.meals.forEach((tm: any) => {
                        let d: number;
                        if (hasDateBasedMeals && tm.mealDate) {
                            // Date-based: compute day index as offset from plan startDate
                            const mealDate = new Date(tm.mealDate);
                            mealDate.setUTCHours(0, 0, 0, 0);
                            d = Math.round((mealDate.getTime() - planStartDate.getTime()) / (1000 * 60 * 60 * 24));
                        } else {
                            d = typeof tm.dayOfWeek === 'string' ? parseInt(tm.dayOfWeek) : (tm.dayOfWeek ?? 0);
                        }
                        if (!mealsByDay[d]) mealsByDay[d] = [];
                        mealsByDay[d].push(tm);
                    });

                    // Normalize so first day is index 0
                    const dayIndices = Object.keys(mealsByDay).map(Number).sort((a, b) => a - b);
                    const minDay = dayIndices.length > 0 ? dayIndices[0] : 0;

                    const newWeeklyMeals: Record<number, LocalMeal[]> = {};
                    Object.entries(mealsByDay).forEach(([dayStr, dayMeals]) => {
                        const normalizedDay = parseInt(dayStr) - minDay;
                        newWeeklyMeals[normalizedDay] = dayMeals.map((tm: any) => {
                            const localFoods: LocalFoodItem[] = tm.foodItems?.map((f: any) => {
                                const ratio = (f.quantityG || 100) / 100;
                                return {
                                    id: f.foodItem.id,
                                    tempId: makeId(),
                                    name: f.foodItem.name,
                                    quantity: f.notes || `${f.quantityG}g`,
                                    quantityValue: f.quantityG || 100,
                                    calories: f.foodItem.calories * ratio,
                                    protein: (Number(f.foodItem.proteinG) || 0) * ratio,
                                    carbs: (Number(f.foodItem.carbsG) || 0) * ratio,
                                    fat: (Number(f.foodItem.fatsG) || 0) * ratio,
                                    optionGroup: f.optionGroup ?? 0,
                                    optionLabel: f.optionLabel ?? undefined,
                                };
                            }) || [];
                            return { id: makeId(), name: tm.name || tm.mealType, type: tm.mealType, time: tm.timeOfDay, description: tm.description || '', instructions: tm.instructions || '', foods: localFoods };
                        });
                    });

                    setWeeklyMeals(newWeeklyMeals);
                    const dayKeys = Object.keys(newWeeklyMeals).map(Number);
                    setNumDays(Math.max(...dayKeys) + 1);
                }

                if (plan.targetCalories) setTargets(t => ({ ...t, calories: plan.targetCalories }));
                if (plan.targetProteinG) setTargets(t => ({ ...t, protein: plan.targetProteinG }));
                if (plan.targetCarbsG) setTargets(t => ({ ...t, carbs: plan.targetCarbsG }));
                if (plan.targetFatsG) setTargets(t => ({ ...t, fat: plan.targetFatsG }));
                setHideCaloriesFromClient(plan.hideCaloriesFromClient ?? false);
            } catch {
                toast.error('Failed to load plan for editing');
            } finally {
                if (!cancelled) setEditLoading(false);
            }
        }

        loadExisting();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editId]);

    // Apply template with optional portion scaling
    const applyTemplate = useCallback(async (templateId: string, opts?: { skipConfirm?: boolean; startDayIndex?: number }) => {
        setApplyingTemplateId(templateId);
        try {
            const { data } = await api.get(`/diet-plans/${templateId}`);
            const template = data.data;

            if (!template.meals || template.meals.length === 0) {
                toast.error('Template has no meals');
                setApplyingTemplateId(null);
                return;
            }

            // ── Slot template: apply meal structure to every existing day, don't touch numDays ──
            if (template.templateCategory === 'slot_template') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const blueprint: LocalMeal[] = template.meals.map((tm: any) => ({
                    id: makeId(),
                    name: tm.name || tm.mealType,
                    type: tm.mealType,
                    time: tm.timeOfDay || '08:00',
                    description: tm.description || '',
                    instructions: tm.instructions || '',
                    foods: [],
                }));

                setWeeklyMealsDirty(prev => {
                    const updated: Record<number, LocalMeal[]> = {};
                    const days = Object.keys(prev).map(Number);
                    const count = days.length > 0 ? Math.max(...days) + 1 : numDays;
                    for (let i = 0; i < count; i++) {
                        updated[i] = blueprint.map(m => ({ ...m, id: makeId() }));
                    }
                    return updated;
                });
                toast.success(`Meal structure applied to all ${numDays} days`);
                setApplyingTemplateId(null);
                return;
            }

            // ── Full template: merge into plan starting from startDayIndex ──

            // Parse meals by day, normalize so first template day = 0
            const mealsByDayRaw: Record<number, Record<string, unknown>[]> = {};
            let minDay = Infinity;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            template.meals.forEach((tm: any) => {
                const d = typeof tm.dayOfWeek === 'string' ? parseInt(tm.dayOfWeek) : tm.dayOfWeek;
                if (!isNaN(d)) {
                    if (d < minDay) minDay = d;
                    if (!mealsByDayRaw[d]) mealsByDayRaw[d] = [];
                    mealsByDayRaw[d].push(tm);
                }
            });
            if (minDay === Infinity) minDay = 0;

            const mealsByDay: Record<number, Record<string, unknown>[]> = {};
            Object.entries(mealsByDayRaw).forEach(([dayStr, meals]) => {
                mealsByDay[parseInt(dayStr) - minDay] = meals;
            });

            const templateDayCount = Object.keys(mealsByDay).length;
            const startDay = opts?.startDayIndex ?? 0;
            // Clamp end to plan bounds — template may have more days than remain
            const endDay = Math.min(startDay + templateDayCount - 1, numDays - 1);
            const daysFilled = endDay - startDay + 1;

            const applyWithScale = (scaleFactor: number) => {
                try {
                    const newMeals: Record<number, LocalMeal[]> = {};
                    Object.entries(mealsByDay).forEach(([relDayStr, dayMeals]) => {
                        const relDay = parseInt(relDayStr);
                        const targetDay = startDay + relDay;
                        if (targetDay > endDay) return; // Clip to plan bounds

                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        newMeals[targetDay] = (dayMeals as any[]).map((tm: any) => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const localFoods: LocalFoodItem[] = tm.foodItems?.map((f: any) => {
                                const scaledQty = Math.round(((f.quantityG || 100) * scaleFactor) / 5) * 5;
                                const ratio = scaledQty / 100;
                                return {
                                    id: f.foodItem.id,
                                    tempId: makeId(),
                                    name: f.foodItem.name,
                                    quantity: `${scaledQty}g`,
                                    quantityValue: scaledQty,
                                    calories: Math.round(f.foodItem.calories * ratio),
                                    protein: Math.round((Number(f.foodItem.proteinG) || 0) * ratio * 10) / 10,
                                    carbs: Math.round((Number(f.foodItem.carbsG) || 0) * ratio * 10) / 10,
                                    fat: Math.round((Number(f.foodItem.fatsG) || 0) * ratio * 10) / 10,
                                    hasWarning: client?.medicalProfile?.allergies?.some((a: string) => f.foodItem.name.toLowerCase().includes(a.toLowerCase())) || false,
                                    optionGroup: f.optionGroup ?? 0,
                                    optionLabel: f.optionLabel ?? undefined,
                                };
                            }) || [];

                            return {
                                id: makeId(),
                                name: tm.name || tm.mealType,
                                type: tm.mealType,
                                time: tm.timeOfDay,
                                description: tm.description || '',
                                instructions: tm.instructions || '',
                                foods: localFoods,
                            };
                        });
                    });

                    // Merge into existing plan — only touch the days filled by the template
                    setWeeklyMealsDirty(prev => ({ ...prev, ...newMeals }));
                    const rangeLabel = daysFilled > 1 ? `Days ${startDay + 1}–${endDay + 1}` : `Day ${startDay + 1}`;
                    toast.success(scaleFactor !== 1 ? `Template applied with scaled portions (${rangeLabel})` : `Template applied to ${rangeLabel}`);
                } catch {
                    toast.error('Failed to apply template');
                } finally {
                    setApplyingTemplateId(null);
                }
            };

            if (opts?.skipConfirm) {
                applyWithScale(1);
                return;
            }

            // Show scope confirmation modal; chain scaling prompt after if needed
            const templateCal = template.targetCalories;
            const clientCal = targets.calories;
            const day0Meals = mealsByDay[0] || [];

            pendingTemplateRef.current = () => {
                setTemplateScopePrompt(null);
                if (templateCal && clientCal && templateCal > 0) {
                    const ratio = clientCal / templateCal;
                    if (ratio > 1.1 || ratio < 0.9) {
                        const pct = Math.abs(Math.round((ratio - 1) * 100));
                        pendingApplyRef.current = applyWithScale;
                        setScalingPrompt({ templateCal, clientCal, pct, ratio });
                        return;
                    }
                }
                applyWithScale(1);
            };

            setTemplateScopePrompt({
                templateName: template.name || 'Template',
                templateDayCount,
                mealsPerDay: day0Meals.length,
                startDayIndex: startDay,
                endDayIndex: endDay,
                planDayCount: numDays,
            });

        } catch {
            toast.error('Failed to apply template');
            setApplyingTemplateId(null);
        }
    }, [api, client, numDays, targets]);

    const confirmTemplateApply = useCallback(() => {
        pendingTemplateRef.current?.();
        pendingTemplateRef.current = null;
    }, []);

    const dismissTemplateApply = useCallback(() => {
        pendingTemplateRef.current = null;
        setTemplateScopePrompt(null);
        setApplyingTemplateId(null);
    }, []);

    // Apply a preset meal structure (empty slots) — dayIndex or 'all'
    const applyPreset = useCallback((preset: MealSlotPreset, dayIndex: number | 'all') => {
        const makeMeals = () => preset.slots.map(slot => ({
            id: makeId(), name: slot.name, type: slot.type, time: slot.time, foods: [] as LocalMeal['foods'],
        }));

        if (dayIndex === 'all') {
            const hasMeals = Object.values(weeklyMeals).some(m => m.length > 0);
            const doApply = () => {
                setWeeklyMealsDirty(() => {
                    const updated: Record<number, LocalMeal[]> = {};
                    for (let i = 0; i < numDays; i++) updated[i] = makeMeals();
                    return updated;
                });
                toast.success(`Applied "${preset.label}" to all ${numDays} days`);
            };
            if (hasMeals) {
                pendingReplaceRef.current = doApply;
                setReplacePrompt(`This will replace meals on all ${numDays} days with "${preset.label}" structure.`);
            } else {
                doApply();
            }
        } else {
            const hasMeals = (weeklyMeals[dayIndex] || []).length > 0;
            const doApply = () => {
                setWeeklyMealsDirty(prev => ({ ...prev, [dayIndex]: makeMeals() }));
                toast.success(`Applied "${preset.label}" to Day ${dayIndex + 1}`);
            };
            if (hasMeals) {
                pendingReplaceRef.current = doApply;
                setReplacePrompt(`This will replace all meals on Day ${dayIndex + 1} with "${preset.label}" structure.`);
            } else {
                doApply();
            }
        }
    }, [weeklyMeals, numDays]);

    // Save / Publish. When slotOnly=true, strips food items and saves as slot template.
    const [saveLock, setSaveLock] = useState(false);
    const save = useCallback(async (publish: boolean, slotOnly: boolean = false) => {
        if (saveLock) return; // Prevent double-click
        setSaveLock(true);

        const apiMeals: CreateDietPlanInput['meals'] = [];

        Object.entries(weeklyMeals).forEach(([dayIdx, dayMeals]) => {
            dayMeals.forEach(m => {
                const mealType = inferMealType(m.name);
                // Meal structure saves: strip all food items, keep only slots
                const foodItems = slotOnly ? [] : m.foods.map(f => ({
                    foodId: f.id,
                    quantityG: f.quantityValue,
                    notes: f.quantity,
                    optionGroup: f.optionGroup,
                    optionLabel: f.optionLabel,
                }));
                if (isTemplateMode) {
                    apiMeals.push({
                        dayOfWeek: parseInt(dayIdx),
                        mealType,
                        timeOfDay: m.time,
                        name: m.name,
                        description: m.description,
                        instructions: m.instructions,
                        foodItems,
                    });
                } else {
                    const mealDate = new Date(startDate);
                    mealDate.setDate(mealDate.getDate() + parseInt(dayIdx));
                    apiMeals.push({
                        mealDate: toLocalDateStr(mealDate),
                        mealType,
                        timeOfDay: m.time,
                        name: m.name,
                        description: m.description,
                        instructions: m.instructions,
                        foodItems,
                    });
                }
            });
        });

        if (apiMeals.length === 0) {
            toast.error('Add at least one meal to the plan');
            return;
        }

        // Block publish if any food has RED validation alerts
        if (publish) {
            const hasRedAlert = Object.values(weeklyMeals).some(dayMeals =>
                dayMeals.some(m => m.foods.some(f => f.validationSeverity === 'RED'))
            );
            if (hasRedAlert) {
                toast.error('Cannot publish: some foods have blocking validation alerts. Remove or replace them first.');
                return;
            }
        }

        // Compute endDate
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + numDays - 1);

        try {
            const caloriesPayload = targets.calories > 0 ? targets.calories : undefined;
            const proteinPayload = targets.protein > 0 ? targets.protein : undefined;
            const carbsPayload = targets.carbs > 0 ? targets.carbs : undefined;
            const fatPayload = targets.fat > 0 ? targets.fat : undefined;

            if (isEditMode && editId) {
                // Update existing plan/template
                await updateMutation.mutateAsync({
                    id: editId,
                    name: planName,
                    description: planDescription,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    targetCalories: caloriesPayload,
                    targetProteinG: proteinPayload,
                    targetCarbsG: carbsPayload,
                    targetFatsG: fatPayload,
                    hideCaloriesFromClient,
                    meals: apiMeals,
                });

                setIsDirty(false);
                if (clientId) sessionStorage.removeItem(`diet-plan-draft-${clientId}`);
                toast.success(isTemplateMode ? 'Template Updated!' : 'Diet Plan Updated!');
                onSaved(isTemplateMode, false);
            } else {
                const createdPlan = await createMutation.mutateAsync({
                    clientId: clientId || undefined,
                    name: planName,
                    description: planDescription,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    targetCalories: caloriesPayload,
                    targetProteinG: proteinPayload,
                    targetCarbsG: carbsPayload,
                    targetFatsG: fatPayload,
                    hideCaloriesFromClient,
                    meals: apiMeals,
                    options: isTemplateMode ? {
                        saveAsTemplate: true,
                        ...(slotOnly ? { templateCategory: 'slot_template' } : {}),
                    } : undefined,
                });

                if (publish && createdPlan?.id) {
                    await publishMutation.mutateAsync({ id: createdPlan.id, overlapStrategy });
                }

                setIsDirty(false);
                if (clientId) sessionStorage.removeItem(`diet-plan-draft-${clientId}`);
                toast.success(
                    isTemplateMode
                        ? (publish ? 'Template Published!' : 'Template Saved!')
                        : (publish ? 'Diet Plan Published!' : 'Draft Saved!')
                );

                onSaved(isTemplateMode, publish);
            }
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: { message?: string; details?: Array<{ field: string; message: string }> } } } };
            const serverMsg = err?.response?.data?.error?.message;
            const details = err?.response?.data?.error?.details;
            if (details?.length) {
                toast.error(`${serverMsg || 'Validation error'}: ${details.map(d => `${d.field}: ${d.message}`).join(', ')}`);
            } else {
                toast.error(serverMsg || 'Failed to save plan');
            }
        } finally {
            setSaveLock(false);
        }
    }, [weeklyMeals, clientId, planName, planDescription, startDate, numDays, isTemplateMode, createMutation, publishMutation, onSaved, targets, hideCaloriesFromClient, saveLock]);

    const confirmScaling = useCallback((scale: boolean) => {
        if (!pendingApplyRef.current || !scalingPrompt) return;
        const factor = scale ? scalingPrompt.ratio : 1;
        setScalingPrompt(null);
        pendingApplyRef.current(factor);
        pendingApplyRef.current = null;
    }, [scalingPrompt]);

    const dismissScaling = useCallback(() => {
        setScalingPrompt(null);
        setApplyingTemplateId(null);
        pendingApplyRef.current = null;
    }, []);

    const confirmReplace = useCallback(() => {
        pendingReplaceRef.current?.();
        pendingReplaceRef.current = null;
        setReplacePrompt(null);
    }, []);

    const dismissReplace = useCallback(() => {
        pendingReplaceRef.current = null;
        setReplacePrompt(null);
    }, []);

    const hasAllergyWarning = currentMeals.some(m => m.foods.some(f => f.hasWarning));

    return {
        // State
        startDate, setStartDate,
        selectedDayIndex, setSelectedDayIndex,
        planName, setPlanName,
        planDescription, setPlanDescription,
        weeklyMeals,
        showAddFoodModal, setShowAddFoodModal,
        activeMealId,
        activeOptionGroup,
        activeDayIndex,
        applyingTemplateId,
        numDays,
        planDates,
        currentMeals,

        // Computed
        dayNutrition,
        getDayMeals,
        getDayNutrition,
        getHasAllergyWarning,
        targets,
        setTargets,
        hideCaloriesFromClient,
        setHideCaloriesFromClient,
        hasAllergyWarning,

        // Actions
        addMeal,
        removeMeal,
        openAddFood,
        addFood,
        removeFood,
        updateFoodQuantity,
        updateFoodQuantityValue,
        updateMealField,
        addMealOption,
        removeOption,
        updateOptionLabel,
        addDay,
        removeDay,
        clipboardDay,
        copyDay,
        pasteDay,
        clearDay,
        clipboardMeal,
        copyMeal,
        pasteMeal,
        replaceAllDays,
        applyTemplate,
        applyPreset,
        bulkAdjust,
        scalingPrompt,
        confirmScaling,
        dismissScaling,
        replacePrompt,
        confirmReplace,
        dismissReplace,
        templateScopePrompt,
        confirmTemplateApply,
        dismissTemplateApply,
        showBulkPortionModal,
        setShowBulkPortionModal,
        save,

        // Mutation states
        isSaving: createMutation.isPending || updateMutation.isPending || saveLock,
        isEditMode,
        editLoading,
        isDirty,
    };
}
