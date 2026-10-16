import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Tried in order. Gemini returns 503 under load and 404 once a model name is
// retired, so a single fallback that hits either one leaves parsing dead.
const models = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-flash-lite-latest"].map(
  (name) => genAI.getGenerativeModel({ model: name })
);

const FALLBACK_STATUSES = new Set([404, 429, 500, 503]);

export async function callAI(prompt: string): Promise<string> {
  let lastError: unknown;

  for (const model of models) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === undefined || !FALLBACK_STATUSES.has(status)) throw error;
      lastError = error;
    }
  }

  throw lastError;
}