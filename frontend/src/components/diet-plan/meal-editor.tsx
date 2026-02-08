'use client';

import { Trash2, Plus, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import type { LocalMeal, LocalFoodItem } from '@/lib/types/diet-plan.types';

function getFoodSeverityStyles(food: LocalFoodItem) {
    switch (food.validationSeverity) {
        case 'RED':
            return {
                bgClass: 'bg-red-50 border border-red-300',
                iconEl: <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />,
            };
        case 'YELLOW':
            return {
                bgClass: 'bg-yellow-50 border border-yellow-300',
                iconEl: <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />,
            };
        case 'GREEN':
            return {
                bgClass: 'bg-green-50 border border-green-300',
                iconEl: <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />,
            };
        default:
            return {
                bgClass: food.hasWarning ? 'bg-red-50 border border-red-300' : 'bg-gray-50',
                iconEl: food.hasWarning ? <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" /> : null,
            };
    }
}

interface MealEditorProps {
    meals: LocalMeal[];
    onAddMeal: () => void;
    onRemoveMeal: (id: string) => void;
    onOpenAddFood: (mealId: string) => void;
    onRemoveFood: (mealId: string, tempId: string) => void;
    onUpdateFoodQuantity: (mealId: string, tempId: string, val: string) => void;
    onUpdateMealField: (mealId: string, field: 'name' | 'time', value: string) => void;
}

export function MealEditor({
    meals,
    onAddMeal,
    onRemoveMeal,
    onOpenAddFood,
    onRemoveFood,
    onUpdateFoodQuantity,
    onUpdateMealField,
}: MealEditorProps) {
    return (
        <div className="space-y-4">
            {meals.length === 0 && (
                <div className="text-center py-8 bg-white rounded-lg border border-gray-200 border-dashed">
                    <p className="text-gray-400 mb-2">No meals for this day</p>
                    <button onClick={onAddMeal} className="text-[#17cf54] font-medium hover:underline">Start adding meals</button>
                </div>
            )}

            {meals.map((meal) => (
                <div key={meal.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <input
                                value={meal.name}
                                onChange={(e) => onUpdateMealField(meal.id, 'name', e.target.value)}
                                className="font-semibold text-gray-900 border-none p-0 focus:ring-0 w-32"
                            />
                            <input
                                type="time"
                                value={meal.time}
                                onChange={(e) => onUpdateMealField(meal.id, 'time', e.target.value)}
                                className="text-sm p-1 border border-gray-200 rounded-md text-gray-700 w-24"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <p className="text-xs font-medium text-gray-500">
                                {meal.foods.reduce((acc, f) => acc + f.calories, 0)} Kcal
                            </p>
                            <button onClick={() => onRemoveMeal(meal.id)} className="text-gray-400 hover:text-red-500">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Food Items */}
                    <div className="space-y-2 mb-3">
                        {meal.foods.map((food) => {
                            const { bgClass, iconEl } = getFoodSeverityStyles(food);

                            return (
                                <div key={food.tempId}>
                                    <div
                                        className={`flex items-center gap-2 p-2 rounded-md ${bgClass}`}
                                    >
                                        {iconEl}
                                        <span className="text-gray-800 text-sm font-medium flex-grow truncate">{food.name}</span>
                                        <input
                                            type="text"
                                            value={food.quantity}
                                            onChange={(e) => onUpdateFoodQuantity(meal.id, food.tempId, e.target.value)}
                                            className="w-24 text-sm text-right p-1 border border-gray-200 rounded-md text-gray-700 bg-white"
                                        />
                                        <button
                                            onClick={() => onRemoveFood(meal.id, food.tempId)}
                                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {food.validationAlerts && food.validationAlerts.length > 0 && (
                                        <p className={`text-xs mt-1 ml-7 ${
                                            food.validationSeverity === 'RED' ? 'text-red-600' :
                                            food.validationSeverity === 'YELLOW' ? 'text-yellow-600' :
                                            'text-green-600'
                                        }`}>
                                            {food.validationAlerts[0].message}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Add Food */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => onOpenAddFood(meal.id)}
                            className="flex-grow flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 hover:border-gray-300 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Add Food Item
                        </button>
                    </div>
                </div>
            ))}

            {/* Add Meal Button */}
            <button
                onClick={onAddMeal}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 hover:border-[#17cf54] hover:text-[#17cf54] transition-colors"
            >
                <Plus className="w-5 h-5" />
                <span className="text-sm font-medium">Add another meal</span>
            </button>
        </div>
    );
}
