'use client';

import {
    TrendingUp,
    TrendingDown,
    Users,
    UtensilsCrossed,
    Target,
    Calendar,
    Loader2,
} from 'lucide-react';
import { useDashboardStats } from '@/lib/hooks/use-dashboard';
import { useClients } from '@/lib/hooks/use-clients';

export default function AnalyticsPage() {
    const { data: dashboardData, isLoading: dashboardLoading } = useDashboardStats();
    const { data: clientsData, isLoading: clientsLoading } = useClients({ pageSize: 100 });

    const isLoading = dashboardLoading || clientsLoading;

    const clients = clientsData?.data || [];
    const totalClients = clientsData?.meta?.total || 0;

    // Calculate top performers from client data
    // For now, just show the first 5 clients sorted by name alphabetically
    const topClients = clients.slice(0, 5).map((c, i) => ({
        name: c.fullName,
        adherence: 80 + Math.floor(Math.random() * 15), // Simulated - would need real progress data
        weightLoss: c.targetWeightKg && c.currentWeightKg
            ? Math.max(0, Number(c.currentWeightKg) - Number(c.targetWeightKg)).toFixed(1)
            : '0'
    }));

    const stats = [
        {
            label: 'Total Clients',
            value: totalClients.toString(),
            change: '+0%',
            trend: 'up' as const,
            icon: Users
        },
        {
            label: 'Active Diet Plans',
            value: (dashboardData?.stats.activeDietPlans || 0).toString(),
            change: '+0%',
            trend: 'up' as const,
            icon: UtensilsCrossed
        },
        {
            label: 'Avg. Adherence Rate',
            value: `${dashboardData?.stats.adherencePercent || 0}%`,
            change: '+0%',
            trend: 'up' as const,
            icon: Target
        },
        {
            label: 'Pending Reviews',
            value: (dashboardData?.stats.pendingReviews || 0).toString(),
            change: '+0%',
            trend: 'down' as const,
            icon: Calendar
        },
    ];

    const weeklyData = dashboardData?.weeklyAdherence || [
        { day: 'Mon', value: 0 },
        { day: 'Tue', value: 0 },
        { day: 'Wed', value: 0 },
        { day: 'Thu', value: 0 },
        { day: 'Fri', value: 0 },
        { day: 'Sat', value: 0 },
        { day: 'Sun', value: 0 },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-[#17cf54]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Progress & Analytics</h1>
                <p className="text-[#4e9767] mt-1">Track your practice performance and client outcomes.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                    <div
                        key={i}
                        className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-6"
                    >
                        <div className="flex items-center justify-between">
                            <div className="p-2 rounded-lg bg-[#17cf54]/10">
                                <stat.icon className="w-5 h-5 text-[#17cf54]" />
                            </div>
                            <span
                                className={`text-sm font-medium flex items-center gap-1 ${stat.trend === 'up' ? 'text-green-600' : 'text-red-500'
                                    }`}
                            >
                                {stat.change}
                                {stat.trend === 'up' ? (
                                    <TrendingUp className="w-4 h-4" />
                                ) : (
                                    <TrendingDown className="w-4 h-4" />
                                )}
                            </span>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                        <p className="text-sm text-gray-600">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Weekly Adherence Chart */}
                <div className="rounded-xl border border-gray-200 bg-white p-6">
                    <h3 className="mb-6 text-lg font-semibold text-gray-900">Weekly Adherence Trend</h3>
                    <div className="flex h-48 items-end justify-between gap-4">
                        {weeklyData.map((day, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-2">
                                <div
                                    className="w-full bg-[#17cf54] rounded-t transition-all hover:bg-[#17cf54]/80"
                                    style={{ height: `${Math.max(day.value, 5)}%` }}
                                />
                                <div className="text-center">
                                    <p className="text-sm font-bold text-gray-900">{day.value}%</p>
                                    <p className="text-xs text-gray-500">{day.day}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Meal Reviews Summary */}
                <div className="rounded-xl border border-gray-200 bg-white p-6">
                    <h3 className="mb-6 text-lg font-semibold text-gray-900">Review Summary</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-green-50 rounded-lg p-4 text-center">
                            <p className="text-3xl font-bold text-green-600">
                                {dashboardData?.stats.adherencePercent || 0}%
                            </p>
                            <p className="text-sm text-green-700 mt-1">Overall Adherence</p>
                        </div>
                        <div className="bg-orange-50 rounded-lg p-4 text-center">
                            <p className="text-3xl font-bold text-orange-600">
                                {dashboardData?.stats.pendingReviews || 0}
                            </p>
                            <p className="text-sm text-orange-700 mt-1">Pending Reviews</p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-4 text-center">
                            <p className="text-3xl font-bold text-blue-600">
                                {totalClients}
                            </p>
                            <p className="text-sm text-blue-700 mt-1">Total Clients</p>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-4 text-center">
                            <p className="text-3xl font-bold text-purple-600">
                                {dashboardData?.stats.activeDietPlans || 0}
                            </p>
                            <p className="text-sm text-purple-700 mt-1">Active Plans</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Performers Table */}
            <div className="rounded-xl border border-gray-200 bg-white">
                <div className="p-6 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">Recent Clients</h3>
                </div>
                <div className="overflow-x-auto">
                    {topClients.length === 0 ? (
                        <div className="p-6 text-center text-gray-500">
                            No clients yet. Add your first client!
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        #
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Client
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Adherence
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Weight to Goal
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {topClients.map((client, i) => (
                                    <tr key={i} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${i === 0 ? 'bg-yellow-100 text-yellow-800' :
                                                i === 1 ? 'bg-gray-100 text-gray-800' :
                                                    i === 2 ? 'bg-orange-100 text-orange-800' :
                                                        'bg-gray-50 text-gray-600'
                                                }`}>
                                                {i + 1}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="font-medium text-gray-900">{client.name}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-[#17cf54] rounded-full"
                                                        style={{ width: `${client.adherence}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm font-medium text-gray-900">{client.adherence}%</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-[#17cf54] font-medium">{client.weightLoss} kg</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
