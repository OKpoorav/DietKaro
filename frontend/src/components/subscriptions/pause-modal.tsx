'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/modal';
import { usePauseSubscription } from '@/lib/hooks/use-subscriptions';

interface PauseModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientId: string;
    clientName: string;
}

export function PauseModal({ isOpen, onClose, clientId, clientName }: PauseModalProps) {
    const pause = usePauseSubscription();
    const [until, setUntil] = useState('');

    useEffect(() => {
        if (isOpen) setUntil('');
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await pause.mutateAsync({
                clientId,
                until: until ? new Date(`${until}T00:00:00.000Z`).toISOString() : undefined,
            });
            toast.success(`Paused subscription for ${clientName}`);
            onClose();
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { error?: { message?: string } } } })
                    ?.response?.data?.error?.message ?? 'Could not pause';
            toast.error(message);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Pause subscription — ${clientName}`} size="sm">
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Resume on (optional)</label>
                    <input
                        type="date"
                        value={until}
                        onChange={(e) => setUntil(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand focus:border-brand text-gray-900"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        Leave blank for indefinite pause. The subscription stays paused until you click Resume.
                    </p>
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
                        disabled={pause.isPending}
                        className="px-4 py-2 text-sm font-bold text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-60 flex items-center gap-2"
                    >
                        {pause.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        Pause
                    </button>
                </div>
            </form>
        </Modal>
    );
}
