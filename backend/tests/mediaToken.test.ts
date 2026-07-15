import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signDownloadToken, verifyDownloadToken, signMediaUrl } from '../src/utils/mediaToken';

const KEY = 'meal-photos/org-123/log-456/1784097095394-full.jpg';
const ORG = 'org-123';

describe('signDownloadToken / verifyDownloadToken', () => {
    it('round-trips key and orgId', () => {
        const token = signDownloadToken(KEY, ORG);
        expect(verifyDownloadToken(token)).toEqual({ key: KEY, orgId: ORG });
    });

    it('rejects a tampered token', () => {
        const token = signDownloadToken(KEY, ORG);
        const decoded = Buffer.from(token, 'base64url').toString();
        const tampered = Buffer.from(decoded.replace(ORG, 'org-evil')).toString('base64url');
        expect(verifyDownloadToken(tampered)).toBeNull();
    });

    it('rejects an expired token', () => {
        vi.useFakeTimers();
        const token = signDownloadToken(KEY, ORG);
        vi.advanceTimersByTime(3601 * 1000);
        expect(verifyDownloadToken(token)).toBeNull();
        vi.useRealTimers();
    });

    it('rejects garbage input', () => {
        expect(verifyDownloadToken('not-a-token')).toBeNull();
        expect(verifyDownloadToken('')).toBeNull();
    });
});

describe('signMediaUrl', () => {
    beforeEach(() => {
        process.env.API_BASE_URL = 'https://api.example.com';
    });
    afterEach(() => {
        delete process.env.API_BASE_URL;
    });

    it('appends a token that the /media route would accept for the same key + orgId', () => {
        const signed = signMediaUrl(`https://api.example.com/media/${KEY}`);
        expect(signed).toContain(`/media/${KEY}?token=`);
        const token = new URL(signed!).searchParams.get('token')!;
        expect(verifyDownloadToken(token)).toEqual({ key: KEY, orgId: ORG });
    });

    it('returns null for null/undefined', () => {
        expect(signMediaUrl(null)).toBeNull();
        expect(signMediaUrl(undefined)).toBeNull();
    });

    it('passes through non-media URLs unchanged', () => {
        const external = 'https://cdn.example.com/some/image.jpg';
        expect(signMediaUrl(external)).toBe(external);
    });

    it('passes through malformed media keys unchanged', () => {
        const shallow = 'https://api.example.com/media/too/shallow';
        expect(signMediaUrl(shallow)).toBe(shallow);
    });

    it('is idempotent — re-signing a signed URL replaces the token', () => {
        const once = signMediaUrl(`https://api.example.com/media/${KEY}`)!;
        const twice = signMediaUrl(once)!;
        expect(twice).toContain(`/media/${KEY}?token=`);
        expect(twice.match(/token=/g)).toHaveLength(1);
        const token = new URL(twice).searchParams.get('token')!;
        expect(verifyDownloadToken(token)).toEqual({ key: KEY, orgId: ORG });
    });

    it('re-bases stale hosts onto the current API_BASE_URL', () => {
        const stale = signMediaUrl(`http://localhost:3000/media/${KEY}`);
        expect(stale).toMatch(new RegExp(`^https://api\\.example\\.com/media/`));
    });
});
