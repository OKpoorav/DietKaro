'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
    ArrowLeft,
    Send,
    Utensils,
    Flag,
    Settings,
    TrendingDown,
    TrendingUp,
    Loader2,
    Clock,
    Camera,
    Calendar,
    CheckCircle,
    XCircle,
    AlertCircle,
    Target,
    Pencil,
    Check,
} from 'lucide-react';
import { useClient, useClientProgress, useUpdateClient } from '@/lib/hooks/use-clients';
import { useDietPlans, useDietPlan } from '@/lib/hooks/use-diet-plans';
import { useWeeklyAdherence, useComplianceHistory } from '@/lib/hooks/use-compliance';
import { useMealLogs } from '@/lib/hooks/use-meal-logs';
import { getInitials, calculateAge } from '@/lib/utils/formatters';
import { MedicalSidebar } from '@/components/diet-plan/medical-sidebar';
import { EditClientModal, type EditClientFormData } from '@/components/modals/edit-client-modal';
import { WhatsAppButton } from '@/components/clients/whatsapp-button';
import { useSetClientTags } from '@/lib/hooks/use-tags';
import { TagChip } from '@/components/clients/tag-chip';
import { ClientSubscriptionCard } from '@/components/subscriptions/client-subscription-card';
import { PaymentHistoryList } from '@/components/subscriptions/payment-history-list';

// ============ TYPES ============

type ClientTab = 'overview' | 'diet-plan' | 'meal-logs' | 'progress';

interface TabConfig {
    key: ClientTab;
    label: string;
}

// ============ CONSTANTS ============

const TABS: TabConfig[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'diet-plan', label: 'Diet Plan' },
    { key: 'meal-logs', label: 'Meal Logs' },
    { key: 'progress', label: 'Progress' },
];

const STATUS_STYLES: Record<string, { bg: string; icon: typeof CheckCircle }> = {
    eaten:       { bg: 'bg-green-100 text-green-700',  icon: CheckCircle },
    skipped:     { bg: 'bg-red-100 text-red-700',      icon: XCircle },
    pending:     { bg: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
    substituted: { bg: 'bg-blue-100 text-blue-700',     icon: AlertCircle },
};

const COMPLIANCE_BAR_COLOR: Record<string, string> = {
    GREEN: 'bg-brand',
    YELLOW: 'bg-yellow-400',
    RED: 'bg-red-400',
};


// ============ PLAN SECTION (fetches its own full plan data) ============

function PlanSection({ plan, client, isFirst }: { plan: { id: string; name: string; startDate: string; endDate?: string; description?: string; status?: string; targetCalories?: number; targetProteinG?: number; targetCarbsG?: number; targetFatsG?: number }; client: any; isFirst: boolean }) {
    const { data: fullPlan, isLoading } = useDietPlan(plan.id);
    const [collapsed, setCollapsed] = useState(!isFirst);

    const typeOrder: Record<string, number> = { breakfast: 0, lunch: 1, snack: 2, dinner: 3 };

    // Group meals by date
    const mealsByDate = new Map<string, any[]>();
    if (fullPlan?.meals?.length) {
        const planStart = new Date(fullPlan.startDate);
        for (const meal of fullPlan.meals) {
            let dateKey: string;
            if (meal.mealDate) {
                const d = new Date(meal.mealDate);
                dateKey = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            } else {
                const d = new Date(planStart);
                d.setDate(d.getDate() + (meal.dayOfWeek ?? 0));
                dateKey = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            }
            if (!mealsByDate.has(dateKey)) mealsByDate.set(dateKey, []);
            mealsByDate.get(dateKey)!.push(meal);
        }
    }

    const startStr = new Date(plan.startDate).toLocaleDateString();
    const endStr = plan.endDate ? new Date(plan.endDate).toLocaleDateString() : '';
    const isCurrent = plan.status === 'active';

    return (
        <div className={`rounded-xl bg-white shadow-sm border ${isCurrent ? 'border-brand/30' : 'border-gray-100'}`}>
            {/* Plan header — always visible, clickable to expand/collapse */}
            <button
                onClick={() => setCollapsed(c => !c)}
                className="w-full p-5 flex items-center justify-between text-left"
            >
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-gray-900">{fullPlan?.name || plan.name}</h3>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isCurrent ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {plan.status}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {startStr}{endStr ? ` — ${endStr}` : ''}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href={`/dashboard/diet-plans/${plan.id}`}
                        onClick={e => e.stopPropagation()}
                        className="text-xs text-brand font-medium hover:underline"
                    >
                        View Full Plan
                    </Link>
                    <span className="text-gray-400 text-xs">{collapsed ? '▸' : '▾'}</span>
                </div>
            </button>

            {/* Expandable content */}
            {!collapsed && (
                <div className="px-5 pb-5 space-y-4">
                    {/* Macro targets */}
                    <div className="grid grid-cols-4 gap-3">
                        <div className="bg-gray-50 p-2.5 rounded text-center">
                            <p className="font-bold text-gray-900 text-sm">{plan.targetCalories ?? client?.targetCalories ?? '-'}</p>
                            <p className="text-gray-500 text-xs">Calories</p>
                        </div>
                        <div className="bg-gray-50 p-2.5 rounded text-center">
                            <p className="font-bold text-gray-900 text-sm">{plan.targetProteinG ?? client?.targetProteinG ?? '-'}g</p>
                            <p className="text-gray-500 text-xs">Protein</p>
                        </div>
                        <div className="bg-gray-50 p-2.5 rounded text-center">
                            <p className="font-bold text-gray-900 text-sm">{plan.targetCarbsG ?? client?.targetCarbsG ?? '-'}g</p>
                            <p className="text-gray-500 text-xs">Carbs</p>
                        </div>
                        <div className="bg-gray-50 p-2.5 rounded text-center">
                            <p className="font-bold text-gray-900 text-sm">{plan.targetFatsG ?? client?.targetFatsG ?? '-'}g</p>
                            <p className="text-gray-500 text-xs">Fat</p>
                        </div>
                    </div>

                    {/* Meals by day */}
                    {isLoading ? (
                        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                    ) : mealsByDate.size > 0 ? (
                        <div className="space-y-4">
                            {Array.from(mealsByDate.entries()).map(([dateLabel, dayMeals]) => (
                                <div key={dateLabel}>
                                    <h4 className="text-xs font-semibold text-[#4e9767] uppercase tracking-wide mb-2 pb-1 border-b border-gray-100">
                                        {dateLabel}
                                    </h4>
                                    <div className="space-y-2">
                                        {dayMeals
                                            .sort((a: any, b: any) => (typeOrder[a.mealType] ?? 9) - (typeOrder[b.mealType] ?? 9))
                                            .map((meal: any) => (
                                            <div key={meal.id} className="p-3 bg-gray-50 rounded-lg">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-medium text-gray-400 uppercase">{meal.mealType}</span>
                                                        <p className="font-medium text-gray-900 text-sm">{meal.name}</p>
                                                    </div>
                                                    {meal.timeOfDay && (
                                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {meal.timeOfDay}
                                                        </span>
                                                    )}
                                                </div>
                                                {meal.foodItems?.length > 0 && (
                                                    <div className="mt-1.5 space-y-0.5">
                                                        {meal.foodItems.map((food: any, fi: number) => (
                                                            <div key={fi} className="text-xs text-gray-600 flex justify-between">
                                                                <span>{food.foodItem?.name || 'Unknown'}</span>
                                                                <span className="text-gray-400">{food.quantityG}g</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 text-center py-4">No meals in this plan</p>
                    )}
                </div>
            )}
        </div>
    );
}

// ============ COMPONENT ============

export default function ClientProfilePage() {
    const params = useParams();
    const clientId = params.id as string;

    // Tab state
    const [activeTab, setActiveTab] = useState<ClientTab>('overview');

    // API hooks — all data comes pre-computed from backend
    const { data: client, isLoading: clientLoading, error: clientError } = useClient(clientId);
    const { data: progress, isLoading: progressLoading } = useClientProgress(clientId);
    const { data: plansData } = useDietPlans({ clientId, isPublished: true });
    const { data: weeklyAdherence } = useWeeklyAdherence(clientId);

    const allPlans = (plansData?.data || []).slice().sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    const activePlan = allPlans[0]; // keep for backward compat (overview tab etc.)

    // Tab-specific hooks (called unconditionally per React rules)
    const { data: fullPlan } = useDietPlan(activePlan?.id || '');
    const { data: mealLogsData, isLoading: mealLogsLoading } = useMealLogs({ clientId, pageSize: 20 });
    const { data: complianceHistory } = useComplianceHistory(clientId, 30);
    const updateClient = useUpdateClient();

    // Edit client modal state
    const [editClientOpen, setEditClientOpen] = useState(false);

    const setClientTags = useSetClientTags();

    const handleEditClient = (data: EditClientFormData) => {
        const parseList = (s: string) => s.split(',').map(v => v.trim()).filter(Boolean);
        updateClient.mutate({
            id: clientId,
            fullName: data.fullName,
            email: data.email,
            phone: data.phone,
            dateOfBirth: data.dateOfBirth || undefined,
            gender: (data.gender as 'male' | 'female' | 'other') || undefined,
            heightCm: data.heightCm ? Number(data.heightCm) : undefined,
            currentWeightKg: data.currentWeightKg ? Number(data.currentWeightKg) : undefined,
            targetWeightKg: data.targetWeightKg ? Number(data.targetWeightKg) : undefined,
            allergies: parseList(data.allergies),
            medicalConditions: parseList(data.medicalConditions),
        } as Parameters<typeof updateClient.mutate>[0], {
            onSuccess: () => {
                setClientTags.mutate({ clientId, tagIds: data.tagIds });
                setEditClientOpen(false);
            },
        });
    };

    // Editable nutrition targets state
    const [editingTargets, setEditingTargets] = useState(false);
    const [targetDraft, setTargetDraft] = useState({
        targetCalories: 0,
        targetProteinG: 0,
        targetCarbsG: 0,
        targetFatsG: 0,
    });

    const startEditTargets = () => {
        setTargetDraft({
            targetCalories: Number(client?.targetCalories) || 0,
            targetProteinG: Number(client?.targetProteinG) || 0,
            targetCarbsG: Number(client?.targetCarbsG) || 0,
            targetFatsG: Number(client?.targetFatsG) || 0,
        });
        setEditingTargets(true);
    };

    const saveTargets = () => {
        updateClient.mutate({
            id: clientId,
            targetCalories: targetDraft.targetCalories || null,
            targetProteinG: targetDraft.targetProteinG || null,
            targetCarbsG: targetDraft.targetCarbsG || null,
            targetFatsG: targetDraft.targetFatsG || null,
        } as Parameters<typeof updateClient.mutate>[0]);
        setEditingTargets(false);
    };

    if (clientLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-brand" />
            </div>
        );
    }

    if (clientError || !client) {
        return (
            <div className="text-center py-12">
                <p className="text-red-600">Failed to load client.</p>
                <Link href="/dashboard/clients" className="text-brand hover:underline mt-2 inline-block">
                    Back to Clients
                </Link>
            </div>
        );
    }

    // All values below come directly from backend — zero computation
    const age = calculateAge(client.dateOfBirth);
    const adherencePercent = progress?.meals?.adherencePercentage ?? 0;
    const weightChange = progress?.weight?.last30DaysChange;

    return (
        <div className="space-y-6">
            {/* Header */}
            <header className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <Link
                        href="/dashboard/clients"
                        className="flex items-center gap-2 text-[#4e9767] hover:text-[#0e1b12] transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="text-sm font-medium">Back to Clients</span>
                    </Link>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setEditClientOpen(true)}
                            className="flex items-center gap-2 h-10 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-bold transition-colors"
                        >
                            <Settings className="w-4 h-4" />
                            Edit Client
                        </button>
                        <Link
                            href={`/dashboard/messages?client=${clientId}`}
                            aria-label="Send Message"
                            title="Send Message"
                            className="flex items-center justify-center w-10 h-10 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                        >
                            <Send className="w-5 h-5" />
                        </Link>
                        <Link
                            href={`/dashboard/diet-plans/new?clientId=${clientId}`}
                            className="flex items-center gap-2 h-10 px-4 bg-brand hover:bg-brand/90 text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
                        >
                            <Flag className="w-4 h-4" />
                            Create Diet Plan
                        </Link>
                    </div>
                </div>

                {/* Profile Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-brand/20 flex items-center justify-center text-brand text-3xl md:text-4xl font-bold">
                            {getInitials(client.fullName)}
                        </div>
                        <div className="flex flex-col justify-center">
                          <div className="flex items-center gap-2">
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
                              {client.fullName}
                            </h1>
                            <WhatsAppButton
                              phone={client.phone}
                              clientName={client.fullName}
                              size="md"
                            />
                          </div>
                
                            <p className="text-[#4e9767]">
                                {age && `Age: ${age}, `}
                                {client.gender && `Gender: ${client.gender.charAt(0).toUpperCase() + client.gender.slice(1)}`}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap text-[#4e9767]">
                                <span>{client.email} • {client.phone || 'No phone'}</span>
                                <WhatsAppButton
                                    phone={client.phone}
                                    clientName={client.fullName}
                                    size="sm"
                                />
                            </div>
                            {(client.tagAssignments?.length ?? 0) > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                    {client.tagAssignments!.map((a) => (
                                        <TagChip
                                            key={a.tagId}
                                            name={a.tag.name}
                                            color={a.tag.color}
                                            size="sm"
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Goal & Deadline */}
                    {(client.goal || client.goalDeadline) && (
                        <div className="flex flex-col gap-2 rounded-xl bg-white border border-gray-100 shadow-sm p-4 md:min-w-[280px]">
                            {client.goal && (
                                <div className="flex items-start gap-2">
                                    <Target className="w-4 h-4 text-brand mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Goal</p>
                                        <p className="text-sm font-semibold text-gray-900">{client.goal}</p>
                                    </div>
                                </div>
                            )}
                            {client.goalDeadline && (
                                <div className="flex items-start gap-2">
                                    <Calendar className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Target Date</p>
                                        <p className="text-sm font-semibold text-gray-900">
                                            {new Date(client.goalDeadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </header>

            {/* Subscription + Payment History */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <ClientSubscriptionCard clientId={clientId} clientName={client.fullName} />
                <PaymentHistoryList clientId={clientId} />
            </section>

            {/* Key Metrics */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Weight Trend */}
                <div className="flex flex-col gap-2 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                    <p className="text-gray-900 font-medium">Weight Trend</p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-bold text-gray-900">
                            {progress?.weight?.currentWeight ?? client.currentWeightKg ?? '-'} kg
                        </p>
                        <span className="text-gray-400 text-lg">/ {client.targetWeightKg ?? '-'} kg goal</span>
                    </div>
                    {weightChange !== null && weightChange !== undefined && (
                        <div className="flex gap-1 items-center">
                            <span className="text-sm text-[#4e9767]">Last 30 Days</span>
                            <span className={`text-sm font-medium flex items-center gap-1 ${weightChange < 0 ? 'text-brand' : 'text-orange-500'}`}>
                                {weightChange < 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                                {weightChange > 0 ? '+' : ''}{weightChange} kg
                            </span>
                        </div>
                    )}
                    {/* Weight progress bar — all values from backend */}
                    <div className="mt-4">
                        {progress?.weight?.startWeight && progress?.weight?.targetWeight ? (
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-gray-400">
                                    <span>Start: {progress.weight.startWeight} kg</span>
                                    <span>Target: {progress.weight.targetWeight} kg</span>
                                </div>
                                <div className="h-3 rounded-full bg-gray-100">
                                    <div
                                        className="h-3 rounded-full bg-brand transition-all"
                                        style={{ width: `${progress.weight.progressToGoal ?? 0}%` }}
                                    />
                                </div>
                                <p className="text-xs text-[#4e9767] text-center">
                                    {progress.weight.progressToGoal != null
                                        ? `${progress.weight.progressToGoal}% to goal`
                                        : 'Progress data unavailable'}
                                </p>
                            </div>
                        ) : (
                            <div className="h-16 flex items-center justify-center text-sm text-gray-400">
                                No weight history available
                            </div>
                        )}
                    </div>
                </div>

                {/* Adherence Score */}
                <div className="flex flex-col gap-3 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <p className="text-gray-900 font-medium">Adherence Score</p>
                        <div className="flex items-center gap-2">
                            {weeklyAdherence?.trend && weeklyAdherence.trend !== 'stable' && (
                                <span className={`text-xs font-medium flex items-center gap-1 ${weeklyAdherence.trend === 'improving' ? 'text-brand' : 'text-orange-500'}`}>
                                    {weeklyAdherence.trend === 'improving' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                    {weeklyAdherence.trend === 'improving' ? 'Improving' : 'Declining'}
                                </span>
                            )}
                            <p className={`text-2xl font-bold ${
                                weeklyAdherence?.color === 'GREEN' ? 'text-brand' :
                                weeklyAdherence?.color === 'YELLOW' ? 'text-yellow-500' :
                                weeklyAdherence?.color === 'RED' ? 'text-red-500' :
                                'text-brand'
                            }`}>
                                {weeklyAdherence ? `${weeklyAdherence.averageScore}%` : (progressLoading ? '...' : `${adherencePercent}%`)}
                            </p>
                        </div>
                    </div>
                    <div className="h-2 rounded-full bg-brand/20">
                        <div
                            className="h-2 rounded-full bg-brand transition-all"
                            style={{ width: `${weeklyAdherence?.averageScore ?? adherencePercent}%` }}
                        />
                    </div>
                    <p className="text-sm text-[#4e9767]">
                        {client.fullName.split(' ')[0]} has logged {progress?.meals?.eaten ?? 0} of {progress?.meals?.total ?? 0} meals.
                    </p>

                    {/* Weekly adherence chart — colors from backend */}
                    {weeklyAdherence?.dailyBreakdown && (
                        <div className="h-28 mt-2 flex gap-1">
                            {weeklyAdherence.dailyBreakdown.map((day, i) => {
                                const barColor = day.mealsLogged === 0
                                    ? 'bg-gray-200'
                                    : (COMPLIANCE_BAR_COLOR[day.color] || 'bg-gray-200');
                                const dayLabel = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center">
                                        <div className="flex-1 w-full relative">
                                            <div
                                                className={`absolute bottom-0 inset-x-0 ${barColor} rounded-t transition-all`}
                                                style={{ height: `${day.score || 4}%` }}
                                                title={`${dayLabel}: ${day.score}%`}
                                            />
                                        </div>
                                        <span className="text-[10px] text-gray-400 mt-1 shrink-0">{dayLabel}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="mt-auto pt-4 border-t border-gray-100 grid grid-cols-3 gap-2 text-center text-sm">
                        <div>
                            <p className="font-bold text-gray-900">{progress?.meals?.eaten ?? 0}</p>
                            <p className="text-gray-500">Eaten</p>
                        </div>
                        <div>
                            <p className="font-bold text-gray-900">{progress?.meals?.skipped ?? 0}</p>
                            <p className="text-gray-500">Skipped</p>
                        </div>
                        <div>
                            <p className="font-bold text-gray-900">{progress?.meals?.pending ?? 0}</p>
                            <p className="text-gray-500">Pending</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Tab Navigation */}
            <section>
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-6">
                        {TABS.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                                    activeTab === tab.key
                                        ? 'border-brand text-brand font-semibold'
                                        : 'border-transparent text-[#4e9767] hover:border-gray-300 hover:text-gray-900'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* ===== OVERVIEW TAB ===== */}
                {activeTab === 'overview' && (
                    <div className="mt-6 space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Current Diet Plan */}
                            <div className="flex flex-col gap-4 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand">
                                        <Flag className="w-5 h-5" />
                                    </div>
                                    <h3 className="font-semibold text-gray-900">Current Diet Plan</h3>
                                </div>
                                {activePlan ? (
                                    <>
                                        <p className="text-[#4e9767]">Active since {new Date(activePlan.startDate).toLocaleDateString()}</p>
                                        <p className="text-lg font-medium text-gray-900">{activePlan.name}</p>
                                        <p className="text-sm text-[#4e9767]">{activePlan.description || 'No description'}</p>
                                    </>
                                ) : (
                                    <div className="space-y-1">
                                        <p className="text-gray-500 text-sm">No active diet plan</p>
                                        <Link
                                            href={`/dashboard/diet-plans/new?clientId=${clientId}`}
                                            className="inline-flex text-sm font-medium text-brand hover:underline"
                                        >
                                            Create your first diet plan
                                        </Link>
                                    </div>
                                )}
                            </div>

                            {/* Nutrition Targets — client-specific, editable */}
                            <div className="flex flex-col gap-4 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand">
                                            <Utensils className="w-5 h-5" />
                                        </div>
                                        <h3 className="font-semibold text-gray-900">Nutrition Targets</h3>
                                    </div>
                                    {editingTargets ? (
                                        <button onClick={saveTargets} className="p-1.5 rounded hover:bg-green-50 text-green-600" title="Save">
                                            <Check className="w-4 h-4" />
                                        </button>
                                    ) : (
                                        <button onClick={startEditTargets} className="p-1.5 rounded hover:bg-gray-100 text-gray-400" title="Edit targets">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                {editingTargets ? (
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        {([
                                            { key: 'targetCalories' as const, label: 'Calories (kcal)', min: 500, max: 10000 },
                                            { key: 'targetProteinG' as const, label: 'Protein (g)', min: 0, max: 500 },
                                            { key: 'targetCarbsG' as const, label: 'Carbs (g)', min: 0, max: 1000 },
                                            { key: 'targetFatsG' as const, label: 'Fat (g)', min: 0, max: 500 },
                                        ]).map(({ key, label, min, max }) => (
                                            <div key={key} className="bg-gray-50 p-3 rounded">
                                                <input
                                                    type="number"
                                                    min={min}
                                                    max={max}
                                                    value={targetDraft[key] || ''}
                                                    onChange={e => setTargetDraft(prev => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
                                                    className="w-full font-bold text-gray-900 bg-white border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-brand focus:border-brand outline-none"
                                                />
                                                <p className="text-gray-500 mt-1">{label}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div className="bg-gray-50 p-3 rounded">
                                            <p className="font-bold text-gray-900">{client.targetCalories ?? activePlan?.targetCalories ?? '-'}</p>
                                            <p className="text-gray-500">Calories</p>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded">
                                            <p className="font-bold text-gray-900">{client.targetProteinG ?? activePlan?.targetProteinG ?? '-'}g</p>
                                            <p className="text-gray-500">Protein</p>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded">
                                            <p className="font-bold text-gray-900">{client.targetCarbsG ?? activePlan?.targetCarbsG ?? '-'}g</p>
                                            <p className="text-gray-500">Carbs</p>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded">
                                            <p className="font-bold text-gray-900">{client.targetFatsG ?? activePlan?.targetFatsG ?? '-'}g</p>
                                            <p className="text-gray-500">Fat</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Medical Summary — full width */}
                        <MedicalSidebar clientId={clientId} />
                    </div>
                )}

                {/* ===== DIET PLAN TAB ===== */}
                {activeTab === 'diet-plan' && (
                    <div className="mt-6 space-y-4">
                        {allPlans.length === 0 ? (
                            <div className="rounded-xl bg-white p-12 shadow-sm border border-gray-100 text-center">
                                <Flag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Diet Plan</h3>
                                <p className="text-gray-500 mb-6">Create a diet plan to get started with meal scheduling.</p>
                                <Link
                                    href={`/dashboard/diet-plans/new?clientId=${clientId}`}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg text-sm font-bold hover:bg-brand/90 transition-colors"
                                >
                                    <Flag className="w-4 h-4" />
                                    Create Diet Plan
                                </Link>
                            </div>
                        ) : (
                            <>
                                {allPlans.map((plan, idx) => (
                                    <PlanSection key={plan.id} plan={plan} client={client} isFirst={idx === 0} />
                                ))}
                                <div className="text-center pt-2">
                                    <Link
                                        href={`/dashboard/diet-plans/new?clientId=${clientId}`}
                                        className="text-sm text-brand font-medium hover:underline"
                                    >
                                        + Create New Plan
                                    </Link>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ===== MEAL LOGS TAB ===== */}
                {activeTab === 'meal-logs' && (
                    <div className="mt-6">
                        <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
                            {mealLogsLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-6 h-6 animate-spin text-brand" />
                                </div>
                            ) : !mealLogsData?.data?.length ? (
                                <div className="text-center py-12">
                                    <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-500 font-medium">No meal logs yet</p>
                                    <p className="text-sm text-gray-400 mt-1">Logs will appear as the client records meals</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 text-left">
                                            <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                                            <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Meal</th>
                                            <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
                                            <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                                            <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Photo</th>
                                            <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {mealLogsData.data.map((log) => {
                                            const style = STATUS_STYLES[log.status] || STATUS_STYLES.pending;
                                            const StatusIcon = style.icon;
                                            return (
                                                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-3 text-gray-900">
                                                        {new Date(log.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                        {log.scheduledTime && (
                                                            <span className="text-gray-400 ml-1 text-xs">{log.scheduledTime}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-3 text-gray-900 font-medium">
                                                        {log.meal?.name || 'Unknown'}
                                                    </td>
                                                    <td className="px-6 py-3 text-gray-500 capitalize">
                                                        {log.meal?.mealType || '-'}
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg}`}>
                                                            <StatusIcon className="w-3 h-3" />
                                                            {log.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        {log.mealPhotoUrl ? (
                                                            <Camera className="w-4 h-4 text-brand" />
                                                        ) : (
                                                            <span className="text-gray-300">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-3 text-gray-500 max-w-[200px] truncate">
                                                        {log.clientNotes || '-'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}

                {/* ===== PROGRESS TAB ===== */}
                {activeTab === 'progress' && (
                    <div className="mt-6 space-y-6">
                        {/* Weight Progress Card */}
                        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <Target className="w-5 h-5 text-brand" />
                                Weight Progress
                            </h3>
                            {progress?.weight ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div className="bg-gray-50 p-3 rounded text-center">
                                            <p className="text-2xl font-bold text-gray-900">
                                                {progress.weight.startWeight ?? '-'}
                                            </p>
                                            <p className="text-gray-500">Start (kg)</p>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded text-center">
                                            <p className="text-2xl font-bold text-gray-900">
                                                {progress.weight.currentWeight ?? '-'}
                                            </p>
                                            <p className="text-gray-500">Current (kg)</p>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded text-center">
                                            <p className="text-2xl font-bold text-gray-900">
                                                {progress.weight.targetWeight ?? '-'}
                                            </p>
                                            <p className="text-gray-500">Target (kg)</p>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded text-center">
                                            <p className={`text-2xl font-bold ${
                                                (progress.weight.totalChange ?? 0) < 0 ? 'text-brand' : 'text-orange-500'
                                            }`}>
                                                {progress.weight.totalChange != null
                                                    ? `${progress.weight.totalChange > 0 ? '+' : ''}${progress.weight.totalChange}`
                                                    : '-'}
                                            </p>
                                            <p className="text-gray-500">Change (kg)</p>
                                        </div>
                                    </div>

                                    {/* Progress bar */}
                                    {progress.weight.progressToGoal != null && (
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-xs text-gray-400">
                                                <span>{progress.weight.startWeight} kg</span>
                                                <span>{progress.weight.targetWeight} kg</span>
                                            </div>
                                            <div className="h-3 rounded-full bg-gray-100">
                                                <div
                                                    className="h-3 rounded-full bg-brand transition-all"
                                                    style={{ width: `${progress.weight.progressToGoal}%` }}
                                                />
                                            </div>
                                            <p className="text-xs text-center text-[#4e9767]">
                                                {progress.weight.progressToGoal}% to goal
                                            </p>
                                        </div>
                                    )}

                                    {progress.weight.weeklyAvgChange != null && (
                                        <p className="text-sm text-[#4e9767]">
                                            Weekly average change: {progress.weight.weeklyAvgChange > 0 ? '+' : ''}{progress.weight.weeklyAvgChange} kg
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-gray-500 text-sm py-4 text-center">No weight data available</p>
                            )}
                        </div>

                        {/* 30-Day Compliance History */}
                        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                            <h3 className="font-semibold text-gray-900 mb-4">30-Day Compliance History</h3>
                            {complianceHistory?.data && complianceHistory.data.length > 0 ? (
                                <div className="space-y-4">
                                    {/* Summary stats row — all values from backend */}
                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                        <div className="bg-gray-50 p-3 rounded text-center">
                                            <p className="text-xl font-bold text-gray-900">
                                                {complianceHistory.averageScore}%
                                            </p>
                                            <p className="text-gray-500">Avg Score</p>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded text-center">
                                            <p className="text-xl font-bold text-brand">
                                                {complianceHistory.bestDay
                                                    ? `${complianceHistory.bestDay.score}%`
                                                    : '-'}
                                            </p>
                                            <p className="text-gray-500">Best Day</p>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded text-center">
                                            <p className="text-xl font-bold text-red-500">
                                                {complianceHistory.worstDay
                                                    ? `${complianceHistory.worstDay.score}%`
                                                    : '-'}
                                            </p>
                                            <p className="text-gray-500">Worst Day</p>
                                        </div>
                                    </div>

                                    {/* 30-day bar chart — colors from backend */}
                                    <div className="h-32 flex gap-px relative">
                                        {complianceHistory.data.map((entry, i) => (
                                            <div key={i} className="flex-1 relative">
                                                <div
                                                    className={`absolute bottom-0 inset-x-0 ${COMPLIANCE_BAR_COLOR[entry.color] || 'bg-gray-200'} rounded-t transition-all`}
                                                    style={{ height: `${entry.score || 3}%` }}
                                                    title={`${new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${entry.score}%`}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-between text-[10px] text-gray-400">
                                        <span>
                                            {new Date(complianceHistory.data[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </span>
                                        <span>
                                            {new Date(complianceHistory.data[complianceHistory.data.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-gray-500 text-sm py-4 text-center">No compliance data for the last 30 days</p>
                            )}
                        </div>

                        {/* This Week's Adherence — reusing existing pattern */}
                        {weeklyAdherence?.dailyBreakdown && (
                            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                                <h3 className="font-semibold text-gray-900 mb-4">This Week&apos;s Adherence</h3>
                                <div className="h-40 flex gap-2">
                                    {weeklyAdherence.dailyBreakdown.map((day, i) => {
                                        const barColor = day.mealsLogged === 0
                                            ? 'bg-gray-200'
                                            : (COMPLIANCE_BAR_COLOR[day.color] || 'bg-gray-200');
                                        const dayLabel = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });
                                        return (
                                            <div key={i} className="flex-1 flex flex-col items-center">
                                                <span className="text-xs font-medium text-gray-700 shrink-0">{day.score}%</span>
                                                <div className="flex-1 w-full relative">
                                                    <div
                                                        className={`absolute bottom-0 inset-x-0 ${barColor} rounded-t transition-all`}
                                                        style={{ height: `${day.score || 4}%` }}
                                                    />
                                                </div>
                                                <span className="text-[10px] text-gray-400 mt-1 shrink-0">{dayLabel}</span>
                                                <span className="text-[10px] text-gray-300 shrink-0">{day.mealsLogged}/{day.mealsPlanned}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </section>

            <EditClientModal
                isOpen={editClientOpen}
                onClose={() => setEditClientOpen(false)}
                client={client}
                onSubmit={handleEditClient}
                isLoading={updateClient.isPending}
            />
        </div>
    );
}
