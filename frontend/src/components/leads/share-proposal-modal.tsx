'use client';

import { useState } from 'react';
import { Copy, MessageCircle, Link } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { useSubscriptionPlans } from '@/lib/hooks/use-subscription-plans';
import { useProposalTemplate } from '@/lib/hooks/use-proposal-template';
import { useRecordProposal } from '@/lib/hooks/use-leads';
import { toast } from 'sonner';
import type { Lead } from '@/lib/hooks/use-leads';

interface ShareProposalModalProps {
    isOpen: boolean;
    onClose: () => void;
    lead: Pick<Lead, 'id' | 'name' | 'primaryMobile' | 'email'>;
}

export function ShareProposalModal({ isOpen, onClose, lead }: ShareProposalModalProps) {
    const { data: plans = [] } = useSubscriptionPlans();
    const { data: template } = useProposalTemplate();
    const recordProposal = useRecordProposal(lead.id);

    const [planId, setPlanId] = useState('');
    const [includePaymentLink, setIncludePaymentLink] = useState(false);
    const [paymentLink, setPaymentLink] = useState('');

    const activePlans = plans.filter((p) => p.active);
    const selectedPlan = activePlans.find((p) => p.id === planId);

    const cost = selectedPlan ? `₹${Number(selectedPlan.costInr).toLocaleString('en-IN')}` : '';
    const duration = selectedPlan
        ? `${selectedPlan.intervalCount} ${selectedPlan.recurrenceUnit}${selectedPlan.intervalCount > 1 ? 's' : ''}`
        : '';

    const whatsappMessage = [
        `Hi ${lead.name}! 👋`,
        '',
        `We've prepared a personalised diet plan for you:`,
        '',
        selectedPlan ? `📋 *${selectedPlan.name}*` : '📋 _(select a plan)_',
        selectedPlan ? `⏱️ Duration: ${duration}` : null,
        selectedPlan ? `💰 Price: ${cost}` : null,
        includePaymentLink && paymentLink.trim() ? '' : null,
        includePaymentLink && paymentLink.trim() ? `💳 Pay here: ${paymentLink.trim()}` : null,
        '',
        `Please review and let us know if you'd like to proceed.`,
        '',
        `Looking forward to helping you reach your goals! 🥗`,
    ].filter((l) => l !== null).join('\n');

    const handleWhatsApp = async () => {
        if (!planId) { toast.error('Select a plan first'); return; }
        const phone = lead.primaryMobile.replace(/\D/g, '');
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage)}`, '_blank');
        try {
            await recordProposal.mutateAsync({ planId });
        } catch {
            // non-fatal — just record the touchpoint
        }
    };

    const handleCopyMessage = async () => {
        try {
            await navigator.clipboard.writeText(whatsappMessage);
            toast.success('Message copied');
        } catch {
            toast.error('Failed to copy');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Share Proposal" size="md">
            <div className="flex flex-col gap-4 p-1">

                {/* Plan selector */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Select Plan <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={planId}
                        onChange={(e) => setPlanId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                    >
                        <option value="">Choose a plan...</option>
                        {activePlans.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name} — ₹{Number(p.costInr).toLocaleString('en-IN')} / {p.intervalCount} {p.recurrenceUnit}
                            </option>
                        ))}
                    </select>

                    {/* Plan details pill */}
                    {selectedPlan && (
                        <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-medium">{duration}</span>
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">₹{Number(selectedPlan.costInr).toLocaleString('en-IN')}</span>
                        </div>
                    )}
                </div>

                {/* Payment link toggle */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={includePaymentLink}
                            onChange={(e) => setIncludePaymentLink(e.target.checked)}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <Link className="w-3.5 h-3.5 text-gray-400" />
                            Include payment link in message
                        </span>
                    </label>
                    {includePaymentLink && (
                        <input
                            type="url"
                            value={paymentLink}
                            onChange={(e) => setPaymentLink(e.target.value)}
                            placeholder="https://rzp.io/... or any payment URL"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                        />
                    )}
                </div>

                {/* Message preview */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700">Message Preview</label>
                        <button type="button" onClick={handleCopyMessage}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-emerald-600 transition-colors">
                            <Copy className="w-3.5 h-3.5" /> Copy
                        </button>
                    </div>
                    <textarea
                        readOnly
                        rows={8}
                        value={whatsappMessage}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 bg-gray-50 resize-none outline-none"
                    />
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <button type="button" onClick={onClose}
                        className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">
                        Cancel
                    </button>
                    <button onClick={handleWhatsApp} disabled={!planId}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                        <MessageCircle className="w-4 h-4" /> Share on WhatsApp
                    </button>
                </div>
            </div>
        </Modal>
    );
}
