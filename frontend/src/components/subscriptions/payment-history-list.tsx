'use client';

import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import { PAYMENT_METHOD_LABELS, useClientPayments, type Payment } from '@/lib/hooks/use-payments';

interface PaymentHistoryListProps {
    clientId: string;
    /** Optional fixed maximum height for the scrollable container. */
    maxHeight?: string;
    /** Show a card-style wrapper. Defaults true. */
    asCard?: boolean;
}

function formatDate(input: string | null | undefined): string {
    if (!input) return '—';
    return new Date(input).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function StatusBadge({ status }: { status: Payment['status'] }) {
    const map: Record<Payment['status'], { icon: typeof CheckCircle2; cls: string; label: string }> = {
        succeeded: { icon: CheckCircle2, cls: 'text-green-700 bg-green-50',  label: 'Paid' },
        pending:   { icon: Clock,        cls: 'text-yellow-800 bg-yellow-50', label: 'Pending' },
        failed:    { icon: XCircle,      cls: 'text-red-600 bg-red-50',       label: 'Failed' },
        expired:   { icon: XCircle,      cls: 'text-gray-500 bg-gray-100',    label: 'Expired' },
    };
    const cfg = map[status];
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.cls}`}>
            <Icon className="w-3 h-3" />
            {cfg.label}
        </span>
    );
}

export function PaymentHistoryList({ clientId, maxHeight = '320px', asCard = true }: PaymentHistoryListProps) {
    const { data: payments, isLoading } = useClientPayments(clientId);

    const body = (
        <div className="space-y-2 overflow-y-auto" style={{ maxHeight }}>
            {isLoading ? (
                <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-brand" />
                </div>
            ) : (payments?.length ?? 0) === 0 ? (
                <p className="text-sm text-gray-500 italic text-center py-6">No payments recorded yet.</p>
            ) : (
                payments!.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-100">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900">₹{Number(p.amountInr).toFixed(2)}</span>
                                <StatusBadge status={p.status} />
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                                {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                                {' · '}
                                {formatDate(p.paidAt ?? p.createdAt)}
                                {p.note ? ` · ${p.note}` : ''}
                            </p>
                        </div>
                    </div>
                ))
            )}
        </div>
    );

    if (!asCard) return body;

    return (
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Payment History</h3>
            {body}
        </div>
    );
}
