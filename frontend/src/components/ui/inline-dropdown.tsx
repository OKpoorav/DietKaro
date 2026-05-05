'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

export interface DropdownOption<T extends string = string> {
    value: T;
    label: string;
    color?: string;
}

interface InlineDropdownProps<T extends string> {
    value: T;
    options: DropdownOption<T>[];
    onChange: (value: T) => void;
    disabled?: boolean;
    className?: string;
}

export function InlineDropdown<T extends string>({ value, options, onChange, disabled, className }: InlineDropdownProps<T>) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
    const btnRef = useRef<HTMLButtonElement>(null);

    const current = options.find(o => o.value === value);
    const color = current?.color;

    const openDropdown = () => {
        if (disabled || !btnRef.current) return;
        const rect = btnRef.current.getBoundingClientRect();
        setPos({
            top: rect.bottom + window.scrollY + 4,
            left: rect.left + window.scrollX,
            width: Math.max(rect.width, 160),
        });
        setOpen(true);
    };

    useEffect(() => {
        if (!open) return;
        const close = () => setOpen(false);
        document.addEventListener('mousedown', close);
        document.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, [open]);

    const badgeStyle = color
        ? { color, backgroundColor: `${color}18`, borderColor: `${color}50` }
        : undefined;

    return (
        <div className={`relative inline-flex items-center ${className ?? ''}`}>
            <button
                ref={btnRef}
                type="button"
                disabled={disabled}
                onClick={openDropdown}
                className="inline-flex items-center gap-1 text-xs font-semibold pl-2.5 pr-5 py-1 rounded-full border cursor-pointer transition-colors hover:brightness-95 disabled:opacity-60 focus:outline-none"
                style={badgeStyle}
            >
                {current?.label ?? value}
            </button>
            <ChevronDown className="w-3 h-3 absolute right-1.5 pointer-events-none" style={color ? { color } : undefined} />

            {open && typeof document !== 'undefined' && createPortal(
                <div
                    onMouseDown={e => e.stopPropagation()}
                    style={{ position: 'absolute', top: pos.top, left: pos.left, minWidth: pos.width, zIndex: 9999 }}
                    className="bg-white rounded-xl shadow-xl border border-gray-100 py-1 overflow-hidden"
                >
                    {options.map(opt => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                        >
                            <span className="flex-1 font-medium text-gray-800">{opt.label}</span>
                            {opt.value === value && <Check className="w-3.5 h-3.5 text-brand flex-shrink-0" />}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
}
