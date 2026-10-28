import { Injectable } from "@nestjs/common";
import { GoogleGenAI } from "@google/genai";

export type GeminiFunctionCall = { type: "function_call"; id: string; name: string; arguments: Record<string, unknown> };
export type GeminiStep = GeminiFunctionCall | { type: string; [key: string]: unknown };
export type GeminiInteraction = { output_text?: string; steps?: GeminiStep[]; status?: string; errors?: unknown[] };

export type GeminiCreateInput = {
  model: string;
  input: unknown[];
  system_instruction: string;
  tools: unknown[];
  store: false;
  generation_config: { temperature: number; max_output_tokens: number };
};

@Injectable()
export class GeminiGateway {
  private client?: GoogleGenAI;

  isConfigured() {
    return Boolean(process.env.GEMINI_API_KEY?.trim());
  }

  async create(input: GeminiCreateInput): Promise<GeminiInteraction> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw Object.assign(new Error("Gemini is not configured"), { agentCode: "GEMINI_NOT_CONFIGURED" });
    this.client ??= new GoogleGenAI({ apiKey });
    return this.client.interactions.create(input as Parameters<GoogleGenAI["interactions"]["create"]>[0]) as Promise<GeminiInteraction>;
  }
}
