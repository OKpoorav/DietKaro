'use client';

import { useState } from 'react';
import {
    Search,
    Plus,
    Grid,
    List,
    Loader2,
} from 'lucide-react';
import { useFoodItems, FoodItem } from '@/lib/hooks/use-food-items';
import { CreateFoodItemModal } from '@/components/modals/create-food-item-modal';

const categories = ['All', 'Grains', 'Proteins', 'Vegetables', 'Fruits', 'Dairy', 'Beverages'];

export default function FoodLibraryPage() {
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('All');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingItem, setEditingItem] = useState<FoodItem | undefined>(undefined);

    // API hook
    const { data, isLoading, error } = useFoodItems({
        q: search || undefined,
        category: category !== 'All' ? category : undefined,
        pageSize: 50,
    });

    const foodItems = data?.data || [];

    const handleEdit = (item: FoodItem) => {
        setEditingItem(item);
        setShowCreateModal(true);
    };

    const handleCloseModal = () => {
        setShowCreateModal(false);
        setEditingItem(undefined);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Food Library</h1>
                    <p className="text-[#4e9767] mt-1">Browse and manage food items for diet plans.</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 h-10 px-4 bg-[#17cf54] hover:bg-[#17cf54]/90 text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Add Food Item
                </button>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                {/* Search Bar */}
                <div className="flex-grow max-w-md">
                    <label className="flex h-12 w-full">
                        <div className="flex w-full flex-1 items-stretch rounded-lg h-full bg-gray-100">
                            <div className="flex items-center justify-center pl-4 text-[#4e9767]">
                                <Search className="w-5 h-5" />
                            </div>
                            <input
                                className="flex w-full min-w-0 flex-1 bg-transparent h-full placeholder:text-gray-400 pl-3 pr-4 text-base outline-none text-gray-900"
                                placeholder="Search food items..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </label>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center gap-2 ml-auto">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-[#17cf54]/10 text-[#17cf54]' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        <Grid className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-[#17cf54]/10 text-[#17cf54]' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        <List className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Category Chips */}
            <div className="flex gap-2 flex-wrap">
                {categories.map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={`flex h-8 shrink-0 items-center justify-center px-4 rounded-lg text-sm font-medium transition-colors ${category === cat
                            ? 'bg-[#17cf54] text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-[#17cf54]" />
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    Failed to load food items. Please try again.
                </div>
            )}

            {/* Empty */}
            {!isLoading && !error && foodItems.length === 0 && (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                    <p className="text-gray-500">No food items found.</p>
                </div>
            )}

            {/* Grid View */}
            {!isLoading && foodItems.length > 0 && viewMode === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {foodItems.map((item: FoodItem) => (
                        <div
                            key={item.id}
                            className="flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-lg transition-shadow group relative"
                        >
                            <div className="h-32 bg-gradient-to-br from-[#17cf54]/20 to-[#17cf54]/5 flex items-center justify-center relative">
                                <span className="text-4xl">🍽️</span>
                                {/* Edit Button Overlay */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleEdit(item);
                                    }}
                                    className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white text-gray-600 hover:text-[#17cf54]"
                                    title="Edit Food Item"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                </button>
                            </div>
                            <div className="p-4 flex flex-col flex-grow">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <h3 className="font-semibold text-gray-900">{item.name}</h3>
                                    {item.isVerified && (
                                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                                            Verified
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-600 mb-3">
                                    {item.servingSize} serving
                                </p>
                                <div className="mt-auto grid grid-cols-4 gap-2 text-center text-xs">
                                    <div className="bg-gray-50 rounded p-2">
                                        <p className="font-bold text-gray-900">{item.nutrition?.calories || 0}</p>
                                        <p className="text-gray-500">kcal</p>
                                    </div>
                                    <div className="bg-gray-50 rounded p-2">
                                        <p className="font-bold text-gray-900">{item.nutrition?.proteinG || 0}g</p>
                                        <p className="text-gray-500">protein</p>
                                    </div>
                                    <div className="bg-gray-50 rounded p-2">
                                        <p className="font-bold text-gray-900">{item.nutrition?.carbsG || 0}g</p>
                                        <p className="text-gray-500">carbs</p>
                                    </div>
                                    <div className="bg-gray-50 rounded p-2">
                                        <p className="font-bold text-gray-900">{item.nutrition?.fatsG || 0}g</p>
                                        <p className="text-gray-500">fat</p>
                                    </div>
                                </div>
                                {item.dietaryTags?.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-1">
                                        {item.dietaryTags.slice(0, 3).map((tag) => (
                                            <span key={tag} className="px-2 py-0.5 text-xs bg-[#17cf54]/10 text-[#17cf54] rounded-full">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* List View */}
            {!isLoading && foodItems.length > 0 && viewMode === 'list' && (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Serving</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Calories</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Protein</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carbs</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fat</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {foodItems.map((item: FoodItem) => (
                                <tr key={item.id} className="hover:bg-gray-50 group">
                                    <td className="px-6 py-4 font-medium text-gray-900">
                                        {item.name}
                                        {item.isVerified && (
                                            <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                                                ✓
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 capitalize">{item.category}</td>
                                    <td className="px-6 py-4 text-gray-600">{item.servingSize}</td>
                                    <td className="px-6 py-4 text-gray-600">{item.nutrition?.calories || 0}</td>
                                    <td className="px-6 py-4 text-gray-600">{item.nutrition?.proteinG || 0}g</td>
                                    <td className="px-6 py-4 text-gray-600">{item.nutrition?.carbsG || 0}g</td>
                                    <td className="px-6 py-4 text-gray-600">{item.nutrition?.fatsG || 0}g</td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleEdit(item)}
                                            className="p-1 text-gray-400 hover:text-[#17cf54] opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Edit"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <CreateFoodItemModal
                isOpen={showCreateModal}
                onClose={handleCloseModal}
                initialData={editingItem}
            />
        </div>
    );
}
