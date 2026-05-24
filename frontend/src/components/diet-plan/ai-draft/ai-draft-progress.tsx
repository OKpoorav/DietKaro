'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sparkles, ChefHat, Search, Wand2, ListChecks, ShieldCheck, CookingPot, Salad, Clock } from 'lucide-react';

/**
 * In-flight view shown while the agent is drafting. Cycles a pool of "doing
 * X..." messages every ~2s so the wait feels active rather than dead. The
 * progress bar is intentionally indeterminate — the backend doesn't stream
 * step counts, so we can't show real progress.
 */

interface AiDraftProgressProps {
    /** Roughly when the request started, used to drive the elapsed timer. */
    startedAt: number;
}

const STAGES: Array<{ label: string; icon: React.ReactNode; minSeconds: number }> = [
    { label: 'Parsing your meal plan…', icon: <Wand2 className="w-4 h-4" />, minSeconds: 0 },
    { label: 'Reading client allergies and preferences…', icon: <ShieldCheck className="w-4 h-4" />, minSeconds: 3 },
    { label: 'Looking up Indian foods in the library…', icon: <Search className="w-4 h-4" />, minSeconds: 6 },
    { label: 'Matching jowar roti, dal, sabzi…', icon: <Salad className="w-4 h-4" />, minSeconds: 10 },
    { label: 'Estimating macros for new ingredients…', icon: <ChefHat className="w-4 h-4" />, minSeconds: 15 },
    { label: 'Tagging allergens and dietary flags…', icon: <ListChecks className="w-4 h-4" />, minSeconds: 22 },
    { label: 'Resolving alternatives (museli OR oats)…', icon: <CookingPot className="w-4 h-4" />, minSeconds: 30 },
    { label: 'Cross-checking your food library…', icon: <Search className="w-4 h-4" />, minSeconds: 38 },
    { label: 'Computing serving sizes (katori, cup, glass)…', icon: <Salad className="w-4 h-4" />, minSeconds: 45 },
    { label: 'Almost there — finalising the draft…', icon: <Sparkles className="w-4 h-4" />, minSeconds: 55 },
];

const TIP_POOL = [
    'Tip: paste multiple days in one go; the AI handles 7 days at once.',
    'Tip: use "/" or "//" for alternatives (e.g. "tea // coffee").',
    'Tip: "+" means add both — "tea + makhana" keeps both in the same meal.',
    'Tip: write "1 katori dal" — household units are auto-converted to grams.',
    'Did you know? Items not in your library get auto-created with estimated macros.',
    'Heads up: foods the client is allergic to are blocked automatically.',
    'Tip: include times ("9am", "1:30pm") to pin meals to the right slot.',
    'Fun fact: each draft takes ~15–60s depending on how many new foods are created.',
];

export function AiDraftProgress({ startedAt }: AiDraftProgressProps) {
    const [now, setNow] = useState(() => Date.now());
    const [tipIndex, setTipIndex] = useState(0);

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 500);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        const id = setInterval(() => setTipIndex((i) => (i + 1) % TIP_POOL.length), 4500);
        return () => clearInterval(id);
    }, []);

    const elapsedSec = Math.floor((now - startedAt) / 1000);

    const currentStage = useMemo(() => {
        // Pick the latest stage whose minSeconds threshold has passed.
        let active = STAGES[0];
        for (const stage of STAGES) {
            if (elapsedSec >= stage.minSeconds) active = stage;
        }
        return active;
    }, [elapsedSec]);

    // Soft progress estimate — caps at 95% so we never show "100% then wait".
    // Tuned for an expected 30s run; long runs slow the bar asymptotically.
    const pct = Math.min(95, Math.round((1 - Math.exp(-elapsedSec / 18)) * 100));

    return (
        <div className="p-6 space-y-5">
            <div className="flex flex-col items-center text-center">
                <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-brand/20 blur-xl animate-pulse" aria-hidden />
                    <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-brand to-emerald-500 flex items-center justify-center shadow-lg shadow-brand/30">
                        <Sparkles className="w-6 h-6 text-white animate-pulse" />
                    </div>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-gray-900">
                    Drafting your meal plan
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">
                    This usually takes 15–60 seconds. Hang tight.
                </p>
            </div>

            {/* Indeterminate-feel progress bar */}
            <div>
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-brand via-emerald-400 to-brand bg-[length:200%_100%] rounded-full transition-all duration-500 ease-out animate-[shimmer_2s_linear_infinite]"
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-gray-400 font-mono">
                        {String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:{String(elapsedSec % 60).padStart(2, '0')}
                    </span>
                    <span className="text-[10px] text-gray-400">{pct}%</span>
                </div>
            </div>

            {/* Live stage label */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-brand/5 border border-brand/15 text-brand">
                <span className="animate-pulse">{currentStage.icon}</span>
                <span className="text-xs font-medium">{currentStage.label}</span>
            </div>

            {/* Rotating tip */}
            <div className="flex items-start gap-2 text-xs text-gray-500">
                <Clock className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" />
                <p key={tipIndex} className="animate-in fade-in slide-in-from-bottom-1 duration-500">
                    {TIP_POOL[tipIndex]}
                </p>
            </div>

            <style jsx>{`
                @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
            `}</style>
        </div>
    );
}
