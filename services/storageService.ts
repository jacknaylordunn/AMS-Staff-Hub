import { storage } from './firebase';

/**
 * Uploads a file to Firebase Storage.
 * @param file The file object to upload.
 * @param path The path in storage where the file should be saved (e.g., 'attachments/eprf123/image.jpg').
 * @returns A promise that resolves with the public download URL of the uploaded file.
 */
export const uploadFile = async (file: File | Blob, path: string): Promise<string> => {
    const storageRef = storage.ref(path);
    const snapshot = await storageRef.put(file);
    const downloadURL = await snapshot.ref.getDownloadURL();
    return downloadURL;
};