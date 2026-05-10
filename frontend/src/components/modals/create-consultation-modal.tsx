'use client';

import { useState } from 'react';
import { Video, MapPin, MessageCircle, Loader2, Check } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { useCreateConsultation, useUpdateConsultation, type Consultation } from '@/lib/hooks/use-consultations';
import { useOrganization } from '@/lib/hooks/use-organization';
import { toast } from 'sonner';

interface CreateConsultationModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientId: string;
    clientName: string;
    clientPhone: string;
    /** Pass to edit/reschedule an existing consultation */
    existing?: Consultation;
}

const DURATIONS = [15, 30, 45, 60, 90, 120];

function pad(n: number) { return n.toString().padStart(2, '0'); }

function localDatetimeToISO(value: string) {
    if (!value) return '';
    return new Date(value).toISOString();
}

function toLocalDatetime(iso: string) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CreateConsultationModal({ isOpen, onClose, clientId, clientName, clientPhone, existing }: CreateConsultationModalProps) {
    const createConsultation = useCreateConsultation(clientId);
    const updateConsultation = useUpdateConsultation(clientId);
    const { data: org } = useOrganization();
    const isEdit = !!existing;

    const [step, setStep] = useState<'form' | 'share'>('form');
    const [created, setCreated] = useState<Consultation | null>(null);

    // form state — default to tomorrow at 10:00 or existing values
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const defaultDatetime = existing
        ? toLocalDatetime(existing.scheduledAt)
        : `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T10:00`;

    const [title, setTitle] = useState(existing?.title ?? '');
    const [scheduledAt, setScheduledAt] = useState(defaultDatetime);
    const [durationMin, setDurationMin] = useState(existing?.durationMin ?? 30);
    const [mode, setMode] = useState<'online' | 'in_person'>(existing?.mode ?? 'online');
    const [meetLink, setMeetLink] = useState(existing?.meetLink ?? '');
    const [location, setLocation] = useState(existing?.location ?? '');
    const [notes, setNotes] = useState(existing?.notes ?? '');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!scheduledAt) { toast.error('Please select a date and time'); return; }
        try {
            let result: Consultation;
            if (isEdit && existing) {
                result = await updateConsultation.mutateAsync({
                    id: existing.id,
                    title: title.trim() || undefined,
                    scheduledAt: localDatetimeToISO(scheduledAt),
                    durationMin,
                    mode,
                    meetLink: mode === 'online' ? meetLink.trim() || undefined : undefined,
                    location: mode === 'in_person' ? location.trim() || undefined : undefined,
                    notes: notes.trim() || undefined,
                });
            } else {
                result = await createConsultation.mutateAsync({
                    title: title.trim() || undefined,
                    scheduledAt: localDatetimeToISO(scheduledAt),
                    durationMin,
                    mode,
                    meetLink: mode === 'online' ? meetLink.trim() || undefined : undefined,
                    location: mode === 'in_person' ? location.trim() || undefined : undefined,
                    notes: notes.trim() || undefined,
                });
            }
            setCreated(result);
            setStep('share');
        } catch {
            toast.error(isEdit ? 'Failed to reschedule' : 'Failed to create consultation');
        }
    };

    const whatsappMessage = created ? buildWhatsAppMessage(created, clientName, org?.name ?? '') : '';

    const handleWhatsApp = () => {
        const phone = clientPhone.replace(/\D/g, '');
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage)}`, '_blank');
    };

    const isPending = createConsultation.isPending || updateConsultation.isPending;

    const handleClose = () => {
        setStep('form');
        setCreated(null);
        onClose();
    };

    const INPUT = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none';

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={step === 'form' ? (isEdit ? 'Reschedule Consultation' : 'Schedule Consultation') : (isEdit ? 'Consultation Rescheduled' : 'Consultation Scheduled')} size="md">
            {step === 'form' ? (
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {/* Title */}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Title <span className="text-gray-400">(optional)</span></label>
                        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Follow-up Session" className={INPUT} />
                    </div>

                    {/* Date + Time */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Date & Time <span className="text-red-500">*</span></label>
                            <input
                                required
                                type="datetime-local"
                                value={scheduledAt}
                                onChange={e => setScheduledAt(e.target.value)}
                                className={INPUT}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
                            <select value={durationMin} onChange={e => setDurationMin(Number(e.target.value))} className={INPUT}>
                                {DURATIONS.map(d => (
                                    <option key={d} value={d}>{d < 60 ? `${d} min` : `${d / 60} hr${d > 60 ? 's' : ''}`}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Mode */}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">Mode</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setMode('online')}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${mode === 'online' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                            >
                                <Video className="w-4 h-4" /> Online
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('in_person')}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${mode === 'in_person' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                            >
                                <MapPin className="w-4 h-4" /> In-Person
                            </button>
                        </div>
                    </div>

                    {/* Meet link / location */}
                    {mode === 'online' ? (
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Meet Link <span className="text-gray-400">(optional)</span></label>
                            <input type="url" value={meetLink} onChange={e => setMeetLink(e.target.value)} placeholder="https://meet.google.com/..." className={INPUT} />
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Location <span className="text-gray-400">(optional)</span></label>
                            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Clinic address or room" className={INPUT} />
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Notes <span className="text-gray-400">(optional)</span></label>
                        <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Agenda or preparation notes…" className={`${INPUT} resize-none`} />
                    </div>

                    <div className="flex gap-2 pt-1">
                        <button type="button" onClick={handleClose} className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">Cancel</button>
                        <button type="submit" disabled={isPending}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50">
                            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            {isEdit ? 'Reschedule' : 'Schedule'}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="p-6 space-y-5">
                    <div className="flex flex-col items-center text-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                            <Check className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-base font-semibold text-gray-900">Consultation scheduled!</h3>
                            <p className="text-sm text-gray-500">
                                {created && formatConsultationDatetime(created.scheduledAt, created.durationMin)}
                            </p>
                        </div>
                    </div>

                    {/* WhatsApp preview */}
                    <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                        {whatsappMessage}
                    </div>

                    <div className="flex gap-2">
                        <button type="button" onClick={handleClose}
                            className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">
                            Done
                        </button>
                        <button type="button" onClick={handleWhatsApp}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700">
                            <MessageCircle className="w-4 h-4" /> Send on WhatsApp
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    );
}

function formatConsultationDatetime(scheduledAt: string, durationMin: number) {
    const d = new Date(scheduledAt);
    const date = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const dur = durationMin < 60 ? `${durationMin} min` : `${durationMin / 60} hr`;
    return `${date} at ${time} · ${dur}`;
}

function buildWhatsAppMessage(c: Consultation, clientName: string, orgName: string) {
    const d = new Date(c.scheduledAt);
    const date = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const dur = c.durationMin < 60 ? `${c.durationMin} minutes` : `${c.durationMin / 60} hour${c.durationMin > 60 ? 's' : ''}`;
    const modeLabel = c.mode === 'online' ? 'Online' : 'In-Person';

    return [
        `Hi ${clientName}! 👋`,
        '',
        `Your consultation with *${orgName || 'us'}* has been scheduled:`,
        '',
        `📅 *Date:* ${date}`,
        `🕐 *Time:* ${time}`,
        `⏱️ *Duration:* ${dur}`,
        `📍 *Mode:* ${modeLabel}`,
        c.mode === 'online' && c.meetLink ? `🔗 *Meeting Link:* ${c.meetLink}` : null,
        c.mode === 'in_person' && c.location ? `📌 *Location:* ${c.location}` : null,
        c.title ? `📋 *Agenda:* ${c.title}` : null,
        '',
        `Please be available a few minutes before the session. Looking forward to speaking with you! 🌿`,
    ].filter(l => l !== null).join('\n');
}
