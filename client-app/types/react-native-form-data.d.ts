/**
 * React Native extends the standard FormData API to accept file-like objects
 * with { uri, name, type } instead of Blob. This is not reflected in the
 * standard TypeScript DOM types.
 *
 * @see https://github.com/facebook/react-native/blob/main/packages/react-native/Libraries/Network/FormData.js
 */
interface ReactNativeFile {
    /** Local file URI (e.g., file:///path/to/photo.jpg) */
    uri: string;
    /** File name for the upload (e.g., 'meal-photo.jpg') */
    name: string;
    /** MIME type (e.g., 'image/jpeg') */
    type: string;
}

// Augment the global FormData interface to accept ReactNativeFile
declare global {
    interface FormData {
        append(name: string, value: ReactNativeFile, fileName?: string): void;
    }
}

export {};
