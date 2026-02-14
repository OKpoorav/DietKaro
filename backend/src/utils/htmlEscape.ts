const ESCAPE_MAP: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

export function escapeHtml(str: string | null | undefined): string {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (char) => ESCAPE_MAP[char] || char);
}
