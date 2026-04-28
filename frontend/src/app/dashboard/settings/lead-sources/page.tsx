'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { useLeadSources, useCreateLeadSource, useUpdateLeadSource, useDeleteLeadSource } from '@/lib/hooks/use-lead-sources';
import { toast } from 'sonner';

export default function LeadSourcesPage() {
    const { data: sources = [], isLoading } = useLeadSources();
    const createSource = useCreateLeadSource();
    const updateSource = useUpdateLeadSource();
    const deleteSource = useDeleteLeadSource();

    const [newName, setNewName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        try {
            await createSource.mutateAsync(newName.trim());
            toast.success('Source added');
            setNewName('');
        } catch (err: unknown) {
            toast.error((err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to create');
        }
    };

    const handleUpdate = async (id: string) => {
        try {
            await updateSource.mutateAsync({ id, name: editName.trim() });
            toast.success('Updated');
            setEditingId(null);
        } catch {
            toast.error('Failed to update');
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete source "${name}"?`)) return;
        try {
            await deleteSource.mutateAsync(id);
            toast.success('Source deleted');
        } catch (err: unknown) {
            const code = (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
            if (code === 'SOURCE_IN_USE') toast.error('Source has leads — reassign them first');
            else toast.error('Failed to delete');
        }
    };

    const handleToggle = async (id: string, active: boolean) => {
        try {
            await updateSource.mutateAsync({ id, active: !active });
        } catch {
            toast.error('Failed to update');
        }
    };

    return (
        <div className="max-w-2xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Lead Sources</h1>
                <p className="text-sm text-gray-500 mt-1">Manage where your leads come from.</p>
            </div>

            {/* Add new */}
            <form onSubmit={handleCreate} className="flex gap-2">
                <input value={newName} onChange={(e) => setNewName(e.target.value)}
                    placeholder="New source name..."
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-emerald-500 focus:border-emerald-500" />
                <button type="submit" disabled={!newName.trim() || createSource.isPending}
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
                ) : sources.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-8">No sources yet</p>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {sources.map((s) => (
                            <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                                {editingId === s.id ? (
                                    <div className="flex items-center gap-2 flex-1">
                                        <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                                            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500"
                                            onKeyDown={(e) => { if (e.key === 'Escape') setEditingId(null); }} />
                                        <button onClick={() => handleUpdate(s.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Check className="w-4 h-4" /></button>
                                        <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex-1 flex items-center gap-2">
                                            <span className={`text-sm font-medium ${s.active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{s.name}</span>
                                            {s.isSystem && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">default</span>}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => handleToggle(s.id, s.active)}
                                                className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${s.active ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'}`}>
                                                {s.active ? 'Active' : 'Inactive'}
                                            </button>
                                            <button onClick={() => { setEditingId(s.id); setEditName(s.name); }}
                                                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(s.id, s.name)}
                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
