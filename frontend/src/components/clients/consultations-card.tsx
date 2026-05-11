'use client';

import { useState } from 'react';
import { Calendar, Video, MapPin, Plus, Loader2, MoreVertical, Check, X, RefreshCw, MessageCircle, Copy, ExternalLink } from 'lucide-react';
import { useConsultations, useUpdateConsultation, type Consultation } from '@/lib/hooks/use-consultations';
import { CreateConsultationModal } from '@/components/modals/create-consultation-modal';
import { Modal } from '@/components/ui/modal';
import { useOrganization } from '@/lib/hooks/use-organization';
import { toast } from 'sonner';

interface ConsultationsCardProps {
    clientId: string;
    clientName: string;
    clientPhone: string;
}

function buildWhatsAppMsg(c: Consultation, clientName: string, orgName: string, action: 'complete' | 'cancel' | 'reschedule') {
    const d = new Date(c.scheduledAt);
    const date = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const dur = c.durationMin < 60 ? `${c.durationMin} minutes` : `${c.durationMin / 60} hr${c.durationMin > 60 ? 's' : ''}`;
    const label = c.title || (c.mode === 'online' ? 'Online Consultation' : 'In-Person Consultation');
    const org = orgName || 'us';
    const regards = `\nWarm regards,\n*${org}*`;

    if (action === 'complete') return [
        `Hi ${clientName}! 👋`, '',
        `Thank you for attending your consultation with *${org}* today.`, '',
        `📋 *Session:* ${label}`, `📅 *Date:* ${date} at ${time}`, `⏱️ *Duration:* ${dur}`, '',
        `We hope the session was helpful. Reach out if you need follow-up support! 🌿`,
        regards,
    ].join('\n');

    if (action === 'cancel') return [
        `Hi ${clientName}! 👋`, '',
        `Your consultation with *${org}* has been cancelled:`, '',
        `📋 *Session:* ${label}`, `📅 *Date:* ${date} at ${time}`, '',
        `Please contact us to reschedule at your convenience. 🌿`,
        regards,
    ].join('\n');

    return [
        `Hi ${clientName}! 👋`, '',
        `Your consultation with *${org}* has been rescheduled:`, '',
        `📋 *Session:* ${label}`, `📅 *New Date:* ${date}`, `🕐 *Time:* ${time}`, `⏱️ *Duration:* ${dur}`,
        c.mode === 'online' && c.meetLink ? `🔗 *Link:* ${c.meetLink}` : null,
        c.mode === 'in_person' && c.location ? `📌 *Location:* ${c.location}` : null,
        '', `Please let us know if this works for you! 🌿`,
        regards,
    ].filter(l => l !== null).join('\n');
}

function WAModal({ message, phone, onClose }: { message: string; phone: string; onClose: () => void }) {
    const [copied, setCopied] = useState(false);
    const send = () => window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
    const copy = async () => {
        await navigator.clipboard.writeText(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <Modal isOpen onClose={onClose} title="Send WhatsApp Message" size="sm">
            <div className="p-4 space-y-4">
                <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">{message}</div>
                <div className="flex gap-2">
                    <button onClick={copy} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">
                        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button onClick={onClose} className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">Done</button>
                    <button onClick={send} className="ml-auto flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700">
                        <MessageCircle className="w-4 h-4" /> Send on WhatsApp
                    </button>
                </div>
            </div>
        </Modal>
    );
}

export function ConsultationsCard({ clientId, clientName, clientPhone }: ConsultationsCardProps) {
    const { data: consultations = [], isLoading } = useConsultations(clientId, { upcoming: true });
    const updateConsultation = useUpdateConsultation(clientId);
    const { data: org } = useOrganization();

    const [showCreate, setShowCreate] = useState(false);
    const [rescheduleTarget, setRescheduleTarget] = useState<Consultation | null>(null);
    const [menuOpen, setMenuOpen] = useState<string | null>(null);
    const [waMsg, setWaMsg] = useState<string | null>(null);

    const handleAction = async (c: Consultation, action: 'complete' | 'cancel') => {
        setMenuOpen(null);
        try {
            await updateConsultation.mutateAsync({ id: c.id, status: action === 'complete' ? 'completed' : 'cancelled' });
            toast.success(action === 'complete' ? 'Marked as completed' : 'Cancelled');
            setWaMsg(buildWhatsAppMsg(c, clientName, org?.name ?? '', action));
        } catch { toast.error('Failed to update'); }
    };

    return (
        <>
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                            <Calendar className="w-4 h-4" />
                        </div>
                        <h3 className="font-semibold text-gray-900">Upcoming Consultations</h3>
                    </div>
                    <button type="button" onClick={() => setShowCreate(true)} className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700">
                        <Plus className="w-3.5 h-3.5" /> New
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex items-center gap-2 py-2"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
                ) : consultations.length === 0 ? (
                    <div className="text-center py-3">
                        <p className="text-sm text-gray-400 mb-3">No upcoming consultations</p>
                        <button type="button" onClick={() => setShowCreate(true)} className="flex items-center gap-2 mx-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors">
                            <Plus className="w-4 h-4" /> Schedule
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {consultations.map(c => {
                            const d = new Date(c.scheduledAt);
                            const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                            const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                            return (
                                <div key={c.id} className="p-3 rounded-xl border border-blue-100 bg-blue-50/30 space-y-2">
                                    {/* Row 1: date block + title + menu */}
                                    <div className="flex items-start gap-3">
                                        <div className="flex flex-col items-center min-w-[44px] bg-white rounded-lg px-1.5 py-1.5 text-center border border-blue-100 flex-shrink-0">
                                            <span className="text-xs font-bold text-gray-800 leading-none">{date}</span>
                                            <span className="text-[10px] text-gray-400 mt-0.5 leading-none">{time}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-800 truncate">
                                                {c.title || (c.mode === 'online' ? 'Online Consultation' : 'In-Person')}
                                            </p>
                                            {/* Row 2: mode badge + duration + location */}
                                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${c.mode === 'online' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                                                    {c.mode === 'online' ? <Video className="w-2.5 h-2.5" /> : <MapPin className="w-2.5 h-2.5" />}
                                                    {c.mode === 'online' ? 'Online' : 'In-Person'}
                                                </span>
                                                <span className="text-[10px] text-gray-400">{c.durationMin} min</span>
                                                {c.mode === 'in_person' && c.location && (
                                                    <span className="text-[10px] text-gray-500 truncate">{c.location}</span>
                                                )}
                                            </div>
                                        </div>
                                        {/* Three-dot menu */}
                                        <div className="relative shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => setMenuOpen(menuOpen === c.id ? null : c.id)}
                                                className="p-1 rounded-lg hover:bg-blue-100 text-gray-400"
                                            >
                                                <MoreVertical className="w-3.5 h-3.5" />
                                            </button>
                                            {menuOpen === c.id && (
                                                <div className="absolute right-0 top-7 z-20 w-40 bg-white rounded-xl shadow-lg border border-gray-100 py-1 text-sm">
                                                    <button onClick={() => handleAction(c, 'complete')} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-emerald-700">
                                                        <Check className="w-3.5 h-3.5" /> Complete
                                                    </button>
                                                    <button onClick={() => { setMenuOpen(null); setRescheduleTarget(c); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-blue-600">
                                                        <RefreshCw className="w-3.5 h-3.5" /> Reschedule
                                                    </button>
                                                    <button onClick={() => handleAction(c, 'cancel')} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-red-500">
                                                        <X className="w-3.5 h-3.5" /> Cancel
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Meet link button — own row */}
                                    {c.mode === 'online' && c.meetLink && (
                                        <a
                                            href={c.meetLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={e => e.stopPropagation()}
                                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors w-fit"
                                        >
                                            <Video className="w-3 h-3" />
                                            Join Meeting
                                            <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                                        </a>
                                    )}

                                    {/* Notes */}
                                    {c.notes && (
                                        <p className="text-[11px] text-gray-500 bg-white/70 rounded-lg px-2 py-1.5 border border-blue-100">
                                            📝 {c.notes}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <CreateConsultationModal isOpen={showCreate} onClose={() => setShowCreate(false)} clientId={clientId} clientName={clientName} clientPhone={clientPhone} />
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
