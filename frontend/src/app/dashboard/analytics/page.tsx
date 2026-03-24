'use client';

import { useState } from 'react';
import {
    TrendingUp,
    TrendingDown,
    Users,
    UtensilsCrossed,
    Target,
    Calendar,
    Loader2,
    ChevronDown,
} from 'lucide-react';
import { useDashboardStats, useDietitianAnalytics } from '@/lib/hooks/use-dashboard';

type DietitianOption = { id: string; fullName: string; email: string } | null;

export default function AnalyticsPage() {
    const [selectedDietitian, setSelectedDietitian] = useState<DietitianOption>(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const dietitianId = selectedDietitian?.id || null;
    const { data: dashboardData, isLoading: dashboardLoading } = useDashboardStats(dietitianId);
    const { data: dietitians, isLoading: dietitiansLoading } = useDietitianAnalytics();

    const isLoading = dashboardLoading;

    const stats = [
        {
            label: 'Total Clients',
            value: (dashboardData?.stats.totalClients || 0).toString(),
            icon: Users,
            color: 'bg-blue-50 text-blue-600',
        },
        {
            label: 'Active Diet Plans',
            value: (dashboardData?.stats.activeDietPlans || 0).toString(),
            icon: UtensilsCrossed,
            color: 'bg-purple-50 text-purple-600',
        },
        {
            label: 'Avg. Adherence',
            value: `${dashboardData?.stats.adherencePercent || 0}%`,
            icon: Target,
            color: 'bg-green-50 text-green-600',
        },
        {
            label: 'Pending Reviews',
            value: (dashboardData?.stats.pendingReviews || 0).toString(),
            icon: Calendar,
            color: 'bg-orange-50 text-orange-600',
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

    return (
        <div className="space-y-6">
            {/* Header with Dietitian Selector */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                        {selectedDietitian ? `${selectedDietitian.fullName}'s Analytics` : 'Practice Analytics'}
                    </h1>
                    <p className="text-[#4e9767] mt-1">
                        {selectedDietitian
                            ? `Viewing individual performance for ${selectedDietitian.email}`
                            : 'Overall practice performance and client outcomes.'
                        }
                    </p>
                </div>

                {/* Dietitian Selector Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm min-w-[200px] justify-between"
                    >
                        <span className="truncate">
                            {selectedDietitian ? selectedDietitian.fullName : 'All Dietitians (Overall)'}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {dropdownOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                            <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 max-h-80 overflow-y-auto">
                                {/* Overall Option */}
                                <button
                                    onClick={() => {
                                        setSelectedDietitian(null);
                                        setDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors ${
                                        !selectedDietitian ? 'bg-brand/5 text-brand font-medium' : 'text-gray-700'
                                    }`}
                                >
                                    <div className="font-medium">All Dietitians (Overall)</div>
                                    <div className="text-xs text-gray-400 mt-0.5">Org-wide analytics</div>
                                </button>

                                {dietitians && dietitians.length > 0 && (
                                    <div className="border-t border-gray-100 my-1" />
                                )}

                                {dietitiansLoading && (
                                    <div className="px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
                                        <Loader2 className="w-3 h-3 animate-spin" /> Loading...
                                    </div>
                                )}

                                {dietitians?.map((d) => (
                                    <button
                                        key={d.id}
                                        onClick={() => {
                                            setSelectedDietitian({ id: d.id, fullName: d.fullName, email: d.email });
                                            setDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors ${
                                            selectedDietitian?.id === d.id ? 'bg-brand/5 text-brand font-medium' : 'text-gray-700'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center text-brand font-bold text-xs flex-shrink-0">
                                                {d.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-medium truncate">{d.fullName}</div>
                                                <div className="text-xs text-gray-400 truncate">{d.clientCount} clients</div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-brand" />
                </div>
            ) : (
                <>
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {stats.map((stat, i) => (
                            <div
                                key={i}
                                className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-6"
                            >
                                <div className={`p-2 rounded-lg w-fit ${stat.color.split(' ')[0]}`}>
                                    <stat.icon className={`w-5 h-5 ${stat.color.split(' ')[1]}`} />
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
                            <h3 className="mb-6 text-lg font-semibold text-gray-900">
                                Weekly Adherence Trend
                                {selectedDietitian && <span className="text-sm font-normal text-gray-400 ml-2">({selectedDietitian.fullName})</span>}
                            </h3>
                            <div className="flex h-48 items-end justify-between gap-4">
                                {weeklyData.map((day, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                                        <div
                                            className="w-full bg-brand rounded-t transition-all hover:bg-brand/80"
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

                        {/* Summary Cards */}
                        <div className="rounded-xl border border-gray-200 bg-white p-6">
                            <h3 className="mb-6 text-lg font-semibold text-gray-900">Summary</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-green-50 rounded-lg p-4 text-center">
                                    <p className="text-3xl font-bold text-green-600">
                                        {dashboardData?.stats.adherencePercent || 0}%
                                    </p>
                                    <p className="text-sm text-green-700 mt-1">Adherence</p>
                                </div>
                                <div className="bg-orange-50 rounded-lg p-4 text-center">
                                    <p className="text-3xl font-bold text-orange-600">
                                        {dashboardData?.stats.pendingReviews || 0}
                                    </p>
                                    <p className="text-sm text-orange-700 mt-1">Pending Reviews</p>
                                </div>
                                <div className="bg-blue-50 rounded-lg p-4 text-center">
                                    <p className="text-3xl font-bold text-blue-600">
                                        {dashboardData?.stats.totalClients || 0}
                                    </p>
                                    <p className="text-sm text-blue-700 mt-1">Clients</p>
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

                    {/* Recent Clients for selected scope */}
                    {dashboardData?.recentClients && dashboardData.recentClients.length > 0 && (
                        <div className="rounded-xl border border-gray-200 bg-white">
                            <div className="p-6 border-b border-gray-100">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Recent Clients
                                    {selectedDietitian && <span className="text-sm font-normal text-gray-400 ml-2">({selectedDietitian.fullName})</span>}
                                </h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-50">
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Activity</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {dashboardData.recentClients.map((client) => (
                                            <tr key={client.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center text-brand font-bold text-xs">
                                                            {client.avatar}
                                                        </div>
                                                        <span className="font-medium text-gray-900">{client.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                        {client.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {new Date(client.lastActivity).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Dietitian Performance Table — only in overall view */}
                    {!selectedDietitian && dietitians && dietitians.length > 0 && (
                        <div className="rounded-xl border border-gray-200 bg-white">
                            <div className="p-6 border-b border-gray-100">
                                <h3 className="text-lg font-semibold text-gray-900">Dietitian Performance</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-50">
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dietitian</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clients</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active Plans</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pending Reviews</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adherence</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {dietitians.map((d) => (
                                            <tr key={d.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center text-brand font-bold text-xs">
                                                            {d.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                                        </div>
                                                        <div>
                                                            <span className="font-medium text-gray-900">{d.fullName}</span>
                                                            <p className="text-xs text-gray-500">{d.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{d.clientCount}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{d.activePlanCount}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{d.pendingReviewCount}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                        d.adherencePercent > 70
                                                            ? 'bg-green-100 text-green-700'
                                                            : d.adherencePercent >= 40
                                                              ? 'bg-yellow-100 text-yellow-700'
                                                              : 'bg-red-100 text-red-700'
                                                    }`}>
                                                        {d.adherencePercent}%
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <button
                                                        onClick={() => setSelectedDietitian({ id: d.id, fullName: d.fullName, email: d.email })}
                                                        className="text-sm text-brand hover:text-brand/80 font-medium"
                                                    >
                                                        View Details
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Pending Reviews for selected scope */}
                    {dashboardData?.pendingReviews && dashboardData.pendingReviews.length > 0 && (
                        <div className="rounded-xl border border-gray-200 bg-white">
                            <div className="p-6 border-b border-gray-100">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Pending Reviews
                                    {selectedDietitian && <span className="text-sm font-normal text-gray-400 ml-2">({selectedDietitian.fullName})</span>}
                                </h3>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {dashboardData.pendingReviews.map((review) => (
                                    <div key={review.id} className="px-6 py-4 flex items-center justify-between">
                                        <div>
                                            <span className="font-medium text-gray-900">{review.client}</span>
                                            <span className="text-gray-400 mx-2">&middot;</span>
                                            <span className="text-sm text-gray-500">{review.meal}</span>
                                        </div>
                                        <span className="text-sm text-gray-400">{review.time}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
