'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/modal';
import { User, Mail, Calendar, Target, AlertCircle, Goal, CalendarClock, FileText, Check, Flag, Tag, Send } from 'lucide-react';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { suggestTagIds, useSetClientTags, useTags } from '@/lib/hooks/use-tags';
import { TagMultiSelect } from '@/components/clients/tag-multiselect';
import { TagInput } from '@/components/ui/tag-input';
import { OnboardingLinkModal } from '@/components/modals/onboarding-link-modal';
import { useTeam } from '@/lib/hooks/use-team';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { toast } from 'sonner';

interface AddClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit?: (data: ClientFormData) => Promise<{ id: string } | void> | void;
    postCreateBehavior?: 'ask' | 'close';
}

interface ClientFormData {
    salutation: string;
    name: string;
    email?: string;
    phone: string;
    altPhone?: string;
    altPhoneRelation?: string;
    dateOfBirth: string;
    gender: string;
    height: string;
    weight: string;
    targetWeight: string;
    allergies: string;
    medicalConditions: string;
    dislikes: string[];
    likedFoods: string[];
    goal: string;
    goalDeadline: string;
    healthNotes: string;
    primaryDietitianId?: string;
    beforePhotoFiles?: { front?: File; side?: File; back?: File };
}

const INITIAL_FORM: ClientFormData = {
    salutation: '',
    name: '',
    email: '',
    phone: '',
    altPhone: '',
    altPhoneRelation: '',
    dateOfBirth: '',
    gender: '',
    height: '',
    weight: '',
    targetWeight: '',
    allergies: '',
    medicalConditions: '',
    dislikes: [],
    likedFoods: [],
    goal: '',
    goalDeadline: '',
    healthNotes: '',
    primaryDietitianId: '',
};

export function AddClientModal({ isOpen, onClose, onSubmit, postCreateBehavior = 'ask' }: AddClientModalProps) {
    const router = useRouter();
    const [formData, setFormData] = useState<ClientFormData>(INITIAL_FORM);
    const [step, setStep] = useState<'form' | 'next-action'>('form');
    const [submitting, setSubmitting] = useState(false);
    const [createdClientId, setCreatedClientId] = useState<string | null>(null);
    const [createdClientName, setCreatedClientName] = useState('');
    const [showOnboardingModal, setShowOnboardingModal] = useState(false);
    const [tagIds, setTagIds] = useState<string[]>([]);
    const [tagsTouched, setTagsTouched] = useState(false);
    const [beforePhotoFiles, setBeforePhotoFiles] = useState<{ front?: File; side?: File; back?: File }>({});

    const { data: tags } = useTags();
    const setClientTags = useSetClientTags();
    const { data: teamMembers = [] } = useTeam();
    const permissions = usePermissions();

    const suggestedTagIds = useMemo(
        () =>
            suggestTagIds(tags ?? [], {
                goal: formData.goal,
                medicalConditions: formData.medicalConditions
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
            }),
        [tags, formData.goal, formData.medicalConditions],
    );

    // Auto-fill suggestions until the user touches the multi-select.
    useEffect(() => {
        if (!tagsTouched) setTagIds(suggestedTagIds);
    }, [suggestedTagIds, tagsTouched]);

    // Reset internal state once the close animation finishes so a re-open is fresh.
    useEffect(() => {
        if (isOpen) return;
        const timer = setTimeout(() => {
            setFormData(INITIAL_FORM);
            setStep('form');
            setSubmitting(false);
            setCreatedClientId(null);
            setCreatedClientName('');
            setTagIds([]);
            setTagsTouched(false);
            setBeforePhotoFiles({});
        }, 200);
        return () => clearTimeout(timer);
    }, [isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleTagsChange = (next: string[]) => {
        setTagsTouched(true);
        setTagIds(next);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!onSubmit || submitting) return;
        setSubmitting(true);
        try {
            const submittedData = {
                ...formData,
                name: [formData.salutation, formData.name].filter(Boolean).join(' '),
                beforePhotoFiles: Object.keys(beforePhotoFiles).length > 0 ? beforePhotoFiles : undefined,
            };
            const result = await onSubmit(submittedData);
            const id = result && typeof result === 'object' && 'id' in result ? result.id : null;
            if (!id) return; // error path — caller surfaces a toast; modal stays on form

            if (tagIds.length > 0) {
                // Best-effort tag assignment; client is already created.
                setClientTags.mutate({ clientId: id, tagIds });
            }

            if (postCreateBehavior === 'close') {
                onClose();
                return;
            }
            setCreatedClientId(id);
            setCreatedClientName(formData.name);
            setStep('next-action');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateDietPlan = () => {
        if (!createdClientId) return;
        window.open(`/dashboard/diet-plans/new?clientId=${createdClientId}`, '_blank');
        onClose();
    };

    const title = step === 'form' ? 'Add New Client' : 'Client Added';

    return (
        <>
        <Modal isOpen={isOpen} onClose={onClose} title={title} size={step === 'form' ? 'lg' : 'md'}>
            {step === 'form' ? (
            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">

                {/* Basic Information */}
                <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Basic Information</p>
                    <div className="space-y-2.5">
                        {/* Row 1: Full Name | Email */}
                        <div className="grid grid-cols-2 gap-x-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
                                <div className="flex gap-1.5">
                                    <select
                                        name="salutation"
                                        value={formData.salutation}
                                        onChange={handleChange}
                                        className="border border-gray-200 rounded-lg px-2 py-2 text-sm text-gray-700 focus:ring-brand focus:border-brand bg-white shrink-0 w-20"
                                    >
                                        <option value="">—</option>
                                        <option value="Mr.">Mr.</option>
                                        <option value="Mrs.">Mrs.</option>
                                        <option value="Ms.">Ms.</option>
                                        <option value="Dr.">Dr.</option>
                                        <option value="Prof.">Prof.</option>
                                    </select>
                                    <div className="relative flex-1">
                                        <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            name="name"
                                            required
                                            value={formData.name}
                                            onChange={handleChange}
                                            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-brand focus:border-brand text-gray-900"
                                            placeholder="Enter full name"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-brand focus:border-brand text-gray-900"
                                        placeholder="email@example.com"
                                    />
                                </div>
                            </div>
                        </div>
                        {/* Row 2: Phone | DOB | Gender */}
                        <div className="grid grid-cols-3 gap-x-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Phone *</label>
                                <PhoneInput
                                    international
                                    defaultCountry="IN"
                                    value={formData.phone}
                                    onChange={(value) => setFormData({ ...formData, phone: value || '' })}
                                    className="phone-input-field"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Date of Birth</label>
                                <div className="relative">
                                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="date"
                                        name="dateOfBirth"
                                        value={formData.dateOfBirth}
                                        onChange={handleChange}
                                        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-brand focus:border-brand text-gray-900"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
                                <select
                                    name="gender"
                                    value={formData.gender}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-brand focus:border-brand text-gray-900"
                                >
                                    <option value="">Select gender</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                        </div>
                        {/* Row 3: Alt Phone | Relation */}
                        <div className="grid grid-cols-2 gap-x-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Alt. Phone <span className="text-gray-400 font-normal">(Optional)</span></label>
                                <PhoneInput
                                    international
                                    defaultCountry="IN"
                                    value={formData.altPhone}
                                    onChange={(value) => setFormData({ ...formData, altPhone: value || '' })}
                                    className="phone-input-field"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Relation <span className="text-gray-400 font-normal">(Optional)</span></label>
                                <input
                                    type="text"
                                    name="altPhoneRelation"
                                    value={formData.altPhoneRelation}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-brand focus:border-brand text-gray-900"
                                    placeholder="Spouse, Parent, Guardian…"
                                />
                            </div>
                        </div>
                        {/* Row 4: Assigned To (owner/admin only) */}
                        {permissions.canViewTeam && teamMembers.length > 0 && (
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Assigned To</label>
                                <select
                                    name="primaryDietitianId"
                                    value={formData.primaryDietitianId ?? ''}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-brand focus:border-brand text-gray-900"
                                >
                                    <option value="">Auto-assign (me)</option>
                                    {teamMembers.map((m) => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* Physical + Medical in one row */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                    <div>
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Physical</p>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Height cm</label>
                                <input type="number" name="height" value={formData.height} onChange={handleChange}
                                    className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:ring-brand focus:border-brand text-gray-900" placeholder="165" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Weight kg</label>
                                <input type="number" name="weight" value={formData.weight} onChange={handleChange}
                                    className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:ring-brand focus:border-brand text-gray-900" placeholder="70" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Target kg</label>
                                <input type="number" name="targetWeight" value={formData.targetWeight} onChange={handleChange}
                                    className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:ring-brand focus:border-brand text-gray-900" placeholder="65" />
                            </div>
                        </div>
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-orange-400" /> Medical
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Allergies</label>
                                <textarea name="allergies" value={formData.allergies} onChange={handleChange} rows={2}
                                    className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-brand focus:border-brand text-gray-900 resize-none"
                                    placeholder="Dairy, Peanuts…" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Conditions</label>
                                <textarea name="medicalConditions" value={formData.medicalConditions} onChange={handleChange} rows={2}
                                    className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-brand focus:border-brand text-gray-900 resize-none"
                                    placeholder="Diabetes, HTN…" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Preferences & Goals */}
                <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-1">
                        <Goal className="w-3 h-3 text-blue-400" /> Preferences &amp; Goals
                    </p>
                    <div className="space-y-2.5">
                        <div className="grid grid-cols-2 gap-x-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Food Dislikes</label>
                                <TagInput
                                    value={formData.dislikes}
                                    onChange={(tags) => setFormData({ ...formData, dislikes: tags })}
                                    placeholder="Type a food, press Enter…"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Food Likes</label>
                                <TagInput
                                    value={formData.likedFoods}
                                    onChange={(tags) => setFormData({ ...formData, likedFoods: tags })}
                                    placeholder="Type a food, press Enter…"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Goal</label>
                                <div className="relative">
                                    <Target className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input type="text" name="goal" value={formData.goal} onChange={handleChange}
                                        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-brand focus:border-brand text-gray-900"
                                        placeholder="e.g. Lose 10kg…" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Deadline</label>
                                <div className="relative">
                                    <CalendarClock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input type="date" name="goalDeadline" value={formData.goalDeadline} onChange={handleChange}
                                        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-brand focus:border-brand text-gray-900" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tags */}
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-brand" /> Tags
                        <span className="text-gray-400 font-normal ml-1">· auto-suggested from goal &amp; conditions</span>
                    </label>
                    <TagMultiSelect selectedIds={tagIds} onChange={handleTagsChange} suggestedIds={suggestedTagIds} />
                </div>

                {/* Notes */}
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Additional Notes</label>
                    <textarea name="healthNotes" value={formData.healthNotes} onChange={handleChange} rows={2}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-brand focus:border-brand text-gray-900 resize-none"
                        placeholder="Any extra information about the client…" />
                </div>

                {/* Before Photos */}
                <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">Before Photos <span className="text-gray-400 font-normal">(optional)</span></p>
                    <div className="grid grid-cols-3 gap-2.5">
                        {(['front', 'side', 'back'] as const).map((type) => (
                            <label key={type} className="flex flex-col items-center gap-1 cursor-pointer">
                                <div className={`w-full h-20 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden transition-colors ${beforePhotoFiles[type] ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 bg-gray-50 hover:border-brand/50'}`}>
                                    {beforePhotoFiles[type] ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={URL.createObjectURL(beforePhotoFiles[type]!)} alt={`${type} view`} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-lg text-gray-300">+</span>
                                    )}
                                </div>
                                <span className="text-[11px] text-gray-500 capitalize">{type}</span>
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) setBeforePhotoFiles((p) => ({ ...p, [type]: file }));
                                }} />
                            </label>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                    <button type="button" onClick={onClose} disabled={submitting}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-60">
                        Cancel
                    </button>
                    <button type="submit" disabled={submitting}
                        className="px-4 py-2 text-sm font-bold text-white bg-brand rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                        {submitting ? 'Adding…' : 'Add Client'}
                    </button>
                </div>
            </form>
            ) : (
                <div className="p-6 space-y-5">
                    <div className="flex flex-col items-center text-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center">
                            <Check className="w-6 h-6 text-brand" />
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
                            <Flag className="w-5 h-5 text-brand shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-gray-800">Create Diet Plan</p>
                                <p className="text-xs text-gray-500">Start building their plan now</p>
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-gray-100 hover:bg-gray-50 text-left transition-colors"
                        >
                            <Check className="w-5 h-5 text-gray-400 shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-gray-600">Done for now</p>
                                <p className="text-xs text-gray-400">You can do these later from the client page</p>
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
