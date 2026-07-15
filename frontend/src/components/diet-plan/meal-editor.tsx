'use client';

import { useMemo, useState, useEffect } from 'react';
import { Trash2, Plus, GitBranch, FileText, ChevronDown, ChevronRight, Copy, ClipboardPaste } from 'lucide-react';
import type { LocalMeal, LocalFoodItem } from '@/lib/types/diet-plan.types';
import { TimeInput12h } from './time-input-12h';
import { NumberInput } from '@/components/ui/number-input';

/**
 * `kind`:
 *   - 'mass'   → resolved quantity displayed in "g"
 *   - 'volume' → resolved quantity displayed in "ml"
 *   - 'count'  → no resolved pill (a piece / serving doesn't convert cleanly)
 */
const HOUSEHOLD_UNITS: { label: string; gramsEach: number | null; kind: 'mass' | 'volume' | 'count'; tooltip: string }[] = [
    { label: 'g',              gramsEach: 1,    kind: 'mass',   tooltip: '1 gram' },
    { label: 'ml',             gramsEach: 1,    kind: 'volume', tooltip: '1 millilitre (≈ 1 g water)' },
    { label: 'tsp',            gramsEach: 5,    kind: 'volume', tooltip: '1 tsp = 5 ml' },
    { label: 'tbsp',           gramsEach: 15,   kind: 'volume', tooltip: '1 tbsp = 15 ml / ~15 g' },
    { label: 'katori (S)',     gramsEach: 100,  kind: 'volume', tooltip: 'Small katori = 100 ml' },
    { label: 'katori (M)',     gramsEach: 150,  kind: 'volume', tooltip: 'Medium katori = 150 ml' },
    { label: 'katori (L)',     gramsEach: 250,  kind: 'volume', tooltip: 'Large katori = 250 ml' },
    { label: 'cup (Indian)',   gramsEach: 200,  kind: 'volume', tooltip: 'Indian cup = 200 ml' },
    { label: 'glass (S)',      gramsEach: 150,  kind: 'volume', tooltip: 'Small glass = 150 ml' },
    { label: 'glass',          gramsEach: 250,  kind: 'volume', tooltip: 'Standard glass = 250 ml' },
    { label: 'mug',            gramsEach: 300,  kind: 'volume', tooltip: 'Coffee mug = 300 ml' },
    { label: 'cup (tea)',      gramsEach: 135,  kind: 'volume', tooltip: 'Tea / coffee cup = 135 ml' },
    { label: 'roti',           gramsEach: 25,   kind: 'mass',   tooltip: '1 roti = 25 g flour' },
    { label: 'piece',          gramsEach: null, kind: 'count',  tooltip: '1 whole piece / unit' },
    { label: 'serving',        gramsEach: null, kind: 'count',  tooltip: '1 standard serving' },
];

/**
 * Convert the row's stored quantity (in grams) into a short display pill.
 * Returns null when the unit is countable (piece / serving) AND we have no
 * meaningful gram backing — those don't have a sensible conversion to show.
 */
function formatResolvedQty(quantityValue: number, unit: string): string | null {
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) return null;
    const def = HOUSEHOLD_UNITS.find(u => u.label === unit);
    if (!def) return `${Math.round(quantityValue)}g`;
    if (def.kind === 'count') {
        // Show the gram backing when known — dietitians find "1 serving (= 100g)" useful.
        return `${Math.round(quantityValue)}g`;
    }
    return def.kind === 'volume' ? `${Math.round(quantityValue)}ml` : `${Math.round(quantityValue)}g`;
}

function parseQty(qty: string): { num: number; unit: string } {
    const m = qty.trim().match(/^(\d+(?:\.\d+)?)\s*(.+)?$/);
    if (!m) return { num: 1, unit: 'serving' };
    return { num: parseFloat(m[1]), unit: m[2]?.trim() || 'serving' };
}

/** 24-hour "HH:MM" → { hm: "08:00", ap: "AM" } for the timeline clock stamp. */
function clockParts(time24: string): { hm: string; ap: string } | null {
    if (!time24) return null;
    const [hStr, mStr] = time24.split(':');
    const h = parseInt(hStr, 10);
    if (Number.isNaN(h)) return null;
    const m = Number.isNaN(parseInt(mStr, 10)) ? 0 : parseInt(mStr, 10);
    const ap = h < 12 ? 'AM' : 'PM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return { hm: `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')}`, ap };
}

/**
 * Severity → row accent (colored left edge + tick dot + gentle tint).
 * Kept lightweight on purpose: no full-card fills, so the validation colour
 * is the only strong colour in the row.
 */
function severityStyles(food: LocalFoodItem) {
    const sev = food.validationSeverity ?? (food.hasWarning ? 'RED' : undefined);
    switch (sev) {
        case 'RED':
            return { edge: 'border-l-red-400', dot: 'bg-red-500', tint: 'bg-gradient-to-r from-red-50 to-transparent', alert: 'text-red-700' };
        case 'YELLOW':
            return { edge: 'border-l-amber-400', dot: 'bg-amber-500', tint: 'bg-gradient-to-r from-amber-50 to-transparent', alert: 'text-amber-700' };
        case 'GREEN':
            return { edge: 'border-l-green-500', dot: 'bg-green-500', tint: '', alert: 'text-green-700' };
        default:
            return { edge: 'border-l-transparent', dot: 'bg-gray-300', tint: '', alert: 'text-gray-500' };
    }
}

// Shared grid so header labels line up with every food row (flat + option modes).
const FOOD_GRID = 'grid grid-cols-[8px_minmax(0,1fr)_52px_104px_28px_28px_28px_52px_22px] items-center gap-2';

function FoodColumnHeader() {
    return (
        <div className={`${FOOD_GRID} px-2.5 py-1.5 bg-gray-50/70 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wide text-gray-400`}>
            <span />
            <span>Food</span>
            <span className="text-right">Qty</span>
            <span>Unit</span>
            <span className="text-center">P</span>
            <span className="text-center">C</span>
            <span className="text-center">F</span>
            <span className="text-right">Kcal</span>
            <span />
        </div>
    );
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
    const { edge, dot, tint, alert } = severityStyles(food);

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

    const handleQtyChange = (n: number) => {
        setQty(n);
        applyChange(n, unit);
    };

    const handleUnitChange = (newUnit: string) => {
        setUnit(newUnit);
        applyChange(qty, newUnit);
    };

    const selectedDef = HOUSEHOLD_UNITS.find(u => u.label === unit);
    const resolvedQty = formatResolvedQty(food.quantityValue, unit);

    const macro = (val: number) => (
        <span className={`text-center text-sm tabular-nums ${val > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
            {Math.round(val)}
        </span>
    );

    return (
        <div className={`border-l-[3px] ${edge} ${tint}`}>
            <div className={`${FOOD_GRID} px-2.5 py-1.5`}>
                <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                <span className="min-w-0 truncate text-sm font-medium text-gray-800">
                    {food.name}
                    {resolvedQty && <span className="ml-1.5 text-xs font-normal text-gray-400">{resolvedQty}</span>}
                </span>
                <NumberInput
                    min={0.1}
                    step={0.5}
                    value={qty}
                    onChange={handleQtyChange}
                    className="w-full text-sm text-right px-1.5 py-1 border border-gray-200 rounded-md text-gray-900 bg-white tabular-nums"
                />
                <select
                    value={unit}
                    onChange={(e) => handleUnitChange(e.target.value)}
                    title={selectedDef?.tooltip}
                    className="w-full text-xs px-1.5 py-1 border border-gray-200 rounded-md text-gray-600 bg-white cursor-pointer"
                >
                    {HOUSEHOLD_UNITS.map(u => (
                        <option key={u.label} value={u.label} title={u.tooltip}>{u.label}</option>
                    ))}
                </select>
                {macro(food.protein)}
                {macro(food.carbs)}
                {macro(food.fat)}
                <span className="text-right text-sm tabular-nums font-semibold text-gray-900">{Math.round(food.calories)}</span>
                <button
                    onClick={() => onRemoveFood(mealId, food.tempId)}
                    className="justify-self-center p-0.5 text-gray-300 hover:text-red-500 rounded transition-colors"
                    title="Remove food"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
            {food.validationAlerts && food.validationAlerts.length > 0 && (
                <p className={`text-xs pl-[26px] pr-2.5 pb-1.5 ${alert}`}>
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
    dayTotalKcal,
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
    dayTotalKcal: number;
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

    // Meal roll-up — option 0 only when alternatives exist (that's what "counts toward day").
    const rollup = useMemo(() => {
        const base = hasAlternatives ? meal.foods.filter(f => (f.optionGroup ?? 0) === 0) : meal.foods;
        return base.reduce(
            (acc, f) => ({ kcal: acc.kcal + f.calories, p: acc.p + f.protein, c: acc.c + f.carbs, f: acc.f + f.fat }),
            { kcal: 0, p: 0, c: 0, f: 0 }
        );
    }, [meal.foods, hasAlternatives]);

    const share = dayTotalKcal > 0 ? Math.round((rollup.kcal / dayTotalKcal) * 100) : null;
    const clock = clockParts(meal.time);

    return (
        <div className="group relative pl-[62px] pb-4 last:pb-0 before:content-[''] before:absolute before:left-[43px] before:top-6 before:bottom-0 before:w-0.5 before:bg-gray-200 last:before:hidden">
            {/* Timeline clock + node */}
            <div className="absolute left-0 top-1 w-10 text-right leading-tight">
                {clock ? (
                    <><span className="block text-[11px] font-bold text-gray-500 tabular-nums">{clock.hm}</span>
                    <span className="block text-[10px] font-bold text-gray-400">{clock.ap}</span></>
                ) : (
                    <span className="block text-[11px] text-gray-300">--:--</span>
                )}
            </div>
            <span className="absolute left-[39px] top-1.5 w-3 h-3 rounded-full bg-white border-[3px] border-brand" />

            {/* Meal header */}
            <div className="flex items-center gap-2 min-h-[28px]">
                <input
                    value={meal.name}
                    onChange={(e) => onUpdateMealField(meal.id, 'name', e.target.value)}
                    className="font-bold text-[15px] text-gray-900 border-none p-0 focus:ring-0 w-28 bg-transparent"
                />
                <TimeInput12h
                    value={meal.time}
                    onChange={(v) => onUpdateMealField(meal.id, 'time', v)}
                />
                <div className="ml-auto flex items-center gap-2.5">
                    <span className="text-[11.5px] text-gray-500 tabular-nums hidden sm:inline">
                        P<b className="text-gray-800">{Math.round(rollup.p)}</b> · C<b className="text-gray-800">{Math.round(rollup.c)}</b> · F<b className="text-gray-800">{Math.round(rollup.f)}</b>
                    </span>
                    {share !== null && (
                        <span className="text-[11px] font-bold text-brand bg-green-50 rounded px-1.5 py-0.5">{share}% of day</span>
                    )}
                    <span className="text-xs text-gray-500 tabular-nums"><b className="text-gray-900 text-[13px]">{Math.round(rollup.kcal)}</b> kcal</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onCopyMeal && (
                            <button onClick={() => onCopyMeal(meal.id)} className="p-1 text-gray-400 hover:text-brand hover:bg-brand/10 rounded transition-colors" title="Copy meal">
                                <Copy className="w-3.5 h-3.5" />
                            </button>
                        )}
                        {onPasteMeal && (
                            <button onClick={() => onPasteMeal(meal.id)} disabled={!hasMealClipboard} className="p-1 text-gray-400 hover:text-brand hover:bg-brand/10 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400" title={hasMealClipboard ? "Replace this meal's foods with the copied meal" : 'Copy a meal first'}>
                                <ClipboardPaste className="w-3.5 h-3.5" />
                            </button>
                        )}
                        <button onClick={() => onRemoveMeal(meal.id)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Remove meal">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Meal Notes — collapsible */}
            <div className="mt-1.5">
                <button
                    onClick={() => setNotesOpen(!notesOpen)}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                    {notesOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <FileText className="w-3.5 h-3.5" />
                    Meal notes
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

            {/* Foods — flat table when no alternatives, grouped options when alternatives exist */}
            {!hasAlternatives ? (
                <div className="mt-2 border border-gray-200 rounded-xl bg-white overflow-hidden">
                    <FoodColumnHeader />
                    <div className="divide-y divide-gray-100">
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
                    <div className="flex items-center gap-2 px-2.5 py-2 border-t border-gray-100 bg-gray-50/40">
                        <button
                            onClick={() => onOpenAddFood(meal.id, 0)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-dashed border-gray-300 rounded-lg hover:bg-brand/5 hover:border-brand hover:text-brand transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Add food item
                        </button>
                        {onAddAlternative && (
                            <button
                                onClick={() => onAddAlternative(meal.id)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-gray-400 rounded-lg hover:bg-brand/5 hover:text-brand transition-colors"
                            >
                                <GitBranch className="w-3.5 h-3.5" />
                                Add alternative option
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="mt-2 border border-gray-200 rounded-xl bg-white overflow-hidden">
                    {groupedFoods.map(([optionGroup, foods], idx) => {
                        const optRollup = foods.reduce(
                            (acc, f) => ({ kcal: acc.kcal + f.calories, p: acc.p + f.protein, c: acc.c + f.carbs, f: acc.f + f.fat }),
                            { kcal: 0, p: 0, c: 0, f: 0 }
                        );
                        const label = foods[0]?.optionLabel || `Option ${String.fromCharCode(65 + idx)}`;
                        const isPrimary = idx === 0;
                        const edge = isPrimary ? 'border-l-green-500' : 'border-l-blue-400';
                        const badge = isPrimary ? 'text-brand bg-green-50' : 'text-blue-600 bg-blue-50';

                        return (
                            <div key={optionGroup}>
                                {idx > 0 && (
                                    <div className="flex items-center gap-3 px-3 py-1.5">
                                        <div className="flex-grow border-t border-dashed border-gray-300" />
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">OR</span>
                                        <div className="flex-grow border-t border-dashed border-gray-300" />
                                    </div>
                                )}
                                <div className={`border-l-[3px] ${edge}`}>
                                    {/* Option header */}
                                    <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                                        <span className={`text-[11px] font-bold uppercase px-1.5 py-0.5 rounded ${badge}`}>
                                            {String.fromCharCode(65 + idx)}
                                        </span>
                                        <input
                                            value={label}
                                            onChange={(e) => onUpdateOptionLabel?.(meal.id, optionGroup, e.target.value)}
                                            className="text-sm font-bold text-gray-800 border-none bg-transparent p-0 focus:ring-0 w-36"
                                            placeholder="Option name..."
                                        />
                                        <span className="text-[10px] font-semibold text-gray-400 hidden md:inline">
                                            {isPrimary ? 'counts toward day' : 'alternative · not counted in totals'}
                                        </span>
                                        <span className="ml-auto text-[11px] text-gray-500 tabular-nums">
                                            {Math.round(optRollup.p)}p · {Math.round(optRollup.c)}c · {Math.round(optRollup.f)}f · <b className="text-gray-800">{Math.round(optRollup.kcal)}</b> kcal
                                        </span>
                                        <button
                                            onClick={() => onRemoveOption?.(meal.id, optionGroup)}
                                            className="p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                                            title="Remove this option"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <FoodColumnHeader />
                                    <div className="divide-y divide-gray-100">
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
                                    <div className="px-2.5 py-2">
                                        <button
                                            onClick={() => onOpenAddFood(meal.id, optionGroup)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-500 bg-white border border-dashed border-gray-300 rounded-lg hover:bg-brand/5 hover:border-brand hover:text-brand transition-colors"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            Add food to this option
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {onAddAlternative && (
                        <button
                            onClick={() => onAddAlternative(meal.id)}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-gray-400 border-t border-dashed border-gray-200 hover:bg-brand/5 hover:text-brand transition-colors"
                        >
                            <GitBranch className="w-3.5 h-3.5" />
                            Add alternative option
                        </button>
                    )}
                </div>
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
    // Day total (option-0 foods only) — powers each meal's "% of day".
    const dayTotalKcal = useMemo(
        () =>
            meals.reduce((total, meal) => {
                const hasAlt = new Set(meal.foods.map(f => f.optionGroup ?? 0)).size > 1;
                const base = hasAlt ? meal.foods.filter(f => (f.optionGroup ?? 0) === 0) : meal.foods;
                return total + base.reduce((a, f) => a + f.calories, 0);
            }, 0),
        [meals]
    );

    return (
        <div>
            {meals.length === 0 && (
                <div className="text-center py-8 bg-white rounded-xl border border-gray-200 border-dashed">
                    <p className="text-gray-400 mb-2">No meals for this day</p>
                    <button onClick={onAddMeal} className="text-brand font-medium hover:underline">Start adding meals</button>
                </div>
            )}

            {meals.map((meal) => (
                <MealCard
                    key={meal.id}
                    meal={meal}
                    dayTotalKcal={dayTotalKcal}
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
                className="w-full flex items-center justify-center gap-2 py-3 mt-1 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:bg-gray-50 hover:border-brand hover:text-brand transition-colors"
            >
                <Plus className="w-5 h-5" />
                <span className="text-sm font-medium">Add another meal</span>
            </button>
        </div>
    );
}
