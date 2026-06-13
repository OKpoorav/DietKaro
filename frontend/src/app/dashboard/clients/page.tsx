'use client';

import { useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import Link from 'next/link';
import {
    Search,
    Plus,
    ChevronLeft,
    ChevronRight,
    Trash2,
    MessageSquare,
    Loader2,
    X,
    Calendar,
    Video,
    MapPin,
    ChevronDown,
    Pencil,
    ClipboardList,
    FilePlus,
} from 'lucide-react';

import { AddClientModal } from '@/components/modals/add-client-modal';
import { EditClientModal, type EditClientFormData } from '@/components/modals/edit-client-modal';
import { CreateConsultationModal } from '@/components/modals/create-consultation-modal';
import { WhatsAppButton } from '@/components/clients/whatsapp-button';
import { TagChip } from '@/components/clients/tag-chip';
import { useTags, useSetClientTags } from '@/lib/hooks/use-tags';
import { useClients, useCreateClient, useDeleteClient, useUpdateClient, Client } from '@/lib/hooks/use-clients';
import { useApiClient } from '@/lib/api/use-api-client';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { getInitials, formatTimeAgo, calculateAge } from '@/lib/utils/formatters';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

type FilterType = 'all' | 'active' | 'at-risk' | 'completed';

const FILTER_VALUES: FilterType[] = ['all', 'active', 'at-risk', 'completed'];

function parseFilter(value: string | null): FilterType {
    return FILTER_VALUES.includes(value as FilterType) ? (value as FilterType) : 'all';
}

// Reusable dropdown item button
function DropdownItem({
    onClick,
    icon,
    label,
    danger,
}: {
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    danger?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium transition-colors text-left ${
                danger
                    ? 'text-red-500 hover:bg-red-50'
                    : 'text-gray-700 hover:bg-gray-50'
            }`}
        >
            <span className="w-3.5 h-3.5 shrink-0">{icon}</span>
            {label}
        </button>
    );
}

export default function ClientsPage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [filter, setFilter] = useState<FilterType>(() => parseFilter(searchParams.get('filter')));
    const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
    const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get('page') ?? '1') || 1));
    const [tagFilter, setTagFilter] = useState<string[]>(() => {
        const raw = searchParams.get('tags');
        return raw ? raw.split(',').filter(Boolean) : [];
    });
    const [showAddClientModal, setShowAddClientModal] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<Client | null>(null);
    const [consultationTarget, setConsultationTarget] = useState<Client | null>(null);
    const [editTarget, setEditTarget] = useState<Client | null>(null);
    const [openActionId, setOpenActionId] = useState<string | null>(null);

    const { canDeleteClient } = usePermissions();
    const debouncedSearch = useDebouncedValue(search, 300);
    const { data: allTags } = useTags();

    // Close action dropdown on outside click
    const dropdownRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (!openActionId) return;
        const handler = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('[data-action-menu]')) {
                setOpenActionId(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [openActionId]);

    // Mirror filter / search / page / tags to URL so refresh + share preserves state.
    useEffect(() => {
        const params = new URLSearchParams();
        if (debouncedSearch) params.set('q', debouncedSearch);
        if (filter !== 'all') params.set('filter', filter);
        if (page > 1) params.set('page', String(page));
        if (tagFilter.length > 0) params.set('tags', tagFilter.join(','));
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, [debouncedSearch, filter, page, tagFilter, pathname, router]);

    const hasActiveFilters = search !== '' || filter !== 'all' || tagFilter.length > 0;
    const clearFilters = () => {
        setSearch('');
        setFilter('all');
        setPage(1);
        setTagFilter([]);
    };

    const toggleTagFilter = (tagId: string) => {
        setTagFilter((current) =>
            current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId],
        );
        setPage(1);
    };

    // API hooks
    const { data, isLoading, error } = useClients({
        page,
        pageSize: 20,
        search: debouncedSearch || undefined,
        status: filter !== 'all' ? filter : undefined,
        tags: tagFilter.length > 0 ? tagFilter.join(',') : undefined,
    });
    const createClient = useCreateClient();
    const deleteClient = useDeleteClient();
    const updateClient = useUpdateClient();
    const setClientTags = useSetClientTags();
    const api = useApiClient();

    const clients = data?.data || [];
    const meta = data?.meta;

    const handleAddClient = async (
        clientData: { name: string; email?: string; phone?: string; altPhone?: string; altPhoneRelation?: string; dateOfBirth?: string; gender?: string; height?: string; weight?: string; targetWeight?: string; allergies?: string[]; medicalConditions?: string[]; dislikes?: string[]; likedFoods?: string[]; goal?: string; goalDeadline?: string; remarks?: string; primaryDietitianId?: string; beforePhotoFiles?: { front?: File; side?: File; back?: File } },
        reactivate?: boolean,
    ): Promise<{ id: string } | void> => {
        try {
            const created: Client = await createClient.mutateAsync({
                fullName: clientData.name,
                email: clientData.email || undefined,
                phone: clientData.phone,
                altPhone: clientData.altPhone || undefined,
                altPhoneRelation: clientData.altPhoneRelation || undefined,
                dateOfBirth: clientData.dateOfBirth || undefined,
                gender: (clientData.gender || undefined) as Client['gender'],
                heightCm: clientData.height ? Number(clientData.height) : undefined,
                currentWeightKg: clientData.weight ? Number(clientData.weight) : undefined,
                targetWeightKg: clientData.targetWeight ? Number(clientData.targetWeight) : undefined,
                allergies: clientData.allergies ?? [],
                medicalConditions: clientData.medicalConditions ?? [],
                dislikes: clientData.dislikes ?? [],
                likedFoods: clientData.likedFoods ?? [],
                goal: clientData.goal || undefined,
                goalDeadline: clientData.goalDeadline || undefined,
                remarks: clientData.remarks || undefined,
                primaryDietitianId: clientData.primaryDietitianId || undefined,
                ...(reactivate ? { reactivate: true } : {}),
            } as any);

            // Upload before photos if provided (best-effort, non-blocking for UX)
            if (clientData.beforePhotoFiles) {
                const uploads = Object.entries(clientData.beforePhotoFiles)
                    .filter(([, file]) => !!file)
                    .map(([type, file]) => {
                        const fd = new FormData();
                        fd.append('photo', file as File);
                        return api.post(`/clients/${created.id}/before-photos?type=${type}`, fd, {
                            headers: { 'Content-Type': 'multipart/form-data' },
                        }).catch(() => null);
                    });
                await Promise.all(uploads);
            }

            toast.success(reactivate ? 'Client reactivated successfully' : 'Client added successfully');
            return { id: created.id };
        } catch (err: any) {
            const code = err?.response?.data?.error?.code;
            const message = err?.response?.data?.error?.message || 'Failed to create client';

            if (code === 'CLIENT_DEACTIVATED') {
                toast(message, {
                    action: {
                        label: 'Reactivate',
                        onClick: () => {
                            handleAddClient(clientData, true).then((res) => {
                                if (res) setShowAddClientModal(false);
                            });
                        },
                    },
                    duration: 10000,
                });
                return;
            }

            toast.error(message);
        }
    };

    const handleDeleteClient = async (client: Client) => {
        try {
            await deleteClient.mutateAsync(client.id);
            setDeleteConfirm(null);
            toast.success(`${client.fullName} has been removed`);
        } catch (err: any) {
            const message = err?.response?.data?.error?.message || 'Failed to delete client';
            toast.error(message);
        }
    };

    const handleEditClient = (data: EditClientFormData) => {
        if (!editTarget) return;
        updateClient.mutate({
            id: editTarget.id,
            fullName: data.fullName,
            email: data.email || undefined,
            phone: data.phone,
            dateOfBirth: data.dateOfBirth || undefined,
            gender: (data.gender as 'male' | 'female' | 'other') || undefined,
            heightCm: data.heightCm ? Number(data.heightCm) : undefined,
            currentWeightKg: data.currentWeightKg ? Number(data.currentWeightKg) : undefined,
            targetWeightKg: data.targetWeightKg ? Number(data.targetWeightKg) : undefined,
            allergies: data.allergies,
            medicalConditions: data.medicalConditions,
            dislikes: data.dislikes,
            likedFoods: data.likedFoods,
            altPhone: data.altPhone || undefined,
            altPhoneRelation: data.altPhoneRelation || undefined,
            remarks: data.remarks || undefined,
            loginEnabled: data.loginEnabled,
        } as Parameters<typeof updateClient.mutate>[0], {
            onSuccess: () => {
                setClientTags.mutate({ clientId: editTarget.id, tagIds: data.tagIds });
                setEditTarget(null);
                toast.success('Client updated');
            },
            onError: (err: any) => {
                toast.error(err?.response?.data?.error?.message || 'Failed to update client');
            },
        });
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-gray-900">Clients</h1>
                <button
                    onClick={() => setShowAddClientModal(true)}
                    className="flex items-center gap-2 h-10 px-4 bg-brand hover:bg-brand/90 text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Add New Client
                </button>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-grow">
                    <label className="flex h-10 w-full">
                        <div className="flex w-full flex-1 items-stretch rounded-lg h-full bg-gray-100">
                            <div className="flex items-center justify-center pl-4 text-brand">
                                <Search className="w-4 h-4" />
                            </div>
                            <input
                                className="flex w-full min-w-0 flex-1 bg-transparent h-full placeholder:text-gray-500 pl-3 pr-4 text-sm outline-none text-gray-900"
                                placeholder="Search by name, phone, or email..."
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setPage(1);
                                }}
                            />
                        </div>
                    </label>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                    {FILTER_VALUES.map((f) => (
                        <button
                            key={f}
                            onClick={() => { setFilter(f); setPage(1); }}
                            className={`flex h-8 shrink-0 items-center justify-center px-4 rounded-lg text-xs font-medium capitalize transition-colors ${
                                filter === f ? 'bg-brand text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                        >
                            {f === 'at-risk' ? 'At Risk' : f}
                        </button>
                    ))}
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="flex h-8 items-center gap-1 px-3 text-xs font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Tag filter row */}
            {(allTags?.length ?? 0) > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tags:</span>
                    {(allTags ?? [])
                        .filter((t) => t.active)
                        .map((tag) => {
                            const selected = tagFilter.includes(tag.id);
                            return (
                                <button
                                    key={tag.id}
                                    type="button"
                                    onClick={() => toggleTagFilter(tag.id)}
                                    className={`transition-opacity ${selected ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
                                >
                                    <TagChip name={tag.name} color={tag.color} size="sm" />
                                </button>
                            );
                        })}
                </div>
            )}

            {/* Loading State */}
            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-brand" />
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                    Failed to load clients. Please try again.
                </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && clients.length === 0 && (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                    <p className="text-gray-500 text-sm">No clients found.</p>
                    <button
                        onClick={() => setShowAddClientModal(true)}
                        className="mt-4 text-brand font-medium hover:underline text-sm"
                    >
                        Add your first client
                    </button>
                </div>
            )}

            {/* Client Cards */}
            {!isLoading && clients.length > 0 && (
                <div className="flex flex-col gap-2">
                    {clients.map((client: Client) => {
                        const age = calculateAge(client.dateOfBirth);
                        const weightDiff = client.currentWeightKg && client.targetWeightKg
                            ? +(client.currentWeightKg - client.targetWeightKg).toFixed(1)
                            : null;
                        const stats: { label: string; value: string }[] = [
                            { label: 'Current', value: client.currentWeightKg ? `${client.currentWeightKg}kg` : '—' },
                            { label: 'Goal', value: client.targetWeightKg ? `${client.targetWeightKg}kg` : '—' },
                            { label: 'To Goal', value: weightDiff !== null ? `${weightDiff > 0 ? '-' : '+'}${Math.abs(weightDiff)}kg` : '—' },
                            { label: 'Last Active', value: client.lastActivityAt ? formatTimeAgo(client.lastActivityAt) : '—' },
                        ];
                        const isActionOpen = openActionId === client.id;

                        return (
                            <div key={client.id} className="bg-white rounded-xl border border-gray-200 px-4 py-2.5 lg:px-5 hover:shadow-sm transition-shadow">
                                {/* Top row: identity + actions */}
                                <div className="flex items-center gap-3">
                                    <Link href={`/dashboard/clients/${client.id}`} className="shrink-0">
                                        <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center text-brand font-bold text-sm hover:bg-brand/30 transition-colors">
                                            {getInitials(client.fullName)}
                                        </div>
                                    </Link>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Link href={`/dashboard/clients/${client.id}`} className="font-bold text-gray-900 text-sm hover:text-brand transition-colors">
                                                {client.fullName}
                                            </Link>
                                            {client.status === 'active' && (
                                                <span className="text-xs font-black italic tracking-wide bg-gradient-to-r from-orange-400 to-brand bg-clip-text text-transparent select-none">
                                                    ACTIVE
                                                </span>
                                            )}
                                            {client.status === 'at-risk' && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">At Risk</span>
                                            )}
                                            {client.status === 'completed' && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Completed</span>
                                            )}
                                            <WhatsAppButton phone={client.phone} clientName={client.fullName} size="sm" />
                                        </div>
                                        <p className="text-[11px] text-gray-500 mt-0.5">
                                            {[
                                                age ? `${age} Yrs` : null,
                                                client.gender ? client.gender.charAt(0).toUpperCase() + client.gender.slice(1) : null,
                                                client.phone || null,
                                            ].filter(Boolean).join('  ·  ')}
                                        </p>
                                        {/* Chips row: subscription, assigned dietitian, tags, consultation */}
                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                            {/* Subscription status */}
                                            {client.subscription ? (
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                                    client.subscription.status === 'deactivated'
                                                        ? 'bg-gray-100 text-gray-400'
                                                        : client.subscription.paymentStatus === 'paid'
                                                        ? 'bg-emerald-50 text-emerald-700'
                                                        : 'bg-orange-50 text-orange-600'
                                                }`}>
                                                    {client.subscription.status === 'deactivated'
                                                        ? '○ Deactivated'
                                                        : client.subscription.paymentStatus === 'paid'
                                                        ? '● Paid'
                                                        : '● Unpaid'}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                                                    ○ No plan
                                                </span>
                                            )}
                                            {/* Active diet plan */}
                                            {(() => {
                                                const plan = client.dietPlans?.[0];
                                                if (plan) {
                                                    const start = new Date(plan.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                                                    const end = plan.endDate
                                                        ? new Date(plan.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                                                        : '∞';
                                                    return (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                                                            📋 {start} – {end}
                                                        </span>
                                                    );
                                                }
                                                return (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-50 text-gray-400">
                                                        📋 No diet plan
                                                    </span>
                                                );
                                            })()}
                                            {/* Assigned dietitian (owner/admin only) */}
                                            {canDeleteClient && client.primaryDietitian && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                                                    👤 {client.primaryDietitian.fullName}
                                                </span>
                                            )}
                                            {/* Tags */}
                                            {(client.tagAssignments?.length ?? 0) > 0 && (
                                                <>
                                                    {client.tagAssignments!.slice(0, 2).map((a) => (
                                                        <TagChip key={a.tagId} name={a.tag.name} color={a.tag.color} size="xs" />
                                                    ))}
                                                    {client.tagAssignments!.length > 2 && (
                                                        <span className="text-[10px] text-gray-400 px-1">+{client.tagAssignments!.length - 2} more</span>
                                                    )}
                                                </>
                                            )}
                                            {/* Next consultation (desktop only) */}
                                            <span className="hidden md:inline-flex">
                                                {(client.consultations?.length ?? 0) > 0 ? (() => {
                                                    const c = client.consultations![0];
                                                    const d = new Date(c.scheduledAt);
                                                    const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                                                    const chip = (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                                                            {c.mode === 'online' ? <Video className="w-2.5 h-2.5" /> : <MapPin className="w-2.5 h-2.5" />}
                                                            {label}
                                                            {c.mode === 'online' && c.meetLink && (
                                                                <span className="ml-0.5 text-blue-500 underline">Join</span>
                                                            )}
                                                        </span>
                                                    );
                                                    return c.mode === 'online' && c.meetLink ? (
                                                        <a href={c.meetLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                                                            {chip}
                                                        </a>
                                                    ) : chip;
                                                })() : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-50 text-gray-400">
                                                        <Calendar className="w-2.5 h-2.5" /> No consultation
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Desktop-only stats */}
                                    <div className="hidden lg:grid grid-cols-4 gap-1.5 shrink-0">
                                        {stats.map(({ label, value }) => (
                                            <div key={label} className="bg-gray-50 rounded-lg px-2.5 py-1.5 text-center min-w-[64px]">
                                                <p className="text-xs font-bold text-gray-800">{value}</p>
                                                <p className="text-[9px] text-gray-400 mt-0.5">{label}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Actions dropdown */}
                                    <div className="relative shrink-0" data-action-menu={client.id}>
                                        <button
                                            onClick={() => setOpenActionId(isActionOpen ? null : client.id)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap"
                                        >
                                            Actions
                                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isActionOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                        {isActionOpen && (
                                            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-20 min-w-[168px] py-1">
                                                <DropdownItem
                                                    icon={<FilePlus className="w-3.5 h-3.5" />}
                                                    label="Create Diet Plan"
                                                    onClick={() => { setOpenActionId(null); window.open(`/dashboard/diet-plans/new?clientId=${client.id}`, '_blank'); }}
                                                />
                                                <DropdownItem
                                                    icon={<ClipboardList className="w-3.5 h-3.5" />}
                                                    label="View Diet Plan"
                                                    onClick={() => { setOpenActionId(null); router.push(`/dashboard/clients/${client.id}?tab=diet-plan`); }}
                                                />
                                                <DropdownItem
                                                    icon={<Pencil className="w-3.5 h-3.5" />}
                                                    label="Edit Client"
                                                    onClick={() => { setOpenActionId(null); setEditTarget(client); }}
                                                />
                                                <div className="my-1 border-t border-gray-100" />
                                                <DropdownItem
                                                    icon={<Calendar className="w-3.5 h-3.5" />}
                                                    label="Consultation"
                                                    onClick={() => { setOpenActionId(null); setConsultationTarget(client); }}
                                                />
                                                <DropdownItem
                                                    icon={<MessageSquare className="w-3.5 h-3.5" />}
                                                    label="Message"
                                                    onClick={() => { setOpenActionId(null); router.push(`/dashboard/messages?client=${client.id}`); }}
                                                />
                                                {canDeleteClient && (
                                                    <>
                                                        <div className="my-1 border-t border-gray-100" />
                                                        <DropdownItem
                                                            icon={<Trash2 className="w-3.5 h-3.5" />}
                                                            label="Remove"
                                                            danger
                                                            onClick={() => { setOpenActionId(null); setDeleteConfirm(client); }}
                                                        />
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Mobile-only: mini stats row */}
                                <div className="lg:hidden mt-2">
                                    <div className="grid grid-cols-4 gap-1">
                                        {stats.map(({ label, value }) => (
                                            <div key={label} className="bg-gray-50 rounded-lg px-2 py-1 text-center">
                                                <p className="text-[11px] font-bold text-gray-800">{value}</p>
                                                <p className="text-[9px] text-gray-400 mt-0.5">{label}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {meta && (
                <div className="flex items-center justify-between px-1">
                    <p className="text-sm text-gray-600">
                        Showing <span className="font-medium">{(page - 1) * (meta.pageSize || 20) + 1}</span>–
                        <span className="font-medium">{Math.min(page * (meta.pageSize || 20), meta.total)}</span> of{' '}
                        <span className="font-medium">{meta.total}</span> clients
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={!meta.hasNextPage && page >= meta.totalPages}
                            className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Add Client Modal */}
            <AddClientModal
                isOpen={showAddClientModal}
                onClose={() => setShowAddClientModal(false)}
                onSubmit={handleAddClient}
            />

            {/* Edit Client Modal */}
            {editTarget && (
                <EditClientModal
                    isOpen={!!editTarget}
                    onClose={() => setEditTarget(null)}
                    client={editTarget}
                    onSubmit={handleEditClient}
                    isLoading={updateClient.isPending}
                />
            )}

            {/* Delete Confirmation Dialog */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
                        <h3 className="text-lg font-semibold text-gray-900">Remove Client</h3>
                        <p className="mt-2 text-sm text-gray-600">
                            Are you sure you want to remove <span className="font-medium">{deleteConfirm.fullName}</span>?
                            Their data will be preserved and the account can be reactivated later.
                        </p>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteClient(deleteConfirm)}
                                disabled={deleteClient.isPending}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                            >
                                {deleteClient.isPending ? 'Removing...' : 'Remove'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Schedule Consultation Modal */}
            {consultationTarget && (
                <CreateConsultationModal
                    isOpen={!!consultationTarget}
                    onClose={() => setConsultationTarget(null)}
                    clientId={consultationTarget.id}
                    clientName={consultationTarget.fullName}
                    clientPhone={consultationTarget.phone}
                />
            )}
        </div>
    );
}
