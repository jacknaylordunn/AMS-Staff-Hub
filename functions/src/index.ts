import * as functions from "firebase-functions";
import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini client. It will automatically use the API_KEY secret.
// Ensure the secret is set by running: firebase functions:secrets:set API_KEY
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error(
    "Gemini API key not found. Set the secret by running 'firebase functions:secrets:set API_KEY'"
  );
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });


export const askClinicalAssistant = functions.https.onCall(
  async (data, context) => {
    // Check if the user is authenticated.
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "The function must be called while authenticated."
      );
    }

    const query = data.query;
    if (!query || typeof query !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "The function must be called with a 'query' string argument."
      );
    }

    try {
        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: query,
            config: {
                systemInstruction: `You are a clinical decision support assistant for Aegis Medical Solutions, a UK-based event medical provider. Your answers must be based on current UK clinical guidelines, primarily JRCALC. Do not provide a diagnosis. Your role is to provide information to trained clinicians to aid their decision-making, not to replace it. Always include a disclaimer at the end that the information is for guidance only and the clinician remains responsible for all patient care decisions.`,
            }
        });

      return { response: result.text };
    } catch (error) {
      console.error("Gemini API call failed:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to get a response from the AI assistant."
      );
    }
  }
);
