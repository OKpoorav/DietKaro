'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';

interface BulkPortionModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentCalories: number;
    onApply: (factor: number, scope: 'meal' | 'day' | 'plan') => void;
}

export function BulkPortionModal({ isOpen, onClose, currentCalories, onApply }: BulkPortionModalProps) {
    const [percent, setPercent] = useState(0);
    const [scope, setScope] = useState<'meal' | 'day' | 'plan'>('day');

    const factor = 1 + percent / 100;
    const newCalories = Math.round(currentCalories * factor);

    const handleApply = () => {
        onApply(factor, scope);
        onClose();
        setPercent(0);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Adjust Portions" size="sm">
            <div className="p-5 space-y-5">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Adjustment: <span className="font-bold text-gray-900">{percent > 0 ? '+' : ''}{percent}%</span>
                    </label>
                    <input
                        type="range"
                        min={-50}
                        max={50}
                        step={5}
                        value={percent}
                        onChange={e => setPercent(parseInt(e.target.value))}
                        className="w-full accent-brand"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>-50%</span>
                        <span>0%</span>
                        <span>+50%</span>
                    </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                    <p className="text-gray-500">Current day: <span className="font-medium text-gray-800">{currentCalories} kcal</span></p>
                    <p className="text-gray-500">After adjustment: <span className="font-bold text-gray-900">{newCalories} kcal</span></p>
                </div>

                <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Apply to:</p>
                    <div className="flex gap-2">
                        {(['day', 'plan'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setScope(s)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                                    scope === s
                                        ? 'bg-brand text-white border-brand'
                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                {s === 'day' ? 'This Day' : 'Entire Plan'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
                    <button
                        onClick={handleApply}
                        disabled={percent === 0}
                        className="px-4 py-2 text-sm font-medium text-white bg-brand hover:bg-brand/90 rounded-lg disabled:opacity-50"
                    >
                        Apply
                    </button>
                </div>
            </div>
        </Modal>
    );
}
