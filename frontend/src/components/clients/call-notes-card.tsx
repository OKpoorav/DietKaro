'use client';

import { NotebookPen } from 'lucide-react';
import { CallNotesPanel } from '@/components/call-notes/call-notes-panel';

/** Call Notes section for the client profile — same notes as the builder dock. */
export function CallNotesCard({ clientId, clientPhone }: { clientId: string; clientPhone?: string | null }) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
                <NotebookPen className="h-4 w-4 text-brand" />
                <h3 className="text-sm font-semibold text-gray-900">Call Notes</h3>
            </div>
            <CallNotesPanel clientId={clientId} clientPhone={clientPhone} className="max-h-[440px]" />
        </div>
    );
}
