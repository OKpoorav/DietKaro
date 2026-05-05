'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import {
    useCreateFollowup,
    useUpdateFollowup,
    type FollowupOutcome,
    type LeadFollowup,
} from '@/lib/hooks/use-lead-followups';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────

type CallDirection = 'outgoing' | 'incoming' | '';
type CallResult = 'answered' | 'unanswered' | 'not_reachable' | 'callback' | 'meeting' | 'lost' | '';
type DatePreset = 'today' | 'tomorrow' | 'in2' | 'in3' | 'custom' | '';

interface FormData {
    type: 'call' | 'todo';
    direction: CallDirection;
    result: CallResult;
    // For todo dueAt (or call dueAt when no direction set yet)
    duePreset: DatePreset;
    dueDate: string;    // YYYY-MM-DD (custom only)
    dueTime: string;    // HH:MM
    // For callback scheduling
    callbackPreset: DatePreset;
    callbackDate: string;
    callbackTime: string;
    lostReason: string;
    notes: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function resultToOutcome(result: CallResult): FollowupOutcome | undefined {
    switch (result) {
        case 'answered': return 'answered';
        case 'unanswered': return 'unanswered';
        case 'not_reachable': return 'unanswered';
        case 'callback': return 'callback_requested';
        case 'meeting': return 'meeting_scheduled';
        case 'lost': return 'lost';
        default: return undefined;
    }
}

function dateFromPreset(preset: DatePreset, customDate: string): string {
    if (preset === 'custom') return customDate;
    const d = new Date();
    const off: Record<string, number> = { today: 0, tomorrow: 1, in2: 2, in3: 3 };
    d.setDate(d.getDate() + (off[preset as string] ?? 0));
    return d.toISOString().split('T')[0];
}

function toISO(dateStr: string, timeStr: string): string {
    if (!dateStr) return new Date().toISOString();
    const t = timeStr || '09:00';
    return new Date(`${dateStr}T${t}:00`).toISOString();
}

function nowTime(): string {
    return new Date().toTimeString().slice(0, 5);
}

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'tomorrow', label: 'Tomorrow' },
    { value: 'in2', label: 'In 2 days' },
    { value: 'in3', label: 'In 3 days' },
    { value: 'custom', label: 'Custom' },
];

const EMPTY_FORM: FormData = {
    type: 'call',
    direction: '',
    result: '',
    duePreset: 'today',
    dueDate: '',
    dueTime: nowTime(),
    callbackPreset: 'tomorrow',
    callbackDate: '',
    callbackTime: '09:00',
    lostReason: '',
    notes: '',
};

// ── Component ─────────────────────────────────────────────────────────────

interface AddFollowupModalProps {
    isOpen: boolean;
    onClose: () => void;
    leadId: string;
    followup?: LeadFollowup;
}

export function AddFollowupModal({ isOpen, onClose, leadId, followup }: AddFollowupModalProps) {
    const isEdit = !!followup;
    const createFollowup = useCreateFollowup(leadId);
    const updateFollowup = useUpdateFollowup(leadId);

    const [form, setForm] = useState<FormData>(EMPTY_FORM);

    useEffect(() => {
        if (!isOpen) return;
        if (followup) {
            // Reverse-map for edit mode
            setForm({
                ...EMPTY_FORM,
                type: followup.type === 'todo' ? 'todo' : 'call',
                direction: '',
                result: '',
                duePreset: 'custom',
                dueDate: followup.dueAt ? followup.dueAt.split('T')[0] : '',
                dueTime: followup.dueAt ? followup.dueAt.slice(11, 16) : '09:00',
                callbackPreset: followup.callbackAt ? 'custom' : 'tomorrow',
                callbackDate: followup.callbackAt ? followup.callbackAt.split('T')[0] : '',
                callbackTime: followup.callbackAt ? followup.callbackAt.slice(11, 16) : '09:00',
                lostReason: followup.lostReason ?? '',
                notes: followup.notes ?? '',
            });
        } else {
            setForm({ ...EMPTY_FORM, dueTime: nowTime() });
        }
    }, [isOpen, followup?.id]);

    const set = <K extends keyof FormData>(k: K, v: FormData[K]) =>
        setForm(prev => ({ ...prev, [k]: v }));

    const handleTypeChange = (t: 'call' | 'todo') => {
        setForm({ ...EMPTY_FORM, type: t, dueTime: nowTime() });
    };

    const handleDirectionChange = (d: CallDirection) => {
        setForm(prev => ({ ...prev, direction: d, result: '' }));
    };

    const handleResultChange = (r: CallResult) => {
        setForm(prev => ({ ...prev, result: r, lostReason: '' }));
    };

    const handleDuePreset = (p: DatePreset) => {
        setForm(prev => ({ ...prev, duePreset: p, dueDate: p !== 'custom' ? dateFromPreset(p, '') : prev.dueDate }));
    };

    const handleCallbackPreset = (p: DatePreset) => {
        setForm(prev => ({ ...prev, callbackPreset: p, callbackDate: p !== 'custom' ? dateFromPreset(p, '') : prev.callbackDate }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate
        if (form.type === 'todo') {
            const d = dateFromPreset(form.duePreset, form.dueDate);
            if (!d) { toast.error('Pick a due date'); return; }
        }
        if (form.result === 'callback') {
            const d = dateFromPreset(form.callbackPreset, form.callbackDate);
            if (!d) { toast.error('Pick a callback date'); return; }
        }
        if (form.result === 'lost' && !form.lostReason.trim()) {
            toast.error('Enter a lost reason'); return;
        }

        // Build payload
        let dueAt: string;
        if (form.type === 'todo') {
            dueAt = toISO(dateFromPreset(form.duePreset, form.dueDate), form.dueTime);
        } else {
            // For calls, dueAt = now (the call happened/was scheduled now)
            dueAt = new Date().toISOString();
        }

        const callbackAt = form.result === 'callback'
            ? toISO(dateFromPreset(form.callbackPreset, form.callbackDate), form.callbackTime)
            : undefined;

        const payload = {
            dueAt,
            type: form.type,
            outcome: resultToOutcome(form.result),
            callbackAt,
            lostReason: form.result === 'lost' ? form.lostReason.trim() || undefined : undefined,
            notes: form.notes.trim() || undefined,
        };

        try {
            if (isEdit && followup) {
                await updateFollowup.mutateAsync({ id: followup.id, ...payload });
                toast.success('Follow-up updated');
            } else {
                await createFollowup.mutateAsync(payload);
                toast.success('Activity logged');
            }
            onClose();
        } catch {
            toast.error(isEdit ? 'Failed to update' : 'Failed to log activity');
        }
    };

    const isPending = createFollowup.isPending || updateFollowup.isPending;

    // Pill styles matching our design
    const pill = (active: boolean) =>
        `px-3 py-1.5 rounded-full text-sm font-medium transition-colors border cursor-pointer ${
            active
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-white border-gray-300 text-gray-700 hover:border-emerald-400 hover:text-emerald-700'
        }`;

    const outgoingResults: { value: CallResult; label: string }[] = [
        { value: 'answered', label: 'Answered' },
        { value: 'unanswered', label: 'Unanswered' },
        { value: 'not_reachable', label: 'Not Reachable' },
    ];

    const incomingResults: { value: CallResult; label: string }[] = [
        { value: 'answered', label: 'Answered' },
    ];

    const actionResults: { value: CallResult; label: string }[] = [
        { value: 'callback', label: 'Call Back' },
        { value: 'meeting', label: 'Meeting' },
        { value: 'lost', label: 'Lost' },
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Follow-up' : 'Log Activity'} size="sm">
            <form onSubmit={handleSubmit} className="space-y-4 p-1">

                {/* Type */}
                <div className="flex gap-2">
                    <button type="button" className={pill(form.type === 'call')} onClick={() => handleTypeChange('call')}>Call</button>
                    <button type="button" className={pill(form.type === 'todo')} onClick={() => handleTypeChange('todo')}>To Do</button>
                </div>

                {/* Call: Direction */}
                {form.type === 'call' && (
                    <div className="flex gap-2">
                        <button type="button" className={pill(form.direction === 'outgoing')} onClick={() => handleDirectionChange('outgoing')}>Outgoing</button>
                        <button type="button" className={pill(form.direction === 'incoming')} onClick={() => handleDirectionChange('incoming')}>Incoming</button>
                    </div>
                )}

                {/* Call: Outcomes */}
                {form.type === 'call' && form.direction && (
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Outcome</p>
                        {/* Row 1: quality */}
                        <div className="flex flex-wrap gap-2">
                            {(form.direction === 'outgoing' ? outgoingResults : incomingResults).map(({ value, label }) => (
                                <button key={value} type="button" className={pill(form.result === value)}
                                    onClick={() => handleResultChange(value)}>
                                    {label}
                                </button>
                            ))}
                        </div>
                        {/* Row 2: actions */}
                        <div className="flex flex-wrap gap-2">
                            {actionResults.map(({ value, label }) => (
                                <button key={value} type="button" className={pill(form.result === value)}
                                    onClick={() => handleResultChange(value)}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Callback scheduling */}
                {form.result === 'callback' && (
                    <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-500">Schedule callback</p>
                        <div className="flex flex-wrap gap-2">
                            {DATE_PRESETS.map(({ value, label }) => (
                                <button key={value} type="button" className={pill(form.callbackPreset === value)}
                                    onClick={() => handleCallbackPreset(value)}>
                                    {label}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2 items-center">
                            {form.callbackPreset === 'custom' && (
                                <input type="date" value={form.callbackDate}
                                    onChange={(e) => set('callbackDate', e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" />
                            )}
                            <div className="flex items-center gap-1.5">
                                <label className="text-xs text-gray-500 whitespace-nowrap">Time</label>
                                <input type="time" value={form.callbackTime}
                                    onChange={(e) => set('callbackTime', e.target.value)}
                                    className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" />
                            </div>
                        </div>
                    </div>
                )}

                {/* To Do: date picker */}
                {form.type === 'todo' && (
                    <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                            {DATE_PRESETS.map(({ value, label }) => (
                                <button key={value} type="button" className={pill(form.duePreset === value)}
                                    onClick={() => handleDuePreset(value)}>
                                    {label}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2 items-center">
                            {form.duePreset === 'custom' && (
                                <input type="date" value={form.dueDate}
                                    onChange={(e) => set('dueDate', e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" />
                            )}
                            <div className="flex items-center gap-1.5">
                                <label className="text-xs text-gray-500 whitespace-nowrap">Time</label>
                                <input type="time" value={form.dueTime}
                                    onChange={(e) => set('dueTime', e.target.value)}
                                    className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Lost reason */}
                {form.result === 'lost' && (
                    <input type="text" value={form.lostReason}
                        onChange={(e) => set('lostReason', e.target.value)}
                        placeholder="Why was this lead lost?"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" />
                )}

                {/* Notes */}
                <textarea rows={2} value={form.notes}
                    onChange={(e) => set('notes', e.target.value)}
                    placeholder="Notes (optional)..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none" />

                {/* Actions */}
                <div className="flex gap-2">
                    <button type="button" onClick={onClose}
                        className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                        Cancel
                    </button>
                    <button type="submit" disabled={isPending}
                        className="flex-1 px-4 py-2 text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                        {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Save'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
