import { GoogleGenAI } from '@google/genai';

let client: GoogleGenAI | null | undefined;

export function getGeminiClient(): GoogleGenAI | null {
  if (client !== undefined) return client;

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    client = null;
    return client;
  }

  client = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'e-commerce-ai-studio' } }
  });
  return client;
}

export function getAiCapabilities() {
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
  return {
    mode: geminiConfigured ? 'ai-enabled' : 'fallback',
    providers: {
      gemini: {
        configured: geminiConfigured,
        capabilities: ['vision-analysis', 'prompt-generation', 'image-generation']
      },
      customOpenAiCompatible: {
        configured: false,
        capabilities: ['runtime-user-configuration']
      },
      proceduralFallback: {
        configured: true,
        capabilities: ['studio-background', 'hero-composition']
      }
    }
  };
}
