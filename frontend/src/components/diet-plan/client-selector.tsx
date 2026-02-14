'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search, ChevronRight, Users } from 'lucide-react';
import { useClients } from '@/lib/hooks/use-clients';

export function ClientSelector() {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');
    const { data: clientsData } = useClients(
        { search: searchTerm, pageSize: 10 }
    );

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
            <div className="w-full max-w-md space-y-6 text-center">
                <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-brand" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Select a Client</h2>
                    <p className="text-gray-500 mt-2">Choose a client to start building their diet plan.</p>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search clients by name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-all"
                        autoFocus
                    />
                </div>

                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm text-left max-h-[300px] overflow-y-auto">
                    {!clientsData?.data?.length ? (
                        <div className="p-4 text-center text-gray-500 text-sm">
                            {searchTerm ? 'No clients found matching your search.' : 'Start typing to search...'}
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {clientsData.data.map((c: { id: string; fullName: string; email: string }) => (
                                <button
                                    key={c.id}
                                    onClick={() => router.push(`/dashboard/diet-plans/new?clientId=${c.id}`)}
                                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors group"
                                >
                                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-medium group-hover:bg-brand/10 group-hover:text-brand">
                                        {c.fullName.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900">{c.fullName}</p>
                                        <p className="text-xs text-gray-500">{c.email}</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-gray-400 ml-auto group-hover:text-brand" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="text-sm">
                    <span className="text-gray-500">Don&apos;t see the client? </span>
                    <Link href="/dashboard/clients" className="text-brand font-medium hover:underline">
                        Add new client
                    </Link>
                </div>
            </div>
        </div>
    );
}
