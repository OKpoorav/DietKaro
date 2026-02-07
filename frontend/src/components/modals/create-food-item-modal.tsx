'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { useCreateFoodItem, useUpdateFoodItem, CreateFoodItemInput, FoodItem } from '@/lib/hooks/use-food-items';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CreateFoodItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: FoodItem;
}

const CATEGORIES = ['Grains', 'Proteins', 'Vegetables', 'Fruits', 'Dairy', 'Beverages', 'Snacks', 'Other'];

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
        dietaryTags: [],
        allergenFlags: []
    });

    // Populate form when initialData changes
    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                brand: initialData.brand || '',
                category: initialData.category,
                servingSizeG: parseFloat(initialData.servingSize) || 100, // Assuming servingSize comes as "100 g"
                calories: initialData.nutrition.calories,
                proteinG: initialData.nutrition.proteinG || 0,
                carbsG: initialData.nutrition.carbsG || 0,
                fatsG: initialData.nutrition.fatsG || 0,
                fiberG: initialData.nutrition.fiberG || 0,
                dietaryTags: initialData.dietaryTags,
                allergenFlags: initialData.allergenFlags
            });
        } else {
            // Reset if opening in create mode
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
                dietaryTags: [],
                allergenFlags: []
            });
        }
    }, [initialData, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isEditing && initialData) {
                await updateMutation.mutateAsync({ id: initialData.id, ...formData });
                toast.success('Food item updated successfully');
            } else {
                await createMutation.mutateAsync(formData);
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

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? "Edit Food Item" : "Add New Food Item"}>
            <form onSubmit={handleSubmit} className="space-y-6 p-1">
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
                        <input
                            required
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#17cf54]/20 focus:border-[#17cf54] transition-all outline-none text-gray-900 placeholder:text-gray-400"
                            placeholder="e.g., Brown Rice"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Brand <span className="text-gray-400 font-normal">(Optional)</span></label>
                        <input
                            type="text"
                            value={formData.brand}
                            onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#17cf54]/20 focus:border-[#17cf54] transition-all outline-none text-gray-900 placeholder:text-gray-400"
                            placeholder="e.g., Nature's Best"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                        <div className="relative">
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#17cf54]/20 focus:border-[#17cf54] transition-all outline-none text-gray-900 appearance-none cursor-pointer"
                            >
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                ▼
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
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#17cf54]/20 focus:border-[#17cf54] transition-all outline-none text-gray-900 placeholder:text-gray-400"
                                placeholder="100"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">g</span>
                        </div>
                    </div>
                </div>

                <div className="border border-gray-100 p-5 rounded-xl bg-gray-50/50">
                    <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="w-1 h-4 bg-[#17cf54] rounded-full"></span>
                        Nutrition per serving
                    </h4>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
                        <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Calories</label>
                            <input
                                type="number"
                                min="0"
                                value={formData.calories}
                                onChange={(e) => updateField('calories', e.target.value)}
                                className="w-full p-0 border-none focus:ring-0 text-lg font-bold text-gray-900 placeholder:text-gray-300 bg-transparent"
                                placeholder="0"
                            />
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Protein</label>
                            <div className="flex items-baseline gap-1">
                                <input
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    value={formData.proteinG}
                                    onChange={(e) => updateField('proteinG', e.target.value)}
                                    className="w-full p-0 border-none focus:ring-0 text-lg font-bold text-gray-900 placeholder:text-gray-300 bg-transparent"
                                    placeholder="0"
                                />
                                <span className="text-xs text-gray-400">g</span>
                            </div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Carbs</label>
                            <div className="flex items-baseline gap-1">
                                <input
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    value={formData.carbsG}
                                    onChange={(e) => updateField('carbsG', e.target.value)}
                                    className="w-full p-0 border-none focus:ring-0 text-lg font-bold text-gray-900 placeholder:text-gray-300 bg-transparent"
                                    placeholder="0"
                                />
                                <span className="text-xs text-gray-400">g</span>
                            </div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Fat</label>
                            <div className="flex items-baseline gap-1">
                                <input
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    value={formData.fatsG}
                                    onChange={(e) => updateField('fatsG', e.target.value)}
                                    className="w-full p-0 border-none focus:ring-0 text-lg font-bold text-gray-900 placeholder:text-gray-300 bg-transparent"
                                    placeholder="0"
                                />
                                <span className="text-xs text-gray-400">g</span>
                            </div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Fiber</label>
                            <div className="flex items-baseline gap-1">
                                <input
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    value={formData.fiberG}
                                    onChange={(e) => updateField('fiberG', e.target.value)}
                                    className="w-full p-0 border-none focus:ring-0 text-lg font-bold text-gray-900 placeholder:text-gray-300 bg-transparent"
                                    placeholder="0"
                                />
                                <span className="text-xs text-gray-400">g</span>
                            </div>
                        </div>
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
                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#17cf54] hover:bg-[#17cf54]/90 rounded-xl shadow-lg shadow-green-500/20 transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                        {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isEditing ? 'Update Food Item' : 'Create Food Item'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
