'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
    Plus, Search, MoreHorizontal, UserCheck, Archive,
    CalendarClock, ExternalLink, ChevronLeft, ChevronRight, MessageSquare,
    FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLeads, useArchiveLead, type Lead, type LeadFilters } from '@/lib/hooks/use-leads';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { LeadStatusPill } from '@/components/leads/lead-status-pill';
import { LeadTemperaturePill } from '@/components/leads/lead-temperature-pill';
import { LeadFormModal } from '@/components/leads/lead-form-modal';
import { AddFollowupModal } from '@/components/leads/add-followup-modal';
import { ConvertToClientModal } from '@/components/leads/convert-to-client-modal';
import { ShareProposalModal } from '@/components/leads/share-proposal-modal';
import { toast } from 'sonner';

const PAGE_SIZE = 25;

function FollowupCell({ followup }: { followup?: { dueAt: string; type: string } }) {
    if (!followup) return <span className="text-gray-400 text-xs">—</span>;
    const due = new Date(followup.dueAt);
    const isOverdue = due < new Date();
    const label = due.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
    return (
        <span className={cn('text-xs font-medium', isOverdue ? 'text-red-600' : 'text-gray-600')}>
            {followup.type.charAt(0).toUpperCase() + followup.type.slice(1)} · {label}
        </span>
    );
}

function LeadRowMenu({ lead, onFollowup, onProposal, onConvert, onArchive }: {
    lead: Lead;
    onFollowup: () => void;
    onProposal: () => void;
    onConvert: () => void;
    onArchive: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
    const btnRef = useRef<HTMLButtonElement>(null);
    const canConvert = lead.status.name === 'Interested' || lead.status.name === 'Consultation Booked';

    const handleToggle = () => {
        if (!open && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            setMenuPos({ top: rect.bottom + 4, left: rect.right - 208 });
        }
        setOpen((o) => !o);
    };

    const handleConvert = () => {
        setOpen(false);
        if (!canConvert) {
            toast.info('Change status to "Interested" or "Consultation Booked" before converting');
            return;
        }
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
                        <button
                            className={cn(item, canConvert ? 'text-emerald-700 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-50')}
                            onClick={handleConvert}
                        >
                            <UserCheck className={cn('w-4 h-4 flex-shrink-0', canConvert ? 'text-emerald-500' : 'text-gray-300')} />
                            <span>Convert to Client</span>
                            {!canConvert && <span className="ml-auto text-[10px] text-gray-300">ⓘ</span>}
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

export default function LeadsPage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const permissions = usePermissions();

    const [addOpen, setAddOpen] = useState(false);
    const [followupLead, setFollowupLead] = useState<Lead | null>(null);
    const [proposalLead, setProposalLead] = useState<Lead | null>(null);
    const [convertLead, setConvertLead] = useState<Lead | null>(null);

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

    const archiveMutation = useArchiveLead();

    const handleArchive = async (lead: Lead) => {
        if (!confirm(`Archive "${lead.name}"?`)) return;
        try {
            await archiveMutation.mutateAsync(lead.id);
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
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
                    <p className="text-sm text-gray-500 mt-0.5">{total} lead{total !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => setAddOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors">
                    <Plus className="w-4 h-4" /> Add Lead
                </button>
            </div>

            {/* Filters bar */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        placeholder="Search name, mobile, email..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500"
                    />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                    <input type="checkbox" checked={showArchived} onChange={(e) => { setShowArchived(e.target.checked); setPage(1); }}
                        className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                    Show archived
                </label>
            </div>

            {/* Table */}
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
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Mobile</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Reference</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Referral</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Temp.</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Next To-Do</th>
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
                                        <td className="px-4 py-3 text-gray-600 max-w-[120px] truncate">{lead.reference ?? '—'}</td>
                                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                                            {new Date(lead.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 text-xs capitalize">{lead.referralType?.replace(/_/g, ' ') ?? '—'}</td>
                                        <td className="px-4 py-3">
                                            <LeadStatusPill name={lead.status.name} color={lead.status.color} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <LeadTemperaturePill temperature={lead.temperature} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <FollowupCell followup={lead.followups?.[0]} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                <Link href={`/dashboard/leads/${lead.id}`}
                                                    className="p-1.5 rounded-md text-gray-400 hover:text-emerald-600 hover:bg-emerald-50">
                                                    <ExternalLink className="w-4 h-4" />
                                                </Link>
                                                <LeadRowMenu
                                                    lead={lead}
                                                    onProposal={() => setProposalLead(lead)}
                                                    onFollowup={() => setFollowupLead(lead)}
                                                    onConvert={() => setConvertLead(lead)}
                                                    onArchive={() => handleArchive(lead)}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
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
        </div>
    );
}
