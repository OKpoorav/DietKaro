'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { useLeadSources } from '@/lib/hooks/use-lead-sources';
import { useLeadStatuses } from '@/lib/hooks/use-lead-statuses';
import { useCreateLead, useUpdateLead, type Lead, type LeadTemperature, type ReferralType } from '@/lib/hooks/use-leads';
import { toast } from 'sonner';

const REFERRAL_TYPES: { value: ReferralType; label: string }[] = [
    { value: 'existing_client', label: 'Existing Client' },
    { value: 'doctor', label: 'Doctor' },
    { value: 'gym_trainer', label: 'Gym Trainer' },
    { value: 'friend_family', label: 'Friend / Family' },
    { value: 'other', label: 'Other' },
];

interface LeadFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    lead?: Partial<Lead>;
}

type FormData = {
    name: string; primaryMobile: string; altMobile: string; email: string;
    age: string; gender: string; city: string; sourceId: string; reference: string;
    referralType: string; ownerUserId: string; statusId: string; temperature: LeadTemperature; notes: string;
};

const EMPTY: FormData = {
    name: '', primaryMobile: '', altMobile: '', email: '', age: '', gender: '',
    city: '', sourceId: '', reference: '', referralType: '', ownerUserId: '',
    statusId: '', temperature: 'warm', notes: '',
};

const INPUT = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500';

export function LeadFormModal({ isOpen, onClose, lead }: LeadFormModalProps) {
    const isEdit = !!lead?.id;
    const { data: sources = [] } = useLeadSources();
    const { data: statuses = [] } = useLeadStatuses();
    const createLead = useCreateLead();
    const updateLead = useUpdateLead(lead?.id ?? '');

    const [form, setForm] = useState<FormData>(EMPTY);

    useEffect(() => {
        if (!isOpen) return;
        if (lead) {
            setForm({
                name: lead.name ?? '',
                primaryMobile: lead.primaryMobile ?? '',
                altMobile: lead.altMobile ?? '',
                email: lead.email ?? '',
                age: lead.age?.toString() ?? '',
                gender: lead.gender ?? '',
                city: lead.city ?? '',
                sourceId: lead.sourceId ?? '',
                reference: lead.reference ?? '',
                referralType: lead.referralType ?? '',
                ownerUserId: lead.ownerUserId ?? '',
                statusId: lead.statusId ?? '',
                temperature: lead.temperature ?? 'warm',
                notes: lead.notes ?? '',
            });
        } else {
            setForm(EMPTY);
        }
    }, [isOpen, lead]);

    const set = (k: keyof FormData, v: string) => setForm((f) => ({ ...f, [k]: v }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload: Partial<Lead> = {
                name: form.name.trim(),
                primaryMobile: form.primaryMobile.trim(),
                altMobile: form.altMobile.trim() || undefined,
                email: form.email.trim() || undefined,
                age: form.age ? parseInt(form.age) : undefined,
                gender: (form.gender || undefined) as Lead['gender'],
                city: form.city.trim() || undefined,
                sourceId: form.sourceId || undefined,
                reference: form.reference.trim() || undefined,
                referralType: (form.referralType || undefined) as ReferralType | undefined,
                ownerUserId: form.ownerUserId || undefined,
                statusId: form.statusId || undefined,
                temperature: form.temperature,
                notes: form.notes.trim() || undefined,
            };

            if (isEdit) {
                await updateLead.mutateAsync(payload);
                toast.success('Lead updated');
            } else {
                await createLead.mutateAsync(payload);
                toast.success('Lead created');
            }
            onClose();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Something went wrong';
            toast.error(msg);
        }
    };

    const isPending = createLead.isPending || updateLead.isPending;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Lead' : 'Add Lead'} size="lg">
            <form onSubmit={handleSubmit} className="space-y-5 p-1">
                {/* Basic section */}
                <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Basic Info</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                            <input required value={form.name} onChange={(e) => set('name', e.target.value)}
                                className={INPUT} placeholder="Lead name" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Primary Mobile <span className="text-red-500">*</span></label>
                            <input required value={form.primaryMobile} onChange={(e) => set('primaryMobile', e.target.value)}
                                className={INPUT} placeholder="+91 XXXXX XXXXX" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Alt Mobile / WhatsApp</label>
                            <input value={form.altMobile} onChange={(e) => set('altMobile', e.target.value)}
                                className={INPUT} placeholder="Optional" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                                className={INPUT} placeholder="email@example.com" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                            <input value={form.city} onChange={(e) => set('city', e.target.value)}
                                className={INPUT} placeholder="City" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                            <input type="number" min={1} max={130} value={form.age} onChange={(e) => set('age', e.target.value)}
                                className={INPUT} placeholder="Age" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                            <select value={form.gender} onChange={(e) => set('gender', e.target.value)} className={INPUT}>
                                <option value="">Select</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Pipeline section */}
                <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Pipeline</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                            <select value={form.sourceId} onChange={(e) => set('sourceId', e.target.value)} className={INPUT}>
                                <option value="">None</option>
                                {sources.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Reference (Person)</label>
                            <input value={form.reference} onChange={(e) => set('reference', e.target.value)}
                                className={INPUT} placeholder="e.g. Dr. Mehta" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Referral Type</label>
                            <select value={form.referralType} onChange={(e) => set('referralType', e.target.value)} className={INPUT}>
                                <option value="">None</option>
                                {REFERRAL_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select value={form.statusId} onChange={(e) => set('statusId', e.target.value)} className={INPUT}>
                                <option value="">Default (New Lead)</option>
                                {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
                            <select value={form.temperature} onChange={(e) => set('temperature', e.target.value as LeadTemperature)} className={INPUT}>
                                <option value="hot">🔥 Hot</option>
                                <option value="warm">☀ Warm</option>
                                <option value="cold">❄ Cold</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Notes */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)}
                        className={`${INPUT} resize-none`}
                        placeholder="Any additional notes..." />
                </div>

                <div className="flex gap-2 pt-1">
                    <button type="button" onClick={onClose}
                        className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                        Cancel
                    </button>
                    <button type="submit" disabled={isPending}
                        className="flex-1 px-4 py-2 text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                        {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Lead'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
