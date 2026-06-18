'use client';

import { useMemo } from 'react';

interface TimeInput12hProps {
    /** "HH:MM" 24-hour string, or '' when unset */
    value: string;
    /** Emits "HH:MM" 24-hour string — storage format never changes */
    onChange: (value: string) => void;
    className?: string;
}

function parse(value: string): { h12: number | null; minute: number; period: 'AM' | 'PM' } {
    if (!value) return { h12: null, minute: 0, period: 'AM' };
    const [hStr, mStr] = value.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (Number.isNaN(h)) return { h12: null, minute: 0, period: 'AM' };
    const period: 'AM' | 'PM' = h < 12 ? 'AM' : 'PM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return { h12, minute: Number.isNaN(m) ? 0 : m, period };
}

function compose(h12: number, minute: number, period: 'AM' | 'PM'): string {
    let h = h12 % 12;
    if (period === 'PM') h += 12;
    return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

const selectCls =
    'text-sm py-1 px-1.5 border border-gray-200 rounded-md text-gray-700 bg-white focus:ring-1 focus:ring-brand focus:border-brand outline-none';

/**
 * 12-hour meal-time picker (hour / minute / AM-PM). Reads and writes the
 * canonical "HH:MM" 24-hour string so storage is unchanged — only the dietitian
 * sees AM/PM. Used in place of <input type="time"> (which renders 12h or 24h
 * depending on the user's OS locale, so AM/PM wasn't guaranteed).
 */
export function TimeInput12h({ value, onChange, className = '' }: TimeInput12hProps) {
    const { h12, minute, period } = useMemo(() => parse(value), [value]);

    // When emitting, default any not-yet-chosen part so we always produce HH:MM.
    const emit = (next: { h12?: number | null; minute?: number; period?: 'AM' | 'PM' }) => {
        const hour = next.h12 ?? h12 ?? 12;
        const min = next.minute ?? minute;
        const per = next.period ?? period;
        onChange(compose(hour, min, per));
    };

    return (
        <div className={`inline-flex items-center gap-0.5 ${className}`}>
            <select
                aria-label="Hour"
                value={h12 ?? ''}
                onChange={(e) => emit({ h12: parseInt(e.target.value, 10) })}
                className={selectCls}
            >
                {h12 === null && <option value="" disabled>--</option>}
                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                    <option key={h} value={h}>{h}</option>
                ))}
            </select>
            <span className="text-gray-400">:</span>
            <select
                aria-label="Minute"
                value={minute}
                onChange={(e) => emit({ minute: parseInt(e.target.value, 10) })}
                className={selectCls}
            >
                {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                    <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                ))}
            </select>
            <select
                aria-label="AM or PM"
                value={period}
                onChange={(e) => emit({ period: e.target.value as 'AM' | 'PM' })}
                className={selectCls}
            >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
            </select>
        </div>
    );
}
