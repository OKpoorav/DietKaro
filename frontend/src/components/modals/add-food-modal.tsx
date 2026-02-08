'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Search, Plus, Loader2, AlertTriangle, Ban, Heart, Check, Info } from 'lucide-react';
import { useFoodItems, FoodItem as ApiFoodItem } from '@/lib/hooks/use-food-items';
import { CreateFoodItemModal } from './create-food-item-modal';
import { useValidation, ValidationResult, ValidationSeverity } from '@/lib/hooks/use-validation';

interface AddFoodModalProps {
    isOpen: boolean;
    onClose: () => void;
    mealType?: string;
    clientId?: string | null;
    currentDay?: string;
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
    // Validation data
    validationSeverity?: ValidationSeverity;
    validationAlerts?: Array<{ type: string; severity: string; message: string; recommendation?: string }>;
    canAdd?: boolean;
}

const typeColors = {
    food: 'text-purple-600 bg-purple-100',
    meal: 'text-blue-600 bg-blue-100',
    template: 'text-[#17cf54] bg-[#17cf54]/10',
};

// Get day name from date
const getDayName = (date?: Date): string => {
    const d = date || new Date();
    return d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
};

// Map meal type string to proper type
const normalizeMealType = (mealType: string): 'breakfast' | 'lunch' | 'snack' | 'dinner' => {
    const lower = mealType.toLowerCase();
    if (lower.includes('breakfast')) return 'breakfast';
    if (lower.includes('lunch')) return 'lunch';
    if (lower.includes('dinner')) return 'dinner';
    return 'snack';
};

export function AddFoodModal({
    isOpen,
    onClose,
    mealType = 'Breakfast',
    clientId = null,
    currentDay,
    onAddFood
}: AddFoodModalProps) {
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedAlert, setSelectedAlert] = useState<ValidationResult | null>(null);

    // Validation hook
    const {
        validateFoods,
        getValidation,
        getBorderClass,
        isValidating,
        clearCache
    } = useValidation(clientId);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    // Clear cache when client changes
    useEffect(() => {
        clearCache();
    }, [clientId, clearCache]);

    const { data, isLoading } = useFoodItems({
        q: debouncedSearch,
        pageSize: 20
    });

    const foodItems = data?.data || [];

    // Validate foods when search results change
    useEffect(() => {
        if (foodItems.length > 0 && clientId) {
            const foodIds = foodItems.map((f: ApiFoodItem) => f.id);
            const day = currentDay || getDayName();
            validateFoods(foodIds, {
                currentDay: day,
                mealType: normalizeMealType(mealType)
            });
        }
    }, [foodItems, clientId, currentDay, mealType, validateFoods]);

    // Get validation icon
    const getValidationIcon = (validation: ValidationResult | undefined) => {
        if (!validation) return null;

        switch (validation.severity) {
            case 'RED':
                return <Ban className="w-4 h-4 text-red-500" />;
            case 'YELLOW':
                return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
            case 'GREEN':
                if (validation.alerts.some(a => a.type === 'preference_match' || a.type === 'cuisine_match')) {
                    return <Heart className="w-4 h-4 text-green-500" />;
                }
                return <Check className="w-4 h-4 text-green-500" />;
            default:
                return null;
        }
    };

    const handleFoodClick = (food: ApiFoodItem) => {
        const validation = getValidation(food.id);

        // If RED severity, show alert instead of adding
        if (validation?.severity === 'RED') {
            setSelectedAlert(validation);
            return;
        }

        onAddFood?.({
            id: food.id,
            name: food.name,
            type: 'food',
            calories: food.nutrition.calories,
            protein: food.nutrition.proteinG || 0,
            carbs: food.nutrition.carbsG || 0,
            fat: food.nutrition.fatsG || 0,
            description: `${food.servingSize} • ${food.nutrition.calories} kcal`,
            validationSeverity: validation?.severity,
            validationAlerts: validation?.alerts.map(a => ({
                type: a.type,
                severity: a.severity,
                message: a.message,
                recommendation: a.recommendation,
            })),
            canAdd: validation?.canAdd ?? true
        });
    };

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

                {/* Validation Legend (only show if client is selected) */}
                {clientId && foodItems.length > 0 && (
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-4 text-xs">
                        <span className="text-gray-500">Validation:</span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-red-500"></span>
                            <span className="text-gray-600">Blocked</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                            <span className="text-gray-600">Caution</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-green-500"></span>
                            <span className="text-gray-600">Good Match</span>
                        </span>
                        {isValidating && (
                            <Loader2 className="w-3 h-3 animate-spin text-gray-400 ml-auto" />
                        )}
                    </div>
                )}

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
                            {foodItems.map((food: ApiFoodItem) => {
                                const validation = clientId ? getValidation(food.id) : undefined;
                                const borderClass = clientId ? getBorderClass(validation?.severity) : 'border-gray-200 hover:border-[#17cf54]';
                                const isBlocked = validation?.severity === 'RED';

                                return (
                                    <div
                                        key={food.id}
                                        className={`border-2 rounded-lg p-4 flex flex-col transition-all group ${borderClass} ${isBlocked
                                                ? 'cursor-not-allowed opacity-75'
                                                : 'cursor-pointer hover:shadow-md'
                                            }`}
                                        onClick={() => handleFoodClick(food)}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="min-w-0 flex-grow">
                                                <p className="font-semibold text-gray-900 truncate" title={food.name}>
                                                    {food.name}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${typeColors.food}`}>
                                                        Food
                                                    </span>
                                                    {validation && validation.alerts.length > 0 && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedAlert(validation);
                                                            }}
                                                            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                                                        >
                                                            <Info className="w-3 h-3" />
                                                            {validation.alerts.length}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className={`p-1 transition-colors ${isBlocked ? 'text-red-400' : 'text-gray-300 group-hover:text-[#17cf54]'
                                                }`}>
                                                {getValidationIcon(validation) || <Plus className="w-5 h-5" />}
                                            </div>
                                        </div>

                                        {/* Alert preview for RED/YELLOW */}
                                        {validation && validation.alerts.length > 0 && (
                                            <p className={`text-xs mb-2 truncate ${validation.severity === 'RED' ? 'text-red-600' :
                                                    validation.severity === 'YELLOW' ? 'text-yellow-600' :
                                                        'text-green-600'
                                                }`}>
                                                {validation.alerts[0].message.replace(/^[⛔🟡✅]\s*/, '')}
                                            </p>
                                        )}

                                        <p className="text-sm text-gray-500 mb-3 flex-grow truncate">
                                            {food.category} • {food.servingSize}
                                        </p>
                                        <div className="text-xs text-gray-500 flex justify-between items-center bg-gray-50 p-2 rounded">
                                            <span className="font-medium">{food.nutrition.calories} Kcal</span>
                                            <div className="flex gap-2">
                                                <span>P:{food.nutrition.proteinG || 0}</span>
                                                <span>C:{food.nutrition.carbsG || 0}</span>
                                                <span>F:{food.nutrition.fatsG || 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
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

            {/* Alert Details Modal */}
            {selectedAlert && (
                <Modal
                    isOpen={!!selectedAlert}
                    onClose={() => setSelectedAlert(null)}
                    title="Validation Details"
                    size="md"
                >
                    <div className="p-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedAlert.severity === 'RED' ? 'bg-red-100' :
                                    selectedAlert.severity === 'YELLOW' ? 'bg-yellow-100' :
                                        'bg-green-100'
                                }`}>
                                {selectedAlert.severity === 'RED' && <Ban className="w-5 h-5 text-red-500" />}
                                {selectedAlert.severity === 'YELLOW' && <AlertTriangle className="w-5 h-5 text-yellow-500" />}
                                {selectedAlert.severity === 'GREEN' && <Check className="w-5 h-5 text-green-500" />}
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">{selectedAlert.foodName}</h3>
                                <p className={`text-sm font-medium ${selectedAlert.severity === 'RED' ? 'text-red-600' :
                                        selectedAlert.severity === 'YELLOW' ? 'text-yellow-600' :
                                            'text-green-600'
                                    }`}>
                                    {selectedAlert.severity === 'RED' ? 'Cannot Add' :
                                        selectedAlert.severity === 'YELLOW' ? 'Add with Caution' :
                                            'Good to Add'}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {selectedAlert.alerts.map((alert, idx) => (
                                <div
                                    key={idx}
                                    className={`p-3 rounded-lg text-sm ${alert.severity === 'RED' ? 'bg-red-50 text-red-700' :
                                            alert.severity === 'YELLOW' ? 'bg-yellow-50 text-yellow-700' :
                                                'bg-green-50 text-green-700'
                                        }`}
                                >
                                    <p>{alert.message}</p>
                                    {alert.recommendation && (
                                        <p className="mt-1 text-xs opacity-75">
                                            💡 {alert.recommendation}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>

                        {selectedAlert.canAdd && (
                            <button
                                onClick={() => {
                                    // Allow adding with warning
                                    setSelectedAlert(null);
                                }}
                                className="mt-4 w-full py-2.5 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition-colors"
                            >
                                Add Anyway
                            </button>
                        )}
                    </div>
                </Modal>
            )}

            <CreateFoodItemModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
            />
        </>
    );
}
