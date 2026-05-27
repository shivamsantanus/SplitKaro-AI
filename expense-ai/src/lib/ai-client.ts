import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
const fallbackModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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