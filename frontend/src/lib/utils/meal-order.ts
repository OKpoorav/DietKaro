/**
 * Canonical meal ordering for the whole app: chronological by clock time
 * (`HH:MM`), falling back to the authored `sequenceNumber` when times tie or
 * are missing. Every view (builder, review spreadsheet, WhatsApp, PDF, mobile)
 * must order meals through this so they never disagree.
 */
export function timeToMin(t?: string | null): number {
    if (!t) return Infinity;
    const [h, m] = t.split(':').map(Number);
    if (Number.isFinite(h) && Number.isFinite(m)) return h * 60 + m;
    return Infinity;
}

/** Comparator: chronological by time, then by authored sequence as a stable tiebreak. */
export function compareByTime(
    aTime?: string | null,
    bTime?: string | null,
    aSeq?: number | null,
    bSeq?: number | null,
): number {
    const diff = timeToMin(aTime) - timeToMin(bTime);
    if (diff !== 0) return diff;
    return (aSeq ?? 0) - (bSeq ?? 0);
}
