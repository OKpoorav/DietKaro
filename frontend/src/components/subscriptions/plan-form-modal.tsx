'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/modal';
import {
    type RecurrenceUnit,
    type SubscriptionPlan,
    deriveDurationDays,
    useCreatePlan,
    useUpdatePlan,
} from '@/lib/hooks/use-subscription-plans';

interface PlanFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Pass an existing plan to edit; omit for create. */
    plan?: SubscriptionPlan | null;
}

const RECURRENCE_OPTIONS: { value: RecurrenceUnit; label: string }[] = [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
];

interface FormState {
    name: string;
    recurrenceUnit: RecurrenceUnit;
    intervalCount: number;
    durationDays: number;
    overrideDuration: boolean;
    costInr: number;
    active: boolean;
}

const EMPTY: FormState = {
    name: '',
    recurrenceUnit: 'month',
    intervalCount: 1,
    durationDays: 30,
    overrideDuration: false,
    costInr: 0,
    active: true,
};

export function PlanFormModal({ isOpen, onClose, plan }: PlanFormModalProps) {
    const [form, setForm] = useState<FormState>(EMPTY);
    const create = useCreatePlan();
    const update = useUpdatePlan();
    const isEdit = !!plan;
    const isPending = create.isPending || update.isPending;

    useEffect(() => {
        if (!isOpen) return;
        if (plan) {
            const derived = deriveDurationDays(plan.recurrenceUnit, plan.intervalCount);
            setForm({
                name: plan.name,
                recurrenceUnit: plan.recurrenceUnit,
                intervalCount: plan.intervalCount,
                durationDays: plan.durationDays,
                overrideDuration: plan.durationDays !== derived,
                costInr: Number(plan.costInr),
                active: plan.active,
            });
        } else {
            setForm(EMPTY);
        }
    }, [isOpen, plan]);

    // Auto-derive durationDays when unit/count change unless admin overrode it.
    useEffect(() => {
        if (form.overrideDuration) return;
        const next = deriveDurationDays(form.recurrenceUnit, form.intervalCount);
        if (next !== form.durationDays) {
            setForm((prev) => ({ ...prev, durationDays: next }));
        }
    }, [form.recurrenceUnit, form.intervalCount, form.overrideDuration, form.durationDays]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            name: form.name.trim(),
            recurrenceUnit: form.recurrenceUnit,
            intervalCount: form.intervalCount,
            durationDays: form.overrideDuration ? form.durationDays : undefined,
            costInr: form.costInr,
            active: form.active,
        };
        try {
            if (isEdit && plan) {
                await update.mutateAsync({ id: plan.id, ...payload });
                toast.success(`Updated "${payload.name}"`);
            } else {
                await create.mutateAsync(payload);
                toast.success(`Created "${payload.name}"`);
            }
            onClose();
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { error?: { message?: string } } } })
                    ?.response?.data?.error?.message ?? 'Save failed';
            toast.error(message);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? `Edit "${plan?.name}"` : 'New Subscription Plan'} size="md">
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Plan name *</label>
                    <input
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand focus:border-brand text-gray-900"
                        placeholder="e.g. Monthly, Quarterly, 2-Weekly"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Recurrence *</label>
                        <select
                            value={form.recurrenceUnit}
                            onChange={(e) => setForm({ ...form, recurrenceUnit: e.target.value as RecurrenceUnit })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand focus:border-brand text-gray-900"
                        >
                            {RECURRENCE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Interval *</label>
                        <input
                            type="number"
                            required
                            min={1}
                            max={120}
                            value={form.intervalCount}
                            onChange={(e) => setForm({ ...form, intervalCount: Math.max(1, Number(e.target.value) || 1) })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand focus:border-brand text-gray-900"
                        />
                        <p className="text-xs text-gray-400 mt-1">e.g. 2 + week = &quot;2-weekly&quot;</p>
                    </div>
                </div>

                <div>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                            type="checkbox"
                            checked={form.overrideDuration}
                            onChange={(e) => setForm({ ...form, overrideDuration: e.target.checked })}
                            className="w-4 h-4 accent-brand"
                        />
                        Override duration
                    </label>
                    <input
                        type="number"
                        min={1}
                        max={3650}
                        disabled={!form.overrideDuration}
                        value={form.durationDays}
                        onChange={(e) => setForm({ ...form, durationDays: Math.max(1, Number(e.target.value) || 1) })}
                        className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand focus:border-brand text-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        Days the subscription stays active after each payment. Default derived from recurrence × interval.
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cost (₹) *</label>
                    <input
                        type="number"
                        required
                        min={0}
                        step={0.01}
                        value={form.costInr}
                        onChange={(e) => setForm({ ...form, costInr: Math.max(0, Number(e.target.value) || 0) })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand focus:border-brand text-gray-900"
                    />
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                        type="checkbox"
                        checked={form.active}
                        onChange={(e) => setForm({ ...form, active: e.target.checked })}
                        className="w-4 h-4 accent-brand"
                    />
                    Active (uncheck to hide from assignment dropdown)
                </label>

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
                        disabled={isPending}
                        className="px-4 py-2 text-sm font-bold text-white bg-brand rounded-lg hover:bg-brand/90 disabled:opacity-60 flex items-center gap-2"
                    >
                        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isEdit ? 'Save changes' : 'Create plan'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
