// FIX: Removed modular storage imports and use compat syntax from firebase service.
import { storage } from './firebase';

/**
 * Uploads a file to Firebase Storage.
 * @param file The file object to upload.
 * @param path The path in storage where the file should be saved (e.g., 'attachments/eprf123/image.jpg').
 * @returns A promise that resolves with the public download URL of the uploaded file.
 */
export const uploadFile = async (file: File | Blob, path: string): Promise<string> => {
    // FIX: Switched to compat storage syntax.
    const storageRef = storage.ref(path);
    await storageRef.put(file);
    const downloadURL = await storageRef.getDownloadURL();
    return downloadURL;
};
