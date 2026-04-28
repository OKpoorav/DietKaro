'use client';

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, MessageSquare, UserCheck, Archive, RotateCcw,
    Phone, Mail, MapPin, User, Calendar, Plus, CheckCircle2,
    Circle, Activity, FileText, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLead, useRestoreLead, useUpdateLead } from '@/lib/hooks/use-leads';
import { useLeadFollowups, useCompleteFollowup } from '@/lib/hooks/use-lead-followups';
import { useLeadTouchpoints, useLogManualTouchpoint } from '@/lib/hooks/use-lead-touchpoints';
import { useLeadSources } from '@/lib/hooks/use-lead-sources';
import { useLeadStatuses } from '@/lib/hooks/use-lead-statuses';
import { useArchiveLead } from '@/lib/hooks/use-leads';
import { LeadStatusPill } from '@/components/leads/lead-status-pill';
import { LeadTemperaturePill } from '@/components/leads/lead-temperature-pill';
import { LeadFormModal } from '@/components/leads/lead-form-modal';
import { AddFollowupModal } from '@/components/leads/add-followup-modal';
import { ConvertToClientModal } from '@/components/leads/convert-to-client-modal';
import { Modal } from '@/components/ui/modal';
import { toast } from 'sonner';

const TOUCHPOINT_ICONS: Record<string, string> = {
    field_change: '✏️', note_added: '📝', proposal_shared: '📄',
    payment_link_shared: '💳', followup_scheduled: '📅', followup_completed: '✅',
    converted: '🎉', archived: '📦', restored: '🔄',
    manual_call: '📞', manual_whatsapp: '💬', manual_visit: '🏢', manual_other: '📌',
};

const TOUCHPOINT_LABELS: Record<string, string> = {
    field_change: 'Field updated', note_added: 'Note added', proposal_shared: 'Proposal shared',
    payment_link_shared: 'Payment link shared', followup_scheduled: 'Follow-up scheduled',
    followup_completed: 'Follow-up completed', converted: 'Converted to client',
    archived: 'Lead archived', restored: 'Lead restored',
    manual_call: 'Call logged', manual_whatsapp: 'WhatsApp logged',
    manual_visit: 'Visit logged', manual_other: 'Activity logged',
};

type Tab = 'todos' | 'touchpoints' | 'notes';

function LogActivityModal({ isOpen, onClose, leadId }: { isOpen: boolean; onClose: () => void; leadId: string }) {
    const logMutation = useLogManualTouchpoint(leadId);
    const [kind, setKind] = useState<'manual_call' | 'manual_whatsapp' | 'manual_visit' | 'manual_other'>('manual_call');
    const [notes, setNotes] = useState('');
    const [duration, setDuration] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await logMutation.mutateAsync({ kind, notes: notes.trim() || undefined, duration: duration ? parseInt(duration) : undefined });
            toast.success('Activity logged');
            setNotes(''); setDuration('');
            onClose();
        } catch {
            toast.error('Failed to log activity');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Log Activity" size="sm">
            <form onSubmit={handleSubmit} className="space-y-4 p-1">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                    <div className="grid grid-cols-2 gap-2">
                        {(['manual_call', 'manual_whatsapp', 'manual_visit', 'manual_other'] as const).map((k) => (
                            <button key={k} type="button" onClick={() => setKind(k)}
                                className={cn('px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
                                    kind === k ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
                                {TOUCHPOINT_ICONS[k]} {k.replace('manual_', '').charAt(0).toUpperCase() + k.replace('manual_', '').slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
                {kind === 'manual_call' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
                        <input type="number" min={0} value={duration} onChange={(e) => setDuration(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500" />
                    </div>
                )}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder="What happened?" />
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                    <button type="submit" disabled={logMutation.isPending}
                        className="flex-1 px-4 py-2 text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                        {logMutation.isPending ? 'Logging...' : 'Log'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

export default function LeadDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) ?? 'todos');
    const [editOpen, setEditOpen] = useState(false);
    const [followupOpen, setFollowupOpen] = useState(false);
    const [convertOpen, setConvertOpen] = useState(false);
    const [logOpen, setLogOpen] = useState(false);
    const [noteText, setNoteText] = useState('');

    const { data: lead, isLoading } = useLead(id);
    const { data: followups = [] } = useLeadFollowups(id);
    const { data: touchpointsData } = useLeadTouchpoints(id);
    const { data: sources = [] } = useLeadSources();
    const { data: statuses = [] } = useLeadStatuses();

    const archiveMutation = useArchiveLead();
    const restoreMutation = useRestoreLead(id);
    const updateLead = useUpdateLead(id);
    const completeFollowup = useCompleteFollowup(id);
    const logTouchpoint = useLogManualTouchpoint(id);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!lead) {
        return <div className="text-center py-16 text-gray-400">Lead not found</div>;
    }

    const canConvert = lead.status.name === 'Interested' || lead.status.name === 'Consultation Booked';
    const isConverted = !!lead.convertedClientId;

    const handleArchive = async () => {
        if (!confirm(`Archive "${lead.name}"?`)) return;
        try {
            await archiveMutation.mutateAsync(id);
            toast.success('Lead archived');
        } catch {
            toast.error('Failed to archive');
        }
    };

    const handleRestore = async () => {
        try {
            await restoreMutation.mutateAsync();
            toast.success('Lead restored');
        } catch {
            toast.error('Failed to restore');
        }
    };

    const handleNoteSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!noteText.trim()) return;
        try {
            await logTouchpoint.mutateAsync({ kind: 'manual_other', notes: noteText.trim() });
            await updateLead.mutateAsync({ notes: noteText.trim() });
            toast.success('Note saved');
            setNoteText('');
            setTab('touchpoints');
        } catch {
            toast.error('Failed to save note');
        }
    };

    const pendingFollowups = followups.filter((f) => !f.completedAt);
    const completedFollowups = followups.filter((f) => f.completedAt);

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Back nav */}
            <Link href="/dashboard/leads" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
                <ArrowLeft className="w-4 h-4" /> All Leads
            </Link>

            {/* Sticky header card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-xl font-bold text-gray-900">{lead.name}</h1>
                            <LeadStatusPill name={lead.status.name} color={lead.status.color} />
                            <LeadTemperaturePill temperature={lead.temperature} />
                            {lead.archivedAt && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Archived</span>}
                        </div>
                        <div className="flex items-center gap-4 mt-2 flex-wrap">
                            <a href={`https://wa.me/${lead.primaryMobile.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-emerald-600">
                                <MessageSquare className="w-4 h-4 text-green-500" /> {lead.primaryMobile}
                            </a>
                            {lead.email && (
                                <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-emerald-600">
                                    <Mail className="w-4 h-4" /> {lead.email}
                                </a>
                            )}
                            {lead.city && <span className="flex items-center gap-1.5 text-sm text-gray-500"><MapPin className="w-4 h-4" /> {lead.city}</span>}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {!isConverted && !lead.archivedAt && (
                            <button
                                onClick={() => setConvertOpen(true)}
                                disabled={!canConvert}
                                title={!canConvert ? 'Status must be Interested or Consultation Booked to convert' : undefined}
                                className={cn('px-4 py-2 text-sm font-semibold rounded-xl transition-colors',
                                    canConvert ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed')}>
                                <UserCheck className="w-4 h-4 inline mr-1.5" />Convert
                            </button>
                        )}
                        {isConverted && lead.convertedClient && (
                            <Link href={`/dashboard/clients/${lead.convertedClientId}`}
                                className="px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                                View Client →
                            </Link>
                        )}
                        <button onClick={() => setEditOpen(true)}
                            className="px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">Edit</button>
                        {lead.archivedAt ? (
                            <button onClick={handleRestore}
                                className="px-3 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 rounded-xl hover:bg-emerald-100 flex items-center gap-1">
                                <RotateCcw className="w-4 h-4" /> Restore
                            </button>
                        ) : (
                            <button onClick={handleArchive}
                                className="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-xl hover:bg-red-100 flex items-center gap-1">
                                <Archive className="w-4 h-4" /> Archive
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left rail */}
                <div className="space-y-4">
                    {/* Profile card */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                        <h3 className="text-sm font-semibold text-gray-900">Profile</h3>
                        {[
                            { icon: User, label: 'Gender', value: lead.gender },
                            { icon: Calendar, label: 'Age', value: lead.age ? `${lead.age} yrs` : null },
                            { icon: Phone, label: 'Alt Mobile', value: lead.altMobile },
                        ].map(({ icon: Icon, label, value }) => value ? (
                            <div key={label} className="flex items-center gap-2 text-sm">
                                <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <span className="text-gray-500">{label}:</span>
                                <span className="text-gray-800 capitalize">{value}</span>
                            </div>
                        ) : null)}
                    </div>

                    {/* Pipeline card */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                        <h3 className="text-sm font-semibold text-gray-900">Pipeline</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-gray-500">Source</span><span className="text-gray-800">{lead.source?.name ?? '—'}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Reference</span><span className="text-gray-800 max-w-[140px] truncate text-right">{lead.reference ?? '—'}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Referral Type</span><span className="text-gray-800 capitalize">{lead.referralType?.replace(/_/g, ' ') ?? '—'}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Owner</span><span className="text-gray-800">{lead.ownerUser?.fullName ?? 'Unassigned'}</span></div>
                            <div className="flex justify-between items-center"><span className="text-gray-500">Status</span><LeadStatusPill name={lead.status.name} color={lead.status.color} /></div>
                            <div className="flex justify-between items-center"><span className="text-gray-500">Temperature</span><LeadTemperaturePill temperature={lead.temperature} /></div>
                            <div className="flex justify-between"><span className="text-gray-500">Created</span><span className="text-gray-800 text-xs">{new Date(lead.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
                        </div>
                    </div>
                </div>

                {/* Right rail — tabbed */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    {/* Tab bar */}
                    <div className="flex border-b border-gray-200">
                        {(['todos', 'touchpoints', 'notes'] as Tab[]).map((t) => (
                            <button key={t} onClick={() => setTab(t)}
                                className={cn('px-5 py-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
                                    tab === t ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-gray-500 hover:text-gray-800')}>
                                {t === 'todos' ? 'To-Do' : t.charAt(0).toUpperCase() + t.slice(1)}
                                {t === 'todos' && pendingFollowups.length > 0 && (
                                    <span className="ml-2 bg-emerald-100 text-emerald-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{pendingFollowups.length}</span>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="p-5">
                        {/* To-Do tab */}
                        {tab === 'todos' && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <p className="text-sm text-gray-500">{pendingFollowups.length} pending</p>
                                    <button onClick={() => setFollowupOpen(true)}
                                        className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700">
                                        <Plus className="w-4 h-4" /> Add To-Do
                                    </button>
                                </div>
                                {pendingFollowups.length === 0 && completedFollowups.length === 0 ? (
                                    <p className="text-center text-gray-400 text-sm py-8">No follow-ups yet</p>
                                ) : (
                                    <div className="space-y-2">
                                        {pendingFollowups.map((f) => {
                                            const due = new Date(f.dueAt);
                                            const isOverdue = due < new Date();
                                            return (
                                                <div key={f.id} className={cn('flex items-start gap-3 p-3 rounded-xl border', isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50')}>
                                                    <button onClick={async () => { try { await completeFollowup.mutateAsync(f.id); toast.success('Marked done'); } catch { toast.error('Failed'); } }}
                                                        className="mt-0.5 text-gray-400 hover:text-emerald-500 transition-colors">
                                                        <Circle className="w-5 h-5" />
                                                    </button>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={cn('text-sm font-medium', isOverdue ? 'text-red-700' : 'text-gray-700')}>
                                                            {f.type.charAt(0).toUpperCase() + f.type.slice(1)}
                                                            <span className="ml-2 font-normal text-xs">
                                                                {due.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                                                            </span>
                                                        </p>
                                                        {f.notes && <p className="text-xs text-gray-500 mt-0.5">{f.notes}</p>}
                                                    </div>
                                                    {isOverdue && <span className="text-xs text-red-600 font-medium flex-shrink-0">Overdue</span>}
                                                </div>
                                            );
                                        })}
                                        {completedFollowups.length > 0 && (
                                            <details className="mt-4">
                                                <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
                                                    {completedFollowups.length} completed
                                                </summary>
                                                <div className="space-y-2 mt-2">
                                                    {completedFollowups.map((f) => (
                                                        <div key={f.id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 opacity-60">
                                                            <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" />
                                                            <div>
                                                                <p className="text-sm text-gray-600 line-through">{f.type}</p>
                                                                <p className="text-xs text-gray-400">{new Date(f.completedAt!).toLocaleDateString('en-IN')}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </details>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Touchpoints tab */}
                        {tab === 'touchpoints' && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <p className="text-sm text-gray-500">{touchpointsData?.total ?? 0} activities</p>
                                    <button onClick={() => setLogOpen(true)}
                                        className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700">
                                        <Activity className="w-4 h-4" /> Log Activity
                                    </button>
                                </div>
                                {!touchpointsData?.items?.length ? (
                                    <p className="text-center text-gray-400 text-sm py-8">No activity yet</p>
                                ) : (
                                    <div className="relative">
                                        <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />
                                        <div className="space-y-4">
                                            {touchpointsData.items.map((tp) => (
                                                <div key={tp.id} className="flex gap-4 relative">
                                                    <div className="w-10 h-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center flex-shrink-0 text-base z-10">
                                                        {TOUCHPOINT_ICONS[tp.kind] ?? '📌'}
                                                    </div>
                                                    <div className="flex-1 min-w-0 pb-4">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div>
                                                                <p className="text-sm font-medium text-gray-800">{TOUCHPOINT_LABELS[tp.kind] ?? tp.kind}</p>
                                                                {tp.actor && <p className="text-xs text-gray-500">by {tp.actor.fullName}</p>}
                                                                {tp.payload && Object.keys(tp.payload).length > 0 && (
                                                                    <details className="mt-1">
                                                                        <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">Details</summary>
                                                                        <pre className="text-xs text-gray-600 bg-gray-50 rounded p-2 mt-1 overflow-x-auto">{JSON.stringify(tp.payload, null, 2)}</pre>
                                                                    </details>
                                                                )}
                                                            </div>
                                                            <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                                                                {new Date(tp.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Notes tab */}
                        {tab === 'notes' && (
                            <div className="space-y-4">
                                {lead.notes && (
                                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{lead.notes}</p>
                                    </div>
                                )}
                                <form onSubmit={handleNoteSubmit} className="space-y-2">
                                    <textarea rows={4} value={noteText} onChange={(e) => setNoteText(e.target.value)}
                                        placeholder="Add a note..."
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-emerald-500 focus:border-emerald-500 resize-none" />
                                    <button type="submit" disabled={!noteText.trim() || logTouchpoint.isPending || updateLead.isPending}
                                        className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50">
                                        <FileText className="w-4 h-4 inline mr-1.5" />Save Note
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modals */}
            <LeadFormModal isOpen={editOpen} onClose={() => setEditOpen(false)} lead={lead} />
            <AddFollowupModal isOpen={followupOpen} onClose={() => setFollowupOpen(false)} leadId={id} />
            {convertOpen && (
                <ConvertToClientModal isOpen={convertOpen} onClose={() => setConvertOpen(false)} lead={lead} />
            )}
            <LogActivityModal isOpen={logOpen} onClose={() => setLogOpen(false)} leadId={id} />
        </div>
    );
}
