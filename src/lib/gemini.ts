import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("[gemini] GEMINI_API_KEY is not set");
}

export const genAI = new GoogleGenerativeAI(apiKey ?? "");

export const MODEL_NAME = "gemini-2.5-flash";

export function getModel() {
  return genAI.getGenerativeModel({ model: MODEL_NAME });
}
