/**
 * Format a stored 24-hour "HH:MM" time string as 12-hour "h:mm AM/PM".
 * Returns '' for empty/null; passes through anything that isn't HH:MM.
 * Storage stays 24h — this is display-only (PDF / generated output).
 */
export function formatTime12h(value?: string | null): string {
    if (!value) return '';
    const [hStr, mStr] = value.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (Number.isNaN(h) || Number.isNaN(m)) return value;
    const period = h < 12 ? 'AM' : 'PM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}
