'use client';

import { X } from 'lucide-react';
import type { TagColor } from '@/lib/hooks/use-tags';

const COLOR_CLASSES: Record<TagColor, string> = {
    green:  'bg-green-50  text-green-700  border-green-200',
    blue:   'bg-blue-50   text-blue-700   border-blue-200',
    amber:  'bg-amber-50  text-amber-800  border-amber-200',
    rose:   'bg-rose-50   text-rose-700   border-rose-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
    slate:  'bg-slate-50  text-slate-700  border-slate-200',
    teal:   'bg-teal-50   text-teal-700   border-teal-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
};

const SIZE_CLASSES = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
};

export interface TagChipProps {
    name: string;
    color: TagColor;
    size?: keyof typeof SIZE_CLASSES;
    onRemove?: () => void;
    className?: string;
}

export function TagChip({ name, color, size = 'sm', onRemove, className = '' }: TagChipProps) {
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap ${SIZE_CLASSES[size]} ${COLOR_CLASSES[color]} ${className}`}
        >
            {name}
            {onRemove && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    aria-label={`Remove ${name}`}
                    className="hover:opacity-70"
                >
                    <X className="w-3 h-3" />
                </button>
            )}
        </span>
    );
}

export function getTagColorClasses(color: TagColor): string {
    return COLOR_CLASSES[color];
}
