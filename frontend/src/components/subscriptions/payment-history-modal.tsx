'use client';

import { Modal } from '@/components/ui/modal';
import { PaymentHistoryList } from './payment-history-list';

interface PaymentHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientId: string;
    clientName: string;
}

export function PaymentHistoryModal({ isOpen, onClose, clientId, clientName }: PaymentHistoryModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Payment history — ${clientName}`} size="md">
            <div className="p-6">
                <PaymentHistoryList clientId={clientId} maxHeight="60vh" asCard={false} />
                <div className="flex justify-end pt-4 border-t border-gray-100 mt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                        Close
                    </button>
                </div>
            </div>
        </Modal>
    );
}
