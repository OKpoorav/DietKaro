'use client';

import { Loader2, Scale } from 'lucide-react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    ReferenceLine,
    Tooltip as RechartsTooltip,
} from 'recharts';
import { useWeightLogs } from '@/lib/hooks/use-weight-logs';

interface WeightTrendChartProps {
    clientId: string;
    targetWeightKg?: number | null;
    height?: number;
}

interface ChartPoint {
    date: string;
    label: string;
    weightKg: number;
    weightChange: number | null;
    isOutlier: boolean;
    notes?: string | null;
}

function formatDateShort(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

// Outliers get a hollow orange dot — dashed + hollow so the flag survives without color
function WeightDot(props: { cx?: number; cy?: number; payload?: ChartPoint }) {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null || !payload) return null;
    if (payload.isOutlier) {
        return <circle cx={cx} cy={cy} r={4} fill="#ffffff" stroke="#f97316" strokeWidth={2} strokeDasharray="2 2" />;
    }
    return <circle cx={cx} cy={cy} r={3} fill="#10b981" stroke="#ffffff" strokeWidth={1.5} />;
}

function WeightTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartPoint }> }) {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
        <div className="bg-white border border-gray-200 rounded-[10px] px-3 py-2 text-xs shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
            <p className="text-gray-400 mb-0.5">{new Date(p.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p>
            <p className="font-semibold text-gray-900">{p.weightKg} kg</p>
            {p.weightChange != null && p.weightChange !== 0 && (
                <p className={p.weightChange < 0 ? 'text-brand' : 'text-orange-500'}>
                    {p.weightChange > 0 ? '+' : ''}{p.weightChange} kg since last entry
                </p>
            )}
            {p.isOutlier && <p className="text-orange-500 mt-0.5">Marked as outlier</p>}
            {p.notes && <p className="text-gray-500 mt-0.5 max-w-[180px]">{p.notes}</p>}
        </div>
    );
}

export function WeightTrendChart({ clientId, targetWeightKg, height = 240 }: WeightTrendChartProps) {
    const { data, isLoading } = useWeightLogs(clientId);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center" style={{ height }}>
                <Loader2 className="w-5 h-5 animate-spin text-brand" />
            </div>
        );
    }

    const logs = data?.data ?? [];

    if (logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 text-center" style={{ height }}>
                <Scale className="w-6 h-6 text-gray-300" />
                <p className="text-sm text-gray-500">No weight entries yet</p>
                <p className="text-xs text-gray-400">Weights logged from the client app will appear here.</p>
            </div>
        );
    }

    const chartData: ChartPoint[] = logs.map((log) => ({
        date: log.logDate,
        label: formatDateShort(log.logDate),
        weightKg: log.weightKg,
        weightChange: log.weightChange,
        isOutlier: log.isOutlier,
        notes: log.notes,
    }));

    const target = targetWeightKg != null ? Number(targetWeightKg) : null;
    const weights = chartData.map((p) => p.weightKg);
    if (target != null) weights.push(target);
    const yMin = Math.floor(Math.min(...weights) - 1);
    const yMax = Math.ceil(Math.max(...weights) + 1);

    return (
        <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={chartData} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                <defs>
                    <linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f3" vertical={false} />
                <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    interval="preserveStartEnd"
                    minTickGap={24}
                />
                <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    domain={[yMin, yMax]}
                    unit="kg"
                    width={64}
                />
                <RechartsTooltip
                    cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '4 4' }}
                    content={<WeightTooltip />}
                />
                {target != null && (
                    <ReferenceLine
                        y={target}
                        stroke="#9ca3af"
                        strokeDasharray="6 4"
                        label={{ value: `Target ${target}kg`, position: 'insideTopRight', fill: '#6b7280', fontSize: 11 }}
                    />
                )}
                <Area
                    type="monotone"
                    dataKey="weightKg"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#weight-fill)"
                    dot={<WeightDot />}
                    activeDot={{ r: 5, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}
