'use client';

import { cn } from '@/lib/utils';
import type { LeadTemperature } from '@/lib/hooks/use-leads';

const TEMP_CONFIG = {
    hot:  { label: 'Hot',  bg: 'bg-red-100',  text: 'text-red-700',  dot: 'bg-red-500' },
    warm: { label: 'Warm', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
    cold: { label: 'Cold', bg: 'bg-blue-100',  text: 'text-blue-700',  dot: 'bg-blue-500' },
} as const;

interface LeadTemperaturePillProps {
    temperature: LeadTemperature;
    className?: string;
}

export function LeadTemperaturePill({ temperature, className }: LeadTemperaturePillProps) {
    const cfg = TEMP_CONFIG[temperature];
    return (
        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', cfg.bg, cfg.text, className)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
            {cfg.label}
        </span>
    );
}
