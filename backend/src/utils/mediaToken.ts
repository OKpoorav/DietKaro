// ─── Signed media download tokens ───────────────────────────────────
// Short-lived HMAC tokens so media served through the auth-gated /media
// proxy can be loaded from contexts that carry no Clerk/JWT credential:
// plain <img> tags on the dashboard, React Native <Image>, new browser tabs.
//
// env.ts crashes startup if CLIENT_JWT_SECRET is missing — never fall back to
// a guessable default here: anyone reading the source could forge tokens.
import crypto from 'crypto';
import { env } from '../config/env';

const DOWNLOAD_TOKEN_SECRET = env.CLIENT_JWT_SECRET;
const DOWNLOAD_TOKEN_TTL = 3600; // 1 hour

/**
 * Generate a signed download token for a given S3 key + orgId.
 * The token encodes: key, orgId, expiry.
 */
export function signDownloadToken(key: string, orgId: string): string {
    const expires = Math.floor(Date.now() / 1000) + DOWNLOAD_TOKEN_TTL;
    const payload = `${key}:${orgId}:${expires}`;
    const signature = crypto
        .createHmac('sha256', DOWNLOAD_TOKEN_SECRET)
        .update(payload)
        .digest('hex');
    // Base64url-encode so it's safe in query strings
    return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

/**
 * Verify a signed download token. Returns { key, orgId } or null.
 */
export function verifyDownloadToken(token: string): { key: string; orgId: string } | null {
    try {
        const decoded = Buffer.from(token, 'base64url').toString();
        const lastColon = decoded.lastIndexOf(':');
        if (lastColon === -1) return null;

        const signature = decoded.slice(lastColon + 1);
        const payload = decoded.slice(0, lastColon);

        const expected = crypto
            .createHmac('sha256', DOWNLOAD_TOKEN_SECRET)
            .update(payload)
            .digest('hex');

        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
            return null;
        }

        // payload = key:orgId:expires
        const parts = payload.split(':');
        if (parts.length < 3) return null;

        const expires = parseInt(parts[parts.length - 1], 10);
        const orgId = parts[parts.length - 2];
        const key = parts.slice(0, parts.length - 2).join(':');

        if (Math.floor(Date.now() / 1000) > expires) return null;

        return { key, orgId };
    } catch {
        return null;
    }
}

/**
 * Append a fresh signed download token to a stored /media proxy URL so the
 * dashboard (<img>) and mobile app (<Image>) can load it without auth headers.
 *
 * Stored URLs look like `${API_BASE_URL}/media/<prefix>/<orgId>/<entityId>/<file>`.
 * Non-media URLs (external links) pass through unchanged. The host is re-based
 * onto the current API_BASE_URL so URLs stored before a domain change (or with
 * a localhost fallback) still resolve.
 *
 * Call this at read-time on every photo URL returned to a client — tokens
 * expire after 1 hour, so they must never be persisted.
 */
export function signMediaUrl(url: string | null | undefined): string | null {
    if (!url) return null;

    const marker = '/media/';
    const idx = url.indexOf(marker);
    if (idx === -1) return url;

    const key = url.slice(idx + marker.length).split('?')[0];
    const segments = key.split('/');
    // Standard media keys are `<prefix>/<orgId>/<entityId>/<file>` — the /media
    // route verifies token.orgId against the URL's orgId segment, so we must
    // sign with the same value. Unexpected shapes pass through unchanged.
    if (segments.length < 4 || segments.some((s) => s.length === 0)) return url;
    const orgId = segments[1];

    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    return `${baseUrl}${marker}${key}?token=${signDownloadToken(key, orgId)}`;
}
