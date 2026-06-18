/**
 * Shared formatting utilities used across dashboard pages
 */

/**
 * Format a stored 24-hour "HH:MM" time string as 12-hour "h:mm AM/PM".
 * Returns '' for empty/null; passes through anything that isn't HH:MM.
 * Storage stays 24h everywhere — this is display-only.
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

export function getInitials(name?: string): string {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function formatTimeAgo(date: Date | string): string {
    if (!date) return 'Never';
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} days ago`;
    return `${Math.floor(days / 7)} weeks ago`;
}

export function calculateAge(dob?: string): number | null {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
}
