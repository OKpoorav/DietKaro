'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/modal';
import { useConvertLead, type Lead } from '@/lib/hooks/use-leads';
import { toast } from 'sonner';

interface ConvertToClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    lead: Pick<Lead, 'id' | 'name' | 'primaryMobile' | 'email' | 'gender' | 'age' | 'city'>;
}

export function ConvertToClientModal({ isOpen, onClose, lead }: ConvertToClientModalProps) {
    const router = useRouter();
    const convertLead = useConvertLead(lead.id);
    const [fullName, setFullName] = useState(lead.name);
    const [email, setEmail] = useState(lead.email ?? '');
    const [phone, setPhone] = useState(lead.primaryMobile);
    const [gender, setGender] = useState(lead.gender ?? '');
    const [city, setCity] = useState(lead.city ?? '');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const result = await convertLead.mutateAsync({
                fullName: fullName.trim(),
                email: email.trim(),
                phone: phone.trim(),
                gender: (gender || undefined) as Lead['gender'],
                city: city.trim() || undefined,
            });
            if (result.alreadyConverted) {
                toast.info('Lead was already converted');
            } else {
                toast.success('Lead converted to client successfully');
            }
            onClose();
            router.push(`/dashboard/clients/${result.clientId}`);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Conversion failed';
            toast.error(msg);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Convert to Client" size="md">
            <form onSubmit={handleSubmit} className="space-y-4 p-1">
                <p className="text-sm text-gray-500">
                    This will create a new client record from <strong>{lead.name}</strong> and mark the lead as Converted.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                        <input required value={fullName} onChange={(e) => setFullName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-red-500">*</span></label>
                        <input required value={phone} onChange={(e) => setPhone(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                        <select value={gender} onChange={(e) => setGender(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500">
                            <option value="">Select</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                        <input value={city} onChange={(e) => setCity(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500" />
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
        </Modal>
    );
}
