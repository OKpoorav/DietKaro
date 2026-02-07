/**
 * Validation Alert Component
 * Displays validation messages with severity-based styling
 */

import React from 'react';
import { ValidationAlert as ValidationAlertType, ValidationSeverity } from '@/lib/hooks/use-validation';
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface ValidationAlertProps {
    alerts: ValidationAlertType[];
}

export function ValidationAlert({ alerts }: ValidationAlertProps) {
    if (!alerts || alerts.length === 0) return null;

    return (
        <div className="space-y-2 mt-3">
            {alerts.map((alert, idx) => {
                const { bgColor, borderColor, textColor, IconComponent } = getSeverityStyles(alert.severity);

                return (
                    <div
                        key={idx}
                        className={`p-3 rounded-lg border-2 ${bgColor} ${borderColor} ${textColor} transition-all`}
                    >
                        <div className="flex items-start gap-2">
                            <IconComponent className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm leading-tight">{alert.message}</p>
                                {alert.recommendation && (
                                    <p className="text-xs mt-1.5 opacity-80 leading-tight">
                                        <span className="inline-block mr-1">💡</span>
                                        {alert.recommendation}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function getSeverityStyles(severity: ValidationSeverity) {
    switch (severity) {
        case 'RED':
            return {
                bgColor: 'bg-red-50 dark:bg-red-950/20',
                borderColor: 'border-red-300 dark:border-red-800',
                textColor: 'text-red-900 dark:text-red-200',
                IconComponent: AlertCircle,
            };
        case 'YELLOW':
            return {
                bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
                borderColor: 'border-yellow-300 dark:border-yellow-700',
                textColor: 'text-yellow-900 dark:text-yellow-200',
                IconComponent: AlertTriangle,
            };
        case 'GREEN':
            return {
                bgColor: 'bg-green-50 dark:bg-green-950/20',
                borderColor: 'border-green-300 dark:border-green-700',
                textColor: 'text-green-900 dark:text-green-200',
                IconComponent: CheckCircle,
            };
        default:
            return {
                bgColor: 'bg-gray-50 dark:bg-gray-900',
                borderColor: 'border-gray-300 dark:border-gray-700',
                textColor: 'text-gray-900 dark:text-gray-200',
                IconComponent: Info,
            };
    }
}
