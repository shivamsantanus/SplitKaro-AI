import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * GEMINI 3.1 FLASH LITE (Released March 2026)
 * This is the current best option for batch processing on the free tier.
 */
const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

export async function callAI(prompt: string): Promise<string> {
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error: any) {
    // If Lite is busy, try the standard Gemini 3 Flash
    if (error.status === 503) {
      console.warn("Lite model busy, falling back to standard Gemini 3 Flash...");
      const fallback = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
      const fallbackResult = await fallback.generateContent(prompt);
      return fallbackResult.response.text();
    }
    throw error;
  }
}