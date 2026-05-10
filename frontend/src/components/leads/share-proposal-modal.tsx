'use client';

import { useState } from 'react';
import { Copy, MessageCircle, Link, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { useSubscriptionPlans } from '@/lib/hooks/use-subscription-plans';
import { useProposalTemplate } from '@/lib/hooks/use-proposal-template';
import { useRecordProposal, useCreateLeadPaymentLink } from '@/lib/hooks/use-leads';
import { toast } from 'sonner';
import type { Lead } from '@/lib/hooks/use-leads';

interface ShareProposalModalProps {
    isOpen: boolean;
    onClose: () => void;
    lead: Pick<Lead, 'id' | 'name' | 'primaryMobile' | 'email'>;
}

type PaymentMode = 'generate' | 'paste';

export function ShareProposalModal({ isOpen, onClose, lead }: ShareProposalModalProps) {
    const { data: plans = [] } = useSubscriptionPlans();
    const { data: template } = useProposalTemplate();
    const recordProposal = useRecordProposal(lead.id);
    const createLeadLink = useCreateLeadPaymentLink(lead.id);

    const [planId, setPlanId] = useState('');
    const [includePaymentLink, setIncludePaymentLink] = useState(false);
    const [paymentMode, setPaymentMode] = useState<PaymentMode>('generate');
    const [customAmount, setCustomAmount] = useState('');
    const [paymentLink, setPaymentLink] = useState('');
    const [generatedLink, setGeneratedLink] = useState('');

    const activePlans = plans.filter((p) => p.active);
    const selectedPlan = activePlans.find((p) => p.id === planId);

    const cost = selectedPlan ? `₹${Number(selectedPlan.costInr).toLocaleString('en-IN')}` : '';
    const duration = selectedPlan
        ? `${selectedPlan.intervalCount} ${selectedPlan.recurrenceUnit}${selectedPlan.intervalCount > 1 ? 's' : ''}`
        : '';

    const effectiveLink = generatedLink || paymentLink.trim();

    const whatsappMessage = [
        `Hi ${lead.name}! 👋`,
        '',
        `We've prepared a personalised diet plan for you:`,
        '',
        selectedPlan ? `📋 *${selectedPlan.name}*` : '📋 _(select a plan)_',
        selectedPlan ? `⏱️ Duration: ${duration}` : null,
        selectedPlan ? `💰 Price: ${cost}` : null,
        includePaymentLink && effectiveLink ? '' : null,
        includePaymentLink && effectiveLink ? `💳 Pay here: ${effectiveLink}` : null,
        '',
        `Please review and let us know if you'd like to proceed.`,
        '',
        `Looking forward to helping you reach your goals! 🥗`,
    ].filter((l) => l !== null).join('\n');

    const handleGenerateLink = async () => {
        const amount = selectedPlan
            ? Number(selectedPlan.costInr)
            : parseFloat(customAmount);
        if (!amount || amount <= 0) {
            toast.error('Enter a valid amount');
            return;
        }
        try {
            const result = await createLeadLink.mutateAsync({ amountInr: amount, planId: planId || undefined });
            setGeneratedLink(result.shortUrl);
            toast.success('Payment link generated');
        } catch {
            toast.error('Failed to generate payment link');
        }
    };

    const handleWhatsApp = async () => {
        if (!planId && !effectiveLink) { toast.error('Select a plan or include a payment link first'); return; }
        const phone = lead.primaryMobile.replace(/\D/g, '');
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage)}`, '_blank');
        if (planId) {
            try { await recordProposal.mutateAsync({ planId }); } catch { /* non-fatal */ }
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

    const handlePlanChange = (newPlanId: string) => {
        setPlanId(newPlanId);
        setGeneratedLink('');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Share Proposal" size="md">
            <div className="flex flex-col gap-4 p-1">

                {/* Plan selector */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Select Plan <span className="text-gray-400 font-normal text-xs">(optional)</span>
                    </label>
                    <select
                        value={planId}
                        onChange={(e) => handlePlanChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                    >
                        <option value="">Choose a plan...</option>
                        {activePlans.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name} — ₹{Number(p.costInr).toLocaleString('en-IN')} / {p.intervalCount} {p.recurrenceUnit}
                            </option>
                        ))}
                    </select>

                    {selectedPlan && (
                        <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-medium">{duration}</span>
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">₹{Number(selectedPlan.costInr).toLocaleString('en-IN')}</span>
                        </div>
                    )}
                </div>

                {/* Payment link toggle */}
                <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={includePaymentLink}
                            onChange={(e) => {
                                setIncludePaymentLink(e.target.checked);
                                setGeneratedLink('');
                                setPaymentLink('');
                            }}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                            <Link className="w-3.5 h-3.5 text-gray-400" />
                            Include payment link in message
                        </span>
                    </label>

                    {includePaymentLink && (
                        <div className="pl-6 space-y-3">
                            {/* Mode selector */}
                            <div className="flex gap-3">
                                <label className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700">
                                    <input
                                        type="radio"
                                        name="paymentMode"
                                        value="generate"
                                        checked={paymentMode === 'generate'}
                                        onChange={() => { setPaymentMode('generate'); setPaymentLink(''); setGeneratedLink(''); }}
                                        className="accent-emerald-600"
                                    />
                                    {selectedPlan ? `Generate link (₹${Number(selectedPlan.costInr).toLocaleString('en-IN')})` : 'Generate link'}
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700">
                                    <input
                                        type="radio"
                                        name="paymentMode"
                                        value="paste"
                                        checked={paymentMode === 'paste'}
                                        onChange={() => { setPaymentMode('paste'); setGeneratedLink(''); }}
                                        className="accent-emerald-600"
                                    />
                                    Paste URL
                                </label>
                            </div>

                            {/* Generate mode */}
                            {paymentMode === 'generate' && (
                                <div className="space-y-2">
                                    {!selectedPlan && (
                                        <div className="flex gap-2 items-center">
                                            <span className="text-sm text-gray-500 whitespace-nowrap">₹ Amount</span>
                                            <input
                                                type="number"
                                                min={1}
                                                value={customAmount}
                                                onChange={(e) => { setCustomAmount(e.target.value); setGeneratedLink(''); }}
                                                placeholder="Enter amount"
                                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                                            />
                                        </div>
                                    )}
                                    {generatedLink ? (
                                        <div className="flex gap-2 items-center">
                                            <input
                                                readOnly
                                                value={generatedLink}
                                                className="flex-1 px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg text-sm text-gray-700 outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => { navigator.clipboard.writeText(generatedLink); toast.success('Copied'); }}
                                                className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
                                            >
                                                Copy
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleGenerateLink}
                                            disabled={createLeadLink.isPending}
                                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                                        >
                                            {createLeadLink.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                            Generate Razorpay Link
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Paste mode */}
                            {paymentMode === 'paste' && (
                                <input
                                    type="url"
                                    value={paymentLink}
                                    onChange={(e) => setPaymentLink(e.target.value)}
                                    placeholder="https://rzp.io/... or any payment URL"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                                />
                            )}
                        </div>
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
                    <button onClick={handleWhatsApp} disabled={!planId && !effectiveLink}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                        <MessageCircle className="w-4 h-4" /> Share on WhatsApp
                    </button>
                </div>
            </div>
        </Modal>
    );
}
