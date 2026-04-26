'use client';

import { useEffect, useState } from 'react';
import { Copy, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/modal';
import { useCreatePaymentLink, type PaymentLinkResult } from '@/lib/hooks/use-payments';

interface PaymentLinkModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientId: string;
    clientName: string;
    /** Default amount (plan cost). User can edit. */
    defaultAmount: number;
    planName: string;
}

export function PaymentLinkModal({ isOpen, onClose, clientId, clientName, defaultAmount, planName }: PaymentLinkModalProps) {
    const create = useCreatePaymentLink();
    const [amount, setAmount] = useState<number>(defaultAmount);
    const [message, setMessage] = useState('');
    const [whatsapp, setWhatsapp] = useState(true);
    const [email, setEmail] = useState(true);
    const [result, setResult] = useState<PaymentLinkResult | null>(null);

    useEffect(() => {
        if (isOpen) {
            setAmount(defaultAmount);
            setMessage('');
            setWhatsapp(true);
            setEmail(true);
            setResult(null);
        }
    }, [isOpen, defaultAmount]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await create.mutateAsync({
                clientId,
                amountInr: amount,
                message: message.trim() || undefined,
                channels: { whatsapp, email },
            });
            setResult(res);
            toast.success('Payment link created');
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { error?: { message?: string } } } })
                    ?.response?.data?.error?.message ?? 'Could not create link';
            toast.error(message);
        }
    };

    const copy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success('Copied to clipboard');
        } catch {
            toast.error('Could not copy');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Send payment link to ${clientName}`} size="md">
            {!result ? (
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                        <input
                            type="number"
                            required
                            min={1}
                            step={0.01}
                            value={amount}
                            onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand focus:border-brand text-gray-900"
                        />
                        <p className="text-xs text-gray-400 mt-1">Default: ₹{defaultAmount.toFixed(2)} ({planName})</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Message (optional)</label>
                        <textarea
                            rows={3}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Custom note prepended to the WhatsApp / email body. Defaults to standard renewal copy."
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand focus:border-brand text-gray-900 text-sm"
                        />
                    </div>

                    <div className="space-y-2">
                        <p className="block text-sm font-medium text-gray-700">Send via</p>
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={whatsapp}
                                onChange={(e) => setWhatsapp(e.target.checked)}
                                className="w-4 h-4 accent-brand"
                            />
                            WhatsApp (opens WA with pre-filled message — you tap Send)
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={email}
                                onChange={(e) => setEmail(e.target.checked)}
                                className="w-4 h-4 accent-brand"
                            />
                            Email
                        </label>
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
                            disabled={create.isPending}
                            className="px-4 py-2 text-sm font-bold text-white bg-brand rounded-lg hover:bg-brand/90 disabled:opacity-60 flex items-center gap-2"
                        >
                            {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            Generate link
                        </button>
                    </div>
                </form>
            ) : (
                <div className="p-6 space-y-4">
                    <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
                        Link created. {result.emailSent ? 'Email sent.' : ''}
                    </div>

                    <div>
                        <p className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Payment link</p>
                        <div className="flex gap-2">
                            <input
                                readOnly
                                value={result.shortUrl}
                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-900 text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => copy(result.shortUrl)}
                                className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
                                title="Copy"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {result.whatsappUrl && (
                        <a
                            href={result.whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-[#25D366] rounded-lg hover:bg-[#25D366]/90"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Open WhatsApp with pre-filled message
                        </a>
                    )}

                    <div className="flex justify-end pt-3 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-bold text-white bg-brand rounded-lg hover:bg-brand/90"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
