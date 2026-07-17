'use client';

import { useState, useEffect } from 'react';
import { Pencil, Eye, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/modal';
import { useUpdateClient, type Client } from '@/lib/hooks/use-clients';
import { useExtractNotes, useApplyExtractedNotes, type NotesExtraction } from '@/lib/hooks/use-notes-extract';
import { ExtractVerifyModal } from '@/components/clients/extract-verify-modal';

interface EditNotesModalProps {
    client: Client;
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Standalone entry point for the client notes — same remarks field and
 * AI-extract flow as the Edit Client modal, without the rest of the form.
 */
export function EditNotesModal({ client, isOpen, onClose }: EditNotesModalProps) {
    const [remarks, setRemarks] = useState('');
    const updateClient = useUpdateClient();

    type NotesTab = 'edit' | 'view' | 'extract';
    const [notesTab, setNotesTab] = useState<NotesTab>('edit');
    const [extracted, setExtracted] = useState<NotesExtraction | null>(null);
    const [verifyOpen, setVerifyOpen] = useState(false);
    const extractMut = useExtractNotes(client.id);
    const applyMut = useApplyExtractedNotes(client.id);

    useEffect(() => {
        if (isOpen) {
            setRemarks(client.remarks || '');
            setNotesTab('edit');
        }
    }, [isOpen, client.remarks]);

    const wordCount = remarks.trim() ? remarks.trim().split(/\s+/).length : 0;
    const overLimit = wordCount > 400;

    const handleExtract = async () => {
        if (!remarks.trim()) {
            toast.error('Notes are empty — write or paste notes first.');
            return;
        }
        if (overLimit) {
            toast.error('Notes exceed 400 words. Trim before extracting.');
            return;
        }
        try {
            const result = await extractMut.mutateAsync(remarks);
            setExtracted(result);
            setVerifyOpen(true);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
            toast.error(msg ?? 'Extraction failed');
        }
    };

    const handleApplyExtracted = async (edited: NotesExtraction) => {
        try {
            const r = await applyMut.mutateAsync({ extracted: edited, notes: remarks });
            const parts: string[] = [];
            if (r.measurementsApplied.length) parts.push(`${r.measurementsApplied.length} measurement(s)`);
            if (r.labReportApplied) parts.push(`labs (${r.labReportApplied.derivedTags.length} tag${r.labReportApplied.derivedTags.length === 1 ? '' : 's'})`);
            if (r.clientFieldsUpdated.length) parts.push(`${r.clientFieldsUpdated.length} client field(s)`);
            if (r.clientReportName) parts.push(`report: ${r.clientReportName}`);
            toast.success(parts.length ? `Applied — ${parts.join(' · ')}` : 'Applied (no changes)');
            setVerifyOpen(false);
            setExtracted(null);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
            toast.error(msg ?? 'Failed to apply');
        }
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (overLimit) return;
        updateClient.mutate(
            { id: client.id, remarks },
            { onSuccess: () => onClose() },
        );
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title="Client Notes" size="md">
                <form onSubmit={handleSave} className="p-6 space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Internal Remarks
                            </label>
                            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs">
                                <button
                                    type="button"
                                    onClick={() => setNotesTab('edit')}
                                    className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors ${notesTab === 'edit' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <Pencil className="w-3 h-3" /> Edit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setNotesTab('view')}
                                    className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors ${notesTab === 'view' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <Eye className="w-3 h-3" /> View
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setNotesTab('extract')}
                                    className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors ${notesTab === 'extract' ? 'bg-white text-purple-600 shadow-sm' : 'text-purple-500 hover:text-purple-700'}`}
                                >
                                    <Sparkles className="w-3 h-3" /> Extract
                                </button>
                            </div>
                        </div>

                        {notesTab === 'edit' && (
                            <textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                rows={8}
                                autoFocus
                                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-brand focus:border-brand text-gray-900 resize-none ${
                                    overLimit ? 'border-red-300 focus:ring-red-300' : 'border-gray-200'
                                }`}
                                placeholder="Internal notes visible only to dietitians..."
                            />
                        )}

                        {notesTab === 'view' && (
                            <div className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 min-h-[180px] max-h-[320px] overflow-y-auto">
                                {remarks.trim() ? (
                                    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                                        {remarks}
                                    </p>
                                ) : (
                                    <p className="text-sm text-gray-400 italic">No notes yet. Switch to Edit to add some.</p>
                                )}
                            </div>
                        )}

                        {notesTab === 'extract' && (
                            <div className="w-full px-4 py-4 border border-purple-200 bg-purple-50/50 rounded-lg space-y-3">
                                <div className="flex items-start gap-2 text-xs text-gray-600">
                                    <Sparkles className="w-3.5 h-3.5 text-purple-600 mt-0.5 shrink-0" />
                                    <span>
                                        AI scans the notes and pulls out structured data — age, height, weight, lab values, body measurements, medical issues, family history, likes, dislikes, allergies, lifestyle. You confirm what to keep in the next step.
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleExtract}
                                    disabled={extractMut.isPending || !remarks.trim() || overLimit}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50"
                                >
                                    {extractMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                    {extractMut.isPending ? 'Extracting…' : 'Extract from notes'}
                                </button>
                            </div>
                        )}

                        <p className={`mt-1 text-xs ${overLimit ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                            {wordCount} / 400 words{overLimit ? ' — limit exceeded' : ''}
                        </p>
                    </div>

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
                            disabled={overLimit || updateClient.isPending}
                            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-brand rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-50"
                        >
                            {updateClient.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            Save Notes
                        </button>
                    </div>
                </form>
            </Modal>

            {extracted && (
                <ExtractVerifyModal
                    isOpen={verifyOpen}
                    onClose={() => setVerifyOpen(false)}
                    extracted={extracted}
                    onApply={handleApplyExtracted}
                    isApplying={applyMut.isPending}
                />
            )}
        </>
    );
}
