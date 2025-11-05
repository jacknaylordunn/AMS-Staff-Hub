
import { GoogleGenAI } from "@google/genai";
import { showToast } from '../components/Toast';

// FIX: Define the AIStudio interface and augment the Window interface to resolve declaration conflicts.
interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}
declare global {
  interface Window {
    aistudio: AIStudio;
  }
}

// Use a simple flag to prevent multiple prompts on the same user action.
// It will be reset if there's a key-related API error.
let hasAttemptedKeySelection = false;

export async function getGeminiClient(options: { showToasts?: boolean } = { showToasts: true }): Promise<GoogleGenAI | null> {
    // This check is for environments where this feature isn't available.
    if (!window.aistudio) {
        console.error("AI Studio context not available.");
        if (options.showToasts) showToast("AI features are currently unavailable.", "error");
        return null;
    }

    const hasKey = await window.aistudio.hasSelectedApiKey();

    if (!hasKey) {
        if (options.showToasts) showToast("An API key is required for AI features. Please select one to continue.", "info");
        await window.aistudio.openSelectKey();
        // After openSelectKey, we assume a key is now available to avoid multiple popups, as per docs.
        // The check for process.env.API_KEY below will handle success or failure.
        hasAttemptedKeySelection = true; 
    }

    if (process.env.API_KEY) {
        return new GoogleGenAI({ apiKey: process.env.API_KEY });
    } else {
        // This case handles:
        // 1. Initial state with no key.
        // 2. The race condition where openSelectKey() resolves before the key is injected.
        if (hasAttemptedKeySelection) {
            // If we prompted them and there's STILL no key, it might be a race condition.
            // Let's wait a moment and check again.
            await new Promise(resolve => setTimeout(resolve, 500));
            if (process.env.API_KEY) {
                 return new GoogleGenAI({ apiKey: process.env.API_KEY });
            }
        }
        
        if (options.showToasts) showToast("An API key is required. Please select a key and try again.", "error");
        return null;
    }
}

// This function can still show toasts as it's handling the *result* of an API call.
export function handleGeminiError(error: any) {
    if (error?.message?.includes("Requested entity was not found.")) {
        showToast("Your API key seems invalid. Please select a valid key.", "error");
        // Reset state to allow the user to select a new key on their next attempt.
        hasAttemptedKeySelection = false; 
    } else {
        console.error("Gemini API Error:", error);
        showToast("An error occurred with the AI feature. Please try again.", "error");
    }
}