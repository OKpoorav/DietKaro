// Build a wa.me deep link from a phone string.
// Falls back to country code 91 (India) when none is present, since this is
// the dominant geography for the app and DB rows occasionally lack a prefix.
export function buildWhatsAppUrl(phone: string | null | undefined, message?: string): string | null {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return null;
    const e164 = digits.length === 10 ? `91${digits}` : digits;
    const text = message ? `?text=${encodeURIComponent(message)}` : '';
    return `https://wa.me/${e164}${text}`;
}
