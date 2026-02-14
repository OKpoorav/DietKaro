'use client';

import { useState, useCallback, useMemo } from 'react';
import { useApiClient } from '../api/use-api-client';
import { useCreateDietPlan, usePublishDietPlan, CreateDietPlanInput } from './use-diet-plans';
import { toast } from 'sonner';
import type { LocalMeal, LocalFoodItem, DayNutrition, ClientData, FoodItemData } from '../types/diet-plan.types';

// Re-export types used by components
export type { LocalMeal, LocalFoodItem, DayNutrition };

interface UseMealBuilderOptions {
    clientId: string | null;
    isTemplateMode: boolean;
    client: ClientData | null | undefined;
    onSaved: (isTemplate: boolean, published: boolean) => void;
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

export function useMealBuilder({ clientId, isTemplateMode, client, onSaved }: UseMealBuilderOptions) {
    const api = useApiClient();
    const createMutation = useCreateDietPlan();
    const publishMutation = usePublishDietPlan();

    // State
    const [startDate, setStartDate] = useState(new Date());
    const [selectedDayIndex, setSelectedDayIndex] = useState(0);
    const [planName, setPlanName] = useState(isTemplateMode ? 'New Template' : 'New Diet Plan');
    const [planDescription, setPlanDescription] = useState('');
    const [weeklyMeals, setWeeklyMeals] = useState<Record<number, LocalMeal[]>>({
        0: [
            { id: '1', name: 'Breakfast', type: 'breakfast', time: '08:00', foods: [] },
            { id: '2', name: 'Lunch', type: 'lunch', time: '13:00', foods: [] },
            { id: '3', name: 'Dinner', type: 'dinner', time: '19:30', foods: [] },
        ]
    });
    const [showAddFoodModal, setShowAddFoodModal] = useState(false);
    const [activeMealId, setActiveMealId] = useState<string | null>(null);
    const [activeOptionGroup, setActiveOptionGroup] = useState<number>(0);
    const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);

    const planDates = getDates(startDate, 7);
    const currentMeals = useMemo(() => weeklyMeals[selectedDayIndex] || [], [weeklyMeals, selectedDayIndex]);

    // Handlers
    const addMeal = useCallback(() => {
        const newMeal: LocalMeal = {
            id: Math.random().toString(36).substr(2, 9),
            name: 'Snack',
            type: 'snack',
            time: '16:00',
            foods: []
        };
        setWeeklyMeals(prev => ({
            ...prev,
            [selectedDayIndex]: [...(prev[selectedDayIndex] || []), newMeal]
        }));
    }, [selectedDayIndex]);

    const removeMeal = useCallback((id: string) => {
        setWeeklyMeals(prev => ({
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

        setWeeklyMeals(prev => ({
            ...prev,
            [selectedDayIndex]: (prev[selectedDayIndex] || []).map(m => {
                if (m.id === activeMealId) {
                    return { ...m, foods: [...m.foods, newFood] };
                }
                return m;
            })
        }));
        setShowAddFoodModal(false);
    }, [activeMealId, selectedDayIndex, client]);

    const removeFood = useCallback((mealId: string, tempId: string) => {
        setWeeklyMeals(prev => ({
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
        setWeeklyMeals(prev => ({
            ...prev,
            [selectedDayIndex]: (prev[selectedDayIndex] || []).map(m => {
                if (m.id === mealId) {
                    return { ...m, foods: m.foods.map(f => f.tempId === tempId ? { ...f, quantity: val } : f) };
                }
                return m;
            })
        }));
    }, [selectedDayIndex]);

    const updateMealField = useCallback((mealId: string, field: 'name' | 'time', value: string) => {
        setWeeklyMeals(prev => ({
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
            setWeeklyMeals(prev => ({
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
        setWeeklyMeals(prev => ({
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
        setWeeklyMeals(prev => ({
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

    // Apply template
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
                        const ratio = (f.quantityG || 100) / 100;
                        return {
                            id: f.foodItem.id,
                            tempId: Math.random().toString(36).substr(2, 9),
                            name: f.foodItem.name,
                            quantity: f.notes || `${f.quantityG}g`,
                            quantityValue: f.quantityG || 100,
                            calories: f.foodItem.calories * ratio,
                            protein: f.foodItem.protein * ratio,
                            carbs: f.foodItem.carbs * ratio,
                            fat: f.foodItem.fat * ratio,
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
                        foods: localFoods
                    };
                });
            });

            setWeeklyMeals(newWeeklyMeals);

            if (!newWeeklyMeals[selectedDayIndex]) {
                const firstDay = Object.keys(newWeeklyMeals).map(Number).sort((a, b) => a - b)[0];
                if (firstDay !== undefined && firstDay !== selectedDayIndex) {
                    setSelectedDayIndex(firstDay);
                }
            }

            toast.success('Template applied successfully');
        } catch (error) {
            console.error(error);
            toast.error('Failed to apply template');
        } finally {
            setApplyingTemplateId(null);
        }
    }, [api, client, selectedDayIndex]);

    // Save / Publish
    const save = useCallback(async (publish: boolean) => {
        const apiMeals: CreateDietPlanInput['meals'] = [];

        Object.entries(weeklyMeals).forEach(([dayIdx, dayMeals]) => {
            dayMeals.forEach(m => {
                apiMeals.push({
                    dayIndex: parseInt(dayIdx),
                    mealType: m.type,
                    timeOfDay: m.time,
                    title: m.name,
                    foodItems: m.foods.map(f => ({
                        foodId: f.id,
                        quantity: f.quantityValue,
                        notes: f.quantity,
                        optionGroup: f.optionGroup,
                        optionLabel: f.optionLabel,
                    }))
                });
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

        try {
            const createdPlan = await createMutation.mutateAsync({
                clientId: clientId || undefined,
                title: planName,
                description: planDescription,
                startDate: startDate.toISOString(),
                targetCalories: targets.calories,
                targetProteinG: targets.protein,
                targetCarbsG: targets.carbs,
                targetFatsG: targets.fat,
                meals: apiMeals,
                options: isTemplateMode ? { saveAsTemplate: true } : undefined,
            });

            if (publish && createdPlan?.id) {
                await publishMutation.mutateAsync(createdPlan.id);
            }

            toast.success(
                isTemplateMode
                    ? (publish ? 'Template Published!' : 'Template Saved!')
                    : (publish ? 'Diet Plan Published!' : 'Draft Saved!')
            );

            onSaved(isTemplateMode, publish);
        } catch (error) {
            toast.error('Failed to save plan');
            console.error(error);
        }
    }, [weeklyMeals, clientId, planName, planDescription, startDate, isTemplateMode, createMutation, publishMutation, onSaved]);

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
        planDates,
        currentMeals,

        // Computed
        dayNutrition,
        targets,
        setTargets,
        hasAllergyWarning,

        // Actions
        addMeal,
        removeMeal,
        openAddFood,
        addFood,
        removeFood,
        updateFoodQuantity,
        updateMealField,
        addMealOption,
        removeOption,
        updateOptionLabel,
        applyTemplate,
        save,

        // Mutation states
        isSaving: createMutation.isPending,
    };
}
