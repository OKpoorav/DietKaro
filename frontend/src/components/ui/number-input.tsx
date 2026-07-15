'use client';

import { useState } from 'react';

interface NumberInputProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'> {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
}

function clamp(n: number, min?: number, max?: number): number {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
}

/**
 * Number input that can be cleared while typing.
 *
 * While focused, the box owns a string draft — empty and partial values
 * ("", "0.", "-") are allowed, so users can select-all + retype. Valid
 * in-range numbers commit live; on blur the draft is parsed, clamped to
 * min/max, and committed, or reverted to the last valid value if empty.
 */
export function NumberInput({ value, onChange, min, max, ...rest }: NumberInputProps) {
    // null = not editing; the prop is the display value
    const [draft, setDraft] = useState<string | null>(null);

    const commit = (raw: string) => {
        const n = parseFloat(raw);
        if (Number.isFinite(n)) onChange(clamp(n, min, max));
        setDraft(null);
    };

    return (
        <input
            {...rest}
            type="number"
            min={min}
            max={max}
            value={draft ?? String(value)}
            onFocus={(e) => {
                setDraft(String(value));
                rest.onFocus?.(e);
            }}
            onChange={(e) => {
                const raw = e.target.value;
                setDraft(raw);
                const n = parseFloat(raw);
                // Live-commit only values that need no clamping, so mid-typing
                // states ("0" on the way to "0.5") don't get snapped
                if (Number.isFinite(n) && clamp(n, min, max) === n) onChange(n);
            }}
            onBlur={(e) => {
                commit(e.target.value);
                rest.onBlur?.(e);
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
                rest.onKeyDown?.(e);
            }}
        />
    );
}
