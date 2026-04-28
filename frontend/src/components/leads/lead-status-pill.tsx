'use client';

import { cn } from '@/lib/utils';

interface LeadStatusPillProps {
    name: string;
    color: string;
    className?: string;
}

export function LeadStatusPill({ name, color, className }: LeadStatusPillProps) {
    return (
        <span
            className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white', className)}
            style={{ backgroundColor: color }}
        >
            {name}
        </span>
    );
}
