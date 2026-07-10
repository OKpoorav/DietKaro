'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Copy, Trash2, Pencil, Check, X, MessageCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
    useCallNotes,
    useCreateCallNote,
    useUpdateCallNote,
    useDeleteCallNote,
    type CallNote,
} from '@/lib/hooks/use-call-notes';

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function waLink(phone: string, text: string): string {
    const digits = phone.replace(/[^\d]/g, '');
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function NoteRow({ note, clientId, clientPhone }: { note: CallNote; clientId: string; clientPhone?: string | null }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(note.content);
    const update = useUpdateCallNote(clientId);
    const del = useDeleteCallNote(clientId);

    const saveEdit = () => {
        const v = draft.trim();
        if (!v || v === note.content) { setEditing(false); setDraft(note.content); return; }
        update.mutate({ id: note.id, content: v }, { onSuccess: () => setEditing(false) });
    };

    if (editing) {
        return (
            <div className="rounded-lg border border-brand/40 bg-white p-2">
                <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={3}
                    autoFocus
                    className="w-full resize-y text-sm text-gray-800 outline-none"
                    onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditing(false); setDraft(note.content); } }}
                />
                <div className="flex justify-end gap-1 pt-1">
                    <button onClick={() => { setEditing(false); setDraft(note.content); }} className="p-1.5 text-gray-400 hover:text-gray-600 rounded"><X className="w-4 h-4" /></button>
                    <button onClick={saveEdit} disabled={update.isPending} className="p-1.5 text-brand hover:bg-brand/10 rounded"><Check className="w-4 h-4" /></button>
                </div>
            </div>
        );
    }

    return (
        <div className="group rounded-lg border border-gray-200 bg-white p-2.5 hover:border-gray-300 transition-colors">
            <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{note.content}</p>
            <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[11px] text-gray-400 truncate">
                    {note.creator?.fullName ? `${note.creator.fullName} · ` : ''}{timeAgo(note.createdAt)}
                </span>
                <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => { navigator.clipboard.writeText(note.content); toast.success('Note copied'); }}
                        className="p-1 text-gray-400 hover:text-gray-700 rounded" title="Copy"
                    ><Copy className="w-3.5 h-3.5" /></button>
                    {clientPhone && (
                        <a href={waLink(clientPhone, note.content)} target="_blank" rel="noopener noreferrer"
                            className="p-1 text-gray-400 hover:text-green-600 rounded" title="Share on WhatsApp"
                        ><MessageCircle className="w-3.5 h-3.5" /></a>
                    )}
                    <button onClick={() => setEditing(true)} className="p-1 text-gray-400 hover:text-brand rounded" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                    <button
                        onClick={() => { if (confirm('Delete this note?')) del.mutate(note.id); }}
                        className="p-1 text-gray-400 hover:text-red-500 rounded" title="Delete"
                    ><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
            </div>
        </div>
    );
}

interface CallNotesPanelProps {
    clientId: string;
    clientPhone?: string | null;
    autoFocus?: boolean;
    className?: string;
}

export function CallNotesPanel({ clientId, clientPhone, autoFocus, className = '' }: CallNotesPanelProps) {
    const { data: notes, isLoading } = useCallNotes(clientId);
    const create = useCreateCallNote(clientId);
    const [draft, setDraft] = useState('');
    const taRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => { if (autoFocus) taRef.current?.focus(); }, [autoFocus, clientId]);

    const add = () => {
        const v = draft.trim();
        if (!v) return;
        create.mutate(v, { onSuccess: () => { setDraft(''); taRef.current?.focus(); } });
    };

    return (
        <div className={`flex flex-col min-h-0 ${className}`}>
            {/* Composer */}
            <div className="flex-shrink-0">
                <textarea
                    ref={taRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') add(); }}
                    placeholder="Type a call note…"
                    rows={3}
                    className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[11px] text-gray-400">⌘↵ to save · saved to this client</span>
                    <button
                        onClick={add}
                        disabled={!draft.trim() || create.isPending}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:opacity-40"
                    >
                        {create.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Save note
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="mt-3 flex-1 min-h-0 space-y-2 overflow-y-auto">
                {isLoading ? (
                    <div className="flex justify-center py-6 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
                ) : notes && notes.length > 0 ? (
                    notes.map((n) => <NoteRow key={n.id} note={n} clientId={clientId} clientPhone={clientPhone} />)
                ) : (
                    <p className="py-6 text-center text-sm text-gray-400">No call notes yet. Jot the first one above.</p>
                )}
            </div>
        </div>
    );
}
