'use client';

import { useState, useEffect } from 'react';
import { useApiClient } from '@/lib/api/use-api-client';
import { useAuth } from '@clerk/nextjs';
import {
    Users,
    Gift,
    Award,
    UserPlus,
    Search,
    RefreshCw,
    CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface ReferralStats {
    overview: {
        clientsWithCodes: number;
        referredClients: number;
        totalReferrals: number;
        freeMonthsEarned: number;
        freeMonthsUsed: number;
        freeMonthsPending: number;
    };
    referralSourceBreakdown: Array<{ source: string; count: number }>;
    topReferrers: Array<{
        id: string;
        name: string;
        code: string;
        referralCount: number;
    }>;
}

interface ClientWithReferrals {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    referralSource: string | null;
    referralSourceName: string | null;
    referralCode: string | null;
    referredBy: { id: string; fullName: string } | null;
    referralCount: number;
    benefit: {
        referralCount: number;
        freeMonthsEarned: number;
        freeMonthsUsed: number;
    } | null;
    createdAt: string;
}

const REFERRAL_SOURCE_LABELS: Record<string, string> = {
    doctor: '👨‍⚕️ Doctor',
    dietitian: '🥗 Dietitian',
    client_referral: '👥 Client Referral',
    social_media: '📱 Social Media',
    website: '🌐 Website',
    other: '📋 Other',
};

export default function ReferralsPage() {
    const api = useApiClient();
    const { isLoaded } = useAuth();
    const [stats, setStats] = useState<ReferralStats | null>(null);
    const [clients, setClients] = useState<ClientWithReferrals[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sourceFilter, setSourceFilter] = useState('');
    const [redeeming, setRedeeming] = useState<string | null>(null);

    useEffect(() => {
        if (isLoaded) {
            fetchData();
        }
    }, [isLoaded, sourceFilter]);

    const fetchData = async () => {
        try {
            const [statsRes, clientsRes] = await Promise.all([
                api.get('/referrals/stats'),
                api.get('/referrals/clients', {
                    params: { source: sourceFilter || undefined, pageSize: 50 },
                }),
            ]);
            setStats(statsRes.data.data);
            setClients(clientsRes.data.data);
        } catch (error) {
            toast.error('Failed to fetch referral data');
        } finally {
            setLoading(false);
        }
    };

    const handleRedeem = async (clientId: string) => {
        setRedeeming(clientId);
        try {
            await api.post(`/referrals/clients/${clientId}/redeem`);
            fetchData();
        } catch (error) {
            toast.error('Failed to redeem');
        } finally {
            setRedeeming(null);
        }
    };

    const filteredClients = clients.filter(
        (client) =>
            client.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.referralCode?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isLoaded || loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-green-500" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Referral Management</h1>
                    <p className="text-gray-500 mt-1">Track referral sources and client rewards</p>
                </div>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <UserPlus className="w-5 h-5 text-green-600" />
                        </div>
                        <span className="text-gray-500 text-sm">Referred Clients</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{stats?.overview.referredClients || 0}</p>
                </div>

                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <span className="text-gray-500 text-sm">Active Referrers</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{stats?.overview.clientsWithCodes || 0}</p>
                </div>

                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <Gift className="w-5 h-5 text-purple-600" />
                        </div>
                        <span className="text-gray-500 text-sm">Free Months Pending</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{stats?.overview.freeMonthsPending || 0}</p>
                </div>

                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-yellow-100 rounded-lg">
                            <Award className="w-5 h-5 text-yellow-600" />
                        </div>
                        <span className="text-gray-500 text-sm">Months Redeemed</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{stats?.overview.freeMonthsUsed || 0}</p>
                </div>
            </div>

            {/* Source Breakdown & Top Referrers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Source Breakdown */}
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Referral Sources</h2>
                    <div className="space-y-3">
                        {stats?.referralSourceBreakdown.map((item) => (
                            <div key={item.source} className="flex justify-between items-center">
                                <span className="text-gray-700">
                                    {REFERRAL_SOURCE_LABELS[item.source] || item.source}
                                </span>
                                <span className="font-medium text-gray-900">{item.count}</span>
                            </div>
                        ))}
                        {(!stats?.referralSourceBreakdown || stats.referralSourceBreakdown.length === 0) && (
                            <p className="text-gray-500 text-sm">No referral source data yet</p>
                        )}
                    </div>
                </div>

                {/* Top Referrers */}
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Referrers</h2>
                    <div className="space-y-3">
                        {stats?.topReferrers.slice(0, 5).map((referrer, index) => (
                            <div key={referrer.id} className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                            index === 1 ? 'bg-gray-100 text-gray-700' :
                                                index === 2 ? 'bg-orange-100 text-orange-700' :
                                                    'bg-gray-50 text-gray-500'
                                        }`}>
                                        {index + 1}
                                    </span>
                                    <div>
                                        <p className="font-medium text-gray-900">{referrer.name}</p>
                                        <p className="text-xs text-gray-500">{referrer.code}</p>
                                    </div>
                                </div>
                                <span className="font-semibold text-green-600">{referrer.referralCount}</span>
                            </div>
                        ))}
                        {(!stats?.topReferrers || stats.topReferrers.length === 0) && (
                            <p className="text-gray-500 text-sm">No referrers yet</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Client List */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search clients..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                    </div>
                    <select
                        value={sourceFilter}
                        onChange={(e) => setSourceFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                        <option value="">All Sources</option>
                        {Object.entries(REFERRAL_SOURCE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Client</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Source</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Code</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Referrals</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Free Months</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredClients.map((client) => (
                                <tr key={client.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-gray-900">{client.fullName}</p>
                                        <p className="text-xs text-gray-500">{client.email}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        {client.referralSource ? (
                                            <span className="text-sm">{REFERRAL_SOURCE_LABELS[client.referralSource] || client.referralSource}</span>
                                        ) : (
                                            <span className="text-gray-400">—</span>
                                        )}
                                        {client.referredBy && (
                                            <p className="text-xs text-green-600">via {client.referredBy.fullName}</p>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {client.referralCode ? (
                                            <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">{client.referralCode}</code>
                                        ) : (
                                            <span className="text-gray-400">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="font-medium text-gray-900">{client.referralCount}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {client.benefit ? (
                                            <div className="text-sm">
                                                <span className="text-green-600">{client.benefit.freeMonthsEarned - client.benefit.freeMonthsUsed}</span>
                                                <span className="text-gray-400"> / {client.benefit.freeMonthsEarned}</span>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400">0</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {client.benefit && client.benefit.freeMonthsEarned > client.benefit.freeMonthsUsed && (
                                            <button
                                                onClick={() => handleRedeem(client.id)}
                                                disabled={redeeming === client.id}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition disabled:opacity-50"
                                            >
                                                {redeeming === client.id ? (
                                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <CheckCircle className="w-3 h-3" />
                                                )}
                                                Redeem
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredClients.length === 0 && (
                    <div className="text-center py-12">
                        <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No clients found</p>
                    </div>
                )}
            </div>
        </div>
    );
}
