'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, Lock } from 'lucide-react';
import { useLeadStatuses, useCreateLeadStatus, useUpdateLeadStatus, useDeleteLeadStatus } from '@/lib/hooks/use-lead-statuses';
import { toast } from 'sonner';

const PRESET_COLORS = [
    '#6B7280', '#3B82F6', '#8B5CF6', '#10B981', '#EF4444',
    '#F59E0B', '#059669', '#9CA3AF', '#EC4899', '#14B8A6',
    '#F97316', '#06B6D4',
];

export default function LeadStatusesPage() {
    const { data: statuses = [], isLoading } = useLeadStatuses();
    const createStatus = useCreateLeadStatus();
    const updateStatus = useUpdateLeadStatus();
    const deleteStatus = useDeleteLeadStatus();

    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState('#6B7280');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('');

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        try {
            await createStatus.mutateAsync({ name: newName.trim(), color: newColor, sortOrder: statuses.length });
            toast.success('Status added');
            setNewName(''); setNewColor('#6B7280');
        } catch (err: unknown) {
            toast.error((err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed');
        }
    };

    const handleUpdate = async (id: string) => {
        try {
            await updateStatus.mutateAsync({ id, name: editName.trim(), color: editColor });
            toast.success('Updated');
            setEditingId(null);
        } catch (err: unknown) {
            toast.error((err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed');
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete status "${name}"?`)) return;
        try {
            await deleteStatus.mutateAsync(id);
            toast.success('Status deleted');
        } catch (err: unknown) {
            const code = (err as { response?: { data?: { error?: { code?: string; message?: string } } } })?.response?.data?.error;
            if (code?.code === 'STATUS_IN_USE') toast.error('Status has leads — reassign them first');
            else toast.error(code?.message ?? 'Failed to delete');
        }
    };

    return (
        <div className="max-w-2xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Lead Statuses</h1>
                <p className="text-sm text-gray-500 mt-1">Customise the stages in your lead pipeline. System statuses cannot be deleted.</p>
            </div>

            {/* Add new */}
            <form onSubmit={handleCreate} className="flex gap-2 items-end">
                <div className="flex-1">
                    <input value={newName} onChange={(e) => setNewName(e.target.value)}
                        placeholder="New status name..."
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-emerald-500 focus:border-emerald-500" />
                </div>
                <div className="flex gap-1.5 items-center">
                    {PRESET_COLORS.slice(0, 6).map((c) => (
                        <button key={c} type="button" onClick={() => setNewColor(c)}
                            className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                            style={{ backgroundColor: c, borderColor: newColor === c ? 'white' : 'transparent', outline: newColor === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }} />
                    ))}
                </div>
                <button type="submit" disabled={!newName.trim() || createStatus.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50">
                    <Plus className="w-4 h-4" /> Add
                </button>
            </form>

            {/* List */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center h-24">
                        <div className="w-6 h-6 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {statuses.map((s) => {
                            const isSystem = s.isSystemDefault || s.isSystemConverted;
                            return (
                                <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                                    {editingId === s.id ? (
                                        <div className="flex items-center gap-2 flex-1">
                                            <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                                                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500"
                                                readOnly={isSystem} />
                                            <div className="flex gap-1">
                                                {PRESET_COLORS.slice(0, 6).map((c) => (
                                                    <button key={c} type="button" onClick={() => setEditColor(c)}
                                                        className="w-5 h-5 rounded-full border-2"
                                                        style={{ backgroundColor: c, borderColor: editColor === c ? 'white' : 'transparent', outline: editColor === c ? `2px solid ${c}` : 'none', outlineOffset: '1px' }} />
                                                ))}
                                            </div>
                                            <button onClick={() => handleUpdate(s.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Check className="w-4 h-4" /></button>
                                            <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex-1 flex items-center gap-2">
                                                <span className="text-sm font-medium text-gray-800">{s.name}</span>
                                                {isSystem && (
                                                    <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                                        <Lock className="w-3 h-3" /> system
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => { setEditingId(s.id); setEditName(s.name); setEditColor(s.color); }}
                                                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                {!isSystem && (
                                                    <button onClick={() => handleDelete(s.id, s.name)}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
