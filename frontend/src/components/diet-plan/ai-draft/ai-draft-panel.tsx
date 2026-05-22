'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAiMealPlanDraft, type MealPlanDraftResult } from '@/lib/hooks/use-ai-meal-plan-draft';
import { AiDraftPreviewModal } from './ai-draft-preview-modal';

interface AiDraftPanelProps {
    clientId: string | null;
    isOpen: boolean;
    onClose: () => void;
    onApply: (draft: MealPlanDraftResult) => void;
}

const PLACEHOLDER = `Day 1
  Breakfast (08:00): 1 katori poha, 1 cup chai
  Lunch (13:00): 2 roti, 1 katori dal, 1 katori bhindi sabzi, salad
  Snack: handful of almonds
  Dinner: 1 cup brown rice, 1 katori rajma, curd

Day 2
  ...`;

export function AiDraftPanel({ clientId, isOpen, onClose, onApply }: AiDraftPanelProps) {
    const [prompt, setPrompt] = useState('');
    const [draft, setDraft] = useState<MealPlanDraftResult | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const mutation = useAiMealPlanDraft();

    const reset = () => {
        setPrompt('');
        setDraft(null);
        setShowPreview(false);
        setErrorMessage(null);
        mutation.reset();
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const handleSubmit = async () => {
        if (!clientId) {
            toast.error('Select a client first');
            return;
        }
        if (prompt.trim().length < 10) {
            toast.error('Prompt is too short — describe at least one day of meals');
            return;
        }
        setErrorMessage(null);
        try {
            const result = await mutation.mutateAsync({ clientId, prompt: prompt.trim() });
            if (result.days.length === 0) {
                setErrorMessage('Could not detect any days in the prompt — try a clearer format with explicit "Day 1", "Day 2" headers.');
                return;
            }
            setDraft(result);
            setShowPreview(true);
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
                ?? 'AI draft failed — try a shorter prompt or retry.';
            setErrorMessage(message);
        }
    };

    const handleApply = (filtered: MealPlanDraftResult) => {
        onApply(filtered);
        setShowPreview(false);
        reset();
        onClose();
    };

    return (
        <>
            <Modal isOpen={isOpen && !showPreview} onClose={handleClose} title="AI Meal Plan Draft" size="lg">
                <div className="p-5 space-y-4">
                    <div className="rounded-md bg-brand/5 border border-brand/20 p-3">
                        <p className="text-xs text-gray-700 leading-relaxed">
                            Paste a free-form meal plan and the AI will:
                        </p>
                        <ul className="text-xs text-gray-600 mt-1.5 space-y-0.5 list-disc list-inside">
                            <li>Match foods to the database (case-insensitive)</li>
                            <li>Create new food items when no match exists</li>
                            <li>Block items the client is allergic / intolerant to</li>
                            <li>Use Indian household units (katori, cup, roti)</li>
                        </ul>
                        <p className="text-[11px] text-gray-500 mt-2">
                            ⚠ This will replace the current meal builder contents.
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Meal plan prose</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={PLACEHOLDER}
                            rows={14}
                            maxLength={8000}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md font-mono leading-snug focus:ring-1 focus:ring-brand focus:border-brand outline-none resize-y"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">
                            {prompt.length} / 8000 characters
                        </p>
                    </div>

                    {errorMessage && (
                        <div className="rounded-md bg-red-50 border border-red-200 p-3 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-red-700">Draft failed</p>
                                <p className="text-xs text-red-600 mt-0.5 leading-relaxed">{errorMessage}</p>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-2">
                        <button
                            onClick={handleClose}
                            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 rounded-md hover:bg-gray-100"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={mutation.isPending || prompt.trim().length < 10}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-brand text-white rounded-md hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {mutation.isPending ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Drafting…
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-3.5 h-3.5" />
                                    Generate draft
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Modal>

            <AiDraftPreviewModal
                isOpen={showPreview}
                onClose={() => setShowPreview(false)}
                draft={draft}
                onApply={handleApply}
            />
        </>
    );
}
