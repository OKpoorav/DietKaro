'use client';

import { useState } from 'react';
import {
    AlertCircle,
    AlertTriangle,
    Ban,
    Heart,
    Shield,
    Calendar,
    Pill,
    ChevronDown,
    ChevronUp,
    TestTube,
    Loader2,
    Info,
} from 'lucide-react';
import { useMedicalSummary } from '@/lib/hooks/use-medical-summary';
import type { LabAlert } from '@/lib/hooks/use-medical-summary';

interface MedicalSidebarProps {
    clientId: string;
    className?: string;
}

// Diet pattern display mapping
const DIET_DISPLAY: Record<string, string> = {
    vegetarian: 'Vegetarian',
    vegan: 'Vegan',
    non_veg: 'Non-Vegetarian',
    pescatarian: 'Pescatarian',
    eggetarian: 'Eggetarian',
};

// Collapsible section component
function Section({
    title,
    icon,
    count,
    color,
    defaultOpen = false,
    children,
}: {
    title: string;
    icon: React.ReactNode;
    count?: number;
    color: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className={`border rounded-lg ${color}`}>
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between p-3 text-left"
            >
                <div className="flex items-center gap-2">
                    {icon}
                    <span className="text-sm font-medium">{title}</span>
                    {count !== undefined && count > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/60 font-medium">
                            {count}
                        </span>
                    )}
                </div>
                {open ? (
                    <ChevronUp className="w-4 h-4 opacity-50" />
                ) : (
                    <ChevronDown className="w-4 h-4 opacity-50" />
                )}
            </button>
            {open && <div className="px-3 pb-3">{children}</div>}
        </div>
    );
}

function LabAlertItem({ alert }: { alert: LabAlert }) {
    const statusColors = {
        critical: 'text-red-700 bg-red-100',
        warning: 'text-yellow-700 bg-yellow-100',
        normal: 'text-green-700 bg-green-100',
        optimal: 'text-emerald-700 bg-emerald-100',
    };

    return (
        <div className="flex items-center justify-between text-xs py-1">
            <span className="text-gray-700">{alert.name}</span>
            <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">
                    {alert.value} {alert.unit}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColors[alert.status]}`}>
                    {alert.status === 'critical' ? 'HIGH' : alert.status === 'warning' ? 'WARN' : alert.status === 'optimal' ? 'OPT' : 'OK'}
                </span>
            </div>
        </div>
    );
}

function Chip({ children, color }: { children: React.ReactNode; color: string }) {
    return (
        <span className={`px-2 py-0.5 text-xs rounded-full ${color}`}>
            {children}
        </span>
    );
}

export function MedicalSidebar({ clientId, className = '' }: MedicalSidebarProps) {
    const { data: summary, isLoading, error } = useMedicalSummary(clientId);

    if (isLoading) {
        return (
            <div className={`bg-white p-4 rounded-lg border border-gray-200 ${className}`}>
                <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
            </div>
        );
    }

    if (error || !summary) {
        return (
            <div className={`bg-white p-4 rounded-lg border border-gray-200 ${className}`}>
                <p className="text-sm text-gray-500 text-center py-4">
                    <Info className="w-4 h-4 inline mr-1" />
                    Unable to load medical summary
                </p>
            </div>
        );
    }

    const criticalAlerts = summary.labAlerts.filter(a => a.status === 'critical');
    const warningAlerts = summary.labAlerts.filter(a => a.status === 'warning');
    const normalAlerts = summary.labAlerts.filter(a => a.status === 'normal' || a.status === 'optimal');

    const hasAnyData = summary.allergies.length > 0 ||
        summary.intolerances.length > 0 ||
        summary.dietPattern ||
        summary.medicalConditions.length > 0 ||
        summary.medications.length > 0 ||
        summary.labAlerts.length > 0 ||
        summary.dislikes.length > 0 ||
        summary.likedFoods.length > 0;

    return (
        <div className={`bg-white p-4 rounded-lg border border-gray-200 ${className}`}>
            <h3 className="text-gray-900 font-medium mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-brand" />
                Medical Summary
            </h3>

            {!hasAnyData ? (
                <p className="text-sm text-gray-500 text-center py-4">
                    No medical data recorded
                </p>
            ) : (
                <div className="space-y-2">
                    {/* Critical Lab Alerts */}
                    {criticalAlerts.length > 0 && (
                        <Section
                            title="Critical Alerts"
                            icon={<AlertCircle className="w-4 h-4 text-red-500" />}
                            count={criticalAlerts.length}
                            color="bg-red-50 border-red-200"
                            defaultOpen={true}
                        >
                            <div className="space-y-1">
                                {criticalAlerts.map((alert, i) => (
                                    <LabAlertItem key={i} alert={alert} />
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Warning Lab Alerts */}
                    {warningAlerts.length > 0 && (
                        <Section
                            title="Warnings"
                            icon={<AlertTriangle className="w-4 h-4 text-yellow-500" />}
                            count={warningAlerts.length}
                            color="bg-yellow-50 border-yellow-200"
                            defaultOpen={true}
                        >
                            <div className="space-y-1">
                                {warningAlerts.map((alert, i) => (
                                    <LabAlertItem key={i} alert={alert} />
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Normal Lab Values (collapsed by default) */}
                    {normalAlerts.length > 0 && (
                        <Section
                            title="Normal Values"
                            icon={<TestTube className="w-4 h-4 text-green-500" />}
                            count={normalAlerts.length}
                            color="bg-green-50 border-green-200"
                        >
                            <div className="space-y-1">
                                {normalAlerts.map((alert, i) => (
                                    <LabAlertItem key={i} alert={alert} />
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Allergies & Intolerances */}
                    {(summary.allergies.length > 0 || summary.intolerances.length > 0) && (
                        <Section
                            title="Allergies & Intolerances"
                            icon={<Ban className="w-4 h-4 text-red-500" />}
                            count={summary.allergies.length + summary.intolerances.length}
                            color="bg-red-50 border-red-200"
                            defaultOpen={true}
                        >
                            <div className="flex flex-wrap gap-1.5">
                                {summary.allergies.map((a, i) => (
                                    <Chip key={`a-${i}`} color="bg-red-100 text-red-700">{a}</Chip>
                                ))}
                                {summary.intolerances.map((a, i) => (
                                    <Chip key={`i-${i}`} color="bg-red-100 text-red-600">{a}</Chip>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Diet Pattern */}
                    {summary.dietPattern && (
                        <Section
                            title="Diet Pattern"
                            icon={<Shield className="w-4 h-4 text-blue-500" />}
                            color="bg-blue-50 border-blue-200"
                            defaultOpen={true}
                        >
                            <div className="text-sm">
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                    {DIET_DISPLAY[summary.dietPattern] || summary.dietPattern}
                                </span>
                                {summary.eggAvoidDays.length > 0 && (
                                    <p className="text-xs text-blue-600 mt-1.5">
                                        No eggs: {summary.eggAvoidDays.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}
                                    </p>
                                )}
                            </div>
                        </Section>
                    )}

                    {/* Medical Conditions */}
                    {summary.medicalConditions.length > 0 && (
                        <Section
                            title="Conditions"
                            icon={<AlertTriangle className="w-4 h-4 text-yellow-600" />}
                            count={summary.medicalConditions.length}
                            color="bg-yellow-50 border-yellow-200"
                            defaultOpen={true}
                        >
                            <div className="flex flex-wrap gap-1.5">
                                {summary.medicalConditions.map((c, i) => (
                                    <Chip key={i} color="bg-yellow-100 text-yellow-700">
                                        {c.replace(/_/g, ' ')}
                                    </Chip>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Medications */}
                    {summary.medications.length > 0 && (
                        <Section
                            title="Medications"
                            icon={<Pill className="w-4 h-4 text-purple-500" />}
                            count={summary.medications.length}
                            color="bg-purple-50 border-purple-200"
                        >
                            <div className="flex flex-wrap gap-1.5">
                                {summary.medications.map((m, i) => (
                                    <Chip key={i} color="bg-purple-100 text-purple-700">{m}</Chip>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Dislikes & Likes */}
                    {(summary.dislikes.length > 0 || summary.likedFoods.length > 0) && (
                        <Section
                            title="Food Preferences"
                            icon={<Heart className="w-4 h-4 text-pink-500" />}
                            color="bg-gray-50 border-gray-200"
                        >
                            {summary.dislikes.length > 0 && (
                                <div className="mb-2">
                                    <p className="text-[10px] font-medium text-gray-500 uppercase mb-1">Dislikes</p>
                                    <div className="flex flex-wrap gap-1">
                                        {summary.dislikes.slice(0, 6).map((d, i) => (
                                            <Chip key={i} color="bg-gray-200 text-gray-600">{d}</Chip>
                                        ))}
                                        {summary.dislikes.length > 6 && (
                                            <span className="text-xs text-gray-400">+{summary.dislikes.length - 6}</span>
                                        )}
                                    </div>
                                </div>
                            )}
                            {summary.likedFoods.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-medium text-gray-500 uppercase mb-1">Favorites</p>
                                    <div className="flex flex-wrap gap-1">
                                        {summary.likedFoods.slice(0, 6).map((f, i) => (
                                            <Chip key={i} color="bg-green-100 text-green-700">{f}</Chip>
                                        ))}
                                        {summary.likedFoods.length > 6 && (
                                            <span className="text-xs text-green-600">+{summary.likedFoods.length - 6}</span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </Section>
                    )}

                    {/* Lab Date Footer */}
                    {summary.labDate && (
                        <p className="text-[10px] text-gray-400 text-center pt-1">
                            Lab date: {new Date(summary.labDate).toLocaleDateString()}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
