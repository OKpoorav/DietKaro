'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
    ArrowLeft,
    Send,
    Utensils,
    Flag,
    MessageSquare,
    TrendingDown,
    TrendingUp,
    Loader2,
} from 'lucide-react';
import { useClient, useClientProgress } from '@/lib/hooks/use-clients';
import { useDietPlans } from '@/lib/hooks/use-diet-plans';
import { getInitials, calculateAge } from '@/lib/utils/formatters';

export default function ClientProfilePage() {
    const params = useParams();
    const clientId = params.id as string;

    // API hooks
    const { data: client, isLoading: clientLoading, error: clientError } = useClient(clientId);
    const { data: progress, isLoading: progressLoading } = useClientProgress(clientId);
    const { data: plansData } = useDietPlans({ clientId, isPublished: true });

    const activePlan = plansData?.data?.[0];


    if (clientLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-[#17cf54]" />
            </div>
        );
    }

    if (clientError || !client) {
        return (
            <div className="text-center py-12">
                <p className="text-red-600">Failed to load client.</p>
                <Link href="/dashboard/clients" className="text-[#17cf54] hover:underline mt-2 inline-block">
                    Back to Clients
                </Link>
            </div>
        );
    }

    const age = calculateAge(client.dateOfBirth);
    const adherencePercent = progress?.meals?.adherencePercentage || 0;
    const weightChange = progress?.weight?.totalChange;

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
                    <div className="flex gap-2">
                        <Link
                            href={`/dashboard/diet-plans/new?clientId=${clientId}`}
                            className="flex items-center gap-2 h-10 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-bold transition-colors"
                        >
                            <Flag className="w-4 h-4" />
                            Create Diet Plan
                        </Link>
                        <button className="flex items-center gap-2 h-10 px-4 bg-[#17cf54] hover:bg-[#17cf54]/90 text-white rounded-lg text-sm font-bold transition-colors">
                            <Send className="w-4 h-4" />
                            Send Message
                        </button>
                    </div>
                </div>

                {/* Profile Header */}
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-[#17cf54]/20 flex items-center justify-center text-[#17cf54] text-3xl md:text-4xl font-bold">
                        {getInitials(client.fullName)}
                    </div>
                    <div className="flex flex-col justify-center">
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
                            {client.fullName}
                        </h1>
                        <p className="text-[#4e9767]">
                            {age && `Age: ${age}, `}
                            {client.gender && `Gender: ${client.gender.charAt(0).toUpperCase() + client.gender.slice(1)}`}
                        </p>
                        <p className="text-[#4e9767]">
                            {client.email} • {client.phone || 'No phone'}
                        </p>
                    </div>
                </div>
            </header>

            {/* Key Metrics */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Weight Trend */}
                <div className="flex flex-col gap-2 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                    <p className="text-gray-900 font-medium">Weight Trend</p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-bold text-gray-900">
                            {progress?.weight?.currentWeight || client.currentWeightKg || '-'} kg
                        </p>
                        <span className="text-gray-400 text-lg">/ {client.targetWeightKg || '-'} kg goal</span>
                    </div>
                    {weightChange !== null && weightChange !== undefined && (
                        <div className="flex gap-1 items-center">
                            <span className="text-sm text-[#4e9767]">Last 30 Days</span>
                            <span className={`text-sm font-medium flex items-center gap-1 ${weightChange < 0 ? 'text-[#17cf54]' : 'text-orange-500'}`}>
                                {weightChange < 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                                {weightChange > 0 ? '+' : ''}{weightChange} kg
                            </span>
                        </div>
                    )}
                    {/* Simple chart placeholder */}
                    <div className="h-32 mt-4 flex items-end gap-1">
                        {[70, 85, 60, 95, 75, 80, 55].map((h, i) => (
                            <div
                                key={i}
                                className="flex-1 bg-[#17cf54] rounded-t"
                                style={{ height: `${h}%` }}
                            />
                        ))}
                    </div>
                </div>

                {/* Adherence Score */}
                <div className="flex flex-col gap-3 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <p className="text-gray-900 font-medium">Adherence Score</p>
                        <p className="text-2xl font-bold text-[#17cf54]">
                            {progressLoading ? '...' : `${adherencePercent}%`}
                        </p>
                    </div>
                    <div className="h-2 rounded-full bg-[#17cf54]/20">
                        <div
                            className="h-2 rounded-full bg-[#17cf54] transition-all"
                            style={{ width: `${adherencePercent}%` }}
                        />
                    </div>
                    <p className="text-sm text-[#4e9767]">
                        {client.fullName.split(' ')[0]} has logged {progress?.meals?.eaten || 0} of {progress?.meals?.total || 0} meals.
                    </p>
                    <div className="mt-auto pt-4 border-t border-gray-100 grid grid-cols-3 gap-2 text-center text-sm">
                        <div>
                            <p className="font-bold text-gray-900">{progress?.meals?.eaten || 0}</p>
                            <p className="text-gray-500">Eaten</p>
                        </div>
                        <div>
                            <p className="font-bold text-gray-900">{progress?.meals?.skipped || 0}</p>
                            <p className="text-gray-500">Skipped</p>
                        </div>
                        <div>
                            <p className="font-bold text-gray-900">{progress?.meals?.pending || 0}</p>
                            <p className="text-gray-500">Pending</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Tab Navigation */}
            <section>
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-6">
                        <button className="whitespace-nowrap border-b-2 border-[#17cf54] px-1 pb-3 text-sm font-semibold text-[#17cf54]">
                            Overview
                        </button>
                        <button className="whitespace-nowrap border-b-2 border-transparent px-1 pb-3 text-sm font-medium text-[#4e9767] hover:border-gray-300 hover:text-gray-900">
                            Diet Plan
                        </button>
                        <button className="whitespace-nowrap border-b-2 border-transparent px-1 pb-3 text-sm font-medium text-[#4e9767] hover:border-gray-300 hover:text-gray-900">
                            Meal Logs
                        </button>
                        <button className="whitespace-nowrap border-b-2 border-transparent px-1 pb-3 text-sm font-medium text-[#4e9767] hover:border-gray-300 hover:text-gray-900">
                            Progress
                        </button>
                    </nav>
                </div>

                {/* Tab Content */}
                <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Current Diet Plan */}
                    <div className="flex flex-col gap-4 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#17cf54]/10 flex items-center justify-center text-[#17cf54]">
                                <Flag className="w-5 h-5" />
                            </div>
                            <h3 className="font-semibold text-gray-900">Current Diet Plan</h3>
                        </div>
                        {activePlan ? (
                            <>
                                <p className="text-[#4e9767]">Active since {new Date(activePlan.startDate).toLocaleDateString()}</p>
                                <p className="text-lg font-medium text-gray-900">{activePlan.title}</p>
                                <p className="text-sm text-[#4e9767]">{activePlan.description || 'No description'}</p>
                            </>
                        ) : (
                            <p className="text-gray-500 text-sm">No active diet plan</p>
                        )}
                    </div>

                    {/* Nutrition Targets */}
                    <div className="flex flex-col gap-4 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#17cf54]/10 flex items-center justify-center text-[#17cf54]">
                                <Utensils className="w-5 h-5" />
                            </div>
                            <h3 className="font-semibold text-gray-900">Nutrition Targets</h3>
                        </div>
                        {activePlan ? (
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="bg-gray-50 p-3 rounded">
                                    <p className="font-bold text-gray-900">{activePlan.targetCalories || '-'}</p>
                                    <p className="text-gray-500">Calories</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded">
                                    <p className="font-bold text-gray-900">{activePlan.targetProteinG || '-'}g</p>
                                    <p className="text-gray-500">Protein</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded">
                                    <p className="font-bold text-gray-900">{activePlan.targetCarbsG || '-'}g</p>
                                    <p className="text-gray-500">Carbs</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded">
                                    <p className="font-bold text-gray-900">{activePlan.targetFatsG || '-'}g</p>
                                    <p className="text-gray-500">Fat</p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-gray-500 text-sm">No diet plan set</p>
                        )}
                    </div>

                    {/* Medical Info */}
                    <div className="flex flex-col gap-4 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#17cf54]/10 flex items-center justify-center text-[#17cf54]">
                                <MessageSquare className="w-5 h-5" />
                            </div>
                            <h3 className="font-semibold text-gray-900">Medical Profile</h3>
                        </div>
                        <div className="space-y-2 text-sm">
                            <div>
                                <p className="font-medium text-gray-700">Allergies</p>
                                <p className="text-gray-500">
                                    {client.medicalProfile?.allergies?.join(', ') || 'None recorded'}
                                </p>
                            </div>
                            <div>
                                <p className="font-medium text-gray-700">Conditions</p>
                                <p className="text-gray-500">
                                    {client.medicalProfile?.conditions?.join(', ') || 'None recorded'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
