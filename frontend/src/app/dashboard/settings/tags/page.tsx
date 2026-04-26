'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Edit2, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '@/lib/hooks/use-permissions';
import {
    useTags,
    useCreateTag,
    useUpdateTag,
    useDeleteTag,
    TAG_COLORS,
    type ClientTag,
    type TagColor,
} from '@/lib/hooks/use-tags';
import { TagChip, getTagColorClasses } from '@/components/clients/tag-chip';

interface TagFormState {
    name: string;
    color: TagColor;
    keywordsText: string;
    active: boolean;
}

const EMPTY_FORM: TagFormState = {
    name: '',
    color: 'green',
    keywordsText: '',
    active: true,
};

function parseKeywords(text: string): string[] {
    return Array.from(
        new Set(
            text
                .split(',')
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean),
        ),
    );
}

export default function TagsAdminPage() {
    const permissions = usePermissions();
    const canManage = permissions.isAdmin || permissions.isOwner;

    const { data: tags, isLoading } = useTags();
    const createTag = useCreateTag();
    const updateTag = useUpdateTag();
    const deleteTag = useDeleteTag();

    const [editing, setEditing] = useState<ClientTag | null>(null);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState<TagFormState>(EMPTY_FORM);

    const startCreate = () => {
        setForm(EMPTY_FORM);
        setEditing(null);
        setCreating(true);
    };
    const startEdit = (tag: ClientTag) => {
        setEditing(tag);
        setCreating(false);
        setForm({
            name: tag.name,
            color: tag.color,
            keywordsText: tag.keywords.join(', '),
            active: tag.active,
        });
    };
    const cancelForm = () => {
        setEditing(null);
        setCreating(false);
        setForm(EMPTY_FORM);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const keywords = parseKeywords(form.keywordsText);
        try {
            if (editing) {
                await updateTag.mutateAsync({
                    id: editing.id,
                    name: form.name,
                    color: form.color,
                    keywords,
                    active: form.active,
                });
                toast.success(`Updated "${form.name}"`);
            } else {
                await createTag.mutateAsync({
                    name: form.name,
                    color: form.color,
                    keywords,
                });
                toast.success(`Created "${form.name}"`);
            }
            cancelForm();
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { error?: { message?: string } } } })
                    ?.response?.data?.error?.message ?? 'Save failed';
            toast.error(message);
        }
    };

    const handleDelete = async (tag: ClientTag) => {
        if (!confirm(`Delete "${tag.name}"? It will be removed from every client it's assigned to.`)) return;
        try {
            await deleteTag.mutateAsync(tag.id);
            toast.success('Tag deleted');
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { error?: { message?: string } } } })
                    ?.response?.data?.error?.message ?? 'Delete failed';
            toast.error(message);
        }
    };

    if (!canManage) {
        return (
            <div className="max-w-3xl mx-auto py-12 text-center">
                <h1 className="text-xl font-semibold text-gray-900 mb-2">Admin only</h1>
                <p className="text-gray-500 mb-6">Only admins or owners can manage client tags.</p>
                <Link href="/dashboard/settings" className="text-brand font-medium hover:underline">
                    Back to settings
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <Link
                        href="/dashboard/settings"
                        className="inline-flex items-center gap-1 text-sm text-[#4e9767] hover:text-[#0e1b12] transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to settings
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 mt-1">Client Tags</h1>
                    <p className="text-gray-500 mt-1">
                        Org-wide labels for things like medical conditions or fitness goals. Dietitians pick from this list when adding clients.
                    </p>
                </div>
                {!creating && !editing && (
                    <button
                        type="button"
                        onClick={startCreate}
                        className="inline-flex items-center gap-2 h-10 px-4 bg-brand hover:bg-brand/90 text-white rounded-lg text-sm font-bold transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        New Tag
                    </button>
                )}
            </div>

            {(creating || editing) && (
                <form
                    onSubmit={handleSubmit}
                    className="bg-white rounded-xl border border-gray-200 p-5 space-y-4"
                >
                    <h2 className="text-lg font-semibold text-gray-900">
                        {editing ? `Edit "${editing.name}"` : 'New tag'}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                            <input
                                type="text"
                                required
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand focus:border-brand text-gray-900"
                                placeholder="e.g. Weight Loss"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                            <div className="flex flex-wrap gap-2">
                                {TAG_COLORS.map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setForm({ ...form, color: c })}
                                        aria-label={`Pick ${c}`}
                                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-shadow ${getTagColorClasses(c)} ${
                                            form.color === c ? 'ring-2 ring-brand ring-offset-1' : ''
                                        }`}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Keywords for auto-suggest
                        </label>
                        <input
                            type="text"
                            value={form.keywordsText}
                            onChange={(e) => setForm({ ...form, keywordsText: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand focus:border-brand text-gray-900"
                            placeholder="lose weight, fat loss, cut, slim"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Comma-separated. When a new client&apos;s goal or medical conditions contain any of these (case-insensitive), this tag is pre-checked in the form.
                        </p>
                    </div>
                    {editing && (
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={form.active}
                                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                                className="w-4 h-4 accent-brand"
                            />
                            Active (uncheck to hide from the multi-select without deleting)
                        </label>
                    )}
                    <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={cancelForm}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createTag.isPending || updateTag.isPending}
                            className="px-4 py-2 text-sm font-bold text-white bg-brand rounded-lg hover:bg-brand/90 disabled:opacity-60 flex items-center gap-2"
                        >
                            {(createTag.isPending || updateTag.isPending) && (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            )}
                            {editing ? 'Save changes' : 'Create tag'}
                        </button>
                    </div>
                </form>
            )}

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-brand" />
                    </div>
                ) : (tags?.length ?? 0) === 0 ? (
                    <p className="text-gray-500 text-center py-12">No tags yet. Create the first one above.</p>
                ) : (
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tag</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Keywords</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {tags!.map((tag) => (
                                <tr key={tag.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-3">
                                        <TagChip name={tag.name} color={tag.color} size="md" />
                                    </td>
                                    <td className="px-6 py-3 text-sm text-gray-600 max-w-md">
                                        {tag.keywords.length === 0 ? (
                                            <span className="italic text-gray-400">No keywords (won&apos;t auto-suggest)</span>
                                        ) : (
                                            <span className="truncate">{tag.keywords.join(', ')}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-3">
                                        <span
                                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                                tag.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                                            }`}
                                        >
                                            {tag.active ? 'Active' : 'Hidden'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                type="button"
                                                onClick={() => startEdit(tag)}
                                                aria-label={`Edit ${tag.name}`}
                                                className="p-2 rounded text-gray-500 hover:text-brand hover:bg-brand/5 transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(tag)}
                                                aria-label={`Delete ${tag.name}`}
                                                className="p-2 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
