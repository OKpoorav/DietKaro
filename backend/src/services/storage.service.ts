import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import logger from '../utils/logger';

// S3/Garage Configuration
const s3Client = new S3Client({
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:3900',
    region: process.env.S3_REGION || 'garage',
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || ''
    },
    forcePathStyle: true // Required for Garage/MinIO
});

const BUCKET = process.env.S3_BUCKET || 'dietkaro-media';

// Default presigned URL expiration (1 hour)
const PRESIGNED_URL_EXPIRY = 3600;

// Image processing options
const COMPRESSION_QUALITY = 80;
const THUMBNAIL_SIZE = 200;
const MAX_WIDTH = 1920;

/**
 * Compress image to JPEG with quality optimization
 */
export async function compressImage(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
        .rotate() // Auto-rotate based on EXIF
        .resize(MAX_WIDTH, MAX_WIDTH, {
            fit: 'inside',
            withoutEnlargement: true
        })
        .jpeg({ quality: COMPRESSION_QUALITY, progressive: true })
        .toBuffer();
}

/**
 * Create thumbnail from image
 */
export async function createThumbnail(buffer: Buffer, size: number = THUMBNAIL_SIZE): Promise<Buffer> {
    return sharp(buffer)
        .rotate()
        .resize(size, size, {
            fit: 'cover',
            position: 'center'
        })
        .jpeg({ quality: 75 })
        .toBuffer();
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

    // Generate media proxy URLs (these work without presigning)
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
