'use client';

import { useMemo, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
    Users,
    Plus,
    ChevronRight,
    Loader2,
    Calendar as CalendarIcon,
    AlertTriangle,
    Camera,
    ArrowUpRight,
    Activity,
    TrendingUp,
    TrendingDown,
    Clock,
    Phone,
    Video,
    ChartLine,
} from 'lucide-react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
} from 'recharts';
import { toast } from 'sonner';
import { useDashboardStats } from '@/lib/hooks/use-dashboard';
import { useCalendarEvents, type CalendarConsultation } from '@/lib/hooks/use-calendar';
import { useCreateClient, Client } from '@/lib/hooks/use-clients';
import { AddClientModal } from '@/components/modals/add-client-modal';
import { formatTimeAgo } from '@/lib/utils/formatters';

// ─── Greeting helpers ────────────────────────────────────────────────────────

function timeOfDayGreeting(): string {
    const h = new Date().getHours();
    if (h < 5) return 'Good night';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 21) return 'Good evening';
    return 'Good night';
}

function buildOperationalInsight(stats?: {
    pendingReviews: number;
    totalClients: number;
    adherencePercent: number;
    activeDietPlans: number;
}): string {
    if (!stats) return 'Loading insights for the day…';
    const lines: string[] = [];
    if (stats.pendingReviews > 0) lines.push(`${stats.pendingReviews} meal review${stats.pendingReviews === 1 ? '' : 's'} pending`);
    if (stats.adherencePercent < 70 && stats.totalClients > 0) lines.push(`average adherence below target`);
    if (stats.activeDietPlans > 0) lines.push(`${stats.activeDietPlans} active plan${stats.activeDietPlans === 1 ? '' : 's'}`);
    if (lines.length === 0) return 'Everything looks great today.';
    return lines.slice(0, 2).join(' · ');
}

// ─── Small chart ─────────────────────────────────────────────────────────────

function AdherenceChart({ data }: { data: { day: string; value: number }[] }) {
    const chartData = data.length > 0 ? data : [
        { day: 'Mon', value: 0 }, { day: 'Tue', value: 0 }, { day: 'Wed', value: 0 },
        { day: 'Thu', value: 0 }, { day: 'Fri', value: 0 }, { day: 'Sat', value: 0 }, { day: 'Sun', value: 0 },
    ];
    return (
        <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                <defs>
                    <linearGradient id="adherence-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f3" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 100]} ticks={[0, 50, 100]} />
                <RechartsTooltip
                    cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '4 4' }}
                    contentStyle={{
                        background: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 10,
                        fontSize: 12,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                    }}
                    formatter={(v: number) => [`${v}%`, 'Adherence']}
                />
                <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#adherence-fill)"
                    activeDot={{ r: 5, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}

// ─── Insight widget shell ────────────────────────────────────────────────────

interface InsightWidgetProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    delta?: { value: string; positive: boolean } | null;
    sub?: string;
    accent?: 'emerald' | 'amber' | 'blue' | 'rose' | 'slate';
}

function InsightWidget({ icon, label, value, delta, sub, accent = 'emerald' }: InsightWidgetProps) {
    const accentBg = {
        emerald: 'bg-emerald-50 text-emerald-600',
        amber: 'bg-amber-50 text-amber-600',
        blue: 'bg-blue-50 text-blue-600',
        rose: 'bg-rose-50 text-rose-600',
        slate: 'bg-slate-100 text-slate-600',
    }[accent];
    return (
        <div className="group rounded-xl border border-gray-200/80 bg-white p-4 hover:shadow-sm hover:border-gray-300 transition-all">
            <div className="flex items-start justify-between">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accentBg}`}>{icon}</div>
                {delta && (
                    <span className={`text-[11px] font-medium inline-flex items-center gap-0.5 ${delta.positive ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {delta.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {delta.value}
                    </span>
                )}
            </div>
            <p className="mt-3 text-[11px] uppercase tracking-wide text-gray-400 font-medium">{label}</p>
            <p className="mt-1 text-xl font-semibold text-gray-900 tabular-nums">{value}</p>
            {sub && <p className="mt-1 text-[11px] text-gray-500">{sub}</p>}
        </div>
    );
}

// ─── Status chip ─────────────────────────────────────────────────────────────

function statusChip(status: string) {
    const map: Record<string, { label: string; className: string; dot: string }> = {
        active: { label: 'On Track', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
        'at-risk': { label: 'At Risk', className: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
        new: { label: 'New', className: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
        inactive: { label: 'Inactive', className: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' },
    };
    return map[status] ?? map.active;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const { user } = useUser();
    const firstName = user?.firstName || 'there';
    const greeting = timeOfDayGreeting();

    const { data, isLoading, error } = useDashboardStats();
    const createClient = useCreateClient();
    const queryClient = useQueryClient();
    const [showAddClientModal, setShowAddClientModal] = useState(false);

    // Today's calendar window
    const { start: todayStart, end: todayEnd } = useMemo(() => {
        const s = new Date(); s.setHours(0, 0, 0, 0);
        const e = new Date(); e.setHours(23, 59, 59, 999);
        return { start: s, end: e };
    }, []);
    const { data: calendarData } = useCalendarEvents(todayStart, todayEnd);
    const todaysConsults: CalendarConsultation[] = useMemo(
        () => (calendarData?.consultations ?? []).slice().sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
        [calendarData],
    );

    const handleAddClient = async (
        clientData: { name: string; email?: string; phone?: string; dateOfBirth?: string; gender?: string; height?: string; weight?: string; targetWeight?: string; allergies?: string[]; medicalConditions?: string[]; dislikes?: string[]; likedFoods?: string[]; goal?: string; goalDeadline?: string; healthNotes?: string },
        reactivate?: boolean,
    ): Promise<{ id: string } | void> => {
        try {
            const created: Client = await createClient.mutateAsync({
                fullName: clientData.name,
                email: clientData.email || undefined,
                phone: clientData.phone,
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
                healthNotes: clientData.healthNotes || undefined,
                ...(reactivate ? { reactivate: true } : {}),
            } as Parameters<typeof createClient.mutateAsync>[0]);
            toast.success(reactivate ? 'Client reactivated successfully' : 'Client added successfully');
            return { id: created.id };
        } catch (err: unknown) {
            const e = err as { response?: { data?: { error?: { code?: string; message?: string } } } };
            const code = e?.response?.data?.error?.code;
            const message = e?.response?.data?.error?.message || 'Failed to create client';
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

    const handleModalClose = () => {
        setShowAddClientModal(false);
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    };

    const stats = data?.stats;
    const recentClients = data?.recentClients || [];
    const pendingReviews = data?.pendingReviews || [];
    const weeklyAdherence = data?.weeklyAdherence || [];

    const atRiskClients = recentClients.filter((c) => c.status === 'at-risk');
    const adherenceTrend = useMemo(() => {
        if (weeklyAdherence.length < 2) return null;
        const head = weeklyAdherence.slice(0, Math.ceil(weeklyAdherence.length / 2));
        const tail = weeklyAdherence.slice(Math.ceil(weeklyAdherence.length / 2));
        const avg = (xs: { value: number }[]) => xs.length === 0 ? 0 : xs.reduce((s, x) => s + x.value, 0) / xs.length;
        const delta = avg(tail) - avg(head);
        return Math.round(delta * 10) / 10;
    }, [weeklyAdherence]);

    return (
        <div className="space-y-6 max-w-[1400px]">
            {/* ── Greeting + actions ─────────────────────────────────────── */}
            <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-2xl lg:text-[28px] font-semibold tracking-tight text-gray-900">
                        {greeting}, {firstName}
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        {buildOperationalInsight(stats)}
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Link
                        href="/dashboard/clients?action=schedule"
                        className="inline-flex items-center gap-1.5 h-9 px-3 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                    >
                        <CalendarIcon className="w-3.5 h-3.5" />
                        Schedule Consult
                    </Link>
                    <Link
                        href="/dashboard/diet-plans/new"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 h-9 px-3 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Create Plan
                    </Link>
                    <button
                        type="button"
                        onClick={() => setShowAddClientModal(true)}
                        className="inline-flex items-center gap-1.5 h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-emerald-600/10"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add Client
                    </button>
                </div>
            </header>

            {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-rose-700 text-sm">
                    Failed to load dashboard data. Please refresh.
                </div>
            )}
            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                </div>
            )}

            {/* ── Section 1: Hero analytics + ops ───────────────────────── */}
            <section className="grid lg:grid-cols-3 gap-5">
                {/* Adherence chart */}
                <div className="lg:col-span-2 rounded-2xl border border-gray-200/80 bg-white p-5">
                    <div className="flex items-start justify-between mb-1">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-900">Weekly Client Adherence</h2>
                            <p className="text-xs text-gray-500 mt-0.5">Average across all active clients (last 7 days)</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Avg</p>
                                <p className="text-xl font-semibold text-gray-900 tabular-nums">
                                    {stats ? `${stats.adherencePercent}%` : '—'}
                                </p>
                            </div>
                            {adherenceTrend !== null && (
                                <div className="text-right">
                                    <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Trend</p>
                                    <p className={`text-xs font-medium tabular-nums inline-flex items-center gap-0.5 mt-1 ${adherenceTrend >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                        {adherenceTrend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {Math.abs(adherenceTrend)}%
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="-ml-2 mt-2">
                        <AdherenceChart data={weeklyAdherence} />
                    </div>
                </div>

                {/* Stacked operational cards */}
                <div className="space-y-3">
                    <TodaysScheduleCard consults={todaysConsults} />
                    <NeedsAttentionCard atRisk={atRiskClients} />
                    <PendingReviewsCard reviews={pendingReviews} />
                </div>
            </section>

            {/* ── Section 2: Recent client activity ─────────────────────── */}
            <section className="rounded-2xl border border-gray-200/80 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-sm font-semibold text-gray-900">Recent Client Activity</h2>
                        <p className="text-[11px] text-gray-500 mt-0.5">Latest engagement across your roster</p>
                    </div>
                    <Link href="/dashboard/clients" className="text-xs font-medium text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1">
                        View all
                        <ArrowUpRight className="w-3 h-3" />
                    </Link>
                </div>
                <div className="divide-y divide-gray-100">
                    {recentClients.length === 0 ? (
                        <div className="py-10 text-center">
                            <Users className="w-8 h-8 text-gray-300 mx-auto" />
                            <p className="mt-2 text-sm text-gray-500">No clients yet</p>
                            <button
                                type="button"
                                onClick={() => setShowAddClientModal(true)}
                                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                            >
                                <Plus className="w-3 h-3" /> Add your first client
                            </button>
                        </div>
                    ) : (
                        recentClients.slice(0, 6).map((c) => {
                            const chip = statusChip(c.status);
                            return (
                                <Link
                                    key={c.id}
                                    href={`/dashboard/clients/${c.id}`}
                                    className="group flex items-center gap-4 px-5 py-3 hover:bg-gray-50/60 transition-colors"
                                >
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                                        {c.avatar}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${chip.className}`}>
                                                <span className={`w-1 h-1 rounded-full ${chip.dot}`} />
                                                {chip.label}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-gray-500 mt-0.5">
                                            Last activity {formatTimeAgo(c.lastActivity)}
                                        </p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                                </Link>
                            );
                        })
                    )}
                </div>
            </section>

            {/* ── Section 3: Roll-up metrics (only real, computed data) ── */}
            <section>
                <div className="flex items-end justify-between mb-3">
                    <div>
                        <h2 className="text-sm font-semibold text-gray-900">Roster Snapshot</h2>
                        <p className="text-[11px] text-gray-500 mt-0.5">Computed from this week's activity</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <InsightWidget
                        icon={<Users className="w-4 h-4" />}
                        label="Active Clients"
                        value={stats ? String(stats.totalClients) : '—'}
                        accent="emerald"
                    />
                    <InsightWidget
                        icon={<Activity className="w-4 h-4" />}
                        label="Avg Adherence"
                        value={stats ? `${stats.adherencePercent}%` : '—'}
                        delta={adherenceTrend !== null
                            ? { value: `${Math.abs(adherenceTrend)}%`, positive: adherenceTrend >= 0 }
                            : null}
                        sub={adherenceTrend !== null ? 'vs. start of week' : undefined}
                        accent="blue"
                    />
                    <InsightWidget
                        icon={<ChartLine className="w-4 h-4" />}
                        label="Active Diet Plans"
                        value={stats ? String(stats.activeDietPlans) : '—'}
                        accent="amber"
                    />
                    <InsightWidget
                        icon={<AlertTriangle className="w-4 h-4" />}
                        label="At-Risk Clients"
                        value={String(atRiskClients.length)}
                        sub={atRiskClients.length > 0 ? 'flagged from recent activity' : undefined}
                        accent={atRiskClients.length > 0 ? 'rose' : 'slate'}
                    />
                </div>
            </section>

            <AddClientModal
                isOpen={showAddClientModal}
                onClose={handleModalClose}
                onSubmit={handleAddClient}
            />
        </div>
    );
}

// ─── Stacked op cards ────────────────────────────────────────────────────────

function TodaysScheduleCard({ consults }: { consults: CalendarConsultation[] }) {
    const formatTime = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    };
    return (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <CalendarIcon className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-xs font-semibold text-gray-900">Today's Schedule</h3>
                </div>
                <Link href="/dashboard/clients" className="text-[11px] text-gray-400 hover:text-gray-700">View →</Link>
            </div>
            {consults.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">No consultations scheduled today</p>
            ) : (
                <ul className="space-y-1">
                    {consults.slice(0, 3).map((c) => (
                        <li key={c.id}>
                            <Link
                                href={`/dashboard/clients/${c.client.id}?tab=consultations`}
                                className="group flex items-center gap-2.5 -mx-2 px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
                            >
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
                                    {c.client.fullName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-gray-900 truncate group-hover:text-gray-700">{c.client.fullName}</p>
                                    <p className="text-[10px] text-gray-500 flex items-center gap-1">
                                        <Clock className="w-2.5 h-2.5" />
                                        {formatTime(c.scheduledAt)} · {c.durationMin}m
                                    </p>
                                </div>
                                {c.mode === 'online' && c.meetLink ? (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            window.open(c.meetLink as string, '_blank', 'noopener,noreferrer');
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-semibold transition-colors"
                                        title="Join meeting"
                                    >
                                        <Video className="w-3 h-3" />
                                        Join
                                    </button>
                                ) : c.client.phone ? (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            window.location.href = `tel:${c.client.phone}`;
                                        }}
                                        className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                                        title={`Call ${c.client.phone}`}
                                    >
                                        <Phone className="w-3 h-3" />
                                    </button>
                                ) : (
                                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition" />
                                )}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function NeedsAttentionCard({ atRisk }: { atRisk: { id: string; name: string; avatar: string; lastActivity: string }[] }) {
    return (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                        <AlertTriangle className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-xs font-semibold text-gray-900">Needs Attention</h3>
                </div>
                {atRisk.length > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold">
                        {atRisk.length}
                    </span>
                )}
            </div>
            {atRisk.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">All clients are on track</p>
            ) : (
                <ul className="space-y-2">
                    {atRisk.slice(0, 3).map((c) => (
                        <li key={c.id}>
                            <Link href={`/dashboard/clients/${c.id}`} className="flex items-center gap-2.5 group">
                                <div className="w-7 h-7 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
                                    {c.avatar}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-gray-900 truncate group-hover:text-gray-700">{c.name}</p>
                                    <p className="text-[10px] text-amber-700/80">Inactive {formatTimeAgo(c.lastActivity)}</p>
                                </div>
                                <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-gray-500 transition" />
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function PendingReviewsCard({ reviews }: { reviews: { id: string; client: string; meal: string; time: string }[] }) {
    return (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Camera className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-xs font-semibold text-gray-900">Pending Meal Reviews</h3>
                </div>
                {reviews.length > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold">
                        {reviews.length}
                    </span>
                )}
            </div>
            {reviews.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">Nothing in the review queue</p>
            ) : (
                <ul className="space-y-2">
                    {reviews.slice(0, 3).map((r) => (
                        <li key={r.id}>
                            <Link href="/dashboard/reviews" className="flex items-center gap-2.5 group">
                                <div className="w-7 h-7 rounded-md bg-gray-100 text-gray-500 flex items-center justify-center flex-shrink-0">
                                    <Camera className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-gray-900 truncate">{r.client}</p>
                                    <p className="text-[10px] text-gray-500 truncate">{r.meal} · {r.time}</p>
                                </div>
                                <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-gray-500 transition" />
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
