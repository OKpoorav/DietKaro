'use client';

import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import {
    Users,
    Camera,
    TrendingUp,
    Calendar,
    Plus,
    ChevronRight,
    Loader2,
} from 'lucide-react';
import { useDashboardStats } from '@/lib/hooks/use-dashboard';
import { formatTimeAgo } from '@/lib/utils/formatters';

export default function DashboardPage() {
    const { user } = useUser();
    const firstName = user?.firstName || 'Doctor';

    const { data, isLoading, error } = useDashboardStats();

    const stats = [
        { label: 'Total Active Clients', value: data?.stats.totalClients ?? '-', icon: Users },
        { label: 'Meals Awaiting Review', value: data?.stats.pendingReviews ?? '-', icon: Camera },
        { label: 'Average Client Adherence', value: data ? `${data.stats.adherencePercent}%` : '-', icon: TrendingUp, highlight: true },
        { label: 'Active Diet Plans', value: data?.stats.activeDietPlans ?? '-', icon: Calendar },
    ];

    const weeklyAdherence = data?.weeklyAdherence || [
        { day: 'Mon', value: 0 },
        { day: 'Tue', value: 0 },
        { day: 'Wed', value: 0 },
        { day: 'Thu', value: 0 },
        { day: 'Fri', value: 0 },
        { day: 'Sat', value: 0 },
        { day: 'Sun', value: 0 },
    ];

    const recentClients = data?.recentClients || [];
    const pendingReviews = data?.pendingReviews || [];

    return (
        <div className="space-y-6">
            {/* Header with Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                        Welcome back, {firstName}!
                    </h1>
                    <p className="text-gray-500 mt-1">Here&apos;s what&apos;s happening with your clients today.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href="/dashboard/clients"
                        className="flex items-center gap-2 h-10 px-4 bg-[#17cf54] hover:bg-[#17cf54]/90 text-[#0e1b12] rounded-lg text-sm font-bold transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add New Client
                    </Link>
                    <Link
                        href="/dashboard/diet-plans/new"
                        className="flex items-center gap-2 h-10 px-4 bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 rounded-lg text-sm font-bold transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Create Diet Plan
                    </Link>
                </div>
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-[#17cf54]" />
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    Failed to load dashboard data. Please refresh.
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                    <div
                        key={i}
                        className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-6"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-[#17cf54]/10">
                                <stat.icon className="w-5 h-5 text-[#17cf54]" />
                            </div>
                            <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                        </div>
                        <p className={`text-3xl font-bold ${stat.highlight ? 'text-[#17cf54]' : 'text-gray-900'}`}>
                            {stat.value}
                        </p>
                    </div>
                ))}
            </div>

            {/* Chart and Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Weekly Adherence Chart */}
                <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-6">
                    <h3 className="mb-6 text-lg font-semibold text-gray-900">Weekly Adherence Overview</h3>
                    <div className="flex h-64 items-end justify-between gap-4">
                        {weeklyAdherence.map((day, i) => (
                            <div key={i} className="flex h-full flex-1 flex-col-reverse items-center gap-2">
                                <p className="text-xs text-gray-500">{day.day}</p>
                                <div className="w-full rounded bg-[#17cf54]/20" style={{ height: `${Math.max(day.value, 5)}%` }}>
                                    <div
                                        className="h-full w-full rounded bg-[#17cf54] transition-all duration-300 hover:opacity-80"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Pending Reviews */}
                <div className="rounded-xl border border-gray-200 bg-white">
                    <div className="flex items-center justify-between p-4 border-b border-gray-100">
                        <h3 className="font-semibold text-gray-900">Pending Reviews</h3>
                        <Link href="/dashboard/reviews" className="text-sm text-[#17cf54] hover:underline font-medium">
                            View all
                        </Link>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {pendingReviews.length === 0 ? (
                            <div className="p-4 text-center text-gray-500 text-sm">
                                No pending reviews
                            </div>
                        ) : (
                            pendingReviews.map((review) => (
                                <Link
                                    key={review.id}
                                    href={`/dashboard/reviews`}
                                    className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                                            <Camera className="w-5 h-5 text-orange-600" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{review.client}</p>
                                            <p className="text-sm text-gray-500">{review.meal} • {review.time}</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                </Link>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Clients */}
            <div className="rounded-xl border border-gray-200 bg-white">
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">Recent Clients</h3>
                    <Link href="/dashboard/clients" className="text-sm text-[#17cf54] hover:underline font-medium">
                        View all
                    </Link>
                </div>
                <div className="divide-y divide-gray-100">
                    {recentClients.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 text-sm">
                            No clients yet. Add your first client!
                        </div>
                    ) : (
                        recentClients.map((client) => (
                            <Link
                                key={client.id}
                                href={`/dashboard/clients/${client.id}`}
                                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[#17cf54]/20 flex items-center justify-center text-[#17cf54] font-bold">
                                        {client.avatar}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-900">{client.name}</span>
                                        {client.status === 'at-risk' && (
                                            <span className="w-2 h-2 rounded-full bg-orange-500" />
                                        )}
                                        {client.status === 'new' && (
                                            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">New</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-gray-500">
                                    <span className="text-sm">{formatTimeAgo(client.lastActivity)}</span>
                                    <ChevronRight className="w-4 h-4" />
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
