'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/modal';
import { useSubscriptionPlans } from '@/lib/hooks/use-subscription-plans';
import { useAssignPlan } from '@/lib/hooks/use-subscriptions';

interface AssignPlanModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientId: string;
    clientName: string;
    currentPlanId?: string | null;
}

export function AssignPlanModal({ isOpen, onClose, clientId, clientName, currentPlanId }: AssignPlanModalProps) {
    const { data: plans, isLoading } = useSubscriptionPlans();
    const assign = useAssignPlan();
    const [selectedId, setSelectedId] = useState<string>('');

    useEffect(() => {
        if (isOpen) setSelectedId(currentPlanId ?? '');
    }, [isOpen, currentPlanId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedId) return;
        try {
            await assign.mutateAsync({ clientId, planId: selectedId });
            toast.success(currentPlanId ? 'Plan changed' : `Plan assigned to ${clientName}`);
            onClose();
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { error?: { message?: string } } } })
                    ?.response?.data?.error?.message ?? 'Could not assign plan';
            toast.error(message);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={currentPlanId ? 'Change plan' : `Assign plan to ${clientName}`} size="md">
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-brand" />
                    </div>
                ) : (plans?.length ?? 0) === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-gray-600">No plans created yet.</p>
                        <p className="text-sm text-gray-400 mt-1">
                            Create one in the Plans tab first.
                        </p>
                    </div>
                ) : (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Choose a plan</label>
                        <div className="space-y-2">
                            {plans!.map((p) => (
                                <label
                                    key={p.id}
                                    className={`flex items-center justify-between gap-3 px-3 py-2 border rounded-lg cursor-pointer ${
                                        selectedId === p.id ? 'border-brand bg-brand/5' : 'border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    <span className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="plan"
                                            value={p.id}
                                            checked={selectedId === p.id}
                                            onChange={() => setSelectedId(p.id)}
                                            className="accent-brand"
                                        />
                                        <span className="font-medium text-gray-900">{p.name}</span>
                                        <span className="text-sm text-gray-500">
                                            · {p.intervalCount} {p.recurrenceUnit}{p.intervalCount > 1 ? 's' : ''} · {p.durationDays}d
                                        </span>
                                    </span>
                                    <span className="font-semibold text-gray-900">₹{Number(p.costInr).toFixed(2)}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

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
                        disabled={!selectedId || assign.isPending}
                        className="px-4 py-2 text-sm font-bold text-white bg-brand rounded-lg hover:bg-brand/90 disabled:opacity-60 flex items-center gap-2"
                    >
                        {assign.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        {currentPlanId ? 'Change plan' : 'Assign'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
