'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
    Plus, Search, MoreHorizontal, UserCheck, Archive,
    CalendarClock, ExternalLink, ChevronLeft, ChevronRight, MessageSquare,
    FileText, ChevronDown, Check, X, UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLeads, useArchiveLead, useUpdateLead, useCompleteFollowup, type Lead, type LeadFilters, type LeadFollowup } from '@/lib/hooks/use-leads';
import { useLeadStatuses, type LeadStatus } from '@/lib/hooks/use-lead-statuses';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useTeam, type TeamMember } from '@/lib/hooks/use-team';
import { LeadFormModal } from '@/components/leads/lead-form-modal';
import { AddFollowupModal } from '@/components/leads/add-followup-modal';
import { ConvertToClientModal } from '@/components/leads/convert-to-client-modal';
import { ShareProposalModal } from '@/components/leads/share-proposal-modal';
import { toast } from 'sonner';
import { InlineDropdown, type DropdownOption } from '@/components/ui/inline-dropdown';
import { ConfirmModal } from '@/components/ui/confirm-modal';

const PAGE_SIZE = 25;

function FollowupCell({ followup, onClick }: { followup?: LeadFollowup; onClick?: () => void }) {
    if (!followup) return <span className="text-gray-400 text-xs">—</span>;
    const due = new Date(followup.dueAt);
    const isOverdue = due < new Date();
    const label = due.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
    return (
        <button
            onClick={onClick}
            className={cn('text-xs font-medium text-left hover:underline underline-offset-2 transition-colors', isOverdue ? 'text-red-600' : 'text-gray-600')}
        >
            {followup.type.charAt(0).toUpperCase() + followup.type.slice(1)} · {label}
        </button>
    );
}

function LeadRowMenu({ lead, onFollowup, onProposal, onConvert, onArchive, onAssign }: {
    lead: Lead;
    onFollowup: () => void;
    onProposal: () => void;
    onConvert: () => void;
    onArchive: () => void;
    onAssign?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
    const btnRef = useRef<HTMLButtonElement>(null);

    const handleToggle = () => {
        if (!open && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            setMenuPos({ top: rect.bottom + 4, left: rect.right - 208 });
        }
        setOpen((o) => !o);
    };

    const handleConvert = () => {
        setOpen(false);
        onConvert();
    };

    const item = 'w-full text-left px-3 py-2 text-sm rounded-lg flex items-center gap-2.5 transition-colors';

    return (
        <div>
            <button
                ref={btnRef}
                onClick={handleToggle}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
                <MoreHorizontal className="w-4 h-4" />
            </button>
            {open && typeof document !== 'undefined' && createPortal(
                <>
                    <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />
                    <div
                        className="fixed z-[101] w-52 bg-white rounded-xl shadow-xl border border-gray-200 p-1.5 space-y-0.5"
                        style={{ top: menuPos.top, left: menuPos.left }}
                    >
                        <Link href={`/dashboard/leads/${lead.id}`}
                            className={cn(item, 'text-gray-700 hover:bg-gray-100')}
                            onClick={() => setOpen(false)}>
                            <ExternalLink className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            View Details
                        </Link>
                        <button className={cn(item, 'text-gray-700 hover:bg-gray-100')}
                            onClick={() => { setOpen(false); onProposal(); }}>
                            <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            Share Proposal
                        </button>
                        <button className={cn(item, 'text-gray-700 hover:bg-gray-100')}
                            onClick={() => { setOpen(false); onFollowup(); }}>
                            <CalendarClock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            Add To-Do
                        </button>
                        {onAssign && (
                            <button className={cn(item, 'text-gray-700 hover:bg-gray-100')}
                                onClick={() => { setOpen(false); onAssign(); }}>
                                <UserPlus className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                Assign To...
                            </button>
                        )}
                        <button
                            className={cn(item, 'text-emerald-700 hover:bg-emerald-50')}
                            onClick={handleConvert}
                        >
                            <UserCheck className="w-4 h-4 flex-shrink-0 text-emerald-500" />
                            <span>Convert to Client</span>
                        </button>
                        <div className="my-1 h-px bg-gray-100" />
                        <button className={cn(item, 'text-red-600 hover:bg-red-50')}
                            onClick={() => { setOpen(false); onArchive(); }}>
                            <Archive className="w-4 h-4 text-red-400 flex-shrink-0" />
                            Archive
                        </button>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
}

function LeadStatusSelect({ lead, statuses }: { lead: Lead; statuses: LeadStatus[] }) {
    const updateLead = useUpdateLead(lead.id);
    const [value, setValue] = useState(lead.statusId);

    const current = statuses.find((s) => s.id === value);
    const options: DropdownOption[] = statuses.map(s => ({ value: s.id, label: s.name, color: s.color }));

    const handleChange = async (newStatusId: string) => {
        setValue(newStatusId);
        try {
            await updateLead.mutateAsync({ statusId: newStatusId });
        } catch {
            setValue(lead.statusId);
            toast.error('Failed to update status');
        }
    };

    return (
        <InlineDropdown
            value={value}
            options={options}
            onChange={handleChange}
            disabled={updateLead.isPending}
        />
    );
}

const TEMP_CONFIG = {
    hot:  { label: '🔥 Hot',  cls: 'bg-red-100 border-red-200 text-red-700' },
    warm: { label: '☀ Warm', cls: 'bg-amber-100 border-amber-200 text-amber-700' },
    cold: { label: '❄ Cold', cls: 'bg-blue-100 border-blue-200 text-blue-700' },
} as const;

const TEMP_OPTIONS: DropdownOption<Lead['temperature']>[] = [
    { value: 'hot', label: '🔥 Hot', color: '#dc2626' },
    { value: 'warm', label: '☀ Warm', color: '#d97706' },
    { value: 'cold', label: '❄ Cold', color: '#2563eb' },
];

function LeadTemperatureSelect({ lead }: { lead: Lead }) {
    const updateLead = useUpdateLead(lead.id);
    const [value, setValue] = useState(lead.temperature);

    const handleChange = async (newTemp: Lead['temperature']) => {
        setValue(newTemp);
        try {
            await updateLead.mutateAsync({ temperature: newTemp });
        } catch {
            setValue(lead.temperature);
            toast.error('Failed to update temperature');
        }
    };

    return (
        <InlineDropdown
            value={value}
            options={TEMP_OPTIONS}
            onChange={handleChange}
            disabled={updateLead.isPending}
        />
    );
}

export default function LeadsPage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const permissions = usePermissions();

    const [addOpen, setAddOpen] = useState(false);
    const [followupLead, setFollowupLead] = useState<Lead | null>(null);
    const [proposalLead, setProposalLead] = useState<Lead | null>(null);
    const [convertLead, setConvertLead] = useState<Lead | null>(null);
    const [archiveTarget, setArchiveTarget] = useState<Lead | null>(null);
    const [todoModal, setTodoModal] = useState<{ lead: Lead; followup: LeadFollowup } | null>(null);
    const [todoNote, setTodoNote] = useState('');
    const [assignLead, setAssignLead] = useState<Lead | null>(null);
    const [assigningUserId, setAssigningUserId] = useState('');
    const completeFollowup = useCompleteFollowup();
    const { data: teamMembers = [] } = useTeam();

    const [search, setSearch] = useState(searchParams.get('q') ?? '');
    const [page, setPage] = useState(parseInt(searchParams.get('page') ?? '1'));
    const [showArchived, setShowArchived] = useState(searchParams.get('archived') === 'true');

    // Sync URL
    useEffect(() => {
        const p = new URLSearchParams();
        if (search) p.set('q', search);
        if (page > 1) p.set('page', String(page));
        if (showArchived) p.set('archived', 'true');
        const qs = p.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, [search, page, showArchived, pathname, router]);

    const filters: LeadFilters = {
        search: search || undefined,
        showArchived,
        page,
        pageSize: PAGE_SIZE,
    };

    const { data, isLoading } = useLeads(filters);
    const { data: statuses = [] } = useLeadStatuses();

    const archiveMutation = useArchiveLead();
    const updateLeadMutation = useUpdateLead(assignLead?.id ?? '');

    const handleArchive = async (lead: Lead) => {
        setArchiveTarget(lead);
    };

    const doArchive = async () => {
        if (!archiveTarget) return;
        try {
            await archiveMutation.mutateAsync(archiveTarget.id);
            toast.success('Lead archived');
        } catch {
            toast.error('Failed to archive');
        }
    };

    if (!permissions.canViewLeads) {
        router.replace('/dashboard');
        return null;
    }

    const total = data?.total ?? 0;
    const totalPages = Math.ceil(total / PAGE_SIZE);

    return (
        <div className="space-y-6">
            <ConfirmModal
                isOpen={!!archiveTarget}
                title="Archive Lead"
                message={archiveTarget ? `Archive "${archiveTarget.name}"? You can restore them later.` : ''}
                confirmLabel="Archive"
                variant="warning"
                onConfirm={doArchive}
                onClose={() => setArchiveTarget(null)}
            />
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
                    <p className="text-sm text-gray-500 mt-0.5">{total} lead{total !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => setAddOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors shrink-0">
                    <Plus className="w-4 h-4" /> Add Lead
                </button>
            </div>

            {/* Filters bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        placeholder="Search name, mobile, email..."
                        className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500"
                    />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none py-1">
                    <input type="checkbox" checked={showArchived} onChange={(e) => { setShowArchived(e.target.checked); setPage(1); }}
                        className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                    Show archived
                </label>
            </div>

            {/* Table / Cards */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center h-48">
                        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : !data?.items?.length ? (
                    <div className="flex flex-col items-center justify-center h-48 text-center">
                        <p className="text-gray-400 text-sm mb-4">No leads found</p>
                        <button onClick={() => setAddOpen(true)}
                            className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700">
                            Add your first lead
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Mobile</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Temp.</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Next To-Do</th>
                                        {permissions.canViewTeam && (
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned To</th>
                                        )}
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {data.items.map((lead, idx) => (
                                        <tr key={lead.id} className={cn('hover:bg-gray-50 transition-colors', lead.archivedAt && 'opacity-60')}>
                                            <td className="px-4 py-3 text-gray-400 text-xs">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                                            <td className="px-4 py-3">
                                                <Link href={`/dashboard/leads/${lead.id}`}
                                                    className="font-medium text-gray-900 hover:text-emerald-600 transition-colors">
                                                    {lead.name}
                                                </Link>
                                                {lead.archivedAt && <span className="ml-1 text-xs text-gray-400">(archived)</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <a href={`https://wa.me/${lead.primaryMobile.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center gap-1 text-gray-700 hover:text-emerald-600">
                                                    <MessageSquare className="w-3.5 h-3.5 text-green-500" />
                                                    {lead.primaryMobile}
                                                </a>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">{lead.source?.name ?? '—'}</td>
                                            <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                                                {new Date(lead.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="px-4 py-3">
                                                {statuses.length > 0
                                                    ? <LeadStatusSelect lead={lead} statuses={statuses} />
                                                    : <span className="text-xs text-gray-600">{lead.status.name}</span>
                                                }
                                            </td>
                                            <td className="px-4 py-3">
                                                <LeadTemperatureSelect lead={lead} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <FollowupCell
                                                    followup={lead.followups?.[0]}
                                                    onClick={lead.followups?.[0] ? () => { setTodoNote(''); setTodoModal({ lead, followup: lead.followups![0] }); } : undefined}
                                                />
                                            </td>
                                            {permissions.canViewTeam && (
                                                <td className="px-4 py-3 text-xs text-gray-600">
                                                    {lead.ownerUser?.fullName ?? <span className="text-gray-300">—</span>}
                                                </td>
                                            )}
                                            <td className="px-4 py-3">
                                                <LeadRowMenu
                                                    lead={lead}
                                                    onProposal={() => setProposalLead(lead)}
                                                    onFollowup={() => setFollowupLead(lead)}
                                                    onConvert={() => setConvertLead(lead)}
                                                    onArchive={() => handleArchive(lead)}
                                                    onAssign={permissions.canViewTeam ? () => { setAssigningUserId(lead.ownerUserId ?? ''); setAssignLead(lead); } : undefined}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="md:hidden divide-y divide-gray-100">
                            {data.items.map((lead) => (
                                <div key={lead.id} className={cn('p-4 space-y-3', lead.archivedAt && 'opacity-60')}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <Link href={`/dashboard/leads/${lead.id}`}
                                                className="font-semibold text-gray-900 hover:text-emerald-600 transition-colors text-sm">
                                                {lead.name}
                                            </Link>
                                            {lead.archivedAt && <span className="ml-1 text-xs text-gray-400">(archived)</span>}
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <a href={`https://wa.me/${lead.primaryMobile.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center gap-1 text-xs text-gray-600 hover:text-emerald-600">
                                                    <MessageSquare className="w-3 h-3 text-green-500" />
                                                    {lead.primaryMobile}
                                                </a>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                {lead.source?.name ?? '—'} · {new Date(lead.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                            </p>
                                        </div>
                                        <LeadRowMenu
                                            lead={lead}
                                            onProposal={() => setProposalLead(lead)}
                                            onFollowup={() => setFollowupLead(lead)}
                                            onConvert={() => setConvertLead(lead)}
                                            onArchive={() => handleArchive(lead)}
                                            onAssign={permissions.canViewTeam ? () => { setAssigningUserId(lead.ownerUserId ?? ''); setAssignLead(lead); } : undefined}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {statuses.length > 0
                                            ? <LeadStatusSelect lead={lead} statuses={statuses} />
                                            : <span className="text-xs text-gray-600">{lead.status.name}</span>
                                        }
                                        <LeadTemperatureSelect lead={lead} />
                                    </div>
                                    {lead.followups?.[0] && (
                                        <div className="text-xs text-gray-500">
                                            <span className="font-medium">Next:</span>{' '}
                                            <FollowupCell
                                                followup={lead.followups[0]}
                                                onClick={() => { setTodoNote(''); setTodoModal({ lead, followup: lead.followups![0] }); }}
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                        Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
                    </p>
                    <div className="flex items-center gap-1">
                        <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                            className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="px-3 py-1 text-sm text-gray-700">{page} / {totalPages}</span>
                        <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
                            className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Modals */}
            <LeadFormModal isOpen={addOpen} onClose={() => setAddOpen(false)} />
            {followupLead && (
                <AddFollowupModal
                    isOpen={!!followupLead}
                    onClose={() => setFollowupLead(null)}
                    leadId={followupLead.id}
                />
            )}
            {proposalLead && (
                <ShareProposalModal
                    isOpen={!!proposalLead}
                    onClose={() => setProposalLead(null)}
                    lead={proposalLead}
                />
            )}
            {convertLead && (
                <ConvertToClientModal
                    isOpen={!!convertLead}
                    onClose={() => setConvertLead(null)}
                    lead={convertLead}
                />
            )}

            {/* Assign Lead modal */}
            {assignLead && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-base font-bold text-gray-900">Assign Lead</h3>
                                <p className="text-sm text-gray-500 mt-0.5">{assignLead.name}</p>
                            </div>
                            <button onClick={() => setAssignLead(null)} className="p-1 text-gray-400 hover:text-gray-600">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Team Member</label>
                            <select
                                value={assigningUserId}
                                onChange={(e) => setAssigningUserId(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500"
                            >
                                <option value="">Unassigned</option>
                                {teamMembers.map((m: TeamMember) => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-3 pt-1">
                            <button onClick={() => setAssignLead(null)}
                                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                                Cancel
                            </button>
                            <button
                                disabled={updateLeadMutation.isPending}
                                onClick={async () => {
                                    try {
                                        await updateLeadMutation.mutateAsync({ ownerUserId: assigningUserId || undefined });
                                        toast.success(assigningUserId ? 'Lead assigned' : 'Lead unassigned');
                                        setAssignLead(null);
                                    } catch {
                                        toast.error('Failed to assign lead');
                                    }
                                }}
                                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                            >
                                <Check className="w-4 h-4" />
                                {updateLeadMutation.isPending ? 'Saving…' : 'Assign'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* To-Do detail modal */}
            {todoModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-base font-bold text-gray-900">To-Do</h3>
                                <p className="text-sm text-gray-500 mt-0.5">{todoModal.lead.name}</p>
                            </div>
                            <button onClick={() => setTodoModal(null)} className="p-1 text-gray-400 hover:text-gray-600">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</span>
                                <span className="text-sm font-medium text-gray-800 capitalize">{todoModal.followup.type}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Due</span>
                                <span className={cn('text-sm font-medium', new Date(todoModal.followup.dueAt) < new Date() ? 'text-red-600' : 'text-gray-800')}>
                                    {new Date(todoModal.followup.dueAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                                </span>
                            </div>
                            {todoModal.followup.notes && (
                                <div className="pt-1 border-t border-gray-200">
                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Note</span>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{todoModal.followup.notes}</p>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Completion note (optional)</label>
                            <textarea
                                value={todoNote}
                                onChange={e => setTodoNote(e.target.value)}
                                rows={2}
                                placeholder="Add a note about how it went…"
                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:ring-1 focus:ring-brand focus:border-brand outline-none"
                            />
                        </div>

                        <div className="flex gap-3 pt-1">
                            <button
                                onClick={() => setTodoModal(null)}
                                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                Close
                            </button>
                            <button
                                disabled={completeFollowup.isPending}
                                onClick={async () => {
                                    await completeFollowup.mutateAsync({
                                        leadId: todoModal.lead.id,
                                        followupId: todoModal.followup.id,
                                        notes: todoNote || undefined,
                                    });
                                    toast.success('To-do marked as complete');
                                    setTodoModal(null);
                                }}
                                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-brand rounded-xl hover:bg-brand/90 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
                            >
                                <Check className="w-4 h-4" />
                                {completeFollowup.isPending ? 'Saving…' : 'Mark Complete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
