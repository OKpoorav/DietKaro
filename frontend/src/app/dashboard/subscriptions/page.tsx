'use client';

import { useMemo, useState } from 'react';
import {
    CheckCircle2,
    CreditCard,
    Edit2,
    History,
    LayoutGrid,
    Loader2,
    MoreVertical,
    Pause,
    Plus,
    Play,
    Send,
    Sparkles,
    Trash2,
    Users,
    XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { usePermissions } from '@/lib/hooks/use-permissions';
import {
    type SubscriptionPlan,
    formatRecurrence,
    useDeletePlan,
    useSubscriptionPlans,
} from '@/lib/hooks/use-subscription-plans';
import {
    type SubscriptionFilter,
    type SubscriptionListRow,
    useDeactivateSubscription,
    useMarkActive,
    useResumeSubscription,
    useSubscriptionList,
} from '@/lib/hooks/use-subscriptions';
import { PlanFormModal } from '@/components/subscriptions/plan-form-modal';
import { AssignPlanModal } from '@/components/subscriptions/assign-plan-modal';
import { PaymentLinkModal } from '@/components/subscriptions/payment-link-modal';
import { ManualPaymentModal } from '@/components/subscriptions/manual-payment-modal';
import { PauseModal } from '@/components/subscriptions/pause-modal';
import { PaymentHistoryModal } from '@/components/subscriptions/payment-history-modal';

type TabId = 'clients' | 'plans';

const FILTERS: { value: SubscriptionFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'paid', label: 'Paid' },
    { value: 'unpaid', label: 'Unpaid' },
    { value: 'due-7', label: 'Due in 7d' },
    { value: 'due-30', label: 'Due in 30d' },
    { value: 'no-plan', label: 'No plan' },
    { value: 'paused', label: 'Paused' },
    { value: 'deactivated', label: 'Deactivated' },
];

function formatDate(input: string | null | undefined): string {
    if (!input) return '—';
    return new Date(input).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function PaymentStatusBadge({ row }: { row: SubscriptionListRow }) {
    if (!row.subscription) {
        return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">No plan</span>;
    }
    if (row.subscription.status === 'deactivated') {
        return <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">Deactivated</span>;
    }
    if (row.subscription.status === 'paused') {
        return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Paused</span>;
    }
    if (row.subscription.paymentStatus === 'paid') {
        return <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">Paid</span>;
    }
    return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-800">Unpaid</span>;
}

interface ActionMenuProps {
    row: SubscriptionListRow;
    onAssign: () => void;
    onChangePlan: () => void;
    onPaymentLink: () => void;
    onManualPay: () => void;
    onMarkActive: () => void;
    onViewHistory: () => void;
    onPause: () => void;
    onResume: () => void;
    onDeactivate: () => void;
}

function ActionMenu(props: ActionMenuProps) {
    const [open, setOpen] = useState(false);
    const sub = props.row.subscription;
    const hasPlan = !!sub;
    const isActive = sub?.status === 'active';
    const isPaused = sub?.status === 'paused';
    const isDeactivated = sub?.status === 'deactivated';

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                aria-label="Actions"
            >
                <MoreVertical className="w-4 h-4" />
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
                    <div className="absolute right-0 z-40 mt-1 w-56 rounded-lg border border-gray-200 bg-white shadow-lg py-1 text-sm">
                        {!hasPlan && (
                            <button onClick={() => { setOpen(false); props.onAssign(); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left">
                                <Plus className="w-4 h-4 text-brand" /> Assign plan
                            </button>
                        )}
                        {hasPlan && (
                            <>
                                <button onClick={() => { setOpen(false); props.onChangePlan(); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left">
                                    <LayoutGrid className="w-4 h-4 text-gray-500" /> Change plan
                                </button>
                                <button onClick={() => { setOpen(false); props.onPaymentLink(); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left">
                                    <Send className="w-4 h-4 text-brand" /> Send payment link
                                </button>
                                <button onClick={() => { setOpen(false); props.onManualPay(); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left">
                                    <CheckCircle2 className="w-4 h-4 text-green-600" /> Record manual payment
                                </button>
                                <button onClick={() => { setOpen(false); props.onMarkActive(); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left">
                                    <Sparkles className="w-4 h-4 text-violet-500" /> Mark active (override)
                                </button>
                                <div className="my-1 border-t border-gray-100" />
                                <button onClick={() => { setOpen(false); props.onViewHistory(); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left">
                                    <History className="w-4 h-4 text-gray-500" /> View payment history
                                </button>
                                <div className="my-1 border-t border-gray-100" />
                                {isActive && (
                                    <button onClick={() => { setOpen(false); props.onPause(); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left">
                                        <Pause className="w-4 h-4 text-amber-500" /> Pause
                                    </button>
                                )}
                                {isPaused && (
                                    <button onClick={() => { setOpen(false); props.onResume(); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left">
                                        <Play className="w-4 h-4 text-green-600" /> Resume
                                    </button>
                                )}
                                {!isDeactivated && (
                                    <button onClick={() => { setOpen(false); props.onDeactivate(); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left">
                                        <XCircle className="w-4 h-4 text-red-500" /> Deactivate
                                    </button>
                                )}
                                {isDeactivated && (
                                    <button onClick={() => { setOpen(false); props.onResume(); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left">
                                        <Play className="w-4 h-4 text-green-600" /> Reactivate
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Plans tab ────────────────────────────────────────────────

function PlansTab() {
    const permissions = usePermissions();
    const canManage = permissions.isAdmin || permissions.isOwner;
    const { data: plans, isLoading } = useSubscriptionPlans(true);
    const deletePlan = useDeletePlan();
    const [editing, setEditing] = useState<SubscriptionPlan | null>(null);
    const [creating, setCreating] = useState(false);

    const handleDelete = async (plan: SubscriptionPlan) => {
        if (!confirm(`Delete "${plan.name}"? Existing client subscriptions will block this — reassign first.`)) return;
        try {
            await deletePlan.mutateAsync(plan.id);
            toast.success('Plan deleted');
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { error?: { message?: string } } } })
                    ?.response?.data?.error?.message ?? 'Delete failed';
            toast.error(message);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-sm text-gray-500">Org-wide plans. Dietitians pick from this list when assigning subscriptions.</p>
                {canManage && (
                    <button
                        type="button"
                        onClick={() => setCreating(true)}
                        className="inline-flex items-center gap-2 h-10 px-4 bg-brand hover:bg-brand/90 text-white rounded-lg text-sm font-bold transition-colors"
                    >
                        <Plus className="w-4 h-4" /> New plan
                    </button>
                )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-brand" />
                    </div>
                ) : (plans?.length ?? 0) === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        No plans yet.
                        {canManage && (
                            <>
                                {' '}
                                <button
                                    onClick={() => setCreating(true)}
                                    className="text-brand font-medium hover:underline"
                                >
                                    Create the first one.
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recurrence</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                {canManage && (
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {plans!.map((plan) => (
                                <tr key={plan.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-3 font-medium text-gray-900">{plan.name}</td>
                                    <td className="px-6 py-3 text-sm text-gray-600">{formatRecurrence(plan.recurrenceUnit, plan.intervalCount)}</td>
                                    <td className="px-6 py-3 text-sm text-gray-600">{plan.durationDays} days</td>
                                    <td className="px-6 py-3 font-semibold text-gray-900">₹{Number(plan.costInr).toFixed(2)}</td>
                                    <td className="px-6 py-3">
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${plan.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {plan.active ? 'Active' : 'Hidden'}
                                        </span>
                                    </td>
                                    {canManage && (
                                        <td className="px-6 py-3 text-right">
                                            <button
                                                onClick={() => setEditing(plan)}
                                                className="p-2 rounded text-gray-500 hover:text-brand hover:bg-brand/5"
                                                aria-label={`Edit ${plan.name}`}
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(plan)}
                                                className="p-2 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
                                                aria-label={`Delete ${plan.name}`}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {canManage && (
                <PlanFormModal
                    isOpen={creating || !!editing}
                    onClose={() => { setCreating(false); setEditing(null); }}
                    plan={editing}
                />
            )}
        </div>
    );
}

// ─── Clients tab ──────────────────────────────────────────────

function ClientsTab() {
    const [filter, setFilter] = useState<SubscriptionFilter>('all');
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebouncedValue(search, 300);
    const [page, setPage] = useState(1);

    const list = useSubscriptionList({
        filter,
        search: debouncedSearch || undefined,
        page,
        pageSize: 20,
    });

    const resume = useResumeSubscription();
    const deactivate = useDeactivateSubscription();
    const markActive = useMarkActive();

    const [assignFor, setAssignFor] = useState<SubscriptionListRow | null>(null);
    const [linkFor, setLinkFor] = useState<SubscriptionListRow | null>(null);
    const [manualFor, setManualFor] = useState<SubscriptionListRow | null>(null);
    const [pauseFor, setPauseFor] = useState<SubscriptionListRow | null>(null);
    const [historyFor, setHistoryFor] = useState<SubscriptionListRow | null>(null);

    const rows = list.data?.data ?? [];

    const handleQuickAction = async (row: SubscriptionListRow, action: 'resume' | 'deactivate' | 'markActive') => {
        try {
            if (action === 'resume') {
                await resume.mutateAsync({ clientId: row.id });
                toast.success('Subscription resumed');
            } else if (action === 'deactivate') {
                if (!confirm(`Deactivate ${row.fullName}'s subscription?`)) return;
                await deactivate.mutateAsync({ clientId: row.id });
                toast.success('Subscription deactivated');
            } else {
                await markActive.mutateAsync({ clientId: row.id });
                toast.success('Marked active');
            }
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { error?: { message?: string } } } })
                    ?.response?.data?.error?.message ?? 'Action failed';
            toast.error(message);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
                <div className="flex flex-wrap gap-2">
                    {FILTERS.map((f) => (
                        <button
                            key={f.value}
                            type="button"
                            onClick={() => { setFilter(f.value); setPage(1); }}
                            className={`h-8 px-3 rounded-lg text-sm font-medium transition-colors ${filter === f.value ? 'bg-brand text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search by name, phone, email…"
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-brand focus:border-brand sm:w-72"
                />
            </div>

            <div className="bg-white rounded-xl border border-gray-200">
                {list.isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-brand" />
                    </div>
                ) : rows.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">No clients match these filters.</div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active since</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Renews</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {rows.map((row) => (
                                <tr key={row.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-3">
                                        <div className="font-medium text-gray-900">{row.fullName}</div>
                                        <div className="text-xs text-gray-400">
                                            {row.email}{row.phone ? ` · ${row.phone}` : ''}
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 text-sm text-gray-700">
                                        {row.subscription ? (
                                            <span>
                                                {row.subscription.planName}
                                                <span className="text-xs text-gray-400 ml-1">₹{Number(row.subscription.costInr).toFixed(0)}</span>
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 italic">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-3 text-sm text-gray-600">{formatDate(row.subscription?.activeDate)}</td>
                                    <td className="px-6 py-3 text-sm text-gray-600">{formatDate(row.subscription?.renewalDate)}</td>
                                    <td className="px-6 py-3"><PaymentStatusBadge row={row} /></td>
                                    <td className="px-6 py-3 text-right">
                                        <ActionMenu
                                            row={row}
                                            onAssign={() => setAssignFor(row)}
                                            onChangePlan={() => setAssignFor(row)}
                                            onPaymentLink={() => setLinkFor(row)}
                                            onManualPay={() => setManualFor(row)}
                                            onMarkActive={() => handleQuickAction(row, 'markActive')}
                                            onViewHistory={() => setHistoryFor(row)}
                                            onPause={() => setPauseFor(row)}
                                            onResume={() => handleQuickAction(row, 'resume')}
                                            onDeactivate={() => handleQuickAction(row, 'deactivate')}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {assignFor && (
                <AssignPlanModal
                    isOpen
                    onClose={() => setAssignFor(null)}
                    clientId={assignFor.id}
                    clientName={assignFor.fullName}
                    currentPlanId={assignFor.subscription?.planId ?? null}
                />
            )}
            {linkFor && (
                <PaymentLinkModal
                    isOpen
                    onClose={() => setLinkFor(null)}
                    clientId={linkFor.id}
                    clientName={linkFor.fullName}
                    defaultAmount={Number(linkFor.subscription?.costInr ?? 0)}
                    planName={linkFor.subscription?.planName ?? ''}
                />
            )}
            {manualFor && (
                <ManualPaymentModal
                    isOpen
                    onClose={() => setManualFor(null)}
                    clientId={manualFor.id}
                    clientName={manualFor.fullName}
                    defaultAmount={Number(manualFor.subscription?.costInr ?? 0)}
                />
            )}
            {pauseFor && (
                <PauseModal
                    isOpen
                    onClose={() => setPauseFor(null)}
                    clientId={pauseFor.id}
                    clientName={pauseFor.fullName}
                />
            )}
            {historyFor && (
                <PaymentHistoryModal
                    isOpen
                    onClose={() => setHistoryFor(null)}
                    clientId={historyFor.id}
                    clientName={historyFor.fullName}
                />
            )}
        </div>
    );
}

// ─── Page shell ───────────────────────────────────────────────

export default function SubscriptionsPage() {
    const [tab, setTab] = useState<TabId>('clients');

    const tabs = useMemo(() => ([
        { id: 'clients' as const, label: 'Clients', icon: Users },
        { id: 'plans' as const, label: 'Plans', icon: CreditCard },
    ]), []);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Subscriptions</h1>
                <p className="text-[#4e9767] mt-1">Manage plans and client subscriptions in one place.</p>
            </div>

            <div className="border-b border-gray-200">
                <nav className="flex gap-4">
                    {tabs.map((t) => {
                        const Icon = t.icon;
                        const active = tab === t.id;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTab(t.id)}
                                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${active ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                            >
                                <Icon className="w-4 h-4" />
                                {t.label}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {tab === 'clients' ? <ClientsTab /> : <PlansTab />}
        </div>
    );
}
