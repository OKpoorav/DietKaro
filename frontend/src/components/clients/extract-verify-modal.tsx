'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import type { NotesExtraction } from '@/lib/hooks/use-notes-extract';

interface ExtractVerifyModalProps {
    isOpen: boolean;
    onClose: () => void;
    extracted: NotesExtraction | null;
    onApply: (edited: NotesExtraction) => void;
    isApplying: boolean;
}

/**
 * Single source of truth for what the user "kept" before apply.
 * Each section keyed by a path → boolean. Defaults true.
 */
type KeepMap = Record<string, boolean>;

function isMeaningful(extracted: NotesExtraction): boolean {
    return (
        extracted.age !== null ||
        extracted.heightCm !== null ||
        extracted.currentWeightKg !== null ||
        !!extracted.referredBy ||
        !!extracted.location ||
        extracted.bloodReports.length > 0 ||
        extracted.bodyMeasurements.length > 0 ||
        extracted.medicalIssues.length > 0 ||
        extracted.familyHistory.length > 0 ||
        extracted.allergies.length > 0 ||
        extracted.intolerances.length > 0 ||
        extracted.dislikes.length > 0 ||
        extracted.likedFoods.length > 0 ||
        extracted.otherNotes.length > 0 ||
        Object.values(extracted.lifestyle).some((v) => v !== null && v !== '')
    );
}

export function ExtractVerifyModal({ isOpen, onClose, extracted, onApply, isApplying }: ExtractVerifyModalProps) {
    const [keep, setKeep] = useState<KeepMap>({});

    // Reset keep map when a new extraction lands.
    useMemo(() => setKeep({}), [extracted]);

    const isKept = (k: string) => keep[k] !== false; // default true

    const toggle = (k: string) => setKeep((m) => ({ ...m, [k]: m[k] === false ? true : false }));

    const handleApply = () => {
        if (!extracted) return;
        // Build filtered payload based on keep map.
        const filtered: NotesExtraction = {
            age: isKept('age') ? extracted.age : null,
            heightCm: isKept('heightCm') ? extracted.heightCm : null,
            currentWeightKg: isKept('currentWeightKg') ? extracted.currentWeightKg : null,
            referredBy: isKept('referredBy') ? extracted.referredBy : null,
            location: isKept('location') ? extracted.location : null,
            bloodReports: extracted.bloodReports.filter((_, i) => isKept(`bloodReports.${i}`)),
            bodyMeasurements: extracted.bodyMeasurements.filter((_, i) => isKept(`bodyMeasurements.${i}`)),
            medicalIssues: extracted.medicalIssues.filter((_, i) => isKept(`medicalIssues.${i}`)),
            familyHistory: extracted.familyHistory.filter((_, i) => isKept(`familyHistory.${i}`)),
            allergies: extracted.allergies.filter((_, i) => isKept(`allergies.${i}`)),
            intolerances: extracted.intolerances.filter((_, i) => isKept(`intolerances.${i}`)),
            dislikes: extracted.dislikes.filter((_, i) => isKept(`dislikes.${i}`)),
            likedFoods: extracted.likedFoods.filter((_, i) => isKept(`likedFoods.${i}`)),
            lifestyle: extracted.lifestyle,
            otherNotes: extracted.otherNotes.filter((_, i) => isKept(`otherNotes.${i}`)),
        };
        onApply(filtered);
    };

    if (!extracted) return null;

    const meaningful = isMeaningful(extracted);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Review extracted data" size="xl">
            <div className="p-6 space-y-5">
                <div className="flex items-start gap-2 text-xs text-gray-500 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600 mt-0.5 shrink-0" />
                    Uncheck any row you do not want to seed. Existing values are never overwritten — arrays merge, scalars only fill when empty.
                </div>

                {!meaningful && (
                    <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <AlertTriangle className="w-4 h-4" /> Nothing structured was found in these notes.
                    </div>
                )}

                {/* Identity */}
                <ScalarRow label="Age" value={extracted.age} unit="yrs" keepKey="age" isKept={isKept} toggle={toggle} />
                <ScalarRow label="Height" value={extracted.heightCm} unit="cm" keepKey="heightCm" isKept={isKept} toggle={toggle} />
                <ScalarRow label="Current Weight" value={extracted.currentWeightKg} unit="kg" keepKey="currentWeightKg" isKept={isKept} toggle={toggle} />
                <ScalarRow label="Referred By" value={extracted.referredBy} keepKey="referredBy" isKept={isKept} toggle={toggle} />
                <ScalarRow label="Location" value={extracted.location} keepKey="location" isKept={isKept} toggle={toggle} />

                {/* Arrays */}
                <ArraySection title="Allergies" items={extracted.allergies} keyPrefix="allergies" isKept={isKept} toggle={toggle} />
                <ArraySection title="Intolerances" items={extracted.intolerances} keyPrefix="intolerances" isKept={isKept} toggle={toggle} />
                <ArraySection title="Medical Issues" items={extracted.medicalIssues} keyPrefix="medicalIssues" isKept={isKept} toggle={toggle} />
                <ArraySection title="Family History" items={extracted.familyHistory} keyPrefix="familyHistory" isKept={isKept} toggle={toggle} />
                <ArraySection title="Dislikes" items={extracted.dislikes} keyPrefix="dislikes" isKept={isKept} toggle={toggle} />
                <ArraySection title="Likes" items={extracted.likedFoods} keyPrefix="likedFoods" isKept={isKept} toggle={toggle} />

                {/* Blood reports */}
                {extracted.bloodReports.length > 0 && (
                    <section>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Blood Reports</h4>
                        <div className="space-y-2">
                            {extracted.bloodReports.map((r, i) => (
                                <KeepRow key={i} keepKey={`bloodReports.${i}`} isKept={isKept} toggle={toggle}>
                                    <div className="text-sm">
                                        <div className="font-medium text-gray-900">{r.date ?? 'Undated'}</div>
                                        <div className="text-xs text-gray-600 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                                            {Object.entries(r.values).map(([k, v]) => (
                                                <span key={k}><span className="text-gray-400">{k}</span> <span className="font-medium">{v}</span></span>
                                            ))}
                                        </div>
                                    </div>
                                </KeepRow>
                            ))}
                        </div>
                    </section>
                )}

                {/* Body measurements */}
                {extracted.bodyMeasurements.length > 0 && (
                    <section>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Body Measurements (cm)</h4>
                        <div className="space-y-2">
                            {extracted.bodyMeasurements.map((m, i) => (
                                <KeepRow key={i} keepKey={`bodyMeasurements.${i}`} isKept={isKept} toggle={toggle}>
                                    <div className="text-sm">
                                        <div className="font-medium text-gray-900">{m.date ?? 'Undated'}</div>
                                        <div className="text-xs text-gray-600 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                                            {(['chestCm', 'waistCm', 'hipsCm', 'thighsCm', 'armsCm', 'stomachCm', 'bellyAboveNavelCm', 'bellyBelowNavelCm', 'calfCm'] as const).map((k) =>
                                                m[k] !== null ? (
                                                    <span key={k}>
                                                        <span className="text-gray-400">{k.replace(/Cm$/, '')}</span>{' '}
                                                        <span className="font-medium">{m[k]}</span>
                                                    </span>
                                                ) : null,
                                            )}
                                        </div>
                                    </div>
                                </KeepRow>
                            ))}
                        </div>
                    </section>
                )}

                {/* Lifestyle (read-only, always stored in extractedNotes) */}
                {Object.values(extracted.lifestyle).some((v) => v) && (
                    <section>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Lifestyle <span className="font-normal normal-case text-gray-400">(stored as reference, not seeded)</span></h4>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            {(Object.entries(extracted.lifestyle) as [keyof typeof extracted.lifestyle, string | null][]).map(([k, v]) =>
                                v ? (
                                    <div key={k}>
                                        <span className="text-gray-400 capitalize">{k}:</span> <span className="text-gray-700">{v}</span>
                                    </div>
                                ) : null,
                            )}
                        </div>
                    </section>
                )}

                {extracted.otherNotes.length > 0 && (
                    <ArraySection title="Other Notes" items={extracted.otherNotes} keyPrefix="otherNotes" isKept={isKept} toggle={toggle} />
                )}
            </div>

            <footer className="flex items-center justify-end gap-2 px-6 py-3 border-t border-gray-100 bg-gray-50">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isApplying}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleApply}
                    disabled={isApplying || !meaningful}
                    className="px-4 py-2 text-sm font-bold text-white bg-brand rounded-lg hover:bg-brand/90 disabled:opacity-50 flex items-center gap-2"
                >
                    {isApplying && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isApplying ? 'Applying…' : 'Apply selected'}
                </button>
            </footer>
        </Modal>
    );
}

function ScalarRow({ label, value, unit, keepKey, isKept, toggle }: {
    label: string;
    value: string | number | null;
    unit?: string;
    keepKey: string;
    isKept: (k: string) => boolean;
    toggle: (k: string) => void;
}) {
    if (value === null || value === '') return null;
    return (
        <KeepRow keepKey={keepKey} isKept={isKept} toggle={toggle}>
            <div className="text-sm">
                <span className="text-gray-400">{label}:</span>{' '}
                <span className="font-medium text-gray-900">{value}{unit ? ` ${unit}` : ''}</span>
            </div>
        </KeepRow>
    );
}

function ArraySection({ title, items, keyPrefix, isKept, toggle }: {
    title: string;
    items: string[];
    keyPrefix: string;
    isKept: (k: string) => boolean;
    toggle: (k: string) => void;
}) {
    if (items.length === 0) return null;
    return (
        <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</h4>
            <div className="flex flex-wrap gap-2">
                {items.map((v, i) => {
                    const key = `${keyPrefix}.${i}`;
                    const kept = isKept(key);
                    return (
                        <button
                            key={i}
                            type="button"
                            onClick={() => toggle(key)}
                            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                kept
                                    ? 'bg-brand/10 text-brand border-brand/30'
                                    : 'bg-gray-50 text-gray-400 line-through border-gray-200'
                            }`}
                        >
                            {v}
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

function KeepRow({ keepKey, isKept, toggle, children }: {
    keepKey: string;
    isKept: (k: string) => boolean;
    toggle: (k: string) => void;
    children: React.ReactNode;
}) {
    const kept = isKept(keepKey);
    return (
        <label className={`flex items-start gap-3 px-3 py-2 border rounded-lg cursor-pointer transition-colors ${kept ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
            <input
                type="checkbox"
                checked={kept}
                onChange={() => toggle(keepKey)}
                className="mt-0.5 w-4 h-4 accent-brand"
            />
            <div className="flex-1 min-w-0">{children}</div>
        </label>
    );
}
