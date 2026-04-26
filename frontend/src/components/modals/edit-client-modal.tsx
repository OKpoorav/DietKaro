'use client';

import { useState, useEffect, useMemo } from 'react';
import { Modal } from '@/components/ui/modal';
import { User, Mail, Calendar, Target, AlertCircle, Tag } from 'lucide-react';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import type { Client } from '@/lib/hooks/use-clients';
import { suggestTagIds, useTags } from '@/lib/hooks/use-tags';
import { TagMultiSelect } from '@/components/clients/tag-multiselect';

interface EditClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    client: Client;
    onSubmit: (data: EditClientFormData) => void;
    isLoading?: boolean;
}

export interface EditClientFormData {
    fullName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    gender: string;
    heightCm: string;
    currentWeightKg: string;
    targetWeightKg: string;
    allergies: string;
    medicalConditions: string;
    tagIds: string[];
}

export function EditClientModal({ isOpen, onClose, client, onSubmit, isLoading }: EditClientModalProps) {
    const [formData, setFormData] = useState<EditClientFormData>({
        fullName: '',
        email: '',
        phone: '',
        dateOfBirth: '',
        gender: '',
        heightCm: '',
        currentWeightKg: '',
        targetWeightKg: '',
        allergies: '',
        medicalConditions: '',
        tagIds: [],
    });

    const { data: tags } = useTags();

    useEffect(() => {
        if (isOpen && client) {
            setFormData({
                fullName: client.fullName || '',
                email: client.email || '',
                phone: client.phone || '',
                dateOfBirth: client.dateOfBirth ? client.dateOfBirth.split('T')[0] : '',
                gender: client.gender || '',
                heightCm: client.heightCm ? String(client.heightCm) : '',
                currentWeightKg: client.currentWeightKg ? String(client.currentWeightKg) : '',
                targetWeightKg: client.targetWeightKg ? String(client.targetWeightKg) : '',
                allergies: (client.medicalProfile?.allergies ?? client.allergies ?? []).join(', '),
                medicalConditions: (client.medicalProfile?.conditions ?? client.medicalConditions ?? []).join(', '),
                tagIds: client.tagAssignments?.map((a) => a.tagId) ?? [],
            });
        }
    }, [isOpen, client]);

    const suggestedTagIds = useMemo(
        () =>
            suggestTagIds(tags ?? [], {
                goal: client.goal,
                medicalConditions: formData.medicalConditions
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
            }),
        [tags, client.goal, formData.medicalConditions],
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Client" size="lg">
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
                                    name="fullName"
                                    required
                                    value={formData.fullName}
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
                                name="heightCm"
                                value={formData.heightCm}
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
                                name="currentWeightKg"
                                value={formData.currentWeightKg}
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
                                    name="targetWeightKg"
                                    value={formData.targetWeightKg}
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

                {/* Tags */}
                <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <Tag className="w-4 h-4 text-brand" />
                        Tags
                    </h3>
                    <TagMultiSelect
                        selectedIds={formData.tagIds}
                        onChange={(tagIds) => setFormData({ ...formData, tagIds })}
                        suggestedIds={suggestedTagIds}
                    />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-4 py-2.5 text-sm font-bold text-white bg-brand rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-60"
                    >
                        {isLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
