'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { useInviteMember } from '@/lib/hooks/use-team';
import { Loader2, Mail, Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface InviteMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function InviteMemberModal({ isOpen, onClose }: InviteMemberModalProps) {
    const inviteMutation = useInviteMember();

    const [email, setEmail] = useState('');
    const [role, setRole] = useState('dietitian');
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data = await inviteMutation.mutateAsync({ email, role });
            // content.data.inviteLink contains the real link from backend, but let's use window.location.origin to be safe about ports
            const token = data.invitation.token;
            const link = `${window.location.origin}/join?token=${token}`;
            setInviteLink(link);
            toast.success('Invitation generated! Share the link.');
        } catch {
            toast.error('Failed to generate invitation');
        }
    };

    const copyToClipboard = () => {
        if (inviteLink) {
            navigator.clipboard.writeText(inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast.success('Link copied to clipboard');
        }
    };

    const handleClose = () => {
        setInviteLink(null);
        setEmail('');
        setRole('dietitian');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Invite Team Member" size="md">
            {!inviteLink ? (
                <form onSubmit={handleSubmit} className="space-y-4 p-4">
                    <p className="text-sm text-gray-500">
                        Send an invitation to a new team member. They will receive an email (simulated) or you can copy the link.
                    </p>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                required
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                                placeholder="colleague@example.com"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                        >
                            <option value="admin">Admin</option>
                            <option value="dietitian">Dietitian</option>
                        </select>
                    </div>

                    <div className="flex justify-end pt-2 gap-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={inviteMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {inviteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            Generate Invite
                        </button>
                    </div>
                </form>
            ) : (
                <div className="p-6 space-y-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
                        <Check className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-lg font-medium text-gray-900">Invitation Ready!</h3>
                        <p className="text-sm text-gray-500 mt-1">
                            Share this link with <strong>{email}</strong> to join the team.
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <input
                            readOnly
                            value={inviteLink}
                            className="flex-grow bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 font-mono"
                        />
                        <button
                            onClick={copyToClipboard}
                            className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                        >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                    </div>

                    <button
                        onClick={handleClose}
                        className="w-full py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                    >
                        Close
                    </button>
                </div>
            )}
        </Modal>
    );
}
