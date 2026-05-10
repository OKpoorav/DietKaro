'use client';

import { useState } from 'react';
import { Plus, Video, MapPin, MessageCircle, Check, X, RefreshCw, Loader2, MoreVertical } from 'lucide-react';
import { useConsultations, useUpdateConsultation, type Consultation } from '@/lib/hooks/use-consultations';
import { CreateConsultationModal } from '@/components/modals/create-consultation-modal';
import { Modal } from '@/components/ui/modal';
import { toast } from 'sonner';

interface ConsultationsTabProps {
    clientId: string;
    clientName: string;
    clientPhone: string;
    orgName: string;
}

function buildWhatsAppMsg(c: Consultation, clientName: string, orgName: string, action: 'complete' | 'cancel' | 'reschedule') {
    const d = new Date(c.scheduledAt);
    const date = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const dur = c.durationMin < 60 ? `${c.durationMin} minutes` : `${c.durationMin / 60} hr${c.durationMin > 60 ? 's' : ''}`;
    const label = c.title || (c.mode === 'online' ? 'Online Consultation' : 'In-Person Consultation');
    const org = orgName || 'us';

    if (action === 'complete') return [
        `Hi ${clientName}! 👋`, '',
        `Thank you for attending your consultation with *${org}* today.`, '',
        `📋 *Session:* ${label}`, `📅 *Date:* ${date} at ${time}`, `⏱️ *Duration:* ${dur}`, '',
        `We hope the session was helpful. Reach out if you need follow-up support! 🌿`,
    ].join('\n');

    if (action === 'cancel') return [
        `Hi ${clientName}! 👋`, '',
        `Your consultation with *${org}* has been cancelled:`, '',
        `📋 *Session:* ${label}`, `📅 *Date:* ${date} at ${time}`, '',
        `Please contact us to reschedule at your convenience. 🌿`,
    ].join('\n');

    return [
        `Hi ${clientName}! 👋`, '',
        `Your consultation with *${org}* has been rescheduled:`, '',
        `📋 *Session:* ${label}`, `📅 *New Date:* ${date}`, `🕐 *Time:* ${time}`, `⏱️ *Duration:* ${dur}`,
        c.mode === 'online' && c.meetLink ? `🔗 *Meeting Link:* ${c.meetLink}` : null,
        c.mode === 'in_person' && c.location ? `📌 *Location:* ${c.location}` : null,
        '', `Please let us know if this works for you! 🌿`,
    ].filter(l => l !== null).join('\n');
}

function WAModal({ message, phone, onClose }: { message: string; phone: string; onClose: () => void }) {
    const send = () => window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
    return (
        <Modal isOpen onClose={onClose} title="Send WhatsApp Message" size="sm">
            <div className="p-4 space-y-4">
                <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">{message}</div>
                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">Done</button>
                    <button onClick={send} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700">
                        <MessageCircle className="w-4 h-4" /> Send on WhatsApp
                    </button>
                </div>
            </div>
        </Modal>
    );
}

function UpcomingRow({ c, onComplete, onReschedule, onCancel }: {
    c: Consultation;
    onComplete: () => void;
    onReschedule: () => void;
    onCancel: () => void;
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const d = new Date(c.scheduledAt);
    const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    return (
        <div className="rounded-xl border border-gray-100 bg-white p-4">
            <div className="flex items-start gap-4">
                <div className="flex flex-col items-center min-w-[52px] bg-gray-50 rounded-xl p-2 text-center">
                    <span className="text-xs font-bold text-gray-700">{date.split(' ').slice(0, 2).join(' ')}</span>
                    <span className="text-[10px] text-gray-400 mt-0.5">{time}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">
                            {c.title || (c.mode === 'online' ? 'Online Consultation' : 'In-Person Consultation')}
                        </p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700">scheduled</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                            {c.mode === 'online' ? <Video className="w-3 h-3 text-blue-500" /> : <MapPin className="w-3 h-3 text-orange-500" />}
                            {c.mode === 'online' ? 'Online' : 'In-Person'} · {c.durationMin} min
                        </span>
                        {c.mode === 'online' && c.meetLink && (
                            <a href={c.meetLink} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Join link</a>
                        )}
                        {c.mode === 'in_person' && c.location && (
                            <span className="text-gray-400 truncate">{c.location}</span>
                        )}
                    </div>
                    {c.notes && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{c.notes}</p>}
                </div>
                <div className="relative shrink-0">
                    <button
                        type="button"
                        onClick={() => setMenuOpen(o => !o)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                    >
                        <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuOpen && (
                        <div className="absolute right-0 top-8 z-20 w-40 bg-white rounded-xl shadow-lg border border-gray-100 py-1 text-sm">
                            <button onClick={() => { setMenuOpen(false); onComplete(); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-emerald-700">
                                <Check className="w-3.5 h-3.5" /> Complete
                            </button>
                            <button onClick={() => { setMenuOpen(false); onReschedule(); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-blue-600">
                                <RefreshCw className="w-3.5 h-3.5" /> Reschedule
                            </button>
                            <button onClick={() => { setMenuOpen(false); onCancel(); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-red-500">
                                <X className="w-3.5 h-3.5" /> Cancel
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export function ConsultationsTab({ clientId, clientName, clientPhone, orgName }: ConsultationsTabProps) {
    const { data: all = [], isLoading } = useConsultations(clientId);
    const updateConsultation = useUpdateConsultation(clientId);

    const [showCreate, setShowCreate] = useState(false);
    const [rescheduleTarget, setRescheduleTarget] = useState<Consultation | null>(null);
    const [waMsg, setWaMsg] = useState<string | null>(null);

    const now = new Date();
    const upcoming = all.filter(c => c.status === 'scheduled' && new Date(c.scheduledAt) >= now);
    const past = all.filter(c => c.status !== 'scheduled' || new Date(c.scheduledAt) < now);

    const handleAction = async (c: Consultation, action: 'complete' | 'cancel') => {
        try {
            await updateConsultation.mutateAsync({ id: c.id, status: action === 'complete' ? 'completed' : 'cancelled' });
            toast.success(action === 'complete' ? 'Marked as completed' : 'Consultation cancelled');
            setWaMsg(buildWhatsAppMsg(c, clientName, orgName, action));
        } catch {
            toast.error('Failed to update consultation');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 py-12 justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                <span className="text-sm text-gray-400">Loading consultations…</span>
            </div>
        );
    }

    return (
        <>
            <div className="mt-6 space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Consultations</h2>
                    <button
                        type="button"
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Schedule
                    </button>
                </div>

                <section>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Upcoming</h3>
                    {upcoming.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
                            <p className="text-sm text-gray-400">No upcoming consultations</p>
                            <button onClick={() => setShowCreate(true)} className="mt-2 text-sm text-emerald-600 hover:underline font-medium">
                                Schedule one →
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {upcoming.map(c => (
                                <UpcomingRow
                                    key={c.id}
                                    c={c}
                                    onComplete={() => handleAction(c, 'complete')}
                                    onReschedule={() => setRescheduleTarget(c)}
                                    onCancel={() => handleAction(c, 'cancel')}
                                />
                            ))}
                        </div>
                    )}
                </section>

                {past.length > 0 && (
                    <section>
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Past</h3>
                        <div className="space-y-2">
                            {past.map(c => (
                                <div key={c.id} className={`rounded-xl border p-4 ${c.status === 'cancelled' ? 'border-gray-100 bg-gray-50 opacity-60' : 'border-gray-100 bg-white'}`}>
                                    <div className="flex items-start gap-4">
                                        <div className="flex flex-col items-center min-w-[52px] bg-gray-50 rounded-xl p-2 text-center">
                                            <span className="text-xs font-bold text-gray-700">
                                                {new Date(c.scheduledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                            </span>
                                            <span className="text-[10px] text-gray-400 mt-0.5">
                                                {new Date(c.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className={`text-sm font-semibold ${c.status === 'cancelled' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                                    {c.title || (c.mode === 'online' ? 'Online Consultation' : 'In-Person Consultation')}
                                                </p>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${c.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                                                    {c.status}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                                {c.mode === 'online' ? <Video className="w-3 h-3 text-blue-500" /> : <MapPin className="w-3 h-3 text-orange-500" />}
                                                {c.mode === 'online' ? 'Online' : 'In-Person'} · {c.durationMin} min
                                                {c.mode === 'online' && c.meetLink && (
                                                    <a href={c.meetLink} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Join</a>
                                                )}
                                                {c.mode === 'in_person' && c.location && (
                                                    <span className="text-gray-400 truncate">{c.location}</span>
                                                )}
                                            </div>
                                            {c.notes && <p className="text-xs text-gray-400 mt-1">{c.notes}</p>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            <CreateConsultationModal
                isOpen={showCreate}
                onClose={() => setShowCreate(false)}
                clientId={clientId}
                clientName={clientName}
                clientPhone={clientPhone}
            />
            {rescheduleTarget && (
                <CreateConsultationModal
                    isOpen
                    onClose={() => setRescheduleTarget(null)}
                    clientId={clientId}
                    clientName={clientName}
                    clientPhone={clientPhone}
                    existing={rescheduleTarget}
                />
            )}
            {waMsg && <WAModal message={waMsg} phone={clientPhone} onClose={() => setWaMsg(null)} />}
        </>
    );
}
