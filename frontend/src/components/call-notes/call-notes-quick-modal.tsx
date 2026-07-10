'use client';

import { useState } from 'react';
import { Search, X, ArrowLeft, NotebookPen, Loader2 } from 'lucide-react';
import { useClients, type Client } from '@/lib/hooks/use-clients';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { CallNotesPanel } from './call-notes-panel';

function initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

interface CallNotesQuickModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Dashboard "Call notes" quick-capture. A call comes in before you're on the
 * client's page — so this opens anywhere: search the client, then write. The
 * same note shows on the client profile and in the diet-plan builder.
 */
export function CallNotesQuickModal({ isOpen, onClose }: CallNotesQuickModalProps) {
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Client | null>(null);
    const debounced = useDebouncedValue(search, 250);
    const { data, isLoading } = useClients({ search: debounced || undefined, pageSize: 8 });
    const clients = data?.data ?? [];

    if (!isOpen) return null;

    const close = () => { setSearch(''); setSelected(null); onClose(); };

    return (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 p-4 pt-[8vh]" onClick={close}>
            <div
                className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <header className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
                    {selected && (
                        <button onClick={() => setSelected(null)} className="p-1 text-gray-400 hover:text-gray-700 rounded" title="Change client">
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                    )}
                    <NotebookPen className="w-4 h-4 text-brand" />
                    <h3 className="text-sm font-semibold text-gray-900">
                        {selected ? selected.fullName : 'Call notes'}
                    </h3>
                    <button onClick={close} className="ml-auto p-1 text-gray-400 hover:text-gray-700 rounded"><X className="w-4 h-4" /></button>
                </header>

                {!selected ? (
                    <>
                        <div className="p-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    autoFocus
                                    placeholder="Search a client to add a note…"
                                    className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                                />
                            </div>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                            {!debounced && <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Recent clients</p>}
                            {isLoading ? (
                                <div className="flex justify-center py-6 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
                            ) : clients.length > 0 ? (
                                <ul className="space-y-1">
                                    {clients.map((c) => (
                                        <li key={c.id}>
                                            <button
                                                onClick={() => setSelected(c)}
                                                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-gray-50"
                                            >
                                                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                                                    {initials(c.fullName)}
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="block truncate text-sm font-medium text-gray-900">{c.fullName}</span>
                                                    <span className="block truncate text-xs text-gray-400">{c.phone}</span>
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="py-6 text-center text-sm text-gray-400">No clients found.</p>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="min-h-0 flex-1 p-3">
                        <CallNotesPanel clientId={selected.id} clientPhone={selected.phone} autoFocus className="h-full" />
                    </div>
                )}
            </div>
        </div>
    );
}
