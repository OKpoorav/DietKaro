import { Router, Response } from 'express';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth.middleware';
import { requireClientAuth, ClientAuthRequest } from '../middleware/clientAuth.middleware';
import { AuthenticatedRequest } from '../types/auth.types';
import { apiLimiter } from '../middleware/rateLimiter';
import { env } from '../config/env';
import prisma from '../utils/prisma';
import logger from '../utils/logger';

const router = Router();

// Media is mounted outside /api/v1, so the global limiter doesn't cover it.
router.use(apiLimiter);

// S3/Garage Configuration (reuse from storage service)
const s3Client = new S3Client({
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:3900',
    region: process.env.S3_REGION || 'garage',
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || ''
    },
    forcePathStyle: true
});

const BUCKET = process.env.S3_BUCKET || 'healthpractix-media';

const ALLOWED_PREFIXES = ['meal-photos', 'weight-photos', 'reports', 'profile-photos'];

// Some keys are nested deeper than `prefix/orgId/entity/file` — e.g. dietitian
// uploaded reports use `clients/{clientId}/reports/{role}/{file}`. We accept
// these as long as the first path segment is one of these top-level namespaces.
const ALLOWED_NAMESPACES = new Set([...ALLOWED_PREFIXES, 'clients']);

// ─── Signed download tokens ────────────────────────────────────────
// Short-lived HMAC tokens so authenticated users can open media in a
// new browser tab (where Clerk/JWT headers aren't available).
// env.ts crashes startup if CLIENT_JWT_SECRET is missing — never fall back to a
// guessable default here: anyone reading the source could forge download tokens.
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
function verifyDownloadToken(token: string): { key: string; orgId: string } | null {
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
 * Patients may only fetch their OWN media. Org scoping alone is not enough —
 * every client in an org shares one orgId, so without this check any logged-in
 * patient could read another patient's lab reports and photos.
 * Maps each prefix's entityId to the owning client and compares.
 */
async function clientOwnsMedia(clientId: string, prefix: string, entityId: string): Promise<boolean> {
    switch (prefix) {
        case 'reports':
        case 'profile-photos':
            // entityId IS the clientId for these prefixes
            return entityId === clientId;
        case 'meal-photos': {
            const log = await prisma.mealLog.findFirst({ where: { id: entityId, clientId }, select: { id: true } });
            return !!log;
        }
        case 'weight-photos': {
            const log = await prisma.weightLog.findFirst({ where: { id: entityId, clientId }, select: { id: true } });
            return !!log;
        }
        default:
            return false;
    }
}

async function serveFromS3(key: string, res: Response) {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const response = await s3Client.send(command);

    res.setHeader('Content-Type', response.ContentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.setHeader('Content-Length', response.ContentLength?.toString() || '0');

    if (response.Body instanceof Readable) {
        response.Body.pipe(res);
    } else if (response.Body) {
        const chunks: Buffer[] = [];
        const readable = response.Body as any;
        for await (const chunk of readable) {
            chunks.push(chunk);
        }
        res.send(Buffer.concat(chunks));
    } else {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Image not found' } });
    }
}

/**
 * GET /media/web/:prefix/:orgId/:entityId/:filename
 * For authenticated web users (Clerk)
 */
router.get('/web/:prefix/:orgId/:entityId/:filename',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
            }

            const { prefix, orgId, entityId, filename } = req.params;

            if (!ALLOWED_PREFIXES.includes(prefix)) {
                return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: `Invalid prefix. Allowed: ${ALLOWED_PREFIXES.join(', ')}` } });
            }

            if (req.user.organizationId !== orgId) {
                return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } });
            }

            const key = `${prefix}/${orgId}/${entityId}/${filename}`;
            await serveFromS3(key, res);
        } catch (error: any) {
            if (error.name === 'NoSuchKey') {
                return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Image not found' } });
            }
            logger.error('Media fetch failed', { error: error.message });
            res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch image' } });
        }
    }
);

/**
 * GET /media/client/:prefix/:orgId/:entityId/:filename
 * For authenticated mobile clients (JWT)
 */
router.get('/client/:prefix/:orgId/:entityId/:filename',
    requireClientAuth,
    async (req: ClientAuthRequest, res: Response) => {
        try {
            if (!req.client) {
                return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
            }

            const { prefix, orgId, entityId, filename } = req.params;

            if (!ALLOWED_PREFIXES.includes(prefix)) {
                return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: `Invalid prefix. Allowed: ${ALLOWED_PREFIXES.join(', ')}` } });
            }

            if (req.client.orgId !== orgId) {
                return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } });
            }

            if (!(await clientOwnsMedia(req.client.id, prefix, entityId))) {
                return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } });
            }

            const key = `${prefix}/${orgId}/${entityId}/${filename}`;
            await serveFromS3(key, res);
        } catch (error: any) {
            if (error.name === 'NoSuchKey') {
                return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Image not found' } });
            }
            logger.error('Media fetch failed', { error: error.message });
            res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch image' } });
        }
    }
);

/**
 * GET /media/:prefix/:orgId/:entityId/:filename
 * Universal route — tries: 1) signed download token (?token=), 2) Clerk auth, 3) client JWT.
 * This is the URL format stored in the database.
 */
router.get('/:prefix/:orgId/:entityId/:filename',
    async (req: any, res: Response, next: any) => {
        // 1) Check for signed download token (new tab / unauthenticated context)
        const token = req.query.token as string | undefined;
        if (token) {
            const verified = verifyDownloadToken(token);
            if (verified) {
                req._downloadToken = verified;
                return next();
            }
            // Token provided but invalid/expired — fall through to other auth methods
        }

        // 2) Try Clerk auth (web app)
        requireAuth(req, res, (err?: any) => {
            if (!err && req.user) {
                return next();
            }
            // 3) Fall back to client JWT auth (mobile app)
            requireClientAuth(req, res, (err2?: any) => {
                if (!err2 && req.client) {
                    return next();
                }
                return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
            });
        });
    },
    async (req: any, res: Response) => {
        try {
            const { prefix, orgId, entityId, filename } = req.params;

            if (!ALLOWED_PREFIXES.includes(prefix)) {
                return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: `Invalid prefix. Allowed: ${ALLOWED_PREFIXES.join(', ')}` } });
            }

            const key = `${prefix}/${orgId}/${entityId}/${filename}`;

            if (req._downloadToken) {
                // Token-based auth: verify the token was signed for this exact key + org
                if (req._downloadToken.key !== key || req._downloadToken.orgId !== orgId) {
                    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Token does not match requested resource' } });
                }
            } else {
                // Session-based auth: verify org ownership
                const userOrgId = req.user?.organizationId || req.client?.orgId;
                if (userOrgId !== orgId) {
                    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } });
                }
                // Patients additionally must own the media — org match alone
                // would let any patient read another patient's files.
                if (!req.user && req.client && !(await clientOwnsMedia(req.client.id, prefix, entityId))) {
                    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } });
                }
            }

            await serveFromS3(key, res);
        } catch (error: any) {
            if (error.name === 'NoSuchKey') {
                return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Image not found' } });
            }
            logger.error('Media fetch failed', { error: error.message });
            res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch image' } });
        }
    }
);

/**
 * GET /media/* — catch-all for deeper S3 keys (e.g. dietitian reports stored as
 * `clients/{clientId}/reports/{role}/{file}` which the fixed 4-segment route
 * above cannot match). Auth path:
 *   1) signed download token (?token=) for the EXACT key — preferred
 *   2) Clerk session + DB lookup to verify org membership
 *   3) Client JWT + DB lookup
 *
 * Mounted last so it never shadows the explicit 4-segment routes.
 */
router.get('/{*splat}',
    async (req: any, res: Response, next: any) => {
        const token = req.query.token as string | undefined;
        if (token) {
            const verified = verifyDownloadToken(token);
            if (verified) {
                req._downloadToken = verified;
                return next();
            }
        }
        requireAuth(req, res, (err?: any) => {
            if (!err && req.user) return next();
            requireClientAuth(req, res, (err2?: any) => {
                if (!err2 && req.client) return next();
                return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
            });
        });
    },
    async (req: any, res: Response) => {
        try {
            // Reconstruct the full key. Express 5 `{*splat}` puts segments in
            // params.splat (array) or as a string depending on path-to-regexp
            // build — handle both.
            const splat = req.params.splat;
            const key = Array.isArray(splat) ? splat.join('/') : (splat ?? '');
            if (!key) {
                return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Missing key' } });
            }

            const firstSegment = key.split('/')[0];
            if (!ALLOWED_NAMESPACES.has(firstSegment)) {
                return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: `Invalid prefix '${firstSegment}'.` } });
            }

            // Token-based auth: token must be signed for the EXACT key.
            if (req._downloadToken) {
                if (req._downloadToken.key !== key) {
                    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Token does not match requested resource' } });
                }
            } else {
                // Session-based auth: derive expected orgId from key shape and compare.
                const segments = key.split('/');
                const userOrgId: string | undefined = req.user?.organizationId || req.client?.orgId;
                if (!userOrgId) {
                    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
                }

                let keyOrgId: string | null = null;
                if (firstSegment === 'clients') {
                    // shape: clients/{clientId}/...  → resolve org via DB lookup.
                    const clientId = segments[1];
                    // Patients can only fetch their own clients/{clientId}/... keys.
                    if (req.client && !req.user && clientId !== req.client.id) {
                        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } });
                    }
                    if (clientId) {
                        const c = await prisma.client.findFirst({ where: { id: clientId }, select: { orgId: true } });
                        keyOrgId = c?.orgId ?? null;
                    }
                } else {
                    // legacy shape: {prefix}/{orgId}/{entityId}/...
                    keyOrgId = segments[1] ?? null;
                    // Patients additionally must own the media (org match alone is not enough).
                    if (req.client && !req.user && !(await clientOwnsMedia(req.client.id, firstSegment, segments[2] ?? ''))) {
                        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } });
                    }
                }

                if (!keyOrgId || keyOrgId !== userOrgId) {
                    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } });
                }
            }

            await serveFromS3(key, res);
        } catch (error: any) {
            if (error.name === 'NoSuchKey') {
                return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } });
            }
            logger.error('Media wildcard fetch failed', { error: error.message });
            res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch file' } });
        }
    }
);

export default router;
