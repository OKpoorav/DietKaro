'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Search, Plus, Loader2 } from 'lucide-react';
import { useFoodItems, FoodItem as ApiFoodItem } from '@/lib/hooks/use-food-items';
import { CreateFoodItemModal } from './create-food-item-modal';

interface AddFoodModalProps {
    isOpen: boolean;
    onClose: () => void;
    mealType?: string;
    onAddFood?: (food: LocalFoodItem) => void;
}

// Local interface for the callback, aligning with what the builder expects
interface LocalFoodItem {
    id: string;
    name: string;
    type: 'food' | 'meal' | 'template';
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    description?: string;
}

const typeColors = {
    food: 'text-purple-600 bg-purple-100',
    meal: 'text-blue-600 bg-blue-100',
    template: 'text-[#17cf54] bg-[#17cf54]/10',
};

export function AddFoodModal({ isOpen, onClose, mealType = 'Breakfast', onAddFood }: AddFoodModalProps) {
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const { data, isLoading } = useFoodItems({
        q: debouncedSearch,
        pageSize: 20
    });

    const foodItems = data?.data || [];

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={`Add to ${mealType}`} size="xl">
                {/* Search and Actions */}
                <div className="p-4 border-b border-gray-100 flex gap-4">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:ring-[#17cf54] focus:border-[#17cf54] text-gray-900"
                            placeholder="Search food database..."
                            autoFocus
                        />
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
                    >
                        <Plus className="w-4 h-4" />
                        Create New
                    </button>
                </div>

                {/* Food Grid */}
                <div className="p-4 max-h-[400px] overflow-y-auto">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-8 h-8 animate-spin text-[#17cf54]" />
                        </div>
                    ) : foodItems.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            {search ? (
                                <div className="space-y-2">
                                    <p>No foods found matching &quot;{search}&quot;.</p>
                                    <button
                                        onClick={() => setShowCreateModal(true)}
                                        className="text-[#17cf54] font-medium hover:underline"
                                    >
                                        Create a new food item
                                    </button>
                                </div>
                            ) : (
                                'Start typing to search foods.'
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {foodItems.map((food: ApiFoodItem) => (
                                <div
                                    key={food.id}
                                    className="border border-gray-200 rounded-lg p-4 flex flex-col hover:border-[#17cf54] cursor-pointer transition-colors group"
                                    onClick={() => onAddFood?.({
                                        id: food.id,
                                        name: food.name,
                                        type: 'food',
                                        calories: food.nutrition.calories,
                                        protein: food.nutrition.proteinG || 0,
                                        carbs: food.nutrition.carbsG || 0,
                                        fat: food.nutrition.fatsG || 0,
                                        description: `${food.servingSize} • ${food.nutrition.calories} kcal`
                                    })}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="min-w-0">
                                            <p className="font-semibold text-gray-900 truncate" title={food.name}>{food.name}</p>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${typeColors.food}`}>
                                                Food Item
                                            </span>
                                        </div>
                                        <div className="p-1 text-gray-300 group-hover:text-[#17cf54] transition-colors">
                                            <Plus className="w-5 h-5" />
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-500 mb-3 flex-grow truncate">{food.category} • {food.servingSize}</p>
                                    <div className="text-xs text-gray-500 flex justify-between items-center bg-gray-50 p-2 rounded">
                                        <span className="font-medium">{food.nutrition.calories} Kcal</span>
                                        <div className="flex gap-2">
                                            <span>P:{food.nutrition.proteinG || 0}</span>
                                            <span>C:{food.nutrition.carbsG || 0}</span>
                                            <span>F:{food.nutrition.fatsG || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </Modal>

            <CreateFoodItemModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
            />
        </>
    );
}
