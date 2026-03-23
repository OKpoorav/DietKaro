import { parentPort, workerData } from 'worker_threads';
import sharp from 'sharp';

const COMPRESSION_QUALITY = 80;
const THUMBNAIL_SIZE = 200;
const MAX_WIDTH = 1920;

async function processImage() {
    const { buffer, operation, options } = workerData;
    const inputBuffer = Buffer.from(buffer, 'base64');

    let result: Buffer;

    if (operation === 'compress') {
        result = await sharp(inputBuffer)
            .rotate()
            .resize(options?.maxWidth || MAX_WIDTH, options?.maxWidth || MAX_WIDTH, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: options?.quality || COMPRESSION_QUALITY, progressive: true })
            .toBuffer();
    } else if (operation === 'thumbnail') {
        result = await sharp(inputBuffer)
            .rotate()
            .resize(options?.size || THUMBNAIL_SIZE, options?.size || THUMBNAIL_SIZE, { fit: 'cover', position: 'centre' })
            .jpeg({ quality: 75 })
            .toBuffer();
    } else {
        throw new Error(`Unknown operation: ${operation}`);
    }

    parentPort?.postMessage({ buffer: result.toString('base64') });
}

processImage().catch(err => {
    parentPort?.postMessage({ error: err.message });
});
