'use client';

import { useState } from 'react';
import {
    CalendarClock,
    CheckCircle2,
    CreditCard,
    Loader2,
    Pause,
    Play,
    Send,
    Sparkles,
    XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    useClientSubscription,
    useDeactivateSubscription,
    useMarkActive,
    useResumeSubscription,
} from '@/lib/hooks/use-subscriptions';
import { AssignPlanModal } from './assign-plan-modal';
import { PaymentLinkModal } from './payment-link-modal';
import { ManualPaymentModal } from './manual-payment-modal';
import { PauseModal } from './pause-modal';

interface Props {
    clientId: string;
    clientName: string;
}

function formatDate(input: string | null | undefined): string {
    if (!input) return '—';
    return new Date(input).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StatusPill({ children, tone }: { children: React.ReactNode; tone: 'green' | 'yellow' | 'amber' | 'red' | 'gray' }) {
    const cls: Record<typeof tone, string> = {
        green:  'bg-green-50 text-green-700',
        yellow: 'bg-yellow-50 text-yellow-800',
        amber:  'bg-amber-50 text-amber-700',
        red:    'bg-red-50 text-red-600',
        gray:   'bg-gray-100 text-gray-500',
    };
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls[tone]}`}>{children}</span>;
}

export function ClientSubscriptionCard({ clientId, clientName }: Props) {
    const { data: sub, isLoading } = useClientSubscription(clientId);
    const resume = useResumeSubscription();
    const deactivate = useDeactivateSubscription();
    const markActive = useMarkActive();

    const [assignOpen, setAssignOpen] = useState(false);
    const [linkOpen, setLinkOpen] = useState(false);
    const [manualOpen, setManualOpen] = useState(false);
    const [pauseOpen, setPauseOpen] = useState(false);

    const quick = async (action: 'resume' | 'deactivate' | 'markActive') => {
        try {
            if (action === 'resume') {
                await resume.mutateAsync({ clientId });
                toast.success('Subscription resumed');
            } else if (action === 'deactivate') {
                if (!confirm(`Deactivate ${clientName}'s subscription?`)) return;
                await deactivate.mutateAsync({ clientId });
                toast.success('Subscription deactivated');
            } else {
                await markActive.mutateAsync({ clientId });
                toast.success('Marked active');
            }
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { error?: { message?: string } } } })
                    ?.response?.data?.error?.message ?? 'Action failed';
            toast.error(message);
        }
    };

    const cost = sub ? Number(sub.plan.costInr) : 0;

    return (
        <>
            <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand">
                            <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Subscription</h3>
                            {isLoading ? (
                                <p className="text-xs text-gray-400">Loading…</p>
                            ) : sub ? (
                                <p className="text-sm text-gray-600">
                                    {sub.plan.name} · ₹{cost.toFixed(2)}
                                </p>
                            ) : (
                                <p className="text-sm text-gray-400">No plan assigned</p>
                            )}
                        </div>
                    </div>
                    {sub && (
                        <div className="flex items-center gap-2 flex-wrap">
                            {sub.status === 'paused' && <StatusPill tone="amber">Paused</StatusPill>}
                            {sub.status === 'deactivated' && <StatusPill tone="red">Deactivated</StatusPill>}
                            {sub.status === 'active' && (sub.paymentStatus === 'paid'
                                ? <StatusPill tone="green">Paid</StatusPill>
                                : <StatusPill tone="yellow">Unpaid</StatusPill>)}
                        </div>
                    )}
                </div>

                {sub && (
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-400 uppercase tracking-wide">Active since</p>
                            <p className="text-sm font-semibold text-gray-900 mt-0.5 flex items-center gap-1.5">
                                <CalendarClock className="w-3.5 h-3.5 text-gray-400" />
                                {formatDate(sub.activeDate)}
                            </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-400 uppercase tracking-wide">Renews on</p>
                            <p className="text-sm font-semibold text-gray-900 mt-0.5 flex items-center gap-1.5">
                                <CalendarClock className="w-3.5 h-3.5 text-gray-400" />
                                {formatDate(sub.renewalDate)}
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex flex-wrap gap-2 mt-4">
                    {!sub && (
                        <button
                            type="button"
                            onClick={() => setAssignOpen(true)}
                            className="inline-flex items-center gap-1.5 h-9 px-3 bg-brand hover:bg-brand/90 text-white rounded-lg text-sm font-bold"
                        >
                            <CreditCard className="w-4 h-4" /> Assign plan
                        </button>
                    )}
                    {sub && (
                        <>
                            <button
                                type="button"
                                onClick={() => setLinkOpen(true)}
                                className="inline-flex items-center gap-1.5 h-9 px-3 bg-brand hover:bg-brand/90 text-white rounded-lg text-sm font-bold"
                            >
                                <Send className="w-4 h-4" /> Send payment link
                            </button>
                            <button
                                type="button"
                                onClick={() => setManualOpen(true)}
                                className="inline-flex items-center gap-1.5 h-9 px-3 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium"
                            >
                                <CheckCircle2 className="w-4 h-4 text-green-600" /> Mark paid
                            </button>
                            <button
                                type="button"
                                onClick={() => quick('markActive')}
                                disabled={markActive.isPending}
                                className="inline-flex items-center gap-1.5 h-9 px-3 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium disabled:opacity-60"
                            >
                                <Sparkles className="w-4 h-4 text-violet-500" /> Mark active
                            </button>
                            <button
                                type="button"
                                onClick={() => setAssignOpen(true)}
                                className="inline-flex items-center gap-1.5 h-9 px-3 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium"
                            >
                                Change plan
                            </button>
                            {sub.status === 'active' && (
                                <button
                                    type="button"
                                    onClick={() => setPauseOpen(true)}
                                    className="inline-flex items-center gap-1.5 h-9 px-3 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium"
                                >
                                    <Pause className="w-4 h-4 text-amber-500" /> Pause
                                </button>
                            )}
                            {sub.status === 'paused' && (
                                <button
                                    type="button"
                                    onClick={() => quick('resume')}
                                    disabled={resume.isPending}
                                    className="inline-flex items-center gap-1.5 h-9 px-3 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium disabled:opacity-60"
                                >
                                    {resume.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 text-green-600" />}
                                    Resume
                                </button>
                            )}
                            {sub.status !== 'deactivated' && (
                                <button
                                    type="button"
                                    onClick={() => quick('deactivate')}
                                    disabled={deactivate.isPending}
                                    className="inline-flex items-center gap-1.5 h-9 px-3 border border-gray-200 hover:bg-gray-50 text-red-600 rounded-lg text-sm font-medium disabled:opacity-60"
                                >
                                    <XCircle className="w-4 h-4" /> Deactivate
                                </button>
                            )}
                            {sub.status === 'deactivated' && (
                                <button
                                    type="button"
                                    onClick={() => quick('resume')}
                                    disabled={resume.isPending}
                                    className="inline-flex items-center gap-1.5 h-9 px-3 border border-gray-200 hover:bg-gray-50 text-green-700 rounded-lg text-sm font-medium disabled:opacity-60"
                                >
                                    <Play className="w-4 h-4" /> Reactivate
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            <AssignPlanModal
                isOpen={assignOpen}
                onClose={() => setAssignOpen(false)}
                clientId={clientId}
                clientName={clientName}
                currentPlanId={sub?.planId ?? null}
            />
            {sub && (
                <>
                    <PaymentLinkModal
                        isOpen={linkOpen}
                        onClose={() => setLinkOpen(false)}
                        clientId={clientId}
                        clientName={clientName}
                        defaultAmount={cost}
                        planName={sub.plan.name}
                    />
                    <ManualPaymentModal
                        isOpen={manualOpen}
                        onClose={() => setManualOpen(false)}
                        clientId={clientId}
                        clientName={clientName}
                        defaultAmount={cost}
                    />
                    <PauseModal
                        isOpen={pauseOpen}
                        onClose={() => setPauseOpen(false)}
                        clientId={clientId}
                        clientName={clientName}
                    />
                </>
            )}
        </>
    );
}
