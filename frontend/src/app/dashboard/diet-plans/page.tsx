'use client';

import Link from 'next/link';
import { Plus, Search, FileText, Calendar, MoreVertical, Loader2 } from 'lucide-react';
import { useDietPlans } from '@/lib/hooks/use-diet-plans';
import { useState } from 'react';

export default function DietPlansPage() {
    const [search, setSearch] = useState('');
    const { data: plansData, isLoading } = useDietPlans({ page: 1, pageSize: 20 });

    const plans = plansData?.data || [];

    const filteredPlans = plans.filter(p =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.client?.fullName.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-gray-900">Diet Plans</h1>
                <Link
                    href="/dashboard/diet-plans/new" // Note: This normally requires a client ID, so we might need a client selector interstitial or just let them pick
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-[#17cf54] text-white font-medium rounded-lg hover:bg-[#17cf54]/90 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Create New Plan
                </Link>
            </div>

            {/* Search and Filters */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex gap-4">
                <div className="relative flex-grow max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search plans or clients..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#17cf54]/20 focus:border-[#17cf54]"
                    />
                </div>
            </div>

            {/* Plans List */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-[#17cf54]" />
                </div>
            ) : filteredPlans.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-1">No diet plans found</h3>
                    <p className="text-gray-500 mb-4">Get started by creating a new diet plan for a client.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPlans.map((plan) => (
                        <div key={plan.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-[#17cf54]">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 group-hover:text-[#17cf54] transition-colors line-clamp-1">
                                            {plan.title}
                                        </h3>
                                        <p className="text-sm text-gray-500">{plan.client?.fullName || 'No Client'}</p>
                                    </div>
                                </div>
                                <button className="text-gray-400 hover:text-gray-600">
                                    <MoreVertical className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-3 mb-6">
                                <div className="flex items-center text-sm text-gray-600 gap-2">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    <span>
                                        {new Date(plan.startDate).toLocaleDateString()}
                                        {plan.endDate ? ` - ${new Date(plan.endDate).toLocaleDateString()}` : ''}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${plan.isPublished ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                        {plan.isPublished ? 'Active' : 'Draft'}
                                    </span>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-100 flex gap-2">
                                <Link
                                    href={`/dashboard/diet-plans/${plan.id}`}
                                    className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 text-center transition-colors"
                                >
                                    View Details
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
