'use client';

import { useEffect, useState } from 'react';
import { Copy, MessageCircle, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { useGenerateInvite } from '@/lib/hooks/use-onboarding-invite';
import { useOrganization } from '@/lib/hooks/use-organization';
import { toast } from 'sonner';

interface OnboardingLinkModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientId: string;
    clientName: string;
}

export function OnboardingLinkModal({ isOpen, onClose, clientId, clientName }: OnboardingLinkModalProps) {
    const generateInvite = useGenerateInvite();
    const { data: org } = useOrganization();
    const [link, setLink] = useState('');

    const mutate = generateInvite.mutateAsync;
    useEffect(() => {
        if (!isOpen || !clientId) return;
        setLink('');
        mutate({ clientId })
            .then((result) => setLink(result.link))
            .catch(() => toast.error('Failed to generate onboarding link'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, clientId]);

    const orgName = org?.name ?? 'our clinic';

    const whatsappMessage = [
        `Hi ${clientName}! 👋`,
        '',
        `Welcome to *${orgName}*! 🌿`,
        '',
        `We're excited to have you on board. Please fill in your details using the link below so we can create the perfect personalised diet plan for you:`,
        '',
        link,
        '',
        `This link expires in 3 days. Feel free to reach out if you need any help!`,
    ].join('\n');

    const handleCopy = async () => {
        if (!link) return;
        await navigator.clipboard.writeText(link);
        toast.success('Link copied to clipboard');
    };

    const handleWhatsApp = () => {
        if (!link) return;
        window.open(`https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`, '_blank');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Send Onboarding Form" size="sm">
            <div className="p-4 space-y-4">
                <p className="text-sm text-gray-500">
                    Share this link with <strong>{clientName}</strong> so they can fill in their details.
                </p>

                {/* Link field */}
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600">Onboarding Link</label>
                    {generateInvite.isPending || !link ? (
                        <div className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50">
                            <Loader2 className="w-4 h-4 text-emerald-600 animate-spin shrink-0" />
                            <span className="text-sm text-gray-400">Generating link…</span>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <input
                                readOnly
                                value={link}
                                className="flex-1 min-w-0 px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg text-xs text-gray-700 outline-none truncate"
                            />
                            <button
                                type="button"
                                onClick={handleCopy}
                                className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 whitespace-nowrap"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                Copy
                            </button>
                        </div>
                    )}
                    <p className="text-xs text-gray-400">Link expires in 3 days.</p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleWhatsApp}
                        disabled={!link}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                        <MessageCircle className="w-4 h-4" />
                        Send on WhatsApp
                    </button>
                </div>
            </div>
        </Modal>
    );
}
