'use client';

import { Modal } from '@/components/ui/modal';
import { NotesContent } from './notes-content';
import type { NotesExtraction } from '@/lib/hooks/use-notes-extract';

interface NotesViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    notes: string | null | undefined;
    extracted?: NotesExtraction | null;
    title?: string;
}

export function NotesViewModal({ isOpen, onClose, notes, extracted, title = 'Internal Notes' }: NotesViewModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
            <div className="p-6">
                <NotesContent rawNotes={notes} extracted={extracted ?? null} density="comfortable" />
            </div>
        </Modal>
    );
}
