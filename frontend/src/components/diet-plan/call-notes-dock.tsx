'use client';

import { useState, useEffect } from 'react';
import { NotebookPen, ChevronRight } from 'lucide-react';
import { CallNotesPanel } from '@/components/call-notes/call-notes-panel';

interface CallNotesDockProps {
    clientId: string;
    clientName?: string;
    clientPhone?: string | null;
    defaultOpen?: boolean;
}

/**
 * Right-edge call-notes dock for the diet-plan builder. Open by default so
 * notes are in view while planning; collapses to a thin vertical tab. Reflows
 * the builder because it's a flex sibling of the main area, not an overlay.
 * Press "N" (when not typing) to toggle and focus.
 */
export function CallNotesDock({ clientId, clientName, clientPhone, defaultOpen = true }: CallNotesDockProps) {
    const [open, setOpen] = useState(defaultOpen);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey) return;
            const t = e.target as HTMLElement | null;
            if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
            if (t?.isContentEditable) return;
            e.preventDefault();
            setOpen((o) => !o);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="flex-shrink-0 w-10 border-l border-gray-200 bg-white hover:bg-gray-50 flex flex-col items-center gap-2 pt-4 text-gray-500 hover:text-brand transition-colors"
                title="Open call notes (N)"
            >
                <NotebookPen className="w-4 h-4" />
                <span className="text-[11px] font-semibold tracking-wide [writing-mode:vertical-rl] rotate-180">Call notes</span>
            </button>
        );
    }

    return (
        <aside className="flex-shrink-0 w-[320px] border-l border-gray-200 bg-white flex flex-col min-h-0">
            <header className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 flex-shrink-0">
                <NotebookPen className="w-4 h-4 text-brand" />
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-tight">Call notes</p>
                    {clientName && <p className="text-[11px] text-gray-400 truncate leading-tight">{clientName}</p>}
                </div>
                <button
                    onClick={() => setOpen(false)}
                    className="ml-auto p-1 text-gray-400 hover:text-gray-700 rounded"
                    title="Collapse (N)"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </header>
            <CallNotesPanel clientId={clientId} clientPhone={clientPhone} autoFocus className="flex-1 p-3" />
        </aside>
    );
}
