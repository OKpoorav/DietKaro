'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Send, Flag } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { useConvertLead, type Lead } from '@/lib/hooks/use-leads';
import { useSubscriptionPlans } from '@/lib/hooks/use-subscription-plans';
import { OnboardingLinkModal } from '@/components/modals/onboarding-link-modal';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { toast } from 'sonner';

const SALUTATIONS = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Master'];

interface ConvertToClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    lead: Pick<Lead, 'id' | 'name' | 'primaryMobile' | 'email' | 'gender' | 'age' | 'city'>;
}

export function ConvertToClientModal({ isOpen, onClose, lead }: ConvertToClientModalProps) {
    const router = useRouter();
    const convertLead = useConvertLead(lead.id);
    const { data: plans = [] } = useSubscriptionPlans();
    const activePlans = plans.filter((p) => p.active);

    const [step, setStep] = useState<'form' | 'next-action'>('form');
    const [createdClientId, setCreatedClientId] = useState('');
    const [createdClientName, setCreatedClientName] = useState('');
    const [showOnboardingModal, setShowOnboardingModal] = useState(false);

    const [salutation, setSalutation] = useState('');
    const [fullName, setFullName] = useState(lead.name);
    const [email, setEmail] = useState(lead.email ?? '');
    const [phone, setPhone] = useState(lead.primaryMobile);
    const [gender, setGender] = useState(lead.gender ?? '');
    const [city, setCity] = useState(lead.city ?? '');
    const [subscriptionPlanId, setSubscriptionPlanId] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phone) { toast.error('Phone number is required'); return; }
        try {
            const result = await convertLead.mutateAsync({
                fullName: fullName.trim(),
                salutation: salutation || undefined,
                email: email.trim() || undefined,
                phone: phone.trim(),
                gender: (gender || undefined) as Lead['gender'],
                city: city.trim() || undefined,
                subscriptionPlanId: subscriptionPlanId || undefined,
            });
            if (result.alreadyConverted) {
                toast.info('Lead was already converted');
                onClose();
                router.push(`/dashboard/clients/${result.clientId}`);
                return;
            }
            setCreatedClientId(result.clientId);
            setCreatedClientName(fullName.trim());
            setStep('next-action');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Conversion failed';
            toast.error(msg);
        }
    };

    const handleCreateDietPlan = () => {
        if (!createdClientId) return;
        window.open(`/dashboard/diet-plans/new?clientId=${createdClientId}`, '_blank');
        onClose();
    };

    const handleViewClient = () => {
        router.push(`/dashboard/clients/${createdClientId}`);
        onClose();
    };

    const INPUT = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500';

    const title = step === 'form' ? 'Convert to Client' : 'Client Created';

    return (
        <>
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
            {step === 'form' ? (
                <form onSubmit={handleSubmit} className="space-y-4 p-1">
                    <p className="text-sm text-gray-500">
                        This will create a new client record from <strong>{lead.name}</strong> and mark the lead as Converted.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Salutation + Full Name */}
                        <div className="sm:col-span-2 flex gap-2">
                            <div className="w-28 flex-shrink-0">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Salutation</label>
                                <select value={salutation} onChange={(e) => setSalutation(e.target.value)} className={INPUT}>
                                    <option value="">—</option>
                                    {SALUTATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                                <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className={INPUT} />
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-red-500">*</span></label>
                            <PhoneInput
                                international
                                defaultCountry="IN"
                                value={phone}
                                onChange={(value) => setPhone(value || '')}
                                className="phone-input-field"
                            />
                        </div>

                        {/* Gender */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                            <select value={gender} onChange={(e) => setGender(e.target.value)} className={INPUT}>
                                <option value="">Select</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                            </select>
                        </div>

                        {/* City */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                            <input value={city} onChange={(e) => setCity(e.target.value)} className={INPUT} />
                        </div>

                        {/* Subscription Plan */}
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Assign Subscription Plan <span className="text-gray-400 font-normal">(optional)</span></label>
                            <select value={subscriptionPlanId} onChange={(e) => setSubscriptionPlanId(e.target.value)} className={INPUT}>
                                <option value="">No plan</option>
                                {activePlans.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} — ₹{Number(p.costInr).toLocaleString('en-IN')} / {p.intervalCount} {p.recurrenceUnit}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                        <button type="submit" disabled={convertLead.isPending}
                            className="flex-1 px-4 py-2 text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                            {convertLead.isPending ? 'Converting...' : 'Convert to Client'}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="p-6 space-y-5">
                    <div className="flex flex-col items-center text-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                            <Check className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-lg font-semibold text-gray-900">
                                {createdClientName || 'Client'} added!
                            </h3>
                            <p className="text-sm text-gray-500">What would you like to do next?</p>
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <button
                            type="button"
                            onClick={() => setShowOnboardingModal(true)}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-left transition-colors"
                        >
                            <Send className="w-5 h-5 text-emerald-600 shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-emerald-700">Send Onboarding Form</p>
                                <p className="text-xs text-emerald-600/80">Client fills in their details via a link</p>
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={handleCreateDietPlan}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-gray-200 hover:bg-gray-50 text-left transition-colors"
                        >
                            <Flag className="w-5 h-5 text-emerald-600 shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-gray-800">Create Diet Plan</p>
                                <p className="text-xs text-gray-500">Start building their plan now</p>
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={handleViewClient}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-gray-100 hover:bg-gray-50 text-left transition-colors"
                        >
                            <Check className="w-5 h-5 text-gray-400 shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-gray-600">View Client</p>
                                <p className="text-xs text-gray-400">Go to the client page</p>
                            </div>
                        </button>
                    </div>
                </div>
            )}
        </Modal>

        {showOnboardingModal && createdClientId && (
            <OnboardingLinkModal
                isOpen={showOnboardingModal}
                onClose={() => setShowOnboardingModal(false)}
                clientId={createdClientId}
                clientName={createdClientName}
            />
        )}
    </>
    );
}
