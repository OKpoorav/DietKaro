'use client';

import { useState, useRef } from 'react';
import { Download, Loader2 } from 'lucide-react';
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
    const [generating, setGenerating] = useState(false);
    const previewRef = useRef<HTMLDivElement>(null);

    const activePlans = plans.filter((p) => p.active);
    const selectedPlan = activePlans.find((p) => p.id === planId);

    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `proposal-${lead.name.replace(/\s+/g, '-')}-${dateStamp}.pdf`;

    const handleDownload = async () => {
        if (!planId) { toast.error('Select a plan first'); return; }
        if (!previewRef.current) return;

        setGenerating(true);
        try {
            const { default: jsPDF } = await import('jspdf');
            const { default: html2canvas } = await import('html2canvas');

            const canvas = await html2canvas(previewRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageW = pdf.internal.pageSize.getWidth();
            const pageH = pdf.internal.pageSize.getHeight();
            const ratio = canvas.height / canvas.width;
            const imgH = pageW * ratio;

            pdf.addImage(imgData, 'PNG', 0, 0, pageW, Math.min(imgH, pageH));
            pdf.save(fileName);

            await recordProposal.mutateAsync({ planId, pdfFilename: fileName });
            toast.success('Proposal downloaded');
            onClose();
        } catch (err) {
            console.error(err);
            toast.error('Failed to generate PDF');
        } finally {
            setGenerating(false);
        }
    };

    const cost = selectedPlan ? Number(selectedPlan.costInr).toLocaleString('en-IN') : '—';
    const duration = selectedPlan
        ? `${selectedPlan.intervalCount} ${selectedPlan.recurrenceUnit}${selectedPlan.intervalCount > 1 ? 's' : ''}`
        : '—';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Share Proposal" size="xl">
            <div className="flex flex-col gap-5 p-1">
                {/* Plan selector */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Select Plan <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={planId}
                        onChange={(e) => setPlanId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500"
                    >
                        <option value="">Choose a plan...</option>
                        {activePlans.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name} — ₹{Number(p.costInr).toLocaleString('en-IN')} / {p.intervalCount} {p.recurrenceUnit}
                            </option>
                        ))}
                    </select>
                </div>

                {/* PDF Preview */}
                <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                    <p className="text-xs text-gray-400 px-4 py-2 border-b border-gray-200 bg-white">Preview</p>
                    <div className="overflow-y-auto max-h-[420px] p-4">
                        <div
                            ref={previewRef}
                            className="bg-white font-sans text-gray-900 p-8 w-full"
                            style={{ minHeight: 500, fontSize: 13 }}
                        >
                            {/* Header */}
                            <div className="border-b-2 border-emerald-600 pb-4 mb-5">
                                <h1 className="text-2xl font-bold text-gray-900">
                                    {template?.headerCopy || 'Your Practice'}
                                </h1>
                                <p className="text-xs text-gray-500 mt-0.5">Personalised Nutrition Proposal</p>
                            </div>

                            {/* Lead info */}
                            <div className="mb-5 space-y-1">
                                <p><span className="font-semibold">Prepared for:</span> {lead.name}</p>
                                {lead.primaryMobile && <p><span className="font-semibold">Mobile:</span> {lead.primaryMobile}</p>}
                                {lead.email && <p><span className="font-semibold">Email:</span> {lead.email}</p>}
                                <p className="text-gray-500 text-xs mt-1">Date: {today}</p>
                            </div>

                            {/* Plan details box */}
                            <div className="border border-gray-200 rounded-lg p-5 mb-5 bg-gray-50 space-y-2">
                                <p className="font-semibold text-base text-gray-800">
                                    {selectedPlan?.name ?? 'Plan not selected'}
                                </p>
                                <p>Duration: <span className="font-medium">{duration}</span></p>
                                <p>Price: <span className="font-bold text-emerald-700">₹{cost}</span></p>

                                {template?.customFields?.map((f, i) => (
                                    <p key={i} className="text-gray-700">
                                        {f.label}: <span className="italic text-gray-400">___________</span>
                                    </p>
                                ))}
                            </div>

                            {/* Footer note */}
                            {template?.footerNote && (
                                <p className="text-xs text-gray-500 italic mb-5">{template.footerNote}</p>
                            )}

                            {/* Signature */}
                            {template?.signatureLine && (
                                <div className="border-t border-gray-200 pt-4 text-right text-xs text-gray-600">
                                    {template.signatureLine}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDownload}
                        disabled={!planId || generating}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                        {generating ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                        ) : (
                            <><Download className="w-4 h-4" /> Download PDF</>
                        )}
                    </button>
                </div>
                <p className="text-xs text-gray-400 text-center -mt-2">
                    PDF is generated in your browser. Share it manually via WhatsApp or email.
                </p>
            </div>
        </Modal>
    );
}
