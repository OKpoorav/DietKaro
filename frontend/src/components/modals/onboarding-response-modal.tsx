'use client';

import { Modal } from '@/components/ui/modal';
import type { Client } from '@/lib/hooks/use-clients';

interface OnboardingResponseModalProps {
    isOpen: boolean;
    onClose: () => void;
    client: Client;
}

const ACTIVITY_LABELS: Record<string, string> = {
    sedentary: 'Sedentary',
    lightly_active: 'Lightly Active',
    moderately_active: 'Moderately Active',
    very_active: 'Very Active',
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    if (value === null || value === undefined || value === '') return null;
    return (
        <div className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
            <span className="text-xs font-medium text-gray-400 w-36 shrink-0 pt-0.5">{label}</span>
            <span className="text-sm text-gray-800">{value}</span>
        </div>
    );
}

function Tags({ items }: { items?: string[] }) {
    if (!items?.length) return null;
    return (
        <div className="flex flex-wrap gap-1">
            {items.map((item) => (
                <span key={item} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs">{item}</span>
            ))}
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{title}</p>
            <div className="bg-gray-50 rounded-xl px-3 py-1">
                {children}
            </div>
        </div>
    );
}

export function OnboardingResponseModal({ isOpen, onClose, client }: OnboardingResponseModalProps) {
    const age = client.dateOfBirth
        ? Math.floor((Date.now() - new Date(client.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
        : null;

    const hasBodyStats = !!(client.heightCm || client.currentWeightKg || client.targetWeightKg || client.dateOfBirth || client.gender);
    const hasLifestyle = !!(client.activityLevel || client.dietPattern || client.eggAllowed !== undefined);
    const hasPreferences = !!((client.preferredCuisines?.length ?? 0) > 0 || (client.likedFoods?.length ?? 0) > 0);
    const hasRestrictions = !!((client.allergies?.length ?? 0) > 0 || (client.intolerances?.length ?? 0) > 0 || (client.dislikes?.length ?? 0) > 0);
    const hasGoal = !!(client.goal || client.goalDeadline);
    const hasPhotos = !!(client.beforePhotoFrontUrl || client.beforePhotoSideUrl || client.beforePhotoBackUrl);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Onboarding Response" size="md">
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                {!client.onboardingCompleted && (
                    <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                        Client hasn't completed onboarding yet. Showing any available data.
                    </p>
                )}

                {hasBodyStats && (
                    <Section title="Body Stats">
                        <Row label="Height" value={client.heightCm ? `${client.heightCm} cm` : null} />
                        <Row label="Current Weight" value={client.currentWeightKg ? `${client.currentWeightKg} kg` : null} />
                        <Row label="Target Weight" value={client.targetWeightKg ? `${client.targetWeightKg} kg` : null} />
                        <Row label="Age" value={age ? `${age} years` : null} />
                        <Row label="Gender" value={client.gender ? client.gender.charAt(0).toUpperCase() + client.gender.slice(1) : null} />
                    </Section>
                )}

                {hasLifestyle && (
                    <Section title="Lifestyle">
                        <Row label="Activity Level" value={client.activityLevel ? ACTIVITY_LABELS[client.activityLevel] ?? client.activityLevel : null} />
                        <Row label="Diet Pattern" value={client.dietPattern} />
                        <Row label="Egg Allowed" value={client.eggAllowed !== undefined ? (client.eggAllowed ? 'Yes' : 'No') : null} />
                    </Section>
                )}

                {hasPreferences && (
                    <Section title="Food Preferences">
                        <Row label="Cuisines" value={<Tags items={client.preferredCuisines} />} />
                        <Row label="Liked Foods" value={<Tags items={client.likedFoods} />} />
                    </Section>
                )}

                {hasRestrictions && (
                    <Section title="Restrictions">
                        <Row label="Allergies" value={<Tags items={client.allergies} />} />
                        <Row label="Intolerances" value={<Tags items={client.intolerances} />} />
                        <Row label="Dislikes" value={<Tags items={client.dislikes} />} />
                    </Section>
                )}

                {hasGoal && (
                    <Section title="Goal">
                        <Row label="Goal" value={client.goal} />
                        <Row label="Target Date" value={client.goalDeadline ? new Date(client.goalDeadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : null} />
                    </Section>
                )}

                {hasPhotos && (
                    <Section title="Before Photos">
                        <div className="flex gap-3 py-2">
                            {[
                                { label: 'Front', url: client.beforePhotoFrontUrl },
                                { label: 'Side', url: client.beforePhotoSideUrl },
                                { label: 'Back', url: client.beforePhotoBackUrl },
                            ].filter(p => p.url).map(({ label, url }) => (
                                <div key={label} className="flex flex-col items-center gap-1">
                                    <a href={url!} target="_blank" rel="noopener noreferrer">
                                        <img src={url!} alt={label} className="w-20 h-28 object-cover rounded-lg border border-gray-200 hover:opacity-90 transition-opacity" />
                                    </a>
                                    <span className="text-xs text-gray-400">{label}</span>
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                {!hasBodyStats && !hasLifestyle && !hasPreferences && !hasRestrictions && !hasGoal && !hasPhotos && (
                    <p className="text-sm text-gray-500 text-center py-6">No onboarding data available yet.</p>
                )}
            </div>
            <div className="px-4 pb-4">
                <button
                    type="button"
                    onClick={onClose}
                    className="w-full px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
                >
                    Close
                </button>
            </div>
        </Modal>
    );
}
