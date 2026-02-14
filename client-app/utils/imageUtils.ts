import * as ImageManipulator from 'expo-image-manipulator';

const MAX_DIMENSION = 1920; // Max width or height in pixels
const JPEG_QUALITY = 0.7;   // Good balance of quality vs size

/**
 * Compresses and resizes an image for upload.
 * Typical output: 200-500 KB instead of 3-8 MB.
 */
export async function compressImageForUpload(uri: string): Promise<string> {
    try {
        const result = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: MAX_DIMENSION } }],
            {
                compress: JPEG_QUALITY,
                format: ImageManipulator.SaveFormat.JPEG,
            }
        );
        return result.uri;
    } catch (error) {
        console.warn('Image compression failed, using original:', error);
        // Fall back to original if compression fails
        return uri;
    }
}
