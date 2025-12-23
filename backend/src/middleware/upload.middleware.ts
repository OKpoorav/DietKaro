import multer from 'multer';
import { Request } from 'express';
import { AppError } from '../errors/AppError';

// Memory storage for processing before S3 upload
const storage = multer.memoryStorage();

// File filter for images only
const imageFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new AppError('Only image files are allowed (JPEG, PNG, WebP, HEIC)', 400, 'INVALID_FILE_TYPE'));
    }
};

// Multer configuration
export const upload = multer({
    storage,
    fileFilter: imageFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
        files: 1
    }
});

// Single photo upload middleware
export const uploadSinglePhoto = upload.single('photo');

export default upload;
