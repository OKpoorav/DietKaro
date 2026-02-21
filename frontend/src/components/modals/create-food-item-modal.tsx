'use client';

import { useState, useEffect, useMemo } from 'react';
import { Modal } from '@/components/ui/modal';
import { useCreateFoodItem, useUpdateFoodItem, useBaseIngredients, CreateFoodItemInput, FoodItem, BaseIngredient } from '@/lib/hooks/use-food-items';
import { Loader2, X, Search } from 'lucide-react';
import { toast } from 'sonner';

interface CreateFoodItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: FoodItem;
}

const CATEGORIES = ['Grains', 'Proteins', 'Vegetables', 'Fruits', 'Dairy', 'Beverages', 'Snacks', 'Other'];

const COMMON_ALLERGENS = [
    'peanuts', 'tree_nuts', 'milk', 'eggs', 'wheat',
    'gluten', 'soy', 'fish', 'shellfish', 'sesame', 'lactose',
];

const ALLERGEN_LABELS: Record<string, string> = {
    peanuts: 'Peanuts',
    tree_nuts: 'Tree Nuts',
    milk: 'Milk/Dairy',
    eggs: 'Eggs',
    wheat: 'Wheat',
    gluten: 'Gluten',
    soy: 'Soy',
    fish: 'Fish',
    shellfish: 'Shellfish',
    sesame: 'Sesame',
    lactose: 'Lactose',
};

const DIETARY_CATEGORIES = [
    { value: '', label: 'Auto-detect' },
    { value: 'vegan', label: 'Vegan' },
    { value: 'vegetarian', label: 'Vegetarian' },
    { value: 'veg_with_egg', label: 'Eggetarian' },
    { value: 'non_veg', label: 'Non-Vegetarian' },
];

export function CreateFoodItemModal({ isOpen, onClose, initialData }: CreateFoodItemModalProps) {
    const createMutation = useCreateFoodItem();
    const updateMutation = useUpdateFoodItem();
    const isEditing = !!initialData;

    const [formData, setFormData] = useState<CreateFoodItemInput>({
        name: '',
        brand: '',
        category: 'Grains',
        servingSizeG: 100,
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatsG: 0,
        fiberG: 0,
        sugarG: 0,
        sodiumMg: 0,
        dietaryTags: [],
        allergenFlags: [],
        isBaseIngredient: false,
        ingredientIds: [],
    });

    // Ingredient search state
    const [ingredientSearch, setIngredientSearch] = useState('');
    const [selectedIngredients, setSelectedIngredients] = useState<BaseIngredient[]>([]);
    const [showIngredientDropdown, setShowIngredientDropdown] = useState(false);

    const { data: baseIngredients } = useBaseIngredients(ingredientSearch || undefined);

    // Filter out already selected ingredients from dropdown
    const availableIngredients = useMemo(() => {
        if (!baseIngredients) return [];
        const selectedIds = new Set(selectedIngredients.map(i => i.id));
        return baseIngredients.filter(i => !selectedIds.has(i.id));
    }, [baseIngredients, selectedIngredients]);

    // Compute derived allergens from selected ingredients
    const derivedAllergens = useMemo(() => {
        const flags = new Set<string>();
        for (const ing of selectedIngredients) {
            for (const flag of ing.allergenFlags) {
                flags.add(flag);
            }
        }
        return Array.from(flags);
    }, [selectedIngredients]);

    // Populate form when initialData changes
    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                brand: initialData.brand || '',
                category: initialData.category,
                servingSizeG: parseFloat(initialData.servingSize) || 100,
                calories: initialData.nutrition.calories,
                proteinG: initialData.nutrition.proteinG || 0,
                carbsG: initialData.nutrition.carbsG || 0,
                fatsG: initialData.nutrition.fatsG || 0,
                fiberG: initialData.nutrition.fiberG || 0,
                sugarG: 0,
                sodiumMg: 0,
                dietaryTags: initialData.dietaryTags,
                allergenFlags: initialData.allergenFlags,
                isBaseIngredient: initialData.isBaseIngredient,
                ingredientIds: initialData.ingredients?.map(i => i.id) || [],
            });
            setSelectedIngredients(
                (initialData.ingredients || []).map(i => ({
                    id: i.id,
                    name: i.name,
                    allergenFlags: i.allergenFlags,
                    dietaryCategory: i.dietaryCategory,
                    category: '',
                }))
            );
        } else {
            setFormData({
                name: '',
                brand: '',
                category: 'Grains',
                servingSizeG: 100,
                calories: 0,
                proteinG: 0,
                carbsG: 0,
                fatsG: 0,
                fiberG: 0,
                sugarG: 0,
                sodiumMg: 0,
                dietaryTags: [],
                allergenFlags: [],
                isBaseIngredient: false,
                ingredientIds: [],
            });
            setSelectedIngredients([]);
        }
        setIngredientSearch('');
    }, [initialData, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const submitData = {
                ...formData,
                ingredientIds: formData.isBaseIngredient ? [] : selectedIngredients.map(i => i.id),
            };
            if (isEditing && initialData) {
                await updateMutation.mutateAsync({ id: initialData.id, ...submitData });
                toast.success('Food item updated successfully');
            } else {
                await createMutation.mutateAsync(submitData);
                toast.success('Food item created successfully');
            }
            onClose();
        } catch {
            toast.error(isEditing ? 'Failed to update food item' : 'Failed to create food item');
        }
    };

    const updateField = (field: keyof CreateFoodItemInput, value: string) => {
        const numValue = parseFloat(value) || 0;
        setFormData(prev => ({
            ...prev,
            [field]: numValue
        }));
    };

    const toggleAllergen = (allergen: string) => {
        setFormData(prev => {
            const current = prev.allergenFlags || [];
            const has = current.includes(allergen);
            return {
                ...prev,
                allergenFlags: has
                    ? current.filter(a => a !== allergen)
                    : [...current, allergen]
            };
        });
    };

    const addIngredient = (ingredient: BaseIngredient) => {
        setSelectedIngredients(prev => [...prev, ingredient]);
        setIngredientSearch('');
        setShowIngredientDropdown(false);
    };

    const removeIngredient = (id: string) => {
        setSelectedIngredients(prev => prev.filter(i => i.id !== id));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? "Edit Food Item" : "Add New Food Item"} size="lg">
            <form onSubmit={handleSubmit} className="space-y-5 p-1">
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
                        <input
                            required
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all outline-none text-gray-900 placeholder:text-gray-400"
                            placeholder="e.g., Brown Rice"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Brand <span className="text-gray-400 font-normal">(Optional)</span></label>
                        <input
                            type="text"
                            value={formData.brand}
                            onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all outline-none text-gray-900 placeholder:text-gray-400"
                            placeholder="e.g., Nature's Best"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                        <div className="relative">
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all outline-none text-gray-900 appearance-none cursor-pointer"
                            >
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                &#x25BC;
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Serving Size (g)</label>
                        <div className="relative">
                            <input
                                required
                                type="number"
                                min="1"
                                value={formData.servingSizeG}
                                onChange={(e) => updateField('servingSizeG', e.target.value)}
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all outline-none text-gray-900 placeholder:text-gray-400"
                                placeholder="100"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">g</span>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Dietary Type</label>
                        <div className="relative">
                            <select
                                value={formData.dietaryTags?.includes('vegan') ? 'vegan' :
                                    formData.dietaryTags?.includes('non_veg') ? 'non_veg' :
                                    formData.dietaryTags?.includes('veg_with_egg') ? 'veg_with_egg' :
                                    formData.dietaryTags?.includes('vegetarian') ? 'vegetarian' : ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData(prev => ({
                                        ...prev,
                                        dietaryTags: val ? [val] : []
                                    }));
                                }}
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all outline-none text-gray-900 appearance-none cursor-pointer"
                            >
                                {DIETARY_CATEGORIES.map(c => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                &#x25BC;
                            </div>
                        </div>
                    </div>
                </div>

                {/* Base Ingredient Toggle */}
                <div className="flex items-center gap-3 px-4 py-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.isBaseIngredient || false}
                            onChange={(e) => {
                                setFormData(prev => ({ ...prev, isBaseIngredient: e.target.checked }));
                                if (e.target.checked) {
                                    setSelectedIngredients([]);
                                }
                            }}
                            className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                    </label>
                    <div>
                        <span className="text-sm font-semibold text-gray-700">Base Ingredient</span>
                        <p className="text-xs text-gray-500">Mark this as a base ingredient (e.g., Milk, Wheat, Egg) that can be linked to other food items for allergen tracking</p>
                    </div>
                </div>

                {/* Ingredient Selector - only for composite (non-base) foods */}
                {!formData.isBaseIngredient && (
                    <div className="border border-gray-100 p-5 rounded-xl bg-amber-50/30">
                        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <span className="w-1 h-4 bg-amber-400 rounded-full"></span>
                            Ingredients
                            <span className="text-xs text-gray-400 font-normal ml-1">
                                (link base ingredients for automatic allergen detection)
                            </span>
                        </h4>

                        {/* Selected ingredients */}
                        {selectedIngredients.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                                {selectedIngredients.map(ing => (
                                    <span
                                        key={ing.id}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-xs font-medium border border-amber-200"
                                    >
                                        {ing.name}
                                        <button
                                            type="button"
                                            onClick={() => removeIngredient(ing.id)}
                                            className="hover:bg-amber-200 rounded-full p-0.5 transition-colors"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Search input */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={ingredientSearch}
                                onChange={(e) => {
                                    setIngredientSearch(e.target.value);
                                    setShowIngredientDropdown(true);
                                }}
                                onFocus={() => setShowIngredientDropdown(true)}
                                placeholder="Search base ingredients (e.g., milk, wheat, egg)..."
                                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition-all outline-none text-sm text-gray-900 placeholder:text-gray-400"
                            />

                            {/* Dropdown */}
                            {showIngredientDropdown && availableIngredients.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                    {availableIngredients.map(ing => (
                                        <button
                                            key={ing.id}
                                            type="button"
                                            onClick={() => addIngredient(ing)}
                                            className="w-full text-left px-4 py-2.5 hover:bg-amber-50 transition-colors flex items-center justify-between"
                                        >
                                            <span className="text-sm text-gray-900">{ing.name}</span>
                                            {ing.allergenFlags.length > 0 && (
                                                <span className="text-[10px] text-red-500 font-medium">
                                                    {ing.allergenFlags.map(f => ALLERGEN_LABELS[f] || f).join(', ')}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Derived allergens display */}
                        {derivedAllergens.length > 0 && (
                            <div className="mt-3 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
                                <span className="text-[10px] font-semibold text-red-600 uppercase tracking-wide">Derived allergens: </span>
                                <span className="text-xs text-red-700">
                                    {derivedAllergens.map(f => ALLERGEN_LABELS[f] || f).join(', ')}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Nutrition */}
                <div className="border border-gray-100 p-5 rounded-xl bg-gray-50/50">
                    <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="w-1 h-4 bg-brand rounded-full"></span>
                        Nutrition per serving
                    </h4>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
                        {[
                            { label: 'Calories', field: 'calories' as const, unit: '' },
                            { label: 'Protein', field: 'proteinG' as const, unit: 'g' },
                            { label: 'Carbs', field: 'carbsG' as const, unit: 'g' },
                            { label: 'Fat', field: 'fatsG' as const, unit: 'g' },
                            { label: 'Fiber', field: 'fiberG' as const, unit: 'g' },
                            { label: 'Sugar', field: 'sugarG' as const, unit: 'g' },
                            { label: 'Sodium', field: 'sodiumMg' as const, unit: 'mg' },
                        ].map(({ label, field, unit }) => (
                            <div key={field} className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                                <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
                                <div className="flex items-baseline gap-1">
                                    <input
                                        type="number"
                                        min="0"
                                        step={field === 'calories' ? '1' : '0.1'}
                                        value={(formData as unknown as Record<string, number>)[field] || 0}
                                        onChange={(e) => updateField(field, e.target.value)}
                                        className="w-full p-0 border-none focus:ring-0 text-base font-bold text-gray-900 placeholder:text-gray-300 bg-transparent"
                                        placeholder="0"
                                    />
                                    {unit && <span className="text-xs text-gray-400">{unit}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Allergens */}
                <div className="border border-gray-100 p-5 rounded-xl bg-red-50/30">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="w-1 h-4 bg-red-400 rounded-full"></span>
                        Allergens
                        <span className="text-xs text-gray-400 font-normal ml-1">
                            {selectedIngredients.length > 0
                                ? '(auto-derived from ingredients + override manually)'
                                : '(select manually)'}
                        </span>
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {COMMON_ALLERGENS.map(allergen => {
                            const isSelected = (formData.allergenFlags || []).includes(allergen);
                            const isDerived = derivedAllergens.includes(allergen);
                            return (
                                <button
                                    key={allergen}
                                    type="button"
                                    onClick={() => toggleAllergen(allergen)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                        isSelected || isDerived
                                            ? 'bg-red-100 text-red-700 border border-red-300'
                                            : 'bg-white text-gray-600 border border-gray-200 hover:border-red-200 hover:text-red-600'
                                    } ${isDerived && !isSelected ? 'opacity-60' : ''}`}
                                >
                                    {(isSelected || isDerived) && <X className="w-3 h-3 inline mr-1" />}
                                    {ALLERGEN_LABELS[allergen] || allergen}
                                    {isDerived && !isSelected && <span className="ml-1 text-[10px]">(auto)</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex justify-end pt-4 gap-3 border-t border-gray-100 mt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-gray-900 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={createMutation.isPending || updateMutation.isPending}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-brand hover:bg-brand/90 rounded-xl shadow-lg shadow-green-500/20 transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                        {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isEditing ? 'Update Food Item' : 'Create Food Item'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
