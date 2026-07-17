'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2 } from 'lucide-react';
import { useClients } from '@/lib/hooks/use-clients';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { getInitials } from '@/lib/utils/formatters';

const MIN_CHARS = 2;

/**
 * Instant client lookup in the persistent top nav. ⌘K (or "/") focuses,
 * arrows navigate, Enter opens the client, Esc closes.
 */
export function GlobalClientSearch() {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Set after mount to avoid an SSR hydration mismatch — ⌘ on Mac, Ctrl elsewhere
    const [kbdHint, setKbdHint] = useState('');
    useEffect(() => {
        const isMac = /Mac|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent);
        setKbdHint(isMac ? '⌘K' : 'Ctrl K');
    }, []);

    const debounced = useDebouncedValue(query.trim(), 250);
    const searching = debounced.length >= MIN_CHARS;
    const { data, isFetching } = useClients({ search: searching ? debounced : undefined, pageSize: 8 });
    const results = searching ? (data?.data ?? []) : [];

    // ⌘K / Ctrl+K / "/" focuses the search from anywhere
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
            } else if (e.key === '/' && !typing) {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    // Close on click outside
    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    useEffect(() => setActiveIndex(0), [debounced]);

    const goToClient = (id: string) => {
        setOpen(false);
        setQuery('');
        inputRef.current?.blur();
        router.push(`/dashboard/clients/${id}`);
    };

    const onInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setOpen(false);
            inputRef.current?.blur();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && results[activeIndex]) {
            e.preventDefault();
            goToClient(results[activeIndex].id);
        }
    };

    return (
        <div ref={containerRef} className="relative w-full max-w-md">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={onInputKeyDown}
                    placeholder="Search clients…"
                    aria-label="Search clients"
                    className="w-full h-10 pl-9 pr-14 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-colors"
                />
                {kbdHint && (
                    <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-gray-400 bg-white border border-gray-200 rounded pointer-events-none">
                        {kbdHint}
                    </kbd>
                )}
            </div>

            {open && query.trim().length >= MIN_CHARS && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
                    {isFetching && results.length === 0 ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="w-4 h-4 animate-spin text-brand" />
                        </div>
                    ) : results.length > 0 ? (
                        <ul className="max-h-80 overflow-y-auto py-1">
                            {results.map((c, i) => (
                                <li key={c.id}>
                                    <button
                                        type="button"
                                        onClick={() => goToClient(c.id)}
                                        onMouseEnter={() => setActiveIndex(i)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                                            i === activeIndex ? 'bg-brand/5' : ''
                                        }`}
                                    >
                                        <span className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-brand text-xs font-bold shrink-0">
                                            {getInitials(c.fullName)}
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block text-sm font-medium text-gray-900 truncate">{c.fullName}</span>
                                            <span className="block text-xs text-gray-400 truncate">
                                                {c.phone || c.email || ''}
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="py-6 text-center text-sm text-gray-400">No clients found</p>
                    )}
                </div>
            )}
        </div>
    );
}
