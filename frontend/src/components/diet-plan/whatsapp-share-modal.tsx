'use client';

import { useState } from 'react';
import { MessageCircle, Copy, Check, X } from 'lucide-react';
import type { LocalMeal } from '@/lib/types/diet-plan.types';
import { compareByTime } from '@/lib/utils/meal-order';
import { formatTime12h } from '@/lib/utils/formatters';

interface WhatsAppShareModalProps {
    phone: string;
    clientName?: string;
    planName: string;
    startDate: Date;
    numDays: number;
    weeklyMeals: Record<number, LocalMeal[]>;
    dayNotes?: Record<number, string>;
    generalGuidelines?: string;
    onClose: () => void;
}

function normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `91${digits}`;
    if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
    return digits;
}

const MEAL_EMOJI: Record<string, string> = {
    breakfast: '🍳',
    lunch: '🥗',
    dinner: '🍽️',
    snack: '🍎',
};

function buildMessage(
    planName: string,
    clientName: string | undefined,
    startDate: Date,
    numDays: number,
    weeklyMeals: Record<number, LocalMeal[]>,
    dayNotes?: Record<number, string>,
    generalGuidelines?: string,
): string {
    const lines: string[] = [];

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + numDays - 1);
    const fmtDate = (d: Date) =>
        d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

    lines.push(`🥗 *${planName}*`);
    if (clientName) lines.push(`👤 ${clientName}`);
    lines.push(`📅 ${fmtDate(startDate)}${numDays > 1 ? ` – ${fmtDate(endDate)}` : ''}`);
    if (generalGuidelines?.trim()) {
        lines.push('');
        lines.push('📋 *General Guidelines*');
        lines.push(`_${generalGuidelines.trim()}_`);
    }
    lines.push('');

    for (let day = 0; day < numDays; day++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + day);
        const dayLabel = date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

        if (numDays > 1) {
            lines.push(`*Day ${day + 1} – ${dayLabel}*`);
        }

        const note = dayNotes?.[day]?.trim();
        if (note) {
            lines.push(`📌 _${note}_`);
        }

        // Canonical chronological order — same comparator as every other view.
        const meals = (weeklyMeals[day] || []).slice().sort((a, b) => compareByTime(a.time, b.time));

        if (meals.length === 0) {
            lines.push('_No meals_');
        } else {
            for (const meal of meals) {
                const emoji = MEAL_EMOJI[meal.type] || '🍴';
                const timePart = meal.time ? ` (${formatTime12h(meal.time)})` : '';
                lines.push('');
                lines.push(`${emoji} *${meal.name}*${timePart}`);
                if (meal.description) lines.push(`  _${meal.description}_`);
                if (meal.instructions) lines.push(`  📝 ${meal.instructions}`);

                // Group foods by optionGroup. Group 0 = primary (always eaten).
                // Groups 1+ = alternatives within the meal (pick one per group).
                const groups = new Map<number, typeof meal.foods>();
                for (const f of meal.foods) {
                    const g = f.optionGroup ?? 0;
                    if (!groups.has(g)) groups.set(g, []);
                    groups.get(g)!.push(f);
                }
                const sortedGroupKeys = Array.from(groups.keys()).sort((a, b) => a - b);

                let totalRendered = 0;
                for (const g of sortedGroupKeys) {
                    const items = groups.get(g)!;
                    if (g === 0) {
                        for (const food of items) {
                            lines.push(`  • ${food.name} – ${food.quantity || `${food.quantityValue}g`}`);
                            totalRendered += 1;
                        }
                    } else {
                        // Render alternatives joined by " OR " on a single sub-line so
                        // the client clearly sees them as a pick-one group.
                        const altLabel = items
                            .map((f) => `${f.name} – ${f.quantity || `${f.quantityValue}g`}`)
                            .join('  *OR*  ');
                        lines.push(`  ↳ ${altLabel}`);
                        totalRendered += items.length;
                    }
                }
                if (totalRendered === 0) lines.push('  _No items_');
            }
        }

        if (day < numDays - 1) lines.push('');
    }

    return lines.join('\n');
}

export function WhatsAppShareModal({
    phone,
    clientName,
    planName,
    startDate,
    numDays,
    weeklyMeals,
    dayNotes,
    generalGuidelines,
    onClose,
}: WhatsAppShareModalProps) {
    const [copied, setCopied] = useState(false);

    const message = buildMessage(planName, clientName, startDate, numDays, weeklyMeals, dayNotes, generalGuidelines);
    const normalized = normalizePhone(phone);
    const waUrl = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;

    const handleCopy = async () => {
        await navigator.clipboard.writeText(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                            <MessageCircle className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-900">Share on WhatsApp</h3>
                            <p className="text-xs text-gray-400">Plan published · send to client</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Phone row */}
                <div className="px-5 py-3 flex items-center gap-2 border-b border-gray-100 flex-shrink-0">
                    <span className="text-xs text-gray-500">Sending to:</span>
                    <span className="text-sm font-semibold text-gray-900">{phone}</span>
                </div>

                {/* Message preview */}
                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Preview</p>
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-xl p-3 border border-gray-100 font-sans">
                        {message}
                    </pre>
                </div>

                {/* Actions */}
                <div className="px-5 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                    >
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                        onClick={onClose}
                        className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        Skip
                    </button>
                    <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={onClose}
                        className="ml-auto flex items-center gap-2 px-4 py-2 text-sm font-bold bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                    >
                        <MessageCircle className="w-4 h-4" />
                        Share on WhatsApp
                    </a>
                </div>
            </div>
        </div>
    );
}
