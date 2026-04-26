'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/modal';
import { useRecordManualPayment, type ManualPaymentMethod } from '@/lib/hooks/use-payments';

interface ManualPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientId: string;
    clientName: string;
    defaultAmount: number;
}

const METHODS: { value: ManualPaymentMethod; label: string }[] = [
    { value: 'manual_cash', label: 'Cash' },
    { value: 'manual_upi', label: 'UPI' },
    { value: 'manual_bank', label: 'Bank transfer' },
    { value: 'manual_other', label: 'Other' },
];

export function ManualPaymentModal({ isOpen, onClose, clientId, clientName, defaultAmount }: ManualPaymentModalProps) {
    const record = useRecordManualPayment();
    const [amount, setAmount] = useState<number>(defaultAmount);
    const [method, setMethod] = useState<ManualPaymentMethod>('manual_cash');
    const [note, setNote] = useState('');

    useEffect(() => {
        if (isOpen) {
            setAmount(defaultAmount);
            setMethod('manual_cash');
            setNote('');
        }
    }, [isOpen, defaultAmount]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await record.mutateAsync({
                clientId,
                amountInr: amount,
                method,
                note: note.trim() || undefined,
            });
            toast.success(`Marked paid for ${clientName}`);
            onClose();
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { error?: { message?: string } } } })
                    ?.response?.data?.error?.message ?? 'Could not record payment';
            toast.error(message);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Record manual payment — ${clientName}`} size="md">
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) *</label>
                    <input
                        type="number"
                        required
                        min={1}
                        step={0.01}
                        value={amount}
                        onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand focus:border-brand text-gray-900"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Method *</label>
                    <select
                        value={method}
                        onChange={(e) => setMethod(e.target.value as ManualPaymentMethod)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand focus:border-brand text-gray-900"
                    >
                        {METHODS.map((m) => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
                    <textarea
                        rows={2}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand focus:border-brand text-gray-900 text-sm"
                        placeholder="Reference number, comments…"
                    />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={record.isPending}
                        className="px-4 py-2 text-sm font-bold text-white bg-brand rounded-lg hover:bg-brand/90 disabled:opacity-60 flex items-center gap-2"
                    >
                        {record.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        Mark paid
                    </button>
                </div>
            </form>
        </Modal>
    );
}
