import { Worker } from 'worker_threads';
import path from 'path';
import logger from '../utils/logger';

// Always resolve from project root to the TS source file
// In dev (tsx): runs .ts directly; in prod (node): runs compiled .js from dist/
const PROJECT_SRC = path.resolve(__dirname, '..');
const WORKER_SCRIPT_TS = path.join(PROJECT_SRC, 'workers', 'image-processor.worker.ts');
const WORKER_SCRIPT_JS = path.join(PROJECT_SRC, 'workers', 'image-processor.worker.js');

function getWorkerScript(): string {
    try {
        // Check if TS source exists (dev mode)
        require('fs').accessSync(WORKER_SCRIPT_TS);
        return WORKER_SCRIPT_TS;
    } catch {
        return WORKER_SCRIPT_JS;
    }
}

const WORKER_SCRIPT = getWorkerScript();
const isTsWorker = WORKER_SCRIPT.endsWith('.ts');
const IMAGE_PROCESSING_TIMEOUT = parseInt(process.env.IMAGE_PROCESSING_TIMEOUT || '30000');

export function processImageInWorker(
    buffer: Buffer,
    operation: 'compress' | 'thumbnail',
    options?: { maxWidth?: number; quality?: number; size?: number }
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const worker = new Worker(WORKER_SCRIPT, {
            workerData: {
                buffer: buffer.toString('base64'),
                operation,
                options,
            },
            // tsx needs to be registered for the worker to handle .ts files
            ...(isTsWorker ? { execArgv: ['--import', 'tsx'] } : {}),
        });

        let settled = false;

        worker.on('message', (msg) => {
            if (settled) return;
            settled = true;
            if (msg.error) {
                reject(new Error(msg.error));
            } else {
                resolve(Buffer.from(msg.buffer, 'base64'));
            }
            worker.terminate();
        });

        worker.on('error', (err) => {
            if (settled) return;
            settled = true;
            reject(err);
            worker.terminate();
        });

        setTimeout(() => {
            if (settled) return;
            settled = true;
            logger.warn('Image processing timed out', { operation, timeout: IMAGE_PROCESSING_TIMEOUT });
            reject(new Error(`Image processing timed out after ${IMAGE_PROCESSING_TIMEOUT}ms`));
            worker.terminate();
        }, IMAGE_PROCESSING_TIMEOUT);
    });
}
