'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { useCreateFollowup, type FollowupType } from '@/lib/hooks/use-lead-followups';
import { toast } from 'sonner';

const FOLLOWUP_TYPES: { value: FollowupType; label: string; icon: string }[] = [
    { value: 'call', label: 'Call', icon: '📞' },
    { value: 'whatsapp', label: 'WhatsApp', icon: '💬' },
    { value: 'visit', label: 'Visit', icon: '🏢' },
    { value: 'reminder', label: 'Reminder', icon: '🔔' },
];

interface AddFollowupModalProps {
    isOpen: boolean;
    onClose: () => void;
    leadId: string;
}

export function AddFollowupModal({ isOpen, onClose, leadId }: AddFollowupModalProps) {
    const createFollowup = useCreateFollowup(leadId);
    const [type, setType] = useState<FollowupType>('call');
    const [dueAt, setDueAt] = useState('');
    const [notes, setNotes] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!dueAt) { toast.error('Select a date and time'); return; }
        try {
            await createFollowup.mutateAsync({ dueAt: new Date(dueAt).toISOString(), type, notes: notes.trim() || undefined });
            toast.success('Follow-up scheduled');
            setDueAt(''); setNotes(''); setType('call');
            onClose();
        } catch {
            toast.error('Failed to schedule follow-up');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Schedule Follow-up" size="sm">
            <form onSubmit={handleSubmit} className="space-y-4 p-1">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                    <div className="grid grid-cols-2 gap-2">
                        {FOLLOWUP_TYPES.map((t) => (
                            <button key={t.value} type="button" onClick={() => setType(t.value)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${type === t.value ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                <span>{t.icon}</span> {t.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time <span className="text-red-500">*</span></label>
                    <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                        placeholder="Optional notes..." />
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                    <button type="submit" disabled={createFollowup.isPending}
                        className="flex-1 px-4 py-2 text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                        {createFollowup.isPending ? 'Scheduling...' : 'Schedule'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
