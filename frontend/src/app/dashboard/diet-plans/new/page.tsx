'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Eye,
    Download,
    Save,
    Send,
    ChevronLeft,
    ChevronRight,
    Search,
    BookOpen,
    Trash2,
    Plus,
    AlertTriangle,
    Loader2,
    Users,
} from 'lucide-react';
import { AddFoodModal } from '@/components/modals/add-food-modal';
import { useClient, useClients } from '@/lib/hooks/use-clients';
import { useCreateDietPlan, usePublishDietPlan, useDietPlans, CreateDietPlanInput } from '@/lib/hooks/use-diet-plans';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/lib/api/use-api-client';

// Helper to generate dates for keys
const getDates = (startDate: Date, days: number) => {
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

interface LocalMeal {
    id: string; // temp id
    name: string;
    type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    time: string;
    foods: LocalFoodItem[];
}

interface LocalFoodItem {
    id: string; // db food id
    tempId: string; // unique local id
    name: string;
    quantity: string;
    quantityValue: number; // in grams/units approx
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    hasWarning: boolean;
}

function BuilderContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const clientId = searchParams.get('clientId');
    const isTemplateMode = searchParams.get('template') === 'true';

    // Hooks - only fetch client if not in template mode and clientId provided
    const { data: client, isLoading: clientLoading } = useClient(
        !isTemplateMode && clientId ? clientId : ''
    );
    const createMutation = useCreateDietPlan();
    const publishMutation = usePublishDietPlan();

    // State for client selection if not provided in URL (and not in template mode)
    const [searchTerm, setSearchTerm] = useState('');
    const { data: clientsData } = useClients(
        !isTemplateMode && !clientId ? { search: searchTerm, pageSize: 10 } : {}
    );

    // Local State
    const [startDate, setStartDate] = useState(new Date());
    const [selectedDayIndex, setSelectedDayIndex] = useState(0);
    const [planName, setPlanName] = useState(isTemplateMode ? 'New Template' : 'New Diet Plan');
    const [planDescription, setPlanDescription] = useState('');

    // Store meals by day index (0-6 typically for a week)
    const [weeklyMeals, setWeeklyMeals] = useState<Record<number, LocalMeal[]>>({
        0: [
            { id: '1', name: 'Breakfast', type: 'breakfast', time: '08:00', foods: [] },
            { id: '2', name: 'Lunch', type: 'lunch', time: '13:00', foods: [] },
            { id: '3', name: 'Dinner', type: 'dinner', time: '19:30', foods: [] },
        ]
    });

    const [showAddFoodModal, setShowAddFoodModal] = useState(false);
    const [activeMealId, setActiveMealId] = useState<string | null>(null);

    const queryClient = useQueryClient();
    const api = useApiClient();

    // Fetch templates for sidebar
    const { data: templatesData } = useDietPlans({
        isTemplate: true,
        pageSize: 50
    });
    const templates = templatesData?.data || [];
    const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);


    // For templates, skip client selection entirely
    if (!isTemplateMode && !clientId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
                <div className="w-full max-w-md space-y-6 text-center">
                    <div className="w-16 h-16 bg-[#17cf54]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users className="w-8 h-8 text-[#17cf54]" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Select a Client</h2>
                        <p className="text-gray-500 mt-2">Choose a client to start building their diet plan.</p>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search clients by name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#17cf54]/20 focus:border-[#17cf54] outline-none transition-all"
                            autoFocus
                        />
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm text-left max-h-[300px] overflow-y-auto">
                        {!clientsData?.data?.length ? (
                            <div className="p-4 text-center text-gray-500 text-sm">
                                {searchTerm ? 'No clients found matching your search.' : 'Start typing to search...'}
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {clientsData.data.map((c: any) => (
                                    <button
                                        key={c.id}
                                        onClick={() => router.push(`/dashboard/diet-plans/new?clientId=${c.id}`)}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors group"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-medium group-hover:bg-[#17cf54]/10 group-hover:text-[#17cf54]">
                                            {c.fullName.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-900">{c.fullName}</p>
                                            <p className="text-xs text-gray-500">{c.email}</p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-gray-400 ml-auto group-hover:text-[#17cf54]" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="text-sm">
                        <span className="text-gray-500">Don&apos;t see the client? </span>
                        <Link href="/dashboard/clients" className="text-[#17cf54] font-medium hover:underline">
                            Add new client
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // For regular plans, show loading if client is loading
    if (!isTemplateMode && clientLoading) {
        return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;
    }

    // For regular plans, show error if client not found
    if (!isTemplateMode && !client) {
        return <div className="p-8 text-center text-red-500">Client not found.</div>;
    }

    const planDates = getDates(startDate, 7); // Default 1 week view
    const currentMeals = weeklyMeals[selectedDayIndex] || [];

    const handleAddMeal = () => {
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
    };

    const removeMeal = (id: string) => {
        setWeeklyMeals(prev => ({
            ...prev,
            [selectedDayIndex]: (prev[selectedDayIndex] || []).filter(m => m.id !== id)
        }));
    };

    const openAddFood = (mealId: string) => {
        setActiveMealId(mealId);
        setShowAddFoodModal(true);
    };

    const handleFoodAdded = (food: any) => {
        if (!activeMealId) return;

        const newFood: LocalFoodItem = {
            id: food.id,
            tempId: Math.random().toString(36).substr(2, 9),
            name: food.name,
            quantity: '1 serving',
            quantityValue: 100, // default
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
            hasWarning: client?.medicalProfile?.allergies?.some(a => food.name.toLowerCase().includes(a.toLowerCase())) || false
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
    };

    const removeFood = (mealId: string, tempId: string) => {
        setWeeklyMeals(prev => ({
            ...prev,
            [selectedDayIndex]: (prev[selectedDayIndex] || []).map(m => {
                if (m.id === mealId) {
                    return { ...m, foods: m.foods.filter(f => f.tempId !== tempId) };
                }
                return m;
            })
        }));
    };

    const updateFoodQuantity = (mealId: string, tempId: string, val: string) => {
        setWeeklyMeals(prev => ({
            ...prev,
            [selectedDayIndex]: (prev[selectedDayIndex] || []).map(m => {
                if (m.id === mealId) {
                    return { ...m, foods: m.foods.map(f => f.tempId === tempId ? { ...f, quantity: val } : f) };
                }
                return m;
            })
        }));
    };

    const calculateDayNutrition = () => {
        let calories = 0, protein = 0, carbs = 0, fat = 0;
        currentMeals.forEach(m => {
            m.foods.forEach(f => {
                calories += f.calories;
                protein += f.protein;
                carbs += f.carbs;
                fat += f.fat;
            });
        });
        return { calories, protein, carbs, fat };
    };

    const dayNutrition = calculateDayNutrition();
    // Default targets logic - use client data if available, otherwise defaults
    const targets = {
        calories: client?.targetWeightKg ? client.targetWeightKg * 30 : 2000,
        protein: 150,
        carbs: 200,
        fat: 70
    };


    const handleApplyTemplate = async (templateId: string) => {
        if (!confirm('This will replace all current meal entries with the selected template. Continue?')) return;

        setApplyingTemplateId(templateId);
        try {
            const { data } = await api.get(`/diet-plans/${templateId}`);
            const template = data.data;

            if (!template.meals || template.meals.length === 0) {
                toast.error('Template has no meals');
                return;
            }

            // Group by day and find min day to normalize
            const mealsByDay: Record<number, any[]> = {};
            let minDay = Infinity;

            template.meals.forEach((tm: any) => {
                // Ensure dayOfWeek is treated as number
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

                newWeeklyMeals[normalizedDay] = dayMeals.map((tm: any) => {
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
                            hasWarning: client?.medicalProfile?.allergies?.some((a: string) => f.foodItem.name.toLowerCase().includes(a.toLowerCase())) || false
                        };
                    }) || [];

                    return {
                        id: Math.random().toString(36).substr(2, 9),
                        name: tm.name || tm.mealType,
                        type: tm.mealType, // Assuming type matches valid types
                        time: tm.timeOfDay,
                        foods: localFoods
                    };
                });
            });

            console.log('Normalized Weekly Meals:', newWeeklyMeals);
            setWeeklyMeals(newWeeklyMeals);

            // If the current viewed day is empty after update, switch to the first populated day?
            // Actually, day 0 (normalized) should be populated if template wasn't empty.
            if (!newWeeklyMeals[selectedDayIndex]) {
                // Try to find first day with meals
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
    };


    const handleSave = async (publish: boolean) => {
        // Flatten weekly meals into API format
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
                        quantity: f.quantityValue, // Needs better quantity handling
                        notes: f.quantity
                    }))
                });
            });
        });

        if (apiMeals.length === 0) {
            toast.error('Add at least one meal to the plan');
            return;
        }

        try {
            // First create the plan (always as draft)
            const createdPlan = await createMutation.mutateAsync({
                clientId: clientId || undefined, // undefined for templates
                title: planName,
                description: planDescription,
                startDate: startDate.toISOString(),
                meals: apiMeals,
                options: isTemplateMode ? { saveAsTemplate: true } : undefined,
            });

            // If publish is requested, use the publish mutation
            if (publish && createdPlan?.id) {
                await publishMutation.mutateAsync(createdPlan.id);
            }

            toast.success(
                isTemplateMode
                    ? (publish ? 'Template Published!' : 'Template Saved!')
                    : (publish ? 'Diet Plan Published!' : 'Draft Saved!')
            );

            // Navigate based on mode
            if (isTemplateMode) {
                router.push('/dashboard/diet-plans?tab=templates');
            } else if (clientId) {
                router.push(`/dashboard/clients/${clientId}`);
            } else {
                router.push('/dashboard/diet-plans');
            }
        } catch (error) {
            toast.error('Failed to save plan');
            console.error(error);
        }
    };

    const hasAllergyWarning = currentMeals.some(m => m.foods.some(f => f.hasWarning));

    // Get client initials (or T for template)
    const initials = isTemplateMode
        ? 'T'
        : (client?.fullName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?');

    return (
        <div className="flex flex-col h-[calc(100vh-5rem)] -m-6">
            {/* Top Header */}
            <header className="flex items-center justify-between border-b border-gray-200 px-6 py-3 bg-white flex-shrink-0">
                <div className="flex items-center gap-6">
                    <Link
                        href={isTemplateMode ? '/dashboard/diet-plans' : `/dashboard/clients/${clientId}`}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {isTemplateMode ? 'Back to Templates' : 'Back to Client'}
                    </Link>
                    <div className="flex items-center gap-2">
                        <input
                            value={planName}
                            onChange={e => setPlanName(e.target.value)}
                            className="text-gray-900 text-sm font-medium border-none focus:ring-0"
                        />
                        {!isTemplateMode && client && (
                            <>
                                <span className="text-gray-400">|</span>
                                <span className="text-gray-600 text-sm">
                                    {client.fullName} ({client.dateOfBirth ?
                                        Math.floor((new Date().getTime() - new Date(client.dateOfBirth).getTime()) / 3.15576e10) :
                                        '?'
                                    } yrs)
                                </span>
                            </>
                        )}
                        {isTemplateMode && (
                            <>
                                <span className="text-gray-400">|</span>
                                <span className="text-purple-600 text-sm font-medium">Template</span>
                            </>
                        )}
                    </div>
                </div>
                <div className="flex gap-2">
                    {isTemplateMode ? (
                        // Template mode - just one Save Template button
                        <button
                            onClick={() => handleSave(false)}
                            disabled={createMutation.isPending}
                            className="flex items-center gap-2 h-10 px-4 bg-[#17cf54] hover:bg-[#17cf54]/90 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {createMutation.isPending ? 'Saving...' : 'Save Template'}
                        </button>
                    ) : (
                        // Client mode - Save Draft and Publish buttons
                        <>
                            <button
                                onClick={() => handleSave(false)}
                                disabled={createMutation.isPending}
                                className="flex items-center gap-2 h-10 px-4 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                Save Draft
                            </button>
                            <button
                                onClick={() => handleSave(true)}
                                disabled={createMutation.isPending}
                                className="flex items-center gap-2 h-10 px-4 bg-[#17cf54] hover:bg-[#17cf54]/90 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                            >
                                <Send className="w-4 h-4" />
                                Publish
                            </button>
                        </>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-grow grid grid-cols-12 gap-4 p-4 overflow-hidden bg-gray-50">
                {/* Left Sidebar - Client Info (only for non-template mode) */}
                <aside className="col-span-3 flex flex-col gap-4 overflow-y-auto pr-2">
                    {isTemplateMode ? (
                        // Template mode sidebar
                        <>
                            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">
                                        T
                                    </div>
                                    <div>
                                        <h1 className="text-gray-900 font-medium">Template</h1>
                                        <p className="text-gray-500 text-sm">
                                            Create reusable diet plan
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                                <h3 className="text-gray-900 font-medium mb-3">Template Tips</h3>
                                <ul className="text-sm text-gray-600 space-y-2">
                                    <li>• Templates can be assigned to any client</li>
                                    <li>• Meals will be copied when assigned</li>
                                    <li>• Client-specific targets will be applied later</li>
                                </ul>
                            </div>
                        </>
                    ) : client ? (
                        // Client mode sidebar
                        <>
                            {/* Client Card */}
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-[#17cf54]/20 flex items-center justify-center text-[#17cf54] font-bold">
                                        {initials}
                                    </div>
                                    <div>
                                        <h1 className="text-gray-900 font-medium">{client.fullName}</h1>
                                        <p className="text-gray-500 text-sm">
                                            {client.heightCm}cm, {client.currentWeightKg}kg <br />
                                            Goal: {client.targetWeightKg}kg
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Medical Summary */}
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                                <h3 className="text-gray-900 font-medium mb-3">Medical Summary</h3>
                                {client.medicalProfile?.allergies?.length ? (
                                    <details className="bg-gray-50 rounded-lg px-4 py-1 group mb-2" open>
                                        <summary className="flex cursor-pointer items-center justify-between py-2 text-sm font-medium text-gray-800">
                                            Allergies
                                            <ChevronRight className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" />
                                        </summary>
                                        <p className="text-gray-600 text-sm pb-2">{client.medicalProfile.allergies.join(', ')}</p>
                                    </details>
                                ) : <p className="text-sm text-gray-500 italic">No allergies recorded.</p>}

                                {client.medicalProfile?.conditions?.length ? (
                                    <details className="bg-gray-50 rounded-lg px-4 py-1 group">
                                        <summary className="flex cursor-pointer items-center justify-between py-2 text-sm font-medium text-gray-800">
                                            Conditions
                                            <ChevronRight className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" />
                                        </summary>
                                        <p className="text-gray-600 text-sm pb-2">{client.medicalProfile.conditions.join(', ')}</p>
                                    </details>
                                ) : null}
                            </div>
                        </>
                    ) : null}

                    {/* Templates Sidebar Scroller */}
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mt-4 flex flex-col gap-3 max-h-[400px]">
                        <h3 className="text-gray-900 font-medium flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-[#17cf54]" />
                            Saved Templates
                        </h3>
                        <div className="overflow-y-auto pr-1 space-y-2 flex-grow">
                            {templates.length === 0 ? (
                                <p className="text-sm text-gray-500 italic text-center py-4">No templates found</p>
                            ) : (
                                templates.map((t: any) => (
                                    <button
                                        key={t.id}
                                        onClick={() => handleApplyTemplate(t.id)}
                                        disabled={applyingTemplateId === t.id}
                                        className="w-full text-left p-3 rounded-lg border border-gray-100 hover:border-[#17cf54] hover:bg-[#17cf54]/5 transition-all group"
                                    >
                                        <div className="flex justify-between items-start">
                                            <span className="font-medium text-gray-800 text-sm group-hover:text-[#17cf54] line-clamp-1">
                                                {t.name}
                                            </span>
                                            {applyingTemplateId === t.id && (
                                                <Loader2 className="w-3 h-3 animate-spin text-[#17cf54]" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                            <span>{t.checkInFrequency || 'Flexible'}</span>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </aside>

                {/* Center - Meal Editor */}
                <section className="col-span-6 flex flex-col gap-4 overflow-y-auto">
                    {/* Day Selector */}
                    <div className="bg-white p-2 rounded-lg border border-gray-200 flex-shrink-0 sticky top-0 z-10">
                        <div className="flex justify-between items-center">
                            <button
                                onClick={() => setSelectedDayIndex(Math.max(0, selectedDayIndex - 1))}
                                className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30"
                                disabled={selectedDayIndex === 0}
                            >
                                <ChevronLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <div className="flex gap-1 overflow-x-auto no-scrollbar">
                                {planDates.map((d, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setSelectedDayIndex(i)}
                                        className={`px-3 py-2 text-sm font-medium rounded-md transition-colors min-w-[80px] ${selectedDayIndex === i
                                            ? 'bg-[#17cf54] text-white'
                                            : 'text-gray-500 hover:bg-gray-100'
                                            }`}
                                    >
                                        {isTemplateMode ? (
                                            <>
                                                <div className="text-xs opacity-80">Day</div>
                                                <div className="font-bold">{i + 1}</div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="text-xs opacity-80">{d.label}</div>
                                                <div className="font-bold">{d.day}</div>
                                            </>
                                        )}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => setSelectedDayIndex(Math.min(6, selectedDayIndex + 1))}
                                className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30"
                                disabled={selectedDayIndex === 6}
                            >
                                <ChevronRight className="w-5 h-5 text-gray-600" />
                            </button>
                        </div>
                    </div>

                    {/* Meals */}
                    <div className="space-y-4">
                        {currentMeals.length === 0 && (
                            <div className="text-center py-8 bg-white rounded-lg border border-gray-200 border-dashed">
                                <p className="text-gray-400 mb-2">No meals for this day</p>
                                <button onClick={handleAddMeal} className="text-[#17cf54] font-medium hover:underline">Start adding meals</button>
                            </div>
                        )}

                        {currentMeals.map((meal) => (
                            <div key={meal.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-2">
                                        <input
                                            value={meal.name}
                                            onChange={(e) => {
                                                setWeeklyMeals(prev => ({
                                                    ...prev,
                                                    [selectedDayIndex]: prev[selectedDayIndex].map(m => m.id === meal.id ? { ...m, name: e.target.value } : m)
                                                }));
                                            }}
                                            className="font-semibold text-gray-900 border-none p-0 focus:ring-0 w-32"
                                        />
                                        <input
                                            type="time"
                                            value={meal.time}
                                            onChange={(e) => {
                                                setWeeklyMeals(prev => ({
                                                    ...prev,
                                                    [selectedDayIndex]: prev[selectedDayIndex].map(m => m.id === meal.id ? { ...m, time: e.target.value } : m)
                                                }));
                                            }}
                                            className="text-sm p-1 border border-gray-200 rounded-md text-gray-700 w-24"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs font-medium text-gray-500">
                                            {meal.foods.reduce((acc, f) => acc + f.calories, 0)} Kcal
                                        </p>
                                        <button onClick={() => removeMeal(meal.id)} className="text-gray-400 hover:text-red-500">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Food Items */}
                                <div className="space-y-2 mb-3">
                                    {meal.foods.map((food) => (
                                        <div
                                            key={food.tempId}
                                            className={`flex items-center gap-2 p-2 rounded-md ${food.hasWarning
                                                ? 'bg-red-50 border border-red-300'
                                                : 'bg-gray-50'
                                                }`}
                                        >
                                            {food.hasWarning && (
                                                <AlertTriangle className="w-4 h-4 text-red-500 mr-1" />
                                            )}
                                            <span className="text-gray-800 text-sm font-medium flex-grow truncate">{food.name}</span>
                                            <input
                                                type="text"
                                                value={food.quantity}
                                                onChange={(e) => updateFoodQuantity(meal.id, food.tempId, e.target.value)}
                                                className="w-24 text-sm text-right p-1 border border-gray-200 rounded-md text-gray-700 bg-white"
                                            />
                                            <button
                                                onClick={() => removeFood(meal.id, food.tempId)}
                                                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Add Food */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => openAddFood(meal.id)}
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
                            onClick={handleAddMeal}
                            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 hover:border-[#17cf54] hover:text-[#17cf54] transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            <span className="text-sm font-medium">Add another meal</span>
                        </button>
                    </div>
                </section>

                {/* Right Sidebar - Nutrition Summary */}
                <aside className="col-span-3 flex flex-col gap-4 overflow-y-auto pl-2">
                    {/* Allergy Warning */}
                    {hasAllergyWarning && (
                        <div className="bg-red-50 border border-red-300 p-4 rounded-lg">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                                <div>
                                    <h4 className="font-bold text-red-700">Allergy Warning</h4>
                                    <p className="text-sm text-red-600">
                                        One or more food items conflict with the client&apos;s allergies.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Nutrition Summary */}
                    <div className="bg-white p-4 rounded-lg border border-gray-200 sticky top-0">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-gray-900 font-medium">Daily Summary</h3>
                            <span className="text-xs text-gray-500">Target: {targets.calories} Kcal</span>
                        </div>
                        <div className="space-y-4">
                            {Object.entries(dayNutrition).map(([key, value]) => {
                                const target = targets[key as keyof typeof targets] || 100;
                                const percent = Math.min((value / target) * 100, 100);
                                return (
                                    <div key={key}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-medium text-gray-800 capitalize">
                                                {key === 'calories' ? "Calories" : key}
                                            </span>
                                            <span className="font-medium text-gray-600">
                                                {Math.round(value)} / {target} {key === 'calories' ? 'kcal' : 'g'}
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full transition-all ${percent > 100 ? 'bg-red-500' : 'bg-[#17cf54]'}`}
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </aside>
            </main>

            {/* Add Food Modal */}
            <AddFoodModal
                isOpen={showAddFoodModal}
                onClose={() => setShowAddFoodModal(false)}
                mealType={currentMeals.find(m => m.id === activeMealId)?.name || 'Meal'}
                onAddFood={handleFoodAdded}
            />
        </div>
    );
}

export default function DietPlanBuilderPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-[#17cf54]" /></div>}>
            <BuilderContent />
        </Suspense>
    );
}
