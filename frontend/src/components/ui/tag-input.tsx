'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';

const FOOD_SUGGESTIONS = [
    'Peanuts', 'Milk', 'Eggs', 'Wheat', 'Soy', 'Fish', 'Shellfish', 'Tree Nuts',
    'Bitter Gourd', 'Broccoli', 'Tofu', 'Okra', 'Mushrooms', 'Onions', 'Garlic',
    'Spinach', 'Cabbage', 'Cauliflower', 'Eggplant', 'Tomatoes', 'Capsicum',
    'Cucumber', 'Celery', 'Beetroot', 'Radish', 'Kale', 'Coriander', 'Mint',
    'Fenugreek', 'Mustard', 'Ginger', 'Karela', 'Lauki', 'Arbi', 'Jackfruit',
    'Raw Papaya', 'Tinda', 'Parwal', 'Cluster Beans', 'Drumstick', 'Colocasia',
];

interface TagInputProps {
    value: string[];
    onChange: (tags: string[]) => void;
    suggestions?: string[];
    /** When provided, queries server for suggestions on each keystroke (debounced). */
    searchFn?: (q: string) => Promise<string[]>;
    placeholder?: string;
}

export function TagInput({
    value,
    onChange,
    suggestions = FOOD_SUGGESTIONS,
    searchFn,
    placeholder = 'Type to search or add...',
}: TagInputProps) {
    const [input, setInput] = useState('');
    const [open, setOpen] = useState(false);
    const [highlighted, setHighlighted] = useState(-1);
    const [asyncResults, setAsyncResults] = useState<string[]>([]);
    const [asyncLoading, setAsyncLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const requestSeqRef = useRef(0);

    const lowerValues = value.map((v) => v.toLowerCase());

    // Debounced server-side search
    useEffect(() => {
        if (!searchFn) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        const q = input.trim();
        if (!q) {
            setAsyncResults([]);
            setAsyncLoading(false);
            return;
        }
        setAsyncLoading(true);
        const seq = ++requestSeqRef.current;
        debounceRef.current = setTimeout(async () => {
            try {
                const results = await searchFn(q);
                if (seq !== requestSeqRef.current) return;
                setAsyncResults(results);
            } catch {
                if (seq !== requestSeqRef.current) return;
                setAsyncResults([]);
            } finally {
                if (seq === requestSeqRef.current) setAsyncLoading(false);
            }
        }, 250);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [input, searchFn]);

    // Build filtered list — server results if searchFn provided, else static suggestions
    const filtered = (() => {
        if (!input.trim()) return [];
        const pool = searchFn ? asyncResults : suggestions;
        const seen = new Set<string>();
        return pool
            .filter((s) => {
                const l = s.toLowerCase();
                if (lowerValues.includes(l) || seen.has(l)) return false;
                seen.add(l);
                if (searchFn) return true; // server already filtered
                return l.includes(input.toLowerCase());
            })
            .slice(0, 8);
    })();

    const add = (tag: string) => {
        const t = tag.trim();
        if (!t || lowerValues.includes(t.toLowerCase())) return;
        onChange([...value, t]);
        setInput('');
        setOpen(false);
        setHighlighted(-1);
        inputRef.current?.focus();
    };

    const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            if (highlighted >= 0 && filtered[highlighted]) add(filtered[highlighted]);
            else if (input.trim()) add(input.trim());
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlighted((h) => Math.max(h - 1, -1));
        } else if (e.key === 'Escape') {
            setOpen(false);
        } else if (e.key === 'Backspace' && !input && value.length > 0) {
            onChange(value.slice(0, -1));
        }
    };

    const showDropdown = open && input.trim() && (asyncLoading || filtered.length > 0);

    return (
        <div className="relative">
            <div
                className="min-h-[42px] w-full px-3 py-2 border border-gray-200 rounded-lg focus-within:ring-1 focus-within:ring-brand focus-within:border-brand flex flex-wrap gap-1.5 cursor-text"
                onClick={() => inputRef.current?.focus()}
            >
                {value.map((tag, i) => (
                    <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand/10 text-brand text-xs font-medium rounded-full"
                    >
                        {tag}
                        <button
                            type="button"
                            onClick={() => remove(i)}
                            className="hover:text-red-500 transition-colors"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                ))}
                <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => {
                        setInput(e.target.value);
                        setOpen(true);
                        setHighlighted(-1);
                    }}
                    onKeyDown={onKeyDown}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                    className="flex-1 min-w-[140px] outline-none bg-transparent text-sm text-gray-900 placeholder-gray-400"
                    placeholder={value.length === 0 ? placeholder : ''}
                />
            </div>
            {showDropdown && (
                <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                    {asyncLoading && filtered.length === 0 ? (
                        <li className="px-3 py-2 text-xs text-gray-400 flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin" /> Searching…
                        </li>
                    ) : (
                        filtered.map((s, i) => (
                            <li
                                key={s}
                                className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                                    i === highlighted
                                        ? 'bg-brand/10 text-brand font-medium'
                                        : 'text-gray-700 hover:bg-gray-50'
                                }`}
                                onMouseDown={() => add(s)}
                            >
                                {s}
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
}
