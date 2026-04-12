'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useApiClient } from '../api/use-api-client';
import { useCreateDietPlan, usePublishDietPlan, useUpdateDietPlan, CreateDietPlanInput } from './use-diet-plans';
import { toast } from 'sonner';
import type { LocalMeal, LocalFoodItem, DayNutrition, FoodItemData } from '../types/diet-plan.types';
import type { Client } from './use-clients';
import type { MealSlotPreset } from '@/components/diet-plan/template-sidebar';

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

export function useMealBuilder({ clientId, isTemplateMode, editId, client, onSaved, initialStartDate, initialNumDays, initialPlanName, overlapStrategy, overlappingPlanIds }: UseMealBuilderOptions) {
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
        const meals: Record<number, LocalMeal[]> = {};
        for (let i = 0; i < days; i++) {
            meals[i] = defaultMeals(client?.preferences);
        }
        return meals;
    });
    const [showAddFoodModal, setShowAddFoodModal] = useState(false);
    const [activeMealId, setActiveMealId] = useState<string | null>(null);
    const [activeOptionGroup, setActiveOptionGroup] = useState<number>(0);
    const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);
    const [hideCaloriesFromClient, setHideCaloriesFromClient] = useState(false);
    const [numDays, setNumDays] = useState(initialNumDays || (isTemplateMode ? 7 : 1));
    const [editLoading, setEditLoading] = useState(!!editId);
    const [isDirty, setIsDirty] = useState(false);
    const [clipboardDay, setClipboardDay] = useState<LocalMeal[] | null>(null);

    // Sync state when PlanSetupModal results arrive (initial values only run once in useState)
    const [setupApplied, setSetupApplied] = useState(false);
    useEffect(() => {
        if (setupApplied || isEditMode) return;
        if (!initialNumDays && !initialStartDate && !initialPlanName) return;
        setSetupApplied(true);

        if (initialStartDate) setStartDate(initialStartDate);
        if (initialPlanName) setPlanName(initialPlanName);
        if (initialNumDays && initialNumDays > 1) {
            setNumDays(initialNumDays);
            setWeeklyMeals(() => {
                const meals: Record<number, LocalMeal[]> = {};
                for (let i = 0; i < initialNumDays; i++) {
                    meals[i] = defaultMeals(client?.preferences);
                }
                return meals;
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialNumDays, initialStartDate, initialPlanName]);

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

    // Dirty-tracking wrapper
    const setWeeklyMealsDirty = useCallback((updater: Parameters<typeof setWeeklyMeals>[0]) => {
        setWeeklyMeals(updater);
        setIsDirty(true);
    }, []);

    // Handlers
    const addMeal = useCallback(() => {
        const existing = weeklyMeals[selectedDayIndex] || [];
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
            [selectedDayIndex]: [...(prev[selectedDayIndex] || []), newMeal]
        }));
    }, [selectedDayIndex, weeklyMeals, client]);

    const removeMeal = useCallback((id: string) => {
        setWeeklyMealsDirty(prev => ({
            ...prev,
            [selectedDayIndex]: (prev[selectedDayIndex] || []).filter(m => m.id !== id)
        }));
    }, [selectedDayIndex]);

    const openAddFood = useCallback((mealId: string, optionGroup: number = 0) => {
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
            [selectedDayIndex]: (prev[selectedDayIndex] || []).map(m => {
                if (m.id === activeMealId) {
                    return { ...m, foods: [...m.foods, newFood] };
                }
                return m;
            })
        }));
        setShowAddFoodModal(false);
    }, [activeMealId, activeOptionGroup, selectedDayIndex, client]);

    const removeFood = useCallback((mealId: string, tempId: string) => {
        setWeeklyMealsDirty(prev => ({
            ...prev,
            [selectedDayIndex]: (prev[selectedDayIndex] || []).map(m => {
                if (m.id === mealId) {
                    return { ...m, foods: m.foods.filter(f => f.tempId !== tempId) };
                }
                return m;
            })
        }));
    }, [selectedDayIndex]);

    const updateFoodQuantity = useCallback((mealId: string, tempId: string, val: string) => {
        setWeeklyMealsDirty(prev => ({
            ...prev,
            [selectedDayIndex]: (prev[selectedDayIndex] || []).map(m => {
                if (m.id === mealId) {
                    return { ...m, foods: m.foods.map(f => f.tempId === tempId ? { ...f, quantity: val } : f) };
                }
                return m;
            })
        }));
    }, [selectedDayIndex]);

    const updateFoodQuantityValue = useCallback((mealId: string, tempId: string, newGrams: number) => {
        setWeeklyMealsDirty(prev => ({
            ...prev,
            [selectedDayIndex]: (prev[selectedDayIndex] || []).map(m => {
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
    }, [selectedDayIndex]);

    const updateMealField = useCallback((mealId: string, field: 'name' | 'time' | 'type' | 'description' | 'instructions', value: string) => {
        setWeeklyMealsDirty(prev => ({
            ...prev,
            [selectedDayIndex]: prev[selectedDayIndex].map(m => m.id === mealId ? { ...m, [field]: value } : m)
        }));
    }, [selectedDayIndex]);

    // Option group actions
    const addMealOption = useCallback((mealId: string) => {
        const meals = weeklyMeals[selectedDayIndex] || [];
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
                [selectedDayIndex]: (prev[selectedDayIndex] || []).map(m => {
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
        setActiveMealId(mealId);
        setActiveOptionGroup(newGroup);
        setShowAddFoodModal(true);
    }, [weeklyMeals, selectedDayIndex]);

    const removeOption = useCallback((mealId: string, optionGroup: number) => {
        setWeeklyMealsDirty(prev => ({
            ...prev,
            [selectedDayIndex]: (prev[selectedDayIndex] || []).map(m => {
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
    }, [selectedDayIndex]);

    const updateOptionLabel = useCallback((mealId: string, optionGroup: number, label: string) => {
        setWeeklyMealsDirty(prev => ({
            ...prev,
            [selectedDayIndex]: (prev[selectedDayIndex] || []).map(m => {
                if (m.id !== mealId) return m;
                return {
                    ...m,
                    foods: m.foods.map(f =>
                        f.optionGroup === optionGroup ? { ...f, optionLabel: label } : f
                    )
                };
            })
        }));
    }, [selectedDayIndex]);

    // Day management
    const addDay = useCallback(() => {
        if (numDays >= 7) return;
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

    const copyDay = useCallback(() => {
        const meals = weeklyMeals[selectedDayIndex] || [];
        setClipboardDay(JSON.parse(JSON.stringify(meals)));
        toast.success('Day copied');
    }, [weeklyMeals, selectedDayIndex]);

    const pasteDay = useCallback(() => {
        if (!clipboardDay) return;
        // Deep clone and assign new IDs
        const pasted: LocalMeal[] = clipboardDay.map(m => ({
            ...m,
            id: Math.random().toString(36).substr(2, 9),
            foods: m.foods.map(f => ({ ...f, tempId: Math.random().toString(36).substr(2, 9) })),
        }));
        setWeeklyMealsDirty(prev => ({ ...prev, [selectedDayIndex]: pasted }));
        toast.success('Day pasted');
    }, [clipboardDay, selectedDayIndex]);

    const clearDay = useCallback(() => {
        setWeeklyMealsDirty(prev => ({ ...prev, [selectedDayIndex]: defaultMeals(client?.preferences) }));
        toast.success('Day cleared');
    }, [selectedDayIndex, client]);

    // Bulk portion adjustment
    const [showBulkPortionModal, setShowBulkPortionModal] = useState(false);

    const bulkAdjust = useCallback((factor: number, scope: 'meal' | 'day' | 'plan') => {
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
            setWeeklyMealsDirty(prev => ({
                ...prev,
                [selectedDayIndex]: (prev[selectedDayIndex] || []).map(m => ({
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
    }, [selectedDayIndex]);

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
    const applyTemplate = useCallback(async (templateId: string) => {
        if (!confirm('This will replace all current meal entries with the selected template. Continue?')) return;

        setApplyingTemplateId(templateId);
        try {
            const { data } = await api.get(`/diet-plans/${templateId}`);
            const template = data.data;

            if (!template.meals || template.meals.length === 0) {
                toast.error('Template has no meals');
                return;
            }

            // Check if portion scaling needed
            let scaleFactor = 1;
            const templateCal = template.targetCalories;
            const clientCal = targets.calories;
            if (templateCal && clientCal && templateCal > 0) {
                const ratio = clientCal / templateCal;
                if (ratio > 1.1 || ratio < 0.9) {
                    const doScale = confirm(
                        `Template is ${templateCal} kcal but client target is ${clientCal} kcal.\n\n` +
                        `Scale portions by ${Math.round((ratio - 1) * 100)}% to match?\n\n` +
                        `OK = Scale portions\nCancel = Apply as-is`
                    );
                    if (doScale) scaleFactor = ratio;
                }
            }

            const mealsByDay: Record<number, Record<string, unknown>[]> = {};
            let minDay = Infinity;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            template.meals.forEach((tm: any) => {
                const d = typeof tm.dayOfWeek === 'string' ? parseInt(tm.dayOfWeek) : tm.dayOfWeek;
                if (!isNaN(d)) {
                    if (d < minDay) minDay = d;
                    if (!mealsByDay[d]) mealsByDay[d] = [];
                    mealsByDay[d].push(tm);
                }
            });

            if (minDay === Infinity) minDay = 0;

            const newWeeklyMeals: Record<number, LocalMeal[]> = {};

            Object.entries(mealsByDay).forEach(([dayStr, dayMeals]) => {
                const originalDay = parseInt(dayStr);
                const normalizedDay = originalDay - minDay;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                newWeeklyMeals[normalizedDay] = dayMeals.map((tm: any) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const localFoods: LocalFoodItem[] = tm.foodItems?.map((f: any) => {
                        const scaledQty = Math.round(((f.quantityG || 100) * scaleFactor) / 5) * 5;
                        const ratio = scaledQty / 100;
                        const proteinPer100 = Number(f.foodItem.proteinG) || 0;
                        const carbsPer100 = Number(f.foodItem.carbsG) || 0;
                        const fatPer100 = Number(f.foodItem.fatsG) || 0;
                        return {
                            id: f.foodItem.id,
                            tempId: Math.random().toString(36).substr(2, 9),
                            name: f.foodItem.name,
                            quantity: `${scaledQty}g`,
                            quantityValue: scaledQty,
                            calories: Math.round(f.foodItem.calories * ratio),
                            protein: Math.round(proteinPer100 * ratio * 10) / 10,
                            carbs: Math.round(carbsPer100 * ratio * 10) / 10,
                            fat: Math.round(fatPer100 * ratio * 10) / 10,
                            hasWarning: client?.medicalProfile?.allergies?.some((a: string) => f.foodItem.name.toLowerCase().includes(a.toLowerCase())) || false,
                            optionGroup: f.optionGroup ?? 0,
                            optionLabel: f.optionLabel ?? undefined,
                        };
                    }) || [];

                    return {
                        id: Math.random().toString(36).substr(2, 9),
                        name: tm.name || tm.mealType,
                        type: tm.mealType,
                        time: tm.timeOfDay,
                        description: tm.description || '',
                        instructions: tm.instructions || '',
                        foods: localFoods
                    };
                });
            });

            setWeeklyMealsDirty(newWeeklyMeals);

            // Sync numDays to match template's day count
            const dayKeys = Object.keys(newWeeklyMeals).map(Number);
            const templateDayCount = dayKeys.length > 0 ? Math.max(...dayKeys) + 1 : 1;
            setNumDays(Math.min(templateDayCount, 7));

            if (!newWeeklyMeals[selectedDayIndex]) {
                const firstDay = dayKeys.sort((a, b) => a - b)[0];
                if (firstDay !== undefined && firstDay !== selectedDayIndex) {
                    setSelectedDayIndex(firstDay);
                }
            }

            toast.success('Template applied successfully');
        } catch (error) {
            toast.error('Failed to apply template');
        } finally {
            setApplyingTemplateId(null);
        }
    }, [api, client, selectedDayIndex]);

    // Apply a preset meal structure (empty slots)
    const applyPreset = useCallback((preset: MealSlotPreset) => {
        if (!confirm('This will replace all current meals for this day with the selected structure. Continue?')) return;
        const newMeals: LocalMeal[] = preset.slots.map(slot => ({
            id: Math.random().toString(36).substr(2, 9),
            name: slot.name,
            type: slot.type,
            time: slot.time,
            foods: [],
        }));
        setWeeklyMealsDirty(prev => ({ ...prev, [selectedDayIndex]: newMeals }));
        toast.success(`Applied "${preset.label}" structure`);
    }, [selectedDayIndex]);

    // Save / Publish. When slotOnly=true, strips food items and saves as slot template.
    const [saveLock, setSaveLock] = useState(false);
    const save = useCallback(async (publish: boolean, slotOnly: boolean = false) => {
        if (saveLock) return; // Prevent double-click
        setSaveLock(true);

        const apiMeals: CreateDietPlanInput['meals'] = [];

        Object.entries(weeklyMeals).forEach(([dayIdx, dayMeals]) => {
            dayMeals.forEach(m => {
                const mealType = inferMealType(m.name);
                if (isTemplateMode) {
                    // Templates: use relative dayOfWeek index
                    apiMeals.push({
                        dayOfWeek: parseInt(dayIdx),
                        mealType,
                        timeOfDay: m.time,
                        name: m.name,
                        description: m.description,
                        instructions: m.instructions,
                        foodItems: slotOnly ? [] : m.foods.map(f => ({
                            foodId: f.id,
                            quantityG: f.quantityValue,
                            notes: f.quantity,
                            optionGroup: f.optionGroup,
                            optionLabel: f.optionLabel,
                        }))
                    });
                } else {
                    // Individual plans: use specific mealDate
                    const mealDate = new Date(startDate);
                    mealDate.setDate(mealDate.getDate() + parseInt(dayIdx));
                    apiMeals.push({
                        mealDate: toLocalDateStr(mealDate),
                        mealType,
                        timeOfDay: m.time,
                        name: m.name,
                        description: m.description,
                        instructions: m.instructions,
                        foodItems: m.foods.map(f => ({
                            foodId: f.id,
                            quantityG: f.quantityValue,
                            notes: f.quantity,
                            optionGroup: f.optionGroup,
                            optionLabel: f.optionLabel,
                        }))
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
            if (isEditMode && editId) {
                // Update existing plan/template
                await updateMutation.mutateAsync({
                    id: editId,
                    name: planName,
                    description: planDescription,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    targetCalories: targets.calories,
                    targetProteinG: targets.protein,
                    targetCarbsG: targets.carbs,
                    targetFatsG: targets.fat,
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
                    targetCalories: targets.calories,
                    targetProteinG: targets.protein,
                    targetCarbsG: targets.carbs,
                    targetFatsG: targets.fat,
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
        } catch (error) {
            toast.error('Failed to save plan');
        } finally {
            setSaveLock(false);
        }
    }, [weeklyMeals, clientId, planName, planDescription, startDate, numDays, isTemplateMode, createMutation, publishMutation, onSaved, targets, hideCaloriesFromClient, saveLock]);

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
        applyingTemplateId,
        numDays,
        planDates,
        currentMeals,

        // Computed
        dayNutrition,
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
        applyTemplate,
        applyPreset,
        bulkAdjust,
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
