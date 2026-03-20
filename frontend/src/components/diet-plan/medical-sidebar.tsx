'use client';

import { useState, useMemo } from 'react';
import {
    FileText,
    ExternalLink,
    Search,
    Loader2,
    ChevronRight,
    ChevronDown,
    RefreshCw,
    Sparkles,
    AlertCircle,
    Clock,
    RotateCcw,
} from 'lucide-react';
import {
    useClientDocumentSummary,
    useRegenerateDocumentSummary,
    MedicalExtractedData,
    useRetriggerSummarize,
    type ReportDocumentItem,
    type ReportProcessingStatus,
} from '@/lib/hooks/use-medical-summary';

interface MedicalSidebarProps {
    clientId: string;
    className?: string;
}

// ─── Status helpers ───────────────────────────────────────────────

const STATUS_CONFIG: Record<ReportProcessingStatus, { label: string; className: string }> = {
    pending:     { label: 'Queued',      className: 'bg-gray-100 text-gray-500' },
    extracting:  { label: 'Extracting…', className: 'bg-blue-50 text-blue-600' },
    summarizing: { label: 'Summarizing…', className: 'bg-purple-50 text-purple-600' },
    done:        { label: 'Done',        className: 'bg-green-50 text-green-600' },
    failed:      { label: 'Failed',      className: 'bg-red-50 text-red-500' },
    skipped:     { label: 'Skipped',     className: 'bg-yellow-50 text-yellow-600' },
};

const isProcessing = (s: ReportProcessingStatus) =>
    s === 'pending' || s === 'extracting' || s === 'summarizing';

function formatTimeAgo(date: string | null | undefined) {
    if (!date) return '';
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

const REPORT_TYPE_LABELS: Record<string, string> = {
    blood_test: 'Blood Test',
    scan: 'Scan',
    prescription: 'Prescription',
    other: 'Report',
};

// ─── Unified Summary Card ─────────────────────────────────────────

function UnifiedSummaryCard({ clientId }: { clientId: string }) {
    const { data, isLoading } = useClientDocumentSummary(clientId);
    const regenerate = useRegenerateDocumentSummary(clientId);

    const summary = data?.unifiedSummary;
    const hasDocs = (data?.documents?.length ?? 0) > 0;

    if (!hasDocs) return null;

    return (
        <div className="mb-3 rounded-xl border border-brand/20 bg-gradient-to-br from-brand/5 to-emerald-50/50 p-4">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-brand text-sm font-semibold">
                    <Sparkles className="w-3.5 h-3.5" />
                    AI Summary
                </div>
                <button
                    onClick={() => regenerate.mutate()}
                    disabled={regenerate.isPending}
                    title="Regenerate summary"
                    className="p-1 rounded hover:bg-brand/10 text-brand/50 hover:text-brand transition-colors disabled:opacity-40"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${regenerate.isPending ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {isLoading || regenerate.isPending ? (
                <div className="flex items-center gap-2 text-xs text-gray-400 py-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generating…
                </div>
            ) : summary ? (
                <>
                    <p className="text-sm text-gray-700 leading-relaxed">{summary.summaryText}</p>
                    <p className="text-[10px] text-gray-400 mt-2">
                        From {summary.docCount} document{summary.docCount !== 1 ? 's' : ''} · {formatTimeAgo(summary.updatedAt ?? summary.generatedAt)}
                    </p>
                </>
            ) : (
                <p className="text-xs text-gray-400 italic">
                    Summary will appear once documents are processed.
                </p>
            )}
        </div>
    );
}

// ─── Per-document row ─────────────────────────────────────────────

type DocTab = 'summary' | 'values';

function ValuesPanel({ extracted }: { extracted: MedicalExtractedData }) {
    const hasLabValues = extracted.lab_values && Object.keys(extracted.lab_values).length > 0;
    const hasConditions = extracted.conditions.length > 0 || extracted.diagnoses.length > 0;
    const hasMeds = extracted.medications.length > 0;
    const hasFlags = extracted.dietary_flags.length > 0 || extracted.dietary_restrictions.length > 0;

    if (!hasLabValues && !hasConditions && !hasMeds && !hasFlags) {
        return <p className="text-xs text-gray-400 italic py-1">No structured values extracted.</p>;
    }

    return (
        <div className="space-y-3">
            {hasLabValues && (
                <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Lab Values</p>
                    <div className="grid grid-cols-2 gap-1">
                        {Object.entries(extracted.lab_values!).map(([k, v]: [string, string]) => (
                            <div key={k} className="flex justify-between items-center bg-white border border-gray-100 rounded px-2 py-1">
                                <span className="text-[11px] text-gray-500 truncate">{k}</span>
                                <span className="text-[11px] font-semibold text-gray-800 ml-2 shrink-0">{v}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {hasConditions && (
                <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Conditions / Diagnoses</p>
                    <div className="flex flex-wrap gap-1">
                        {[...extracted.diagnoses, ...extracted.conditions].map((c, i) => (
                            <span key={i} className="text-[11px] bg-orange-50 text-orange-700 border border-orange-100 px-2 py-0.5 rounded-full">{c}</span>
                        ))}
                    </div>
                </div>
            )}
            {hasMeds && (
                <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Medications</p>
                    <div className="space-y-1">
                        {extracted.medications.map((m: MedicalExtractedData['medications'][number], i: number) => (
                            <div key={i} className="text-[11px] text-gray-700">
                                <span className="font-medium">{m.name}</span>
                                {m.dose && <span className="text-gray-400"> · {m.dose}</span>}
                                {m.frequency && <span className="text-gray-400"> · {m.frequency}</span>}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {hasFlags && (
                <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Dietary Flags</p>
                    <div className="flex flex-wrap gap-1">
                        {[...extracted.dietary_flags, ...extracted.dietary_restrictions].map((f, i) => (
                            <span key={i} className="text-[11px] bg-brand/10 text-brand border border-brand/20 px-2 py-0.5 rounded-full">{f}</span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function ReportRow({
    report,
    clientId,
}: {
    report: ReportDocumentItem;
    clientId: string;
}) {
    const [expanded, setExpanded] = useState(false);
    const [tab, setTab] = useState<DocTab>('summary');
    const retrigger = useRetriggerSummarize(clientId);
    const cfg = STATUS_CONFIG[report.processingStatus];
    const processing = isProcessing(report.processingStatus);
    const hasSummary = report.processingStatus === 'done' && report.summary?.summaryText;
    const hasValues = report.processingStatus === 'done' && report.summary?.extractedData;
    const typeLabel = REPORT_TYPE_LABELS[report.reportType ?? 'other'] ?? 'Report';
    const canExpand = hasSummary || hasValues || report.processingStatus === 'failed';

    return (
        <div className="rounded-lg border border-gray-100 overflow-hidden">
            {/* Row header */}
            <div className="flex items-center gap-2 p-3 hover:bg-gray-50 transition-colors">
                <button
                    onClick={() => canExpand && setExpanded((v) => !v)}
                    className={`shrink-0 ${canExpand ? 'text-gray-400 hover:text-brand cursor-pointer' : 'text-gray-200 cursor-default'}`}
                >
                    {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />

                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{report.fileName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-gray-400">{typeLabel}</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs text-gray-400">
                            {new Date(report.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                    </div>
                </div>

                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${cfg.className}`}>
                    {processing && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                    {cfg.label}
                </span>

                {report.viewUrl && (
                    <a
                        href={report.viewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-brand hover:underline px-1.5 py-0.5 rounded hover:bg-brand/5 transition-colors"
                        title="View document"
                    >
                        <ExternalLink className="w-3 h-3" />
                        View
                    </a>
                )}
            </div>

            {/* Expanded panel */}
            {expanded && (
                <div className="border-t border-gray-100">
                    {report.processingStatus === 'failed' ? (
                        <div className="px-4 py-3 bg-gray-50/60 flex items-start gap-2">
                            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-red-500">{report.processingError ?? 'Processing failed.'}</p>
                                <button
                                    onClick={() => retrigger.mutate(report.id)}
                                    disabled={retrigger.isPending}
                                    className="mt-1.5 flex items-center gap-1 text-xs text-brand hover:underline disabled:opacity-50"
                                >
                                    <RotateCcw className="w-3 h-3" />
                                    Retry
                                </button>
                            </div>
                        </div>
                    ) : (hasSummary || hasValues) ? (
                        <>
                            {/* Tabs */}
                            <div className="flex border-b border-gray-100 bg-gray-50/40">
                                <button
                                    onClick={() => setTab('summary')}
                                    className={`px-3 py-1.5 text-[11px] font-medium border-b-2 transition-colors ${tab === 'summary' ? 'border-brand text-brand' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                                >
                                    Summary
                                </button>
                                {hasValues && (
                                    <button
                                        onClick={() => setTab('values')}
                                        className={`px-3 py-1.5 text-[11px] font-medium border-b-2 transition-colors ${tab === 'values' ? 'border-brand text-brand' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                                    >
                                        Values
                                    </button>
                                )}
                            </div>

                            <div className="px-4 py-3 bg-gray-50/60">
                                {tab === 'summary' ? (
                                    <div>
                                        <p className="text-xs text-gray-600 leading-relaxed">{report.summary!.summaryText}</p>
                                        <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
                                            <Clock className="w-2.5 h-2.5" />
                                            {formatTimeAgo(report.summary!.generatedAt)}
                                        </p>
                                    </div>
                                ) : (
                                    <ValuesPanel extracted={report.summary!.extractedData!} />
                                )}
                            </div>
                        </>
                    ) : null}
                </div>
            )}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────

export function MedicalSidebar({ clientId, className = '' }: MedicalSidebarProps) {
    const { data: docSummary, isLoading } = useClientDocumentSummary(clientId);
    const [search, setSearch] = useState('');

    const documents = docSummary?.documents ?? [];

    const filtered = useMemo(() => {
        if (!search.trim()) return documents;
        const q = search.toLowerCase();
        return documents.filter((d) => d.fileName.toLowerCase().includes(q));
    }, [documents, search]);

    return (
        <div className={`bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col min-h-0 ${className}`}>
            {/* Header — fixed, never scrolls */}
            <h3 className="text-gray-900 font-medium px-4 pt-4 pb-3 flex-shrink-0 flex items-center gap-2 border-b border-gray-100">
                <FileText className="w-4 h-4 text-brand" />
                Uploaded Reports
            </h3>

            {/* Scrollable body: AI summary + search + doc list */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                {/* Unified AI Summary */}
                <div className="px-4 pt-3">
                    <UnifiedSummaryCard clientId={clientId} />
                </div>

                {/* Search */}
                <div className="px-4 pb-2">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search reports..."
                            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand focus:border-brand outline-none"
                        />
                    </div>
                </div>

                {/* Document list */}
                <div className="px-4 pb-4 space-y-2">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <p className="text-sm text-gray-500 italic text-center py-4">
                            {search.trim() ? 'No matching reports' : 'No reports uploaded'}
                        </p>
                    ) : (
                        filtered.map((doc) => (
                            <ReportRow
                                key={doc.id}
                                report={doc}
                                clientId={clientId}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
