'use client';

import { useMemo, useState, useEffect } from 'react';
import { Trash2, Plus, AlertTriangle, AlertCircle, CheckCircle, GitBranch, FileText, ChevronDown, ChevronRight, Copy, ClipboardPaste } from 'lucide-react';
import type { LocalMeal, LocalFoodItem } from '@/lib/types/diet-plan.types';

const HOUSEHOLD_UNITS: { label: string; gramsEach: number | null; tooltip: string }[] = [
    { label: 'g',              gramsEach: 1,    tooltip: '1 gram' },
    { label: 'ml',             gramsEach: 1,    tooltip: '1 millilitre (≈ 1 g water)' },
    { label: 'tsp',            gramsEach: 5,    tooltip: '1 tsp = 5 ml' },
    { label: 'tbsp',           gramsEach: 15,   tooltip: '1 tbsp = 15 ml / ~15 g' },
    { label: 'katori (S)',     gramsEach: 100,  tooltip: 'Small katori = 100 ml' },
    { label: 'katori (M)',     gramsEach: 150,  tooltip: 'Medium katori = 150 ml' },
    { label: 'katori (L)',     gramsEach: 250,  tooltip: 'Large katori = 250 ml' },
    { label: 'cup (Indian)',   gramsEach: 200,  tooltip: 'Indian cup = 200 ml' },
    { label: 'glass (S)',      gramsEach: 150,  tooltip: 'Small glass = 150 ml' },
    { label: 'glass',          gramsEach: 250,  tooltip: 'Standard glass = 250 ml' },
    { label: 'mug',            gramsEach: 300,  tooltip: 'Coffee mug = 300 ml' },
    { label: 'cup (tea)',      gramsEach: 135,  tooltip: 'Tea / coffee cup = 135 ml' },
    { label: 'roti',           gramsEach: 25,   tooltip: '1 roti = 25 g flour' },
    { label: 'piece',          gramsEach: null, tooltip: '1 whole piece / unit' },
    { label: 'serving',        gramsEach: null, tooltip: '1 standard serving' },
];

function parseQty(qty: string): { num: number; unit: string } {
    const m = qty.trim().match(/^(\d+(?:\.\d+)?)\s*(.+)?$/);
    if (!m) return { num: 1, unit: 'serving' };
    return { num: parseFloat(m[1]), unit: m[2]?.trim() || 'serving' };
}

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

function FoodItemRow({
    food,
    mealId,
    onRemoveFood,
    onUpdateFoodQuantity,
    onUpdateFoodQuantityValue,
}: {
    food: LocalFoodItem;
    mealId: string;
    onRemoveFood: (mealId: string, tempId: string) => void;
    onUpdateFoodQuantity: (mealId: string, tempId: string, val: string) => void;
    onUpdateFoodQuantityValue: (mealId: string, tempId: string, grams: number) => void;
}) {
    const { bgClass, iconEl } = getFoodSeverityStyles(food);

    const initial = parseQty(food.quantity);
    const [qty, setQty] = useState(initial.num);
    const [unit, setUnit] = useState(
        HOUSEHOLD_UNITS.some(u => u.label === initial.unit) ? initial.unit : 'serving'
    );

    // Sync if quantity string changes externally (e.g. plan load)
    useEffect(() => {
        const p = parseQty(food.quantity);
        setQty(p.num);
        setUnit(HOUSEHOLD_UNITS.some(u => u.label === p.unit) ? p.unit : 'serving');
    }, [food.quantity]);

    const applyChange = (newQty: number, newUnit: string) => {
        const def = HOUSEHOLD_UNITS.find(u => u.label === newUnit);
        onUpdateFoodQuantity(mealId, food.tempId, `${newQty} ${newUnit}`);
        if (def?.gramsEach != null) {
            onUpdateFoodQuantityValue(mealId, food.tempId, newQty * def.gramsEach);
        }
    };

    const handleQtyChange = (val: string) => {
        const n = Math.max(0.1, parseFloat(val) || 1);
        setQty(n);
        applyChange(n, unit);
    };

    const handleUnitChange = (newUnit: string) => {
        setUnit(newUnit);
        applyChange(qty, newUnit);
    };

    const selectedDef = HOUSEHOLD_UNITS.find(u => u.label === unit);

    return (
        <div>
            <div className={`flex items-center gap-2 p-2 rounded-md ${bgClass}`}>
                {iconEl}
                <span className="text-gray-800 text-sm font-medium flex-grow truncate">{food.name}</span>
                <div className="flex items-center gap-1 shrink-0">
                    <input
                        type="number"
                        min="0.1"
                        step="0.5"
                        value={qty}
                        onChange={(e) => handleQtyChange(e.target.value)}
                        className="w-14 text-sm text-right px-1 py-1 border border-gray-200 rounded-md text-gray-900 bg-white"
                    />
                    <select
                        value={unit}
                        onChange={(e) => handleUnitChange(e.target.value)}
                        title={selectedDef?.tooltip}
                        className="text-xs px-1 py-1 border border-gray-200 rounded-md text-gray-700 bg-white cursor-pointer max-w-[108px]"
                    >
                        {HOUSEHOLD_UNITS.map(u => (
                            <option key={u.label} value={u.label} title={u.tooltip}>{u.label}</option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={() => onRemoveFood(mealId, food.tempId)}
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
}

interface MealEditorProps {
    meals: LocalMeal[];
    onAddMeal: () => void;
    onRemoveMeal: (id: string) => void;
    onOpenAddFood: (mealId: string, optionGroup?: number) => void;
    onRemoveFood: (mealId: string, tempId: string) => void;
    onUpdateFoodQuantity: (mealId: string, tempId: string, val: string) => void;
    onUpdateFoodQuantityValue: (mealId: string, tempId: string, grams: number) => void;
    onUpdateMealField: (mealId: string, field: 'name' | 'time' | 'type' | 'description' | 'instructions', value: string) => void;
    onAddAlternative?: (mealId: string) => void;
    onRemoveOption?: (mealId: string, optionGroup: number) => void;
    onUpdateOptionLabel?: (mealId: string, optionGroup: number, label: string) => void;
    onCopyMeal?: (mealId: string) => void;
    onPasteMeal?: (mealId: string) => void;
    hasMealClipboard?: boolean;
}

function MealCard({
    meal,
    onRemoveMeal,
    onOpenAddFood,
    onRemoveFood,
    onUpdateFoodQuantity,
    onUpdateFoodQuantityValue,
    onUpdateMealField,
    onAddAlternative,
    onRemoveOption,
    onUpdateOptionLabel,
    onCopyMeal,
    onPasteMeal,
    hasMealClipboard,
}: {
    meal: LocalMeal;
} & Omit<MealEditorProps, 'meals' | 'onAddMeal'>) {
    // Group foods by optionGroup
    const groupedFoods = useMemo(() => {
        const groups = new Map<number, LocalFoodItem[]>();
        meal.foods.forEach(food => {
            const g = food.optionGroup ?? 0;
            if (!groups.has(g)) groups.set(g, []);
            groups.get(g)!.push(food);
        });
        return Array.from(groups.entries()).sort(([a], [b]) => a - b);
    }, [meal.foods]);

    const hasAlternatives = groupedFoods.length > 1;
    const [notesOpen, setNotesOpen] = useState(false);
    const hasNotes = !!(meal.description || meal.instructions);

    // Calculate calories for display (option 0 only when alternatives exist)
    const displayCalories = useMemo(() => {
        if (!hasAlternatives) {
            return meal.foods.reduce((acc, f) => acc + f.calories, 0);
        }
        const option0Foods = meal.foods.filter(f => (f.optionGroup ?? 0) === 0);
        return option0Foods.reduce((acc, f) => acc + f.calories, 0);
    }, [meal.foods, hasAlternatives]);

    return (
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            {/* Meal Header */}
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
                        {displayCalories} Kcal
                    </p>
                    {onCopyMeal && (
                        <button
                            onClick={() => onCopyMeal(meal.id)}
                            className="p-1 text-gray-400 hover:text-brand hover:bg-brand/10 rounded transition-colors"
                            title="Copy meal (foods + options)"
                        >
                            <Copy className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {onPasteMeal && (
                        <button
                            onClick={() => onPasteMeal(meal.id)}
                            disabled={!hasMealClipboard}
                            className="p-1 text-gray-400 hover:text-brand hover:bg-brand/10 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                            title={hasMealClipboard ? 'Replace this meal\'s foods with the copied meal' : 'Copy a meal first'}
                        >
                            <ClipboardPaste className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button onClick={() => onRemoveMeal(meal.id)} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Meal Notes — collapsible */}
            <div className="mb-3">
                <button
                    onClick={() => setNotesOpen(!notesOpen)}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                    {notesOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <FileText className="w-3.5 h-3.5" />
                    Meal Notes
                    {hasNotes && !notesOpen && <span className="w-1.5 h-1.5 rounded-full bg-brand" />}
                </button>
                {notesOpen && (
                    <div className="mt-2 space-y-2 pl-5">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Description (visible to client)</label>
                            <textarea
                                value={meal.description || ''}
                                onChange={(e) => onUpdateMealField(meal.id, 'description', e.target.value)}
                                placeholder="e.g. Light protein-rich breakfast, ready in 10 min"
                                rows={2}
                                className="w-full text-sm px-2.5 py-1.5 border border-gray-200 rounded-md text-gray-800 placeholder:text-gray-300 focus:ring-1 focus:ring-brand/20 focus:border-brand outline-none resize-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Preparation Instructions</label>
                            <textarea
                                value={meal.instructions || ''}
                                onChange={(e) => onUpdateMealField(meal.id, 'instructions', e.target.value)}
                                placeholder="e.g. Boil eggs 8 min. Toast bread lightly. No butter."
                                rows={2}
                                className="w-full text-sm px-2.5 py-1.5 border border-gray-200 rounded-md text-gray-800 placeholder:text-gray-300 focus:ring-1 focus:ring-brand/20 focus:border-brand outline-none resize-none"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Food Items — flat list when no alternatives, grouped when alternatives exist */}
            {!hasAlternatives ? (
                <>
                    <div className="space-y-2 mb-3">
                        {meal.foods.map((food) => (
                            <FoodItemRow
                                key={food.tempId}
                                food={food}
                                mealId={meal.id}
                                onRemoveFood={onRemoveFood}
                                onUpdateFoodQuantity={onUpdateFoodQuantity}
                                onUpdateFoodQuantityValue={onUpdateFoodQuantityValue}
                            />
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => onOpenAddFood(meal.id, 0)}
                            className="flex-grow flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 hover:border-gray-300 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Add Food Item
                        </button>
                    </div>
                </>
            ) : (
                <div className="space-y-0">
                    {groupedFoods.map(([optionGroup, foods], idx) => {
                        const optionCalories = foods.reduce((acc, f) => acc + f.calories, 0);
                        const label = foods[0]?.optionLabel || `Option ${String.fromCharCode(65 + idx)}`;
                        const borderColor = idx === 0 ? 'border-l-brand' : 'border-l-blue-400';
                        const labelColor = idx === 0 ? 'text-brand bg-green-50' : 'text-blue-500 bg-blue-50';

                        return (
                            <div key={optionGroup}>
                                {/* OR divider between options */}
                                {idx > 0 && (
                                    <div className="flex items-center gap-3 my-4">
                                        <div className="flex-grow border-t-2 border-dashed border-gray-300" />
                                        <span className="text-sm font-bold text-gray-400 uppercase tracking-widest px-2">OR</span>
                                        <div className="flex-grow border-t-2 border-dashed border-gray-300" />
                                    </div>
                                )}

                                {/* Option group card */}
                                <div className={`border border-gray-200 border-l-4 ${borderColor} rounded-lg p-3 bg-gray-50/50`}>
                                    {/* Option header */}
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded ${labelColor}`}>
                                                {String.fromCharCode(65 + idx)}
                                            </span>
                                            <input
                                                value={label}
                                                onChange={(e) => onUpdateOptionLabel?.(meal.id, optionGroup, e.target.value)}
                                                className="text-sm font-semibold text-gray-800 border-none bg-transparent p-0 focus:ring-0 w-36"
                                                placeholder="Option name..."
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-gray-500">{optionCalories} kcal</span>
                                            <button
                                                onClick={() => onRemoveOption?.(meal.id, optionGroup)}
                                                className="p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                                                title="Remove this option"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Food items in this option */}
                                    <div className="space-y-2 mb-2">
                                        {foods.map((food) => (
                                            <FoodItemRow
                                                key={food.tempId}
                                                food={food}
                                                mealId={meal.id}
                                                onRemoveFood={onRemoveFood}
                                                onUpdateFoodQuantity={onUpdateFoodQuantity}
                                                onUpdateFoodQuantityValue={onUpdateFoodQuantityValue}
                                            />
                                        ))}
                                    </div>

                                    {/* Add food to this option */}
                                    <button
                                        onClick={() => onOpenAddFood(meal.id, optionGroup)}
                                        className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-md hover:bg-gray-50 hover:border-gray-300 transition-colors"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Add Food Item
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add Alternative Option button */}
            {onAddAlternative && (
                <button
                    onClick={() => onAddAlternative(meal.id)}
                    className="w-full mt-3 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-gray-400 border border-dashed border-gray-200 rounded-md hover:bg-gray-50 hover:border-brand hover:text-brand transition-colors"
                >
                    <GitBranch className="w-3.5 h-3.5" />
                    Add Alternative Option
                </button>
            )}
        </div>
    );
}

export function MealEditor({
    meals,
    onAddMeal,
    onRemoveMeal,
    onOpenAddFood,
    onRemoveFood,
    onUpdateFoodQuantity,
    onUpdateFoodQuantityValue,
    onUpdateMealField,
    onAddAlternative,
    onRemoveOption,
    onUpdateOptionLabel,
    onCopyMeal,
    onPasteMeal,
    hasMealClipboard,
}: MealEditorProps) {
    return (
        <div className="space-y-4">
            {meals.length === 0 && (
                <div className="text-center py-8 bg-white rounded-lg border border-gray-200 border-dashed">
                    <p className="text-gray-400 mb-2">No meals for this day</p>
                    <button onClick={onAddMeal} className="text-brand font-medium hover:underline">Start adding meals</button>
                </div>
            )}

            {meals.map((meal) => (
                <MealCard
                    key={meal.id}
                    meal={meal}
                    onRemoveMeal={onRemoveMeal}
                    onOpenAddFood={onOpenAddFood}
                    onRemoveFood={onRemoveFood}
                    onUpdateFoodQuantity={onUpdateFoodQuantity}
                    onUpdateFoodQuantityValue={onUpdateFoodQuantityValue}
                    onUpdateMealField={onUpdateMealField}
                    onAddAlternative={onAddAlternative}
                    onRemoveOption={onRemoveOption}
                    onUpdateOptionLabel={onUpdateOptionLabel}
                    onCopyMeal={onCopyMeal}
                    onPasteMeal={onPasteMeal}
                    hasMealClipboard={hasMealClipboard}
                />
            ))}

            {/* Add Meal Button */}
            <button
                onClick={onAddMeal}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 hover:border-brand hover:text-brand transition-colors"
            >
                <Plus className="w-5 h-5" />
                <span className="text-sm font-medium">Add another meal</span>
            </button>
        </div>
    );
}
