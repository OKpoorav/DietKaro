'use client';

import { useState } from 'react';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import Link from 'next/link';
import {
    Search,
    Plus,
    ChevronLeft,
    ChevronRight,
    Trash2,
    MessageSquare,
    Eye,
    Loader2,
} from 'lucide-react';
import { AddClientModal } from '@/components/modals/add-client-modal';
import { useClients, useCreateClient, useDeleteClient, Client } from '@/lib/hooks/use-clients';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { getInitials, formatTimeAgo } from '@/lib/utils/formatters';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type FilterType = 'all' | 'active' | 'at-risk' | 'completed';

export default function ClientsPage() {
    const [filter, setFilter] = useState<FilterType>('all');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [showAddClientModal, setShowAddClientModal] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<Client | null>(null);

    const router = useRouter();
    const { canDeleteClient } = usePermissions();
    const debouncedSearch = useDebouncedValue(search, 300);

    // API hooks
    const { data, isLoading, error } = useClients({
        page,
        pageSize: 20,
        search: debouncedSearch || undefined,
        status: filter !== 'all' ? filter : undefined,
    });
    const createClient = useCreateClient();
    const deleteClient = useDeleteClient();

    const clients = data?.data || [];
    const meta = data?.meta;

    const handleAddClient = async (clientData: { name: string; email: string; phone?: string; dateOfBirth?: string; gender?: string; height?: string; weight?: string; targetWeight?: string }, reactivate?: boolean) => {
        try {
            await createClient.mutateAsync({
                fullName: clientData.name,
                email: clientData.email,
                phone: clientData.phone,
                dateOfBirth: clientData.dateOfBirth || undefined,
                gender: (clientData.gender || undefined) as Client['gender'],
                heightCm: clientData.height ? Number(clientData.height) : undefined,
                currentWeightKg: clientData.weight ? Number(clientData.weight) : undefined,
                targetWeightKg: clientData.targetWeight ? Number(clientData.targetWeight) : undefined,
                ...(reactivate ? { reactivate: true } : {}),
            } as any);
            setShowAddClientModal(false);
            toast.success(reactivate ? 'Client reactivated successfully' : 'Client added successfully');
        } catch (err: any) {
            const code = err?.response?.data?.error?.code;
            const message = err?.response?.data?.error?.message || 'Failed to create client';

            if (code === 'CLIENT_DEACTIVATED') {
                // Ask for confirmation to reactivate
                toast(message, {
                    action: {
                        label: 'Reactivate',
                        onClick: () => handleAddClient(clientData, true),
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


    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Clients</h1>
                <button
                    onClick={() => setShowAddClientModal(true)}
                    className="flex items-center gap-2 h-10 px-4 bg-brand hover:bg-brand/90 text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Add New Client
                </button>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                {/* Search Bar */}
                <div className="flex-grow">
                    <label className="flex h-12 w-full">
                        <div className="flex w-full flex-1 items-stretch rounded-lg h-full bg-gray-100">
                            <div className="flex items-center justify-center pl-4 text-brand">
                                <Search className="w-5 h-5" />
                            </div>
                            <input
                                className="flex w-full min-w-0 flex-1 bg-transparent h-full placeholder:text-gray-500 pl-3 pr-4 text-base outline-none text-gray-900"
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

                {/* Filter Chips */}
                <div className="flex gap-2 items-center flex-wrap">
                    {(['all', 'active', 'at-risk', 'completed'] as FilterType[]).map((f) => (
                        <button
                            key={f}
                            onClick={() => {
                                setFilter(f);
                                setPage(1);
                            }}
                            className={`flex h-8 shrink-0 items-center justify-center px-4 rounded-lg text-sm font-medium capitalize transition-colors ${filter === f
                                ? 'bg-brand text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                        >
                            {f === 'at-risk' ? 'At Risk' : f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-brand" />
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    Failed to load clients. Please try again.
                </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && clients.length === 0 && (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                    <p className="text-gray-500">No clients found.</p>
                    <button
                        onClick={() => setShowAddClientModal(true)}
                        className="mt-4 text-brand font-medium hover:underline"
                    >
                        Add your first client
                    </button>
                </div>
            )}

            {/* Table */}
            {!isLoading && clients.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Client
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Phone
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Weight (current/goal)
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Dietitian
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Last Activity
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {clients.map((client: Client) => (
                                    <tr key={client.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center text-brand font-bold">
                                                    {getInitials(client.fullName)}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-gray-900">{client.fullName}</span>
                                                    {client.status === 'at-risk' && (
                                                        <span className="w-2.5 h-2.5 rounded-full bg-orange-400" title="At risk" />
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                                            {client.phone || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                                            {client.currentWeightKg || '-'} kg / {client.targetWeightKg || '-'} kg
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                                            {client.primaryDietitian?.fullName || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                                            {client.lastActivityAt ? formatTimeAgo(client.lastActivityAt) : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/dashboard/clients/${client.id}`}
                                                    className="text-brand hover:underline text-sm font-medium flex items-center gap-1"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                    View
                                                </Link>
                                                <button
                                                    onClick={() => router.push(`/dashboard/messages?client=${client.id}`)}
                                                    className="text-brand hover:underline text-sm font-medium flex items-center gap-1"
                                                >
                                                    <MessageSquare className="w-4 h-4" />
                                                    Message
                                                </button>
                                                {canDeleteClient && (
                                                    <button
                                                        onClick={() => setDeleteConfirm(client)}
                                                        className="text-gray-400 hover:text-red-500 text-sm font-medium flex items-center gap-1 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Pagination */}
            {meta && (
                <div className="flex items-center justify-between px-1">
                    <p className="text-sm text-gray-600">
                        Showing <span className="font-medium">{(page - 1) * (meta.pageSize || 20) + 1}</span>-
                        <span className="font-medium">{Math.min(page * (meta.pageSize || 20), meta.total)}</span> of{' '}
                        <span className="font-medium">{meta.total}</span> clients
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={!meta.hasNextPage && page >= meta.totalPages}
                            className="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50"
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
        </div>
    );
}
