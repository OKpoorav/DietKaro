'use client';

import { useState } from 'react';
import type { NotesExtraction } from '@/lib/hooks/use-notes-extract';

interface NotesContentProps {
    rawNotes: string | null | undefined;
    extracted: NotesExtraction | null | undefined;
    /** Visual density. `compact` for inline cards, `comfortable` for modals. */
    density?: 'compact' | 'comfortable';
    /** Clamp raw text in compact mode (uses fixed tailwind classes). */
    clamp?: boolean;
}

/**
 * Shared Notes renderer with a Key-Value / Notes toggle.
 *
 * - Defaults to Key-Value when `extracted` is provided (richer info).
 * - Falls back to raw notes if no extracted payload exists.
 * - Toggle is hidden when only one of the two is available.
 */
export function NotesContent({ rawNotes, extracted, density = 'compact', clamp = false }: NotesContentProps) {
    const hasExtracted = !!extracted;
    const hasRaw = !!rawNotes && rawNotes.trim().length > 0;
    const [mode, setMode] = useState<'kv' | 'raw'>(hasExtracted ? 'kv' : 'raw');

    if (!hasExtracted && !hasRaw) {
        return <p className="text-sm text-gray-400 italic">No notes yet.</p>;
    }

    const showToggle = hasExtracted && hasRaw;
    const effectiveMode = !hasExtracted ? 'raw' : !hasRaw ? 'kv' : mode;

    return (
        <div className="space-y-2">
            {showToggle && (
                <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5 text-[11px]">
                    <button
                        type="button"
                        onClick={() => setMode('kv')}
                        className={`px-2 py-0.5 rounded transition-colors ${effectiveMode === 'kv' ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Key-Value
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('raw')}
                        className={`px-2 py-0.5 rounded transition-colors ${effectiveMode === 'raw' ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Notes
                    </button>
                </div>
            )}

            <div className={clamp ? 'max-h-[180px] overflow-y-auto pr-1' : ''}>
                {effectiveMode === 'kv' && extracted ? (
                    <KeyValueView extracted={extracted} density={density} />
                ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed">
                        {rawNotes}
                    </p>
                )}
            </div>
        </div>
    );
}

function KeyValueView({ extracted, density }: { extracted: NotesExtraction; density: 'compact' | 'comfortable' }) {
    const txt = density === 'compact' ? 'text-xs' : 'text-sm';
    const labelCls = 'text-gray-400';
    const valCls = 'text-gray-800 font-medium';

    const identity: Array<[string, string | number | null | undefined]> = [
        ['Age', extracted.age],
        ['Height', extracted.heightCm ? `${extracted.heightCm} cm` : null],
        ['Weight', extracted.currentWeightKg ? `${extracted.currentWeightKg} kg` : null],
        ['Referred by', extracted.referredBy],
        ['Location', extracted.location],
    ].filter(([, v]) => v !== null && v !== undefined && v !== '') as Array<[string, string | number]>;

    return (
        <div className={`${txt} space-y-2.5`}>
            {identity.length > 0 && (
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                    {identity.map(([k, v]) => (
                        <div key={k} className="truncate">
                            <span className={labelCls}>{k}:</span> <span className={valCls}>{v}</span>
                        </div>
                    ))}
                </div>
            )}

            <ChipBlock label="Allergies" items={extracted.allergies} tone="red" txt={txt} />
            <ChipBlock label="Intolerances" items={extracted.intolerances} tone="amber" txt={txt} />
            <ChipBlock label="Medical issues" items={extracted.medicalIssues} tone="orange" txt={txt} />
            <ChipBlock label="Family history" items={extracted.familyHistory} tone="purple" txt={txt} />
            <ChipBlock label="Dislikes" items={extracted.dislikes} tone="gray" txt={txt} />
            <ChipBlock label="Likes" items={extracted.likedFoods} tone="green" txt={txt} />

            {extracted.bloodReports.length > 0 && (
                <div>
                    <p className={`${labelCls} text-[10px] uppercase tracking-wide mb-0.5`}>Blood reports</p>
                    <ul className="space-y-1">
                        {extracted.bloodReports.map((r, i) => (
                            <li key={i} className="leading-snug">
                                <span className={labelCls}>{r.date ?? 'Undated'}</span>{' '}
                                <span className="text-gray-700">
                                    {Object.entries(r.values).map(([k, v]) => `${k} ${v}`).join(' · ')}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {extracted.bodyMeasurements.length > 0 && (
                <div>
                    <p className={`${labelCls} text-[10px] uppercase tracking-wide mb-0.5`}>Body measurements (cm)</p>
                    <ul className="space-y-1">
                        {extracted.bodyMeasurements.map((m, i) => {
                            const entries = (['chestCm', 'waistCm', 'hipsCm', 'thighsCm', 'armsCm', 'stomachCm', 'bellyAboveNavelCm', 'bellyBelowNavelCm', 'calfCm'] as const)
                                .filter((k) => m[k] !== null)
                                .map((k) => `${k.replace(/Cm$/, '')} ${m[k]}`);
                            return (
                                <li key={i} className="leading-snug">
                                    <span className={labelCls}>{m.date ?? 'Undated'}</span>{' '}
                                    <span className="text-gray-700">{entries.join(' · ')}</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {Object.values(extracted.lifestyle).some((v) => v) && (
                <div>
                    <p className={`${labelCls} text-[10px] uppercase tracking-wide mb-0.5`}>Lifestyle</p>
                    <div className="grid grid-cols-1 gap-y-0.5">
                        {(Object.entries(extracted.lifestyle) as [keyof typeof extracted.lifestyle, string | null][]).map(([k, v]) =>
                            v ? (
                                <div key={k} className="leading-snug">
                                    <span className={`${labelCls} capitalize`}>{k}:</span>{' '}
                                    <span className="text-gray-700">{v}</span>
                                </div>
                            ) : null,
                        )}
                    </div>
                </div>
            )}

            {extracted.otherNotes.length > 0 && (
                <div>
                    <p className={`${labelCls} text-[10px] uppercase tracking-wide mb-0.5`}>Other</p>
                    <ul className="space-y-0.5">
                        {extracted.otherNotes.map((n, i) => (
                            <li key={i} className="text-gray-700 leading-snug">{n}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

const TONE_CLASSES: Record<string, string> = {
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    gray: 'bg-gray-100 text-gray-700 border-gray-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function ChipBlock({ label, items, tone, txt }: { label: string; items: string[]; tone: string; txt: string }) {
    if (items.length === 0) return null;
    return (
        <div>
            <p className="text-gray-400 text-[10px] uppercase tracking-wide mb-1">{label}</p>
            <div className="flex flex-wrap gap-1">
                {items.map((v, i) => (
                    <span key={i} className={`${txt} px-1.5 py-0.5 rounded-full border ${TONE_CLASSES[tone]}`}>{v}</span>
                ))}
            </div>
        </div>
    );
}
