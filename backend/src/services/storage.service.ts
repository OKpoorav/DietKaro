import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { processImageInWorker } from './imageWorkerPool';
import logger from '../utils/logger';

// S3/Garage Configuration
const s3Client = new S3Client({
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:3900',
    region: process.env.S3_REGION || 'garage',
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || ''
    },
    forcePathStyle: true, // Required for Garage/MinIO
    requestHandler: {
        requestTimeout: 30_000,   // 30s per request
        connectionTimeout: 10_000, // 10s to establish connection
    } as any,
});

const BUCKET = process.env.S3_BUCKET || 'healthpractix-media';

// Ensure bucket exists on startup — creates it if missing (safe for MinIO/Garage)
async function ensureBucketExists() {
    try {
        await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET }));
    } catch (err: any) {
        if (err.name === 'NoSuchBucket' || err.$metadata?.httpStatusCode === 404 || err.$metadata?.httpStatusCode === 403) {
            try {
                await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET }));
                logger.info('Created S3 bucket', { bucket: BUCKET });
            } catch (createErr: any) {
                logger.error('Failed to create S3 bucket', { bucket: BUCKET, error: createErr.message });
            }
        }
    }
}
ensureBucketExists();

// Default presigned URL expiration (1 hour)
const PRESIGNED_URL_EXPIRY = 3600;

// Image processing options
const COMPRESSION_QUALITY = 80;
const THUMBNAIL_SIZE = 200;
const MAX_WIDTH = 1920;

/**
 * Compress image to JPEG with quality optimization (offloaded to worker thread)
 */
export async function compressImage(buffer: Buffer): Promise<Buffer> {
    return processImageInWorker(buffer, 'compress', { maxWidth: MAX_WIDTH, quality: COMPRESSION_QUALITY });
}

/**
 * Create thumbnail from image (offloaded to worker thread)
 */
export async function createThumbnail(buffer: Buffer, size: number = THUMBNAIL_SIZE): Promise<Buffer> {
    return processImageInWorker(buffer, 'thumbnail', { size });
}

/**
 * Upload buffer to S3/Garage and return the key
 */
export async function uploadToS3(
    buffer: Buffer,
    key: string,
    contentType: string = 'image/jpeg'
): Promise<string> {
    const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType
    });

    await s3Client.send(command);
    logger.info('Uploaded to S3', { key });

    return key;
}

/**
 * Generate presigned URL for reading an object
 */
export async function getPresignedUrl(key: string, expiresIn: number = PRESIGNED_URL_EXPIRY): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: key
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
}

/**
 * Generate presigned URLs for multiple keys
 */
export async function getPresignedUrls(keys: string[], expiresIn: number = PRESIGNED_URL_EXPIRY): Promise<Record<string, string>> {
    const urls: Record<string, string> = {};

    await Promise.all(
        keys.map(async (key) => {
            if (key) {
                urls[key] = await getPresignedUrl(key, expiresIn);
            }
        })
    );

    return urls;
}

/**
 * Generate presigned URL for uploading an object (PUT)
 */
export async function getPresignedPutUrl(key: string, contentType: string, expiresIn: number = 3600): Promise<string> {
    const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: contentType,
    });
    return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Download an object from storage and return as Buffer
 */
export async function downloadFromStorage(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const response = await s3Client.send(command);
    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

/**
 * Delete object from S3/Garage
 */
export async function deleteFromS3(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key
    });

    await s3Client.send(command);
    logger.info('Deleted from S3', { key });
}

/**
 * Process and upload image with compression + thumbnail
 * Returns keys for generating presigned URLs later
 */
export async function processAndUploadImage(
    buffer: Buffer,
    prefix: 'meal-photos' | 'weight-photos',
    orgId: string,
    entityId: string
): Promise<{ fullUrl: string; thumbUrl: string; fullKey: string; thumbKey: string }> {
    // Generate keys
    const timestamp = Date.now();
    const fullKey = `${prefix}/${orgId}/${entityId}/${timestamp}-full.jpg`;
    const thumbKey = `${prefix}/${orgId}/${entityId}/${timestamp}-thumb.jpg`;

    // Process images
    const [compressedBuffer, thumbnailBuffer] = await Promise.all([
        compressImage(buffer),
        createThumbnail(buffer)
    ]);

    // Upload both
    await Promise.all([
        uploadToS3(compressedBuffer, fullKey),
        uploadToS3(thumbnailBuffer, thumbKey)
    ]);

    // Generate media proxy URLs — stored without auth prefix
    // The media route handles both web (Clerk) and client (JWT) auth
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    const fullUrl = `${baseUrl}/media/${fullKey}`;
    const thumbUrl = `${baseUrl}/media/${thumbKey}`;

    logger.info('Image processed and uploaded', {
        prefix,
        entityId,
        originalSize: buffer.length,
        compressedSize: compressedBuffer.length,
        thumbnailSize: thumbnailBuffer.length,
        compressionRatio: Math.round((1 - compressedBuffer.length / buffer.length) * 100) + '%'
    });

    return { fullUrl, thumbUrl, fullKey, thumbKey };
}

/**
 * Storage service interface for controllers
 */
export const StorageService = {
    uploadMealPhoto: async (buffer: Buffer, orgId: string, mealLogId: string) => {
        return processAndUploadImage(buffer, 'meal-photos', orgId, mealLogId);
    },

    uploadWeightPhoto: async (buffer: Buffer, orgId: string, weightLogId: string) => {
        return processAndUploadImage(buffer, 'weight-photos', orgId, weightLogId);
    },

    getPresignedUrl,
    getPresignedUrls,

    deleteImage: async (key: string) => {
        return deleteFromS3(key);
    }
};

export default StorageService;
