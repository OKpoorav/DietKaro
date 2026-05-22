'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import {
    useMedicalConditions,
    useCreateMedicalCondition,
    useUpdateMedicalCondition,
    useDeleteMedicalCondition,
} from '@/lib/hooks/use-medical-conditions';
import { toast } from 'sonner';

export default function MedicalConditionsPage() {
    const { data: conditions = [], isLoading } = useMedicalConditions();
    const createCondition = useCreateMedicalCondition();
    const updateCondition = useUpdateMedicalCondition();
    const deleteCondition = useDeleteMedicalCondition();

    const [newName, setNewName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        try {
            await createCondition.mutateAsync(newName.trim());
            toast.success('Condition added');
            setNewName('');
        } catch (err: unknown) {
            toast.error((err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to create');
        }
    };

    const handleUpdate = async (id: string) => {
        try {
            await updateCondition.mutateAsync({ id, name: editName.trim() });
            toast.success('Updated');
            setEditingId(null);
        } catch {
            toast.error('Failed to update');
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete condition "${name}"?`)) return;
        try {
            await deleteCondition.mutateAsync(id);
            toast.success('Condition deleted');
        } catch {
            toast.error('Failed to delete');
        }
    };

    const handleToggle = async (id: string, active: boolean) => {
        try {
            await updateCondition.mutateAsync({ id, active: !active });
        } catch {
            toast.error('Failed to update');
        }
    };

    return (
        <div className="max-w-2xl space-y-6 p-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Medical Conditions</h1>
                <p className="text-sm text-gray-500 mt-1">Manage the master list of medical conditions available across client forms.</p>
            </div>

            <form onSubmit={handleCreate} className="flex gap-2">
                <input value={newName} onChange={(e) => setNewName(e.target.value)}
                    placeholder="New condition name..."
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-emerald-500 focus:border-emerald-500" />
                <button type="submit" disabled={!newName.trim() || createCondition.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50">
                    <Plus className="w-4 h-4" /> Add
                </button>
            </form>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center h-24">
                        <div className="w-6 h-6 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : conditions.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-8">No conditions yet</p>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {conditions.map((c) => (
                            <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                                {editingId === c.id ? (
                                    <div className="flex items-center gap-2 flex-1">
                                        <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                                            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500"
                                            onKeyDown={(e) => { if (e.key === 'Escape') setEditingId(null); }} />
                                        <button onClick={() => handleUpdate(c.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Check className="w-4 h-4" /></button>
                                        <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex-1 flex items-center gap-2">
                                            <span className={`text-sm font-medium ${c.active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{c.name}</span>
                                            {c.isSystem && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">default</span>}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => handleToggle(c.id, c.active)}
                                                className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${c.active ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'}`}>
                                                {c.active ? 'Active' : 'Inactive'}
                                            </button>
                                            <button onClick={() => { setEditingId(c.id); setEditName(c.name); }}
                                                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(c.id, c.name)}
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
