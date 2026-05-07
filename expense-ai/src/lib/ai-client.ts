import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * GEMINI 3.1 FLASH LITE (Released March 2026)
 * This is the current best option for batch processing on the free tier.
 */
const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
const fallbackModel = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

export async function callAI(prompt: string): Promise<string> {
  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error: any) {
    if (error.status === 503) {
      const fallbackResult = await fallbackModel.generateContent(prompt);
      return fallbackResult.response.text();
    }
    throw error;
  }
}