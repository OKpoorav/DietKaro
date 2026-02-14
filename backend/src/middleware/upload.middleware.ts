import multer from 'multer';
import { Request } from 'express';
import { AppError } from '../errors/AppError';

// Memory storage for processing before S3 upload
const storage = multer.memoryStorage();

export const IMAGE_MIMES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
]);

export const REPORT_MIMES = new Set([
    ...IMAGE_MIMES,
    'application/pdf',
]);

// File filter for images only
const imageFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (IMAGE_MIMES.has(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new AppError('Only image files are allowed (JPEG, PNG, WebP, HEIC)', 400, 'INVALID_FILE_TYPE'));
    }
};

// File filter for reports (images + PDF)
const reportFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (REPORT_MIMES.has(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new AppError('Only image and PDF files are allowed', 400, 'INVALID_FILE_TYPE'));
    }
};

// Multer configurations
export const upload = multer({
    storage,
    fileFilter: imageFilter,
    limits: { fileSize: 10 * 1024 * 1024, files: 1 } // 10MB max
});

export const uploadReport = multer({
    storage,
    fileFilter: reportFilter,
    limits: { fileSize: 25 * 1024 * 1024, files: 1 } // 25MB for PDFs
});

/**
 * Validate actual file content matches declared MIME type using magic bytes.
 * Call AFTER multer has parsed the file into req.file.buffer.
 */
export async function validateFileContent(buffer: Buffer, allowedMimes: Set<string>): Promise<void> {
    const { fileTypeFromBuffer } = await import('file-type');
    const detected = await fileTypeFromBuffer(buffer);

    if (!detected) {
        throw new AppError('Could not determine file type from content', 400, 'UNKNOWN_FILE_TYPE');
    }

    if (!allowedMimes.has(detected.mime)) {
        throw new AppError(
            `File content does not match an allowed type. Detected: ${detected.mime}`,
            400,
            'FILE_CONTENT_MISMATCH'
        );
    }
}

// Single photo upload middleware
export const uploadSinglePhoto = upload.single('photo');

// Single report upload middleware
export const uploadSingleReport = uploadReport.single('file');

export default upload;
