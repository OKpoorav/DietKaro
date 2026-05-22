'use client';

import { CheckCircle, AlertTriangle, AlertCircle, Sparkles } from 'lucide-react';
import type { DraftFoodItem } from '@/lib/hooks/use-ai-meal-plan-draft';

interface AiDraftItemRowProps {
    item: DraftFoodItem;
    selected: boolean;
    onToggle: () => void;
}

function statusBadge(item: DraftFoodItem) {
    if (item.validation.blocked) {
        return {
            icon: <AlertCircle className="w-3.5 h-3.5 text-red-500" />,
            label: 'blocked',
            className: 'bg-red-50 text-red-600 border-red-200',
        };
    }
    if (item.validation.severity === 'YELLOW') {
        return {
            icon: <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />,
            label: 'warning',
            className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
        };
    }
    return {
        icon: <CheckCircle className="w-3.5 h-3.5 text-green-500" />,
        label: 'ok',
        className: 'bg-green-50 text-green-700 border-green-200',
    };
}

export function AiDraftItemRow({ item, selected, onToggle }: AiDraftItemRowProps) {
    const badge = statusBadge(item);
    const disabled = item.validation.blocked;
    const firstAlert = item.validation.alerts[0];

    return (
        <li className={`flex items-start gap-2 px-3 py-2 rounded-md ${disabled ? 'bg-red-50/40' : 'hover:bg-gray-50'}`}>
            <input
                type="checkbox"
                checked={selected && !disabled}
                disabled={disabled}
                onChange={onToggle}
                className="mt-1 w-3.5 h-3.5 accent-brand"
            />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm ${disabled ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {item.foodName}
                    </span>
                    {item.wasCreated && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-200 inline-flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            new
                        </span>
                    )}
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${badge.className}`}>
                        {badge.icon}
                        {badge.label}
                    </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                    {item.quantityLabel} ({item.quantityG}g)
                    {item.notes ? ` · ${item.notes}` : ''}
                </p>
                {firstAlert && (
                    <p className={`text-[11px] mt-0.5 ${item.validation.blocked ? 'text-red-600' : 'text-yellow-700'}`}>
                        {firstAlert.message}
                    </p>
                )}
            </div>
        </li>
    );
}
