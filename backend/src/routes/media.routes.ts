import { Router, Response } from 'express';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { requireAuth } from '../middleware/auth.middleware';
import { requireClientAuth, ClientAuthRequest } from '../middleware/clientAuth.middleware';
import { AuthenticatedRequest } from '../types/auth.types';
import logger from '../utils/logger';

const router = Router();

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
 * Universal route — tries Clerk auth first, falls back to client JWT auth.
 * This is the URL format stored in the database.
 */
router.get('/:prefix/:orgId/:entityId/:filename',
    async (req: any, res: Response, next: any) => {
        // Try Clerk auth first (web app)
        requireAuth(req, res, (err?: any) => {
            if (!err && req.user) {
                return next();
            }
            // Fall back to client JWT auth (mobile app)
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

            // Verify org ownership from whichever auth method succeeded
            const userOrgId = req.user?.organizationId || req.client?.orgId;
            if (userOrgId !== orgId) {
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

export default router;
