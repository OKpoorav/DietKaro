'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { useProposalTemplate, useUpdateProposalTemplate, type ProposalTemplate } from '@/lib/hooks/use-proposal-template';
import { toast } from 'sonner';

type CustomField = { label: string; sortOrder: number };

export default function ProposalTemplatePage() {
    const { data: template, isLoading } = useProposalTemplate();
    const updateTemplate = useUpdateProposalTemplate();

    const [headerCopy, setHeaderCopy] = useState('');
    const [footerNote, setFooterNote] = useState('');
    const [signatureLine, setSignatureLine] = useState('');
    const [customFields, setCustomFields] = useState<CustomField[]>([]);
    const [newField, setNewField] = useState('');
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        if (!template) return;
        setHeaderCopy(template.headerCopy ?? '');
        setFooterNote(template.footerNote ?? '');
        setSignatureLine(template.signatureLine ?? '');
        setCustomFields(template.customFields ?? []);
    }, [template]);

    const mark = () => setDirty(true);

    const addField = () => {
        if (!newField.trim()) return;
        setCustomFields((prev) => [...prev, { label: newField.trim(), sortOrder: prev.length }]);
        setNewField('');
        mark();
    };

    const removeField = (idx: number) => {
        setCustomFields((prev) => prev.filter((_, i) => i !== idx).map((f, i) => ({ ...f, sortOrder: i })));
        mark();
    };

    const handleSave = async () => {
        try {
            await updateTemplate.mutateAsync({
                headerCopy: headerCopy.trim() || null,
                footerNote: footerNote.trim() || null,
                signatureLine: signatureLine.trim() || null,
                customFields,
            });
            toast.success('Template saved');
            setDirty(false);
        } catch {
            toast.error('Failed to save template');
        }
    };

    const orgName = 'Your Org';

    if (isLoading) {
        return <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" /></div>;
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Editor */}
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Proposal Template</h1>
                    <p className="text-sm text-gray-500 mt-1">Configure the proposal shared with leads. PDFs are generated in-browser.</p>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Header Copy</label>
                        <input value={headerCopy} onChange={(e) => { setHeaderCopy(e.target.value); mark(); }}
                            placeholder={orgName}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-emerald-500 focus:border-emerald-500" />
                        <p className="text-xs text-gray-400 mt-1">Shown at the top of the proposal. Defaults to your org name.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Custom Line Items</label>
                        <p className="text-xs text-gray-400 mb-3">Labels for plan details (e.g. &ldquo;Includes 2 consultations / week&rdquo;). Values are filled per-proposal.</p>
                        <div className="space-y-2 mb-3">
                            {customFields.map((f, i) => (
                                <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                                    <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                                    <span className="flex-1 text-sm text-gray-700">{f.label}</span>
                                    <button onClick={() => removeField(i)} className="p-1 text-gray-400 hover:text-red-500">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input value={newField} onChange={(e) => setNewField(e.target.value)}
                                placeholder="e.g. Includes 2 consultations / week"
                                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-emerald-500 focus:border-emerald-500"
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addField(); } }} />
                            <button onClick={addField} disabled={!newField.trim()}
                                className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl disabled:opacity-40">
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Footer Note</label>
                        <textarea rows={3} value={footerNote} onChange={(e) => { setFooterNote(e.target.value); mark(); }}
                            placeholder="e.g. Prices are subject to change. Contact us for queries."
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:ring-emerald-500 focus:border-emerald-500" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Signature Line</label>
                        <input value={signatureLine} onChange={(e) => { setSignatureLine(e.target.value); mark(); }}
                            placeholder="e.g. Dr. Sharma — Lead Dietitian"
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-emerald-500 focus:border-emerald-500" />
                    </div>

                    <button onClick={handleSave} disabled={!dirty || updateTemplate.isPending}
                        className="w-full px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                        {updateTemplate.isPending ? 'Saving...' : 'Save Template'}
                    </button>
                </div>
            </div>

            {/* Live preview */}
            <div className="space-y-4">
                <h2 className="text-sm font-semibold text-gray-700">Preview</h2>
                <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-6 text-sm font-sans space-y-4">
                    <div className="border-b-2 border-emerald-600 pb-3">
                        <h2 className="text-lg font-bold text-gray-900">{headerCopy || orgName}</h2>
                        <p className="text-xs text-gray-500">Personalised Nutrition Proposal</p>
                    </div>
                    <div className="space-y-1">
                        <p className="font-semibold text-gray-700">Prepared for: <span className="font-normal">Lead Name</span></p>
                        <p className="text-gray-500 text-xs">Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                    </div>
                    <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                        <p className="font-semibold text-gray-800 text-sm">Plan: Example Plan (3 months)</p>
                        <p className="text-gray-700">Price: <strong>₹9,999</strong></p>
                        {customFields.map((f, i) => (
                            <p key={i} className="text-gray-600">{f.label}: <span className="italic text-gray-400">___</span></p>
                        ))}
                    </div>
                    {footerNote && <p className="text-xs text-gray-400 italic">{footerNote}</p>}
                    {signatureLine && (
                        <div className="border-t border-gray-200 pt-3 text-xs text-gray-600 text-right">
                            {signatureLine}
                        </div>
                    )}
                </div>
                <p className="text-xs text-gray-400 text-center">Actual PDF is generated when sharing from the lead detail page.</p>
            </div>
        </div>
    );
}
