'use client';

import Link from 'next/link';
import { Plus, Search, FileText, Calendar, MoreVertical, Loader2, Trash2, Edit, Send, LayoutTemplate, Users, X, UtensilsCrossed, ArrowRight } from 'lucide-react';
import { useDietPlans, usePublishDietPlan, useDeleteDietPlan, type DietPlan } from '@/lib/hooks/use-diet-plans';
import { PlanSetupModal, type PlanSetupResult } from '@/components/diet-plan/plan-setup-modal';
import { useClients } from '@/lib/hooks/use-clients';
import { useState, useRef, useEffect } from 'react';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { toast } from 'sonner';

type TabType = 'plans' | 'templates';

interface PlanCardProps {
    plan: DietPlan;
    isTemplateView: boolean;
    openMenuId: string | null;
    menuRef: React.RefObject<HTMLDivElement>;
    setOpenMenuId: (id: string | null) => void;
    handlePublish: (id: string) => void;
    handleDelete: (id: string, name: string) => void;
    publishMutation: { isPending: boolean };
    deleteMutation: { isPending: boolean };
    onAssign: (id: string, name: string) => void;
}

function PlanCard({ plan, isTemplateView, openMenuId, menuRef, setOpenMenuId, handlePublish, handleDelete, publishMutation, deleteMutation, onAssign }: PlanCardProps) {
    const isActive = plan.status === 'active';
    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow group">
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
                                    {plan.templateCategory === 'slot_template' ? 'Meal Slots' : 'Template'}
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
                                href={isTemplateView
                                    ? `/dashboard/diet-plans/new?template=true&editId=${plan.id}`
                                    : `/dashboard/diet-plans/${plan.id}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                                <Edit className="w-4 h-4" />
                                {isTemplateView ? 'Edit Template' : 'Edit Plan'}
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
                                className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left disabled:opacity-50"
                                disabled={deleteMutation.isPending}
                                onClick={() => handleDelete(plan.id, plan.name || 'Untitled Plan')}
                            >
                                <Trash2 className="w-4 h-4" />
                                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-3 mb-6">
                {isTemplateView ? (
                    <div className="flex items-center text-sm text-gray-600 gap-4">
                        <div className="flex items-center gap-2">
                            <UtensilsCrossed className="w-4 h-4 text-gray-400" />
                            <span>{plan.mealCount || 0} meals</span>
                        </div>
                        {plan.endDate && plan.startDate && (
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <span>
                                    {Math.max(1, Math.ceil((new Date(plan.endDate).getTime() - new Date(plan.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)} days
                                </span>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="flex items-center text-sm text-gray-600 gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span>
                                {new Date(plan.startDate).toLocaleDateString()}
                                {plan.endDate ? ` - ${new Date(plan.endDate).toLocaleDateString()}` : ''}
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${isActive ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {isActive ? 'Active' : 'Draft'}
                            </span>
                        </div>
                    </>
                )}
            </div>

            <div className="pt-4 border-t border-gray-100 flex gap-2">
                {isTemplateView ? (
                    <button
                        onClick={() => onAssign(plan.id, plan.name || '')}
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
}

export default function DietPlansPage() {
    const [activeTab, setActiveTab] = useState<TabType>('templates');
    const [search, setSearch] = useState('');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    // Assign Modal State
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showPlanSetup, setShowPlanSetup] = useState(false);
    const [assigningTemplateId, setAssigningTemplateId] = useState<string | null>(null);
    const [assigningTemplateName, setAssigningTemplateName] = useState<string>('');
    const [clientSearch, setClientSearch] = useState('');
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [selectedClientName, setSelectedClientName] = useState<string>('');

    const menuRef = useRef<HTMLDivElement>(null);
    const debouncedSearch = useDebouncedValue(search, 300);

    // Fetch based on active tab
    const isTemplateView = activeTab === 'templates';
    const { data: plansData, isLoading, refetch } = useDietPlans({
        page: 1,
        pageSize: 20,
        isTemplate: isTemplateView
    });
    const publishMutation = usePublishDietPlan();
    const deleteMutation = useDeleteDietPlan();

    // Fetch clients for assignment modal
    const { data: clientsData } = useClients({
        search: clientSearch,
        pageSize: 10
    });

    const plans = plansData?.data || [];

    const filteredPlans = plans.filter(p => {
        const planName = (p.name || '').toLowerCase();
        const clientName = (p.client?.fullName || '').toLowerCase();
        const searchLower = debouncedSearch.toLowerCase();
        return planName.includes(searchLower) || clientName.includes(searchLower);
    });

    const slotTemplates = isTemplateView ? filteredPlans.filter(p => p.templateCategory === 'slot_template') : [];
    const fullTemplates = isTemplateView ? filteredPlans.filter(p => p.templateCategory !== 'slot_template') : filteredPlans;

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
            await publishMutation.mutateAsync({ id: planId });
            await refetch();
            setOpenMenuId(null);
            toast.success('Diet plan published successfully');
        } catch (err) {
            toast.error('Failed to publish diet plan');
        }
    };

    const handleDelete = async (planId: string, planName: string) => {
        if (!confirm(`Delete "${planName}"? This will cancel all pending meal logs.`)) return;
        try {
            await deleteMutation.mutateAsync(planId);
            await refetch();
            setOpenMenuId(null);
            toast.success('Diet plan deleted');
        } catch (err) {
            toast.error('Failed to delete plan');
        }
    };

    const handleAssign = () => {
        if (!assigningTemplateId || !selectedClientId) return;
        // Move to Step 2 — plan details (name, start date, days, overlap check)
        setShowAssignModal(false);
        setShowPlanSetup(true);
    };

    const handlePlanSetupConfirm = (result: PlanSetupResult) => {
        setShowPlanSetup(false);
        const params = new URLSearchParams();
        params.set('clientId', selectedClientId!);
        params.set('applyTemplateId', assigningTemplateId!);
        params.set('setupPlanName', result.planName);
        params.set('setupStart', result.startDate.toISOString().slice(0, 10));
        params.set('setupDays', String(result.numDays));
        params.set('setupMeals', String(result.mealCount));
        params.set('setupStrategy', result.overlapStrategy);
        if (result.overlappingPlanIds?.length) params.set('overlappingPlanIds', result.overlappingPlanIds.join(','));
        window.open(`/dashboard/diet-plans/new?${params.toString()}`, '_blank');
        // Reset
        setSelectedClientId(null);
        setSelectedClientName('');
        setAssigningTemplateId(null);
        setAssigningTemplateName('');
        setClientSearch('');
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-gray-900">Diet Plans</h1>
                <div className="flex gap-2">
                    {isTemplateView ? (
                        <Link
                            href="/dashboard/diet-plans/new?template=true"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-brand text-white font-medium rounded-lg hover:bg-brand/90 transition-colors"
                        >
                            <LayoutTemplate className="w-5 h-5" />
                            Create Template
                        </Link>
                    ) : (
                        <Link
                            href="/dashboard/diet-plans/new"
                            target="_blank"
                            rel="noopener noreferrer"
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
                        onClick={() => setActiveTab('templates')}
                        className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${activeTab === 'templates'
                            ? 'border-brand text-brand'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        <LayoutTemplate className="w-4 h-4" />
                        Templates
                    </button>
                    <button
                        onClick={() => setActiveTab('plans')}
                        className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'plans'
                            ? 'border-brand text-brand'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        Client Plans
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
                    <h3 className="text-lg font-medium text-gray-900 mb-1">
                        {isTemplateView ? 'No templates found' : 'No diet plans found'}
                    </h3>
                    <p className="text-gray-500 mb-4">
                        {isTemplateView
                            ? 'Save reusable templates to speed up plan creation.'
                            : 'Get started by creating a new diet plan for a client.'}
                    </p>
                    <div className="flex flex-col items-center gap-2">
                        <Link
                            href="/dashboard/diet-plans/new"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-brand hover:underline"
                        >
                            Create New Plan
                        </Link>
                        <Link
                            href="/dashboard/diet-plans/new?template=true"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-brand hover:underline"
                        >
                            Create Template
                        </Link>
                        <p className="text-xs text-gray-400 mt-1">
                            Build templates to reuse across clients
                        </p>
                    </div>
                </div>
            ) : isTemplateView ? (
                <div className="space-y-8">
                    {/* Full Templates section — shown first */}
                    {fullTemplates.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <FileText className="w-4 h-4 text-brand" />
                                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Full Templates</h2>
                            </div>
                            <p className="text-xs text-gray-400 mb-4">Replaces all meals and days when applied</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {fullTemplates.map((plan) => (
                                    <PlanCard key={plan.id} plan={plan} isTemplateView={true} openMenuId={openMenuId} menuRef={menuRef} setOpenMenuId={setOpenMenuId} handlePublish={handlePublish} handleDelete={handleDelete} publishMutation={publishMutation} deleteMutation={deleteMutation} onAssign={(id, name) => { setAssigningTemplateId(id); setAssigningTemplateName(name); setShowAssignModal(true); }} />
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Meal Slots section — shown second */}
                    {slotTemplates.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <LayoutTemplate className="w-4 h-4 text-brand" />
                                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Meal Slots</h2>
                            </div>
                            <p className="text-xs text-gray-400 mb-4">Applied as slot layout only — does not overwrite day count</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {slotTemplates.map((plan) => (
                                    <PlanCard key={plan.id} plan={plan} isTemplateView={true} openMenuId={openMenuId} menuRef={menuRef} setOpenMenuId={setOpenMenuId} handlePublish={handlePublish} handleDelete={handleDelete} publishMutation={publishMutation} deleteMutation={deleteMutation} onAssign={(id, name) => { setAssigningTemplateId(id); setAssigningTemplateName(name); setShowAssignModal(true); }} />
                                ))}
                            </div>
                        </div>
                    )}
                    {slotTemplates.length === 0 && fullTemplates.length === 0 && (
                        <p className="text-sm text-gray-400 italic text-center py-8">No templates match your search</p>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPlans.map((plan) => (
                        <PlanCard key={plan.id} plan={plan} isTemplateView={false} openMenuId={openMenuId} menuRef={menuRef} setOpenMenuId={setOpenMenuId} handlePublish={handlePublish} handleDelete={handleDelete} publishMutation={publishMutation} deleteMutation={deleteMutation} onAssign={(id, name) => { setAssigningTemplateId(id); setAssigningTemplateName(name); setShowAssignModal(true); }} />
                    ))}
                </div>
            )}

            {/* Assign Modal — select client then open builder */}
            {showAssignModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-xl max-h-[90vh] flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                            <div>
                                <h3 className="font-semibold text-base text-gray-900">Use Template for Client</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Pick a client — the builder will open so you can review & customise before saving</p>
                            </div>
                            <button
                                onClick={() => { setShowAssignModal(false); setAssigningTemplateId(null); setSelectedClientId(null); setClientSearch(''); }}
                                className="text-gray-400 hover:text-gray-600 ml-4 shrink-0"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto">
                            <div className="relative mb-3">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Search clients..."
                                    value={clientSearch}
                                    onChange={(e) => setClientSearch(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                                />
                            </div>
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                                {!clientsData?.data?.length ? (
                                    <p className="p-4 text-center text-gray-500 text-sm">No clients found</p>
                                ) : (
                                    <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                                        {clientsData.data.map(client => (
                                            <button
                                                key={client.id}
                                                onClick={() => { setSelectedClientId(client.id); setSelectedClientName(client.fullName); }}
                                                className={`w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left ${
                                                    selectedClientId === client.id ? 'bg-brand/5' : ''
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600">
                                                        {client.fullName.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">{client.fullName}</p>
                                                        <p className="text-xs text-gray-500">{client.email}</p>
                                                    </div>
                                                </div>
                                                {selectedClientId === client.id && (
                                                    <div className="w-2 h-2 rounded-full bg-brand shrink-0" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <button
                                onClick={() => { setShowAssignModal(false); setAssigningTemplateId(null); setSelectedClientId(null); setClientSearch(''); }}
                                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAssign}
                                disabled={!selectedClientId}
                                className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                Open in Builder
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2: Plan setup modal — name, start date, days, overlap check */}
            {showPlanSetup && selectedClientId && (
                <PlanSetupModal
                    isOpen={true}
                    onClose={() => { setShowPlanSetup(false); setShowAssignModal(true); }}
                    clientId={selectedClientId}
                    clientName={selectedClientName}
                    slotTemplates={[]}
                    skipSlotSelection
                    defaultPlanName={assigningTemplateName}
                    onConfirm={handlePlanSetupConfirm}
                />
            )}
        </div>
    );
}
