'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Video, MapPin, Phone, Check, X, Loader2, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import {
    useCalendarEvents, useUpdateCalendarConsultation, useCompleteFollowup,
    type CalendarConsultation, type CalendarFollowup,
} from '@/lib/hooks/use-calendar';
import { Modal } from '@/components/ui/modal';
import { toast } from 'sonner';

type View = 'day' | 'week' | 'month';

type AnyEvent =
    | { kind: 'consultation'; data: CalendarConsultation }
    | { kind: 'followup'; data: CalendarFollowup };

// ─── Date helpers ─────────────────────────────────────────────────────────────

function startOfDay(d: Date) { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfWeek(d: Date) { const r = startOfDay(d); r.setDate(r.getDate() - ((r.getDay() + 6) % 7)); return r; }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999); }
function isSameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function isToday(d: Date) { return isSameDay(d, new Date()); }
function fmtTime(d: Date) { return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); }
function fmtDateLong(d: Date) { return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
function fmtDateShort(d: Date) { return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }

// ─── Unified event helpers ────────────────────────────────────────────────────

function eventTime(e: AnyEvent): Date {
    return e.kind === 'consultation' ? new Date(e.data.scheduledAt) : new Date(e.data.dueAt);
}
function eventKey(e: AnyEvent): string {
    return `${e.kind}:${e.data.id}`;
}
function sameEventKey(a: AnyEvent, b: AnyEvent) { return eventKey(a) === eventKey(b); }

const FOLLOWUP_ICONS = { call: Phone, visit: MapPin, todo: Check };
const FOLLOWUP_LABELS = { call: 'Call', visit: 'Visit', todo: 'To-Do' };

function eventColor(e: AnyEvent): string {
    if (e.kind === 'consultation') {
        const c = e.data;
        if (c.status === 'completed') return 'bg-emerald-100 border-emerald-400 text-emerald-800';
        if (c.status === 'cancelled') return 'bg-gray-100 border-gray-300 text-gray-400';
        return c.mode === 'online'
            ? 'bg-blue-100 border-blue-400 text-blue-800'
            : 'bg-orange-100 border-orange-400 text-orange-800';
    }
    const f = e.data;
    if (f.type === 'call') return 'bg-purple-100 border-purple-400 text-purple-800';
    if (f.type === 'visit') return 'bg-teal-100 border-teal-400 text-teal-800';
    return 'bg-yellow-100 border-yellow-400 text-yellow-800';
}

function eventLabel(e: AnyEvent): string {
    if (e.kind === 'consultation') {
        return e.data.client.fullName;
    }
    return e.data.lead.name;
}

function eventSubLabel(e: AnyEvent): string {
    if (e.kind === 'consultation') {
        return e.data.mode === 'online' ? 'Online' : 'In-Person';
    }
    return FOLLOWUP_LABELS[e.data.type];
}

// ─── Time grid constants ──────────────────────────────────────────────────────

const HOUR_START = 7;
const HOUR_END = 21;
const HOUR_HEIGHT = 64;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

function eventTop(e: AnyEvent) {
    const d = eventTime(e);
    return (d.getHours() + d.getMinutes() / 60 - HOUR_START) * HOUR_HEIGHT;
}
function eventHeight(e: AnyEvent) {
    const dur = e.kind === 'consultation' ? e.data.durationMin : 30;
    return Math.max(dur / 60 * HOUR_HEIGHT, 24);
}

// ─── Overlap layout ───────────────────────────────────────────────────────────

function computeOverlapLayout(events: AnyEvent[]): Map<string, { col: number; total: number }> {
    const sorted = [...events].sort((a, b) => eventTime(a).getTime() - eventTime(b).getTime());
    const layout = new Map<string, { col: number; total: number }>();
    const groups: AnyEvent[][] = [];

    for (const e of sorted) {
        const eStart = eventTime(e).getTime();
        const eDur = e.kind === 'consultation' ? e.data.durationMin : 30;
        const eEnd = eStart + eDur * 60000;
        let placed = false;
        for (const group of groups) {
            const overlaps = group.some(g => {
                const gStart = eventTime(g).getTime();
                const gDur = g.kind === 'consultation' ? g.data.durationMin : 30;
                const gEnd = gStart + gDur * 60000;
                return eStart < gEnd && eEnd > gStart;
            });
            if (overlaps) { group.push(e); placed = true; break; }
        }
        if (!placed) groups.push([e]);
    }

    for (const group of groups) {
        const total = group.length;
        group.forEach((e, i) => layout.set(eventKey(e), { col: i, total }));
    }
    return layout;
}

// ─── WhatsApp helper ──────────────────────────────────────────────────────────

function WAModal({ message, phone, onClose }: { message: string; phone: string; onClose: () => void }) {
    return (
        <Modal isOpen onClose={onClose} title="Send WhatsApp Message" size="sm">
            <div className="p-4 space-y-4">
                <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">{message}</div>
                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">Done</button>
                    <button onClick={() => window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank')}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700">
                        <MessageCircle className="w-4 h-4" /> Send on WhatsApp
                    </button>
                </div>
            </div>
        </Modal>
    );
}

// ─── Event Detail Panel ───────────────────────────────────────────────────────

function EventDetail({ event, onClose }: { event: AnyEvent; onClose: () => void }) {
    const updateConsult = useUpdateCalendarConsultation();
    const completeFollowup = useCompleteFollowup();
    const [waMsg, setWaMsg] = useState<{ msg: string; phone: string } | null>(null);
    const isPending = updateConsult.isPending || completeFollowup.isPending;

    const handleCompleteConsult = async () => {
        if (event.kind !== 'consultation') return;
        try {
            await updateConsult.mutateAsync({ id: event.data.id, status: 'completed' });
            toast.success('Marked as completed');
            const c = event.data;
            const d = new Date(c.scheduledAt);
            const label = c.title || (c.mode === 'online' ? 'Online Consultation' : 'In-Person Consultation');
            setWaMsg({
                phone: c.client.phone,
                msg: [
                    `Hi ${c.client.fullName}! 👋`, '',
                    `Thank you for attending your *${label}* today.`, '',
                    `📅 ${fmtDateLong(d)} at ${fmtTime(d)}`, '',
                    `We hope the session was helpful! 🌿`,
                ].join('\n'),
            });
        } catch { toast.error('Failed to update'); }
    };

    const handleCancelConsult = async () => {
        if (event.kind !== 'consultation') return;
        try {
            await updateConsult.mutateAsync({ id: event.data.id, status: 'cancelled' });
            toast.success('Cancelled');
            const c = event.data;
            const d = new Date(c.scheduledAt);
            const label = c.title || (c.mode === 'online' ? 'Online Consultation' : 'In-Person Consultation');
            setWaMsg({
                phone: c.client.phone,
                msg: [
                    `Hi ${c.client.fullName}! 👋`, '',
                    `Your *${label}* has been cancelled.`, '',
                    `📅 ${fmtDateLong(d)} at ${fmtTime(d)}`, '',
                    `Please contact us to reschedule. 🌿`,
                ].join('\n'),
            });
        } catch { toast.error('Failed to update'); }
    };

    const handleDoneFollowup = async () => {
        if (event.kind !== 'followup') return;
        try {
            await completeFollowup.mutateAsync({ id: event.data.id });
            toast.success('Follow-up marked done');
            onClose();
        } catch { toast.error('Failed to update'); }
    };

    if (event.kind === 'consultation') {
        const c = event.data;
        const d = new Date(c.scheduledAt);
        const endTime = new Date(d.getTime() + c.durationMin * 60000);
        return (
            <>
                <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <p className="font-semibold text-gray-900 text-sm">{c.title || (c.mode === 'online' ? 'Online Consultation' : 'In-Person Consultation')}</p>
                            <Link href={`/dashboard/clients/${c.client.id}`} className="text-xs text-brand hover:underline">{c.client.fullName}</Link>
                        </div>
                        <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="space-y-1.5 text-xs text-gray-600">
                        <p>📅 {fmtDateLong(d)}</p>
                        <p>🕐 {fmtTime(d)} – {fmtTime(endTime)} · {c.durationMin} min</p>
                        <div className="flex items-center gap-1">
                            {c.mode === 'online' ? <Video className="w-3 h-3 text-blue-500" /> : <MapPin className="w-3 h-3 text-orange-500" />}
                            <span>{c.mode === 'online' ? 'Online' : 'In-Person'}</span>
                        </div>
                        {c.mode === 'online' && c.meetLink && (
                            <a href={c.meetLink} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline block truncate">🔗 {c.meetLink}</a>
                        )}
                        {c.mode === 'in_person' && c.location && <p className="truncate">📌 {c.location}</p>}
                        {c.notes && <p className="text-gray-400 italic line-clamp-2">{c.notes}</p>}
                    </div>
                    <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : c.status === 'cancelled' ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-700'}`}>
                        {c.status}
                    </span>
                    {c.status === 'scheduled' && (
                        <div className="flex gap-1.5 pt-1">
                            <button onClick={handleCompleteConsult} disabled={isPending}
                                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-medium">
                                {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Done
                            </button>
                            <button onClick={handleCancelConsult} disabled={isPending}
                                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 text-xs font-medium">
                                <X className="w-3 h-3" /> Cancel
                            </button>
                        </div>
                    )}
                </div>
                {waMsg && <WAModal message={waMsg.msg} phone={waMsg.phone} onClose={() => setWaMsg(null)} />}
            </>
        );
    }

    // Followup
    const f = event.data;
    const d = new Date(f.dueAt);
    const Icon = FOLLOWUP_ICONS[f.type];
    return (
        <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <div className="flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5 text-purple-600" />
                        <p className="font-semibold text-gray-900 text-sm">{FOLLOWUP_LABELS[f.type]}</p>
                    </div>
                    <Link href={`/dashboard/leads/${f.lead.id}`} className="text-xs text-brand hover:underline">{f.lead.name}</Link>
                </div>
                <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-1.5 text-xs text-gray-600">
                <p>📅 {fmtDateLong(d)} at {fmtTime(d)}</p>
                <p>📞 {f.lead.primaryMobile}</p>
                <div className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: f.lead.status.color }}>
                    {f.lead.status.name}
                </div>
                {f.notes && <p className="text-gray-400 italic line-clamp-2">{f.notes}</p>}
            </div>
            <button onClick={handleDoneFollowup} disabled={isPending}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-medium">
                {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Mark as Done
            </button>
        </div>
    );
}

function DetailPanel({ event, onClose }: { event: AnyEvent; onClose: () => void }) {
    return (
        <div className="absolute z-30 right-0 top-0 w-72 bg-white rounded-2xl shadow-xl border border-gray-200 p-4">
            <EventDetail event={event} onClose={onClose} />
        </div>
    );
}

// ─── Time Grid ────────────────────────────────────────────────────────────────

function isInGrid(e: AnyEvent) {
    const d = eventTime(e);
    const h = d.getHours() + d.getMinutes() / 60;
    return h >= HOUR_START && h < HOUR_END;
}

function TimeGrid({ columns, events, onEventClick, selectedKey }: {
    columns: Date[];
    events: AnyEvent[];
    onEventClick: (e: AnyEvent) => void;
    selectedKey?: string;
}) {
    const nowRef = useRef<HTMLDivElement>(null);
    const now = new Date();
    const nowTop = (now.getHours() + now.getMinutes() / 60 - HOUR_START) * HOUR_HEIGHT;
    const showNow = nowTop >= 0 && nowTop <= (HOUR_END - HOUR_START) * HOUR_HEIGHT;

    // Check if any column has out-of-range events
    const hasOutOfRange = columns.some(col =>
        events.some(e => isSameDay(eventTime(e), col) && !isInGrid(e))
    );

    useEffect(() => {
        nowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, []);

    return (
        <div className="flex flex-col">
            {/* Out-of-range events strip — outside scroll so always visible */}
            {hasOutOfRange && (
                <div className="flex border border-gray-100 rounded-lg mb-2 bg-gray-50">
                    <div className="shrink-0 w-14 pr-2 text-right pt-1.5 pl-1">
                        <span className="text-[9px] text-gray-400 leading-none">early /<br/>late</span>
                    </div>
                    <div className="flex-1 flex gap-1 py-1.5 px-1 flex-wrap min-h-[28px]">
                        {columns.flatMap((col) =>
                            events
                                .filter(e => isSameDay(eventTime(e), col) && !isInGrid(e))
                                .map(e => {
                                    const isSelected = selectedKey === eventKey(e);
                                    return (
                                        <button
                                            key={eventKey(e)}
                                            onClick={() => onEventClick(e)}
                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border-l-2 text-[10px] font-semibold truncate max-w-[180px] transition-all hover:brightness-95 ${eventColor(e)} ${isSelected ? 'ring-2 ring-blue-400' : ''}`}
                                        >
                                            {fmtTime(eventTime(e))} · {eventLabel(e)} · {eventSubLabel(e)}
                                        </button>
                                    );
                                })
                        )}
                    </div>
                </div>
            )}

            {/* Main time grid — scrollable */}
            <div className="overflow-auto" style={{ maxHeight: '540px' }}>
            <div className="flex">
                {/* Time labels */}
                <div className="shrink-0 w-14 relative select-none" style={{ height: `${(HOUR_END - HOUR_START) * HOUR_HEIGHT}px` }}>
                    {HOURS.map(h => (
                        <div key={h} className="absolute w-full pr-2 text-right" style={{ top: `${(h - HOUR_START) * HOUR_HEIGHT - 8}px` }}>
                            <span className="text-[10px] text-gray-400">{h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}</span>
                        </div>
                    ))}
                </div>

            {/* Columns */}
            <div className="flex-1 flex">
                {columns.map((col, ci) => {
                    const colEvents = events.filter(e => isSameDay(eventTime(e), col) && isInGrid(e));
                    const layout = computeOverlapLayout(colEvents);
                    return (
                        <div key={ci} className="flex-1 relative border-l border-gray-100 min-w-0" style={{ height: `${(HOUR_END - HOUR_START) * HOUR_HEIGHT}px` }}>
                            {HOURS.map(h => (
                                <div key={h} className="absolute w-full border-t border-gray-100" style={{ top: `${(h - HOUR_START) * HOUR_HEIGHT}px` }} />
                            ))}
                            {showNow && isToday(col) && (
                                <div ref={nowRef} className="absolute w-full flex items-center z-10" style={{ top: `${nowTop}px` }}>
                                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                                    <div className="flex-1 h-px bg-red-400" />
                                </div>
                            )}
                            {colEvents.map(e => {
                                const top = eventTop(e);
                                const height = eventHeight(e);
                                const isSelected = selectedKey === eventKey(e);
                                const { col: lCol, total } = layout.get(eventKey(e)) ?? { col: 0, total: 1 };
                                const pct = 100 / total;
                                return (
                                    <button
                                        key={eventKey(e)}
                                        onClick={() => onEventClick(e)}
                                        className={`absolute rounded-lg border-l-4 px-2 py-1 text-left overflow-hidden transition-all hover:brightness-95 ${eventColor(e)} ${isSelected ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}
                                        style={{
                                            top: `${Math.max(top, 0)}px`,
                                            height: `${height}px`,
                                            minHeight: '24px',
                                            left: `calc(${lCol * pct}% + 2px)`,
                                            right: `calc(${(total - lCol - 1) * pct}% + 2px)`,
                                        }}
                                    >
                                        <p className="text-[11px] font-semibold leading-tight truncate">{eventLabel(e)}</p>
                                        {height > 30 && (
                                            <p className="text-[10px] opacity-70 truncate">{fmtTime(eventTime(e))} · {eventSubLabel(e)}</p>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
            </div>{/* end flex time-labels + columns */}
            </div>{/* end scrollable */}
        </div>
    );
}

// ─── Day View ─────────────────────────────────────────────────────────────────

function DayView({ date, events, onEventClick, selectedKey }: {
    date: Date; events: AnyEvent[]; onEventClick: (e: AnyEvent) => void; selectedKey?: string;
}) {
    const dayEvents = events.filter(e => isSameDay(eventTime(e), date));
    return (
        <div>
            <div className={`text-center py-2 mb-1 rounded-xl text-sm font-semibold ${isToday(date) ? 'bg-brand/10 text-brand' : 'text-gray-600'}`}>
                {fmtDateLong(date)}
                <span className="ml-2 text-xs font-normal text-gray-400">{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</span>
            </div>
            <TimeGrid columns={[date]} events={events} onEventClick={onEventClick} selectedKey={selectedKey} />
        </div>
    );
}

// ─── Week View ────────────────────────────────────────────────────────────────

function WeekView({ weekStart, events, onEventClick, selectedKey, onDayClick }: {
    weekStart: Date; events: AnyEvent[]; onEventClick: (e: AnyEvent) => void;
    selectedKey?: string; onDayClick: (d: Date) => void;
}) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    return (
        <div>
            <div className="flex ml-14">
                {days.map((d, i) => (
                    <div key={i} className="flex-1 text-center">
                        <button onClick={() => onDayClick(d)}
                            className={`w-full py-1.5 rounded-lg transition-colors ${isToday(d) ? 'bg-brand/10' : 'hover:bg-gray-50'}`}>
                            <span className="block text-[10px] font-normal text-gray-500">{d.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                            <span className={`text-base font-bold ${isToday(d) ? 'text-brand' : 'text-gray-800'}`}>{d.getDate()}</span>
                        </button>
                    </div>
                ))}
            </div>
            <TimeGrid columns={days} events={events} onEventClick={onEventClick} selectedKey={selectedKey} />
        </div>
    );
}

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({ monthStart, events, onEventClick, onDayClick }: {
    monthStart: Date; events: AnyEvent[]; onEventClick: (e: AnyEvent) => void; onDayClick: (d: Date) => void;
}) {
    const gridStart = startOfWeek(monthStart);
    const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
    return (
        <div>
            <div className="grid grid-cols-7 mb-1">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                    <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 border-l border-t border-gray-100">
                {cells.map((cell, i) => {
                    const dayEvents = events.filter(e => isSameDay(eventTime(e), cell));
                    const isCurrentMonth = cell.getMonth() === monthStart.getMonth();
                    return (
                        <div key={i}
                            className={`border-r border-b border-gray-100 min-h-[80px] p-1 cursor-pointer transition-colors ${isToday(cell) ? 'bg-brand/5' : isCurrentMonth ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/50'}`}
                            onClick={() => onDayClick(cell)}>
                            <div className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-0.5 ${isToday(cell) ? 'bg-brand text-white' : isCurrentMonth ? 'text-gray-800' : 'text-gray-300'}`}>
                                {cell.getDate()}
                            </div>
                            <div className="space-y-0.5">
                                {dayEvents.slice(0, 3).map(e => (
                                    <button key={eventKey(e)} onClick={ev => { ev.stopPropagation(); onEventClick(e); }}
                                        className={`w-full text-left rounded px-1 py-px text-[10px] font-medium truncate leading-tight border-l-2 ${eventColor(e)}`}>
                                        {fmtTime(eventTime(e))} {eventLabel(e)}
                                    </button>
                                ))}
                                {dayEvents.length > 3 && (
                                    <p className="text-[10px] text-gray-400 px-1">+{dayEvents.length - 3} more</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CalendarView() {
    const [view, setView] = useState<View>('day');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedEvent, setSelectedEvent] = useState<AnyEvent | null>(null);

    const fetchStart = view === 'day' ? startOfDay(currentDate)
        : view === 'week' ? startOfWeek(currentDate)
        : startOfMonth(currentDate);
    const fetchEnd = view === 'day' ? addDays(fetchStart, 1)
        : view === 'week' ? addDays(fetchStart, 7)
        : endOfMonth(currentDate);

    const { data, isLoading } = useCalendarEvents(fetchStart, fetchEnd);

    const allEvents: AnyEvent[] = [
        ...(data?.consultations ?? []).map(c => ({ kind: 'consultation' as const, data: c })),
        ...(data?.followups ?? []).map(f => ({ kind: 'followup' as const, data: f })),
    ];

    const navigate = (dir: -1 | 1) => {
        setCurrentDate(prev =>
            view === 'day' ? addDays(prev, dir)
            : view === 'week' ? addDays(prev, dir * 7)
            : new Date(prev.getFullYear(), prev.getMonth() + dir, 1)
        );
        setSelectedEvent(null);
    };

    const handleDayClick = (d: Date) => { setCurrentDate(d); setView('day'); setSelectedEvent(null); };
    const handleEventClick = (e: AnyEvent) => {
        setSelectedEvent(prev => prev && sameEventKey(prev, e) ? null : e);
    };

    const rangeLabel = view === 'day' ? fmtDateLong(currentDate)
        : view === 'week'
        ? `${fmtDateShort(startOfWeek(currentDate))} – ${fmtDateShort(addDays(startOfWeek(currentDate), 6))}`
        : currentDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    const selectedKey = selectedEvent ? eventKey(selectedEvent) : undefined;

    return (
        <div className="rounded-xl border border-gray-200 bg-white">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                    <button onClick={() => { setCurrentDate(new Date()); setSelectedEvent(null); }}
                        className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
                        Today
                    </button>
                    <div className="flex">
                        <button onClick={() => navigate(-1)} className="p-1.5 rounded-l-lg border border-gray-200 hover:bg-gray-50 text-gray-600"><ChevronLeft className="w-4 h-4" /></button>
                        <button onClick={() => navigate(1)} className="p-1.5 rounded-r-lg border border-gray-200 border-l-0 hover:bg-gray-50 text-gray-600"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-800 hidden sm:block">{rangeLabel}</h3>
                </div>
                <div className="flex items-center gap-3">
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
                        {(['day', 'week', 'month'] as View[]).map(v => (
                            <button key={v} onClick={() => { setView(v); setSelectedEvent(null); }}
                                className={`px-3 py-1.5 capitalize transition-colors ${view === v ? 'bg-brand text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                                {v}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="px-4 py-2 border-b border-gray-50 flex gap-3 flex-wrap">
                {[
                    { color: 'bg-blue-300', label: 'Online Consult' },
                    { color: 'bg-orange-300', label: 'In-Person Consult' },
                    { color: 'bg-emerald-300', label: 'Completed' },
                    { color: 'bg-purple-300', label: 'Call' },
                    { color: 'bg-teal-300', label: 'Visit' },
                    { color: 'bg-yellow-300', label: 'To-Do' },
                ].map(({ color, label }) => (
                    <span key={label} className="flex items-center gap-1 text-[10px] text-gray-500">
                        <span className={`w-2.5 h-2.5 rounded-sm ${color} inline-block`} /> {label}
                    </span>
                ))}
            </div>

            {/* Body */}
            <div className="relative p-3">
                {view === 'day' && <DayView date={currentDate} events={allEvents} onEventClick={handleEventClick} selectedKey={selectedKey} />}
                {view === 'week' && <WeekView weekStart={startOfWeek(currentDate)} events={allEvents} onEventClick={handleEventClick} selectedKey={selectedKey} onDayClick={handleDayClick} />}
                {view === 'month' && <MonthView monthStart={startOfMonth(currentDate)} events={allEvents} onEventClick={handleEventClick} onDayClick={handleDayClick} />}

                {selectedEvent && (
                    <div className="absolute top-3 right-3 z-20">
                        <DetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
                    </div>
                )}
            </div>

            {!isLoading && allEvents.length === 0 && (
                <p className="text-center text-sm text-gray-400 pb-6">No events scheduled for this period</p>
            )}
        </div>
    );
}
