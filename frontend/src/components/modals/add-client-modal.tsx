'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/modal';
import { User, Mail, Calendar, Target, AlertCircle, ThumbsDown, Goal, CalendarClock, FileText, Check, Flag, Tag } from 'lucide-react';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { suggestTagIds, useSetClientTags, useTags } from '@/lib/hooks/use-tags';
import { TagMultiSelect } from '@/components/clients/tag-multiselect';

interface AddClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit?: (data: ClientFormData) => Promise<{ id: string } | void> | void;
    postCreateBehavior?: 'ask' | 'close';
}

interface ClientFormData {
    name: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    gender: string;
    height: string;
    weight: string;
    targetWeight: string;
    allergies: string;
    medicalConditions: string;
    dislikes: string;
    goal: string;
    goalDeadline: string;
    healthNotes: string;
}

const INITIAL_FORM: ClientFormData = {
    name: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    height: '',
    weight: '',
    targetWeight: '',
    allergies: '',
    medicalConditions: '',
    dislikes: '',
    goal: '',
    goalDeadline: '',
    healthNotes: '',
};

export function AddClientModal({ isOpen, onClose, onSubmit, postCreateBehavior = 'ask' }: AddClientModalProps) {
    const router = useRouter();
    const [formData, setFormData] = useState<ClientFormData>(INITIAL_FORM);
    const [step, setStep] = useState<'form' | 'next-action'>('form');
    const [submitting, setSubmitting] = useState(false);
    const [createdClientId, setCreatedClientId] = useState<string | null>(null);
    const [createdClientName, setCreatedClientName] = useState('');
    const [tagIds, setTagIds] = useState<string[]>([]);
    const [tagsTouched, setTagsTouched] = useState(false);

    const { data: tags } = useTags();
    const setClientTags = useSetClientTags();

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
            const result = await onSubmit(formData);
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
        router.push(`/dashboard/diet-plans/new?clientId=${createdClientId}`);
        onClose();
    };

    const title = step === 'form' ? 'Add New Client' : 'Client Added';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size={step === 'form' ? 'lg' : 'md'}>
            {step === 'form' ? (
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                        Basic Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Full Name *
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-brand focus:border-brand text-gray-900"
                                    placeholder="Enter full name"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email Address *
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-brand focus:border-brand text-gray-900"
                                    placeholder="email@example.com"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Phone Number *
                            </label>
                            <PhoneInput
                                international
                                defaultCountry="IN"
                                value={formData.phone}
                                onChange={(value) => setFormData({ ...formData, phone: value || '' })}
                                className="phone-input-field"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Date of Birth
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="date"
                                    name="dateOfBirth"
                                    value={formData.dateOfBirth}
                                    onChange={handleChange}
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-brand focus:border-brand text-gray-900"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Gender
                            </label>
                            <select
                                name="gender"
                                value={formData.gender}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-brand focus:border-brand text-gray-900"
                            >
                                <option value="">Select gender</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Physical Info */}
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                        Physical Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Height (cm)
                            </label>
                            <input
                                type="number"
                                name="height"
                                value={formData.height}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-brand focus:border-brand text-gray-900"
                                placeholder="165"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Current Weight (kg)
                            </label>
                            <input
                                type="number"
                                name="weight"
                                value={formData.weight}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-brand focus:border-brand text-gray-900"
                                placeholder="70"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Target Weight (kg)
                            </label>
                            <div className="relative">
                                <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="number"
                                    name="targetWeight"
                                    value={formData.targetWeight}
                                    onChange={handleChange}
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-brand focus:border-brand text-gray-900"
                                    placeholder="65"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Medical Info */}
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-orange-500" />
                        Medical Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Allergies
                            </label>
                            <textarea
                                name="allergies"
                                value={formData.allergies}
                                onChange={handleChange}
                                rows={3}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-brand focus:border-brand text-gray-900"
                                placeholder="Dairy, Peanuts, Shellfish..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Medical Conditions
                            </label>
                            <textarea
                                name="medicalConditions"
                                value={formData.medicalConditions}
                                onChange={handleChange}
                                rows={3}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-brand focus:border-brand text-gray-900"
                                placeholder="Diabetes, Hypertension..."
                            />
                        </div>
                    </div>
                </div>

                {/* Preferences & Goals */}
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <Goal className="w-4 h-4 text-blue-500" />
                        Preferences & Goals
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Food Dislikes
                            </label>
                            <textarea
                                name="dislikes"
                                value={formData.dislikes}
                                onChange={handleChange}
                                rows={3}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-brand focus:border-brand text-gray-900"
                                placeholder="Bitter gourd, Broccoli, Tofu..."
                            />
                            <p className="mt-1 text-xs text-gray-400">Comma-separated list of foods the client dislikes</p>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Goal
                                </label>
                                <div className="relative">
                                    <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        name="goal"
                                        value={formData.goal}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-brand focus:border-brand text-gray-900"
                                        placeholder="e.g. Lose 10kg, Manage diabetes..."
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Goal Deadline
                                </label>
                                <div className="relative">
                                    <CalendarClock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="date"
                                        name="goalDeadline"
                                        value={formData.goalDeadline}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-brand focus:border-brand text-gray-900"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Additional Notes
                        </label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                            <textarea
                                name="healthNotes"
                                value={formData.healthNotes}
                                onChange={handleChange}
                                rows={3}
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-brand focus:border-brand text-gray-900"
                                placeholder="Any extra information about the client..."
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                            <Tag className="w-4 h-4 text-brand" />
                            Tags
                        </label>
                        <TagMultiSelect
                            selectedIds={tagIds}
                            onChange={handleTagsChange}
                            suggestedIds={suggestedTagIds}
                        />
                        <p className="mt-1 text-xs text-gray-400">
                            Suggestions are pre-checked from goal &amp; medical conditions. Adjust as needed.
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="px-4 py-2.5 text-sm font-bold text-white bg-brand rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {submitting ? 'Adding…' : 'Add Client'}
                    </button>
                </div>
            </form>
            ) : (
                <div className="p-6 space-y-6">
                    <div className="flex flex-col items-center text-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center">
                            <Check className="w-6 h-6 text-brand" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-lg font-semibold text-gray-900">
                                {createdClientName || 'Client'} added
                            </h3>
                            <p className="text-sm text-gray-600">
                                Create a diet plan now to get them started, or do it later from the client page.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Later
                        </button>
                        <button
                            type="button"
                            onClick={handleCreateDietPlan}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-brand rounded-lg hover:bg-brand/90 transition-colors"
                        >
                            <Flag className="w-4 h-4" />
                            Create Diet Plan
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
