'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, Loader2, Tag } from 'lucide-react';
import { useTags, type ClientTag } from '@/lib/hooks/use-tags';
import { TagChip } from './tag-chip';

interface TagMultiSelectProps {
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    suggestedIds?: string[];
    disabled?: boolean;
    placeholder?: string;
    emptyHint?: string;
    className?: string;
}

export function TagMultiSelect({
    selectedIds,
    onChange,
    suggestedIds = [],
    disabled = false,
    placeholder = 'Add tags…',
    emptyHint = 'No tags exist yet — ask an admin to create them.',
    className = '',
}: TagMultiSelectProps) {
    const { data: tags, isLoading } = useTags();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');

    const tagsById = useMemo(() => {
        const map = new Map<string, ClientTag>();
        (tags ?? []).forEach((t) => map.set(t.id, t));
        return map;
    }, [tags]);

    const filtered = useMemo(() => {
        const list = (tags ?? []).filter((t) => t.active);
        const q = query.trim().toLowerCase();
        if (!q) return list;
        return list.filter((t) => t.name.toLowerCase().includes(q));
    }, [tags, query]);

    const toggle = (id: string) => {
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter((x) => x !== id));
        } else {
            onChange([...selectedIds, id]);
        }
    };

    const suggestedSet = useMemo(() => new Set(suggestedIds), [suggestedIds]);

    return (
        <div className={`relative ${className}`}>
            {/* Trigger row showing selected chips */}
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((v) => !v)}
                className="w-full min-h-[42px] flex items-center flex-wrap gap-1.5 px-3 py-2 border border-gray-200 rounded-lg bg-white hover:border-gray-300 focus:border-brand focus:ring-1 focus:ring-brand text-left disabled:opacity-60 disabled:cursor-not-allowed"
            >
                {selectedIds.length === 0 && (
                    <span className="flex items-center gap-2 text-sm text-gray-400">
                        <Tag className="w-4 h-4" />
                        {placeholder}
                    </span>
                )}
                {selectedIds.map((id) => {
                    const tag = tagsById.get(id);
                    if (!tag) return null;
                    return (
                        <TagChip
                            key={id}
                            name={tag.name}
                            color={tag.color}
                            size="sm"
                            onRemove={!disabled ? () => toggle(id) : undefined}
                        />
                    );
                })}
                <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />
            </button>

            {/* Dropdown */}
            {open && !disabled && (
                <>
                    <div
                        className="fixed inset-0 z-30"
                        onClick={() => setOpen(false)}
                        aria-hidden="true"
                    />
                    <div className="absolute z-40 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-64 overflow-hidden flex flex-col">
                        <div className="p-2 border-b border-gray-100">
                            <input
                                autoFocus
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search tags…"
                                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-4 text-gray-400">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                </div>
                            ) : filtered.length === 0 ? (
                                <p className="text-xs text-gray-400 italic text-center py-4 px-3">
                                    {(tags?.length ?? 0) === 0 ? emptyHint : 'No matches'}
                                </p>
                            ) : (
                                <ul className="py-1">
                                    {filtered.map((tag) => {
                                        const checked = selectedIds.includes(tag.id);
                                        const suggested = suggestedSet.has(tag.id);
                                        return (
                                            <li key={tag.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => toggle(tag.id)}
                                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 text-left"
                                                >
                                                    <span
                                                        className={`w-4 h-4 rounded border flex items-center justify-center ${
                                                            checked ? 'bg-brand border-brand text-white' : 'border-gray-300'
                                                        }`}
                                                    >
                                                        {checked && <Check className="w-3 h-3" />}
                                                    </span>
                                                    <TagChip name={tag.name} color={tag.color} size="sm" />
                                                    {suggested && !checked && (
                                                        <span className="ml-auto text-[10px] text-brand font-medium">
                                                            Suggested
                                                        </span>
                                                    )}
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
