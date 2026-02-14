import { Router, Request, Response } from 'express';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
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

const BUCKET = process.env.S3_BUCKET || 'dietkaro-media';

/**
 * GET /media/:prefix/:orgId/:entityId/:filename
 * Proxy endpoint to serve images from S3/Garage
 */
router.get('/:prefix/:orgId/:entityId/:filename', async (req: Request, res: Response) => {
    try {
        const { prefix, orgId, entityId, filename } = req.params;
        const key = `${prefix}/${orgId}/${entityId}/${filename}`;

        const command = new GetObjectCommand({
            Bucket: BUCKET,
            Key: key
        });

        const response = await s3Client.send(command);

        // Set content type
        res.setHeader('Content-Type', response.ContentType || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
        res.setHeader('Content-Length', response.ContentLength?.toString() || '0');

        // Stream the response
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
    } catch (error: any) {
        if (error.name === 'NoSuchKey') {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Image not found' } });
        }
        logger.error('Error fetching image', { error: error.message, key: req.params });
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch image' } });
    }
});

export default router;
