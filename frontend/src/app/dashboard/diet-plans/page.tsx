'use client';

import Link from 'next/link';
import { Plus, Search, FileText, Calendar, MoreVertical, Loader2, Trash2, Edit, Send, LayoutTemplate, Users, X, ChevronRight } from 'lucide-react';
import { useDietPlans, usePublishDietPlan, useAssignTemplate } from '@/lib/hooks/use-diet-plans';
import { useClients } from '@/lib/hooks/use-clients';
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

type TabType = 'plans' | 'templates';

export default function DietPlansPage() {
    const [activeTab, setActiveTab] = useState<TabType>('plans');
    const [search, setSearch] = useState('');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    // Assign Modal State
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assigningTemplateId, setAssigningTemplateId] = useState<string | null>(null);
    const [clientSearch, setClientSearch] = useState('');
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

    const menuRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Fetch based on active tab
    const isTemplateView = activeTab === 'templates';
    const { data: plansData, isLoading, refetch } = useDietPlans({
        page: 1,
        pageSize: 20,
        isTemplate: isTemplateView
    });
    const publishMutation = usePublishDietPlan();
    const assignMutation = useAssignTemplate();

    // Fetch clients for assignment modal
    const { data: clientsData } = useClients({
        search: clientSearch,
        pageSize: 10
    });

    const plans = plansData?.data || [];

    const filteredPlans = plans.filter(p => {
        const planName = (p.name || '').toLowerCase();
        const clientName = (p.client?.fullName || '').toLowerCase();
        const searchLower = search.toLowerCase();
        return planName.includes(searchLower) || clientName.includes(searchLower);
    });

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handlePublish = async (planId: string) => {
        try {
            await publishMutation.mutateAsync(planId);
            await refetch();
            setOpenMenuId(null);
            toast.success('Diet plan published successfully');
        } catch (err) {
            toast.error('Failed to publish diet plan');
        }
    };

    const handleAssign = async () => {
        if (!assigningTemplateId || !selectedClientId || !startDate) return;

        try {
            const newPlan = await assignMutation.mutateAsync({
                templateId: assigningTemplateId,
                clientId: selectedClientId,
                startDate,
            });

            toast.success('Template assigned successfully!');
            setShowAssignModal(false);
            setAssigningTemplateId(null);
            setSelectedClientId(null);

            // Navigate to the newly created plan
            router.push(`/dashboard/diet-plans/${newPlan.id}`);
        } catch (error) {
            toast.error('Failed to assign template');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-gray-900">Diet Plans</h1>
                <div className="flex gap-2">
                    {isTemplateView ? (
                        <Link
                            href="/dashboard/diet-plans/new?template=true"
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-brand text-white font-medium rounded-lg hover:bg-brand/90 transition-colors"
                        >
                            <LayoutTemplate className="w-5 h-5" />
                            Create Template
                        </Link>
                    ) : (
                        <Link
                            href="/dashboard/diet-plans/new"
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-brand text-white font-medium rounded-lg hover:bg-brand/90 transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            Create New Plan
                        </Link>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex gap-4">
                    <button
                        onClick={() => setActiveTab('plans')}
                        className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'plans'
                            ? 'border-brand text-brand'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        Client Plans
                    </button>
                    <button
                        onClick={() => setActiveTab('templates')}
                        className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${activeTab === 'templates'
                            ? 'border-brand text-brand'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        <LayoutTemplate className="w-4 h-4" />
                        Templates
                    </button>
                </nav>
            </div>

            {/* Search and Filters */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex gap-4">
                <div className="relative flex-grow max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder={isTemplateView ? "Search templates..." : "Search plans or clients..."}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                    />
                </div>
            </div>

            {/* Plans List */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-brand" />
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
                    {filteredPlans.map((plan) => {
                        const isActive = plan.status === 'active';
                        return (
                            <div key={plan.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-brand">
                                            {isTemplateView ? <LayoutTemplate className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900 group-hover:text-brand transition-colors line-clamp-1">
                                                {plan.name || 'Untitled Plan'}
                                            </h3>
                                            <p className="text-sm text-gray-500">
                                                {plan.isTemplate ? (
                                                    <span className="inline-flex items-center gap-1 text-purple-600">
                                                        <LayoutTemplate className="w-3 h-3" />
                                                        Template
                                                    </span>
                                                ) : (
                                                    plan.client?.fullName || 'No Client'
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="relative" ref={openMenuId === plan.id ? menuRef : null}>
                                        <button
                                            onClick={() => setOpenMenuId(openMenuId === plan.id ? null : plan.id)}
                                            className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                                        >
                                            <MoreVertical className="w-5 h-5" />
                                        </button>
                                        {openMenuId === plan.id && (
                                            <div className="absolute right-0 top-8 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                                                <Link
                                                    href={`/dashboard/diet-plans/${plan.id}`}
                                                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                    Edit Plan
                                                </Link>
                                                {!isActive && (
                                                    <button
                                                        onClick={() => handlePublish(plan.id)}
                                                        disabled={publishMutation.isPending}
                                                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left disabled:opacity-50"
                                                    >
                                                        <Send className="w-4 h-4" />
                                                        {publishMutation.isPending ? 'Publishing...' : 'Publish'}
                                                    </button>
                                                )}
                                                <button
                                                    className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                                                    onClick={() => {
                                                        // TODO: Add delete functionality
                                                        setOpenMenuId(null);
                                                    }}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
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
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${isActive ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                            }`}>
                                            {isActive ? 'Active' : 'Draft'}
                                        </span>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-100 flex gap-2">
                                    {isTemplateView ? (
                                        <button
                                            onClick={() => {
                                                setAssigningTemplateId(plan.id);
                                                setShowAssignModal(true);
                                            }}
                                            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand/90 text-center transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Users className="w-4 h-4" />
                                            Assign to Client
                                        </button>
                                    ) : (
                                        <Link
                                            href={`/dashboard/diet-plans/${plan.id}`}
                                            className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 text-center transition-colors"
                                        >
                                            View Details
                                        </Link>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Assign Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-lg overflow-hidden shadow-xl">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <h3 className="font-semibold text-lg text-gray-900">Assign Template to Client</h3>
                            <button
                                onClick={() => {
                                    setShowAssignModal(false);
                                    setAssigningTemplateId(null);
                                    setSelectedClientId(null);
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Start Date Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Start Date
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                                />
                            </div>

                            {/* Client Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Select Client
                                </label>
                                <div className="relative mb-2">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search clients..."
                                        value={clientSearch}
                                        onChange={(e) => setClientSearch(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                                    />
                                </div>
                                <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                                    {clientsData?.data?.length === 0 ? (
                                        <div className="p-4 text-center text-gray-500 text-sm">
                                            No clients found
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-gray-100">
                                            {clientsData?.data?.map(client => (
                                                <button
                                                    key={client.id}
                                                    onClick={() => setSelectedClientId(client.id)}
                                                    className={`w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors ${selectedClientId === client.id ? 'bg-brand/5 ring-1 ring-inset ring-brand' : ''
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">
                                                            {client.fullName.charAt(0)}
                                                        </div>
                                                        <div className="text-left">
                                                            <div className="font-medium text-gray-900 text-sm">{client.fullName}</div>
                                                            <div className="text-xs text-gray-500">{client.email}</div>
                                                        </div>
                                                    </div>
                                                    {selectedClientId === client.id && (
                                                        <div className="w-2 h-2 rounded-full bg-brand" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowAssignModal(false);
                                    setAssigningTemplateId(null);
                                    setSelectedClientId(null);
                                }}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAssign}
                                disabled={!selectedClientId || !startDate || assignMutation.isPending}
                                className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {assignMutation.isPending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Assigning...
                                    </>
                                ) : (
                                    <>
                                        Confirm Assignment
                                        <ChevronRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
