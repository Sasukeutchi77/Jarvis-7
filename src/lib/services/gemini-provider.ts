/**
 * Google Gemini Provider for JARVIS
 * 
 * Powered by official @google/genai SDK.
 * Features: Multimodal vision reasoning, audio understanding, large context window (1M+ tokens).
 * 
 * Security: GEMINI_API_KEY is loaded exclusively server-side via process.env.
 */

import { GoogleGenAI } from '@google/genai';
import {
  AIProvider,
  ChatMessage,
  GenerateOptions,
  GenerateResult,
  StreamOptions,
} from './provider-interface.js';

export class GeminiProvider implements AIProvider {
  public readonly id = 'gemini';
  public readonly name = 'Google Gemini Neural Core';

  private clientInstance: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not defined in server environment');
    }
    if (!this.clientInstance) {
      this.clientInstance = new GoogleGenAI({ apiKey });
    }
    return this.clientInstance;
  }

  public isConfigured(): boolean {
    return !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0;
  }

  public getDefaultModel(): string {
    return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  }

  public getSupportedModels(): string[] {
    return [
      'gemini-2.5-flash',
      'gemini-3.7-flash',
      'gemini-2.0-flash',
      'gemini-flash-latest',
      'gemini-2.5-pro',
      'gemini-3.1-flash-lite',
    ];
  }

  public supportsVision(): boolean {
    return true;
  }

  public resolveModel(requestedModel?: string): string {
    if (!requestedModel || !requestedModel.trim()) {
      return this.getDefaultModel();
    }
    const clean = requestedModel.toLowerCase().trim().replace(/^google\//, '').replace(/^gemini\//, '');
    if (clean.includes('pro')) return 'gemini-2.5-pro';
    if (clean.includes('lite')) return 'gemini-3.1-flash-lite';
    if (clean.includes('3.7')) return 'gemini-3.7-flash';
    if (clean.includes('2.0')) return 'gemini-2.0-flash';
    if (clean.includes('2.5') || clean.includes('flash') || clean.includes('latest')) return 'gemini-2.5-flash';
    return clean.startsWith('gemini-') ? clean : 'gemini-2.5-flash';
  }

  public async healthCheck(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const client = this.getClient();
      const res = await client.models.generateContent({
        model: this.getDefaultModel(),
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
      });
      return !!res.text;
    } catch {
      return false;
    }
  }

  private formatContents(messages: ChatMessage[]): any[] {
    return messages.map((m) => {
      const role = m.role === 'assistant' ? 'model' : 'user';
      const parts: any[] = [];

      // Add text content
      if (m.content) {
        parts.push({ text: m.content });
      }

      // Add multimodal image attachments if present
      if (m.images && m.images.length > 0) {
        for (const img of m.images) {
          const base64Data = img.data.includes('base64,')
            ? img.data.split('base64,')[1]
            : img.data;
          parts.push({
            inlineData: {
              mimeType: img.mimeType || 'image/jpeg',
              data: base64Data,
            },
          });
        }
      }

      if (parts.length === 0) {
        parts.push({ text: ' ' });
      }

      return { role, parts };
    });
  }

  public async stream(options: StreamOptions): Promise<{ modelUsed: string; chunks: number }> {
    if (!this.isConfigured()) {
      throw new Error('Google Gemini is not configured: GEMINI_API_KEY missing');
    }

    const client = this.getClient();
    const initialModel = this.resolveModel(options.model);
    const timeoutMs = options.timeoutMs || parseInt(process.env.AI_TIMEOUT_MS || '20000', 10);

    const formattedContents = this.formatContents(options.messages);

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

    const candidateModels = [
      initialModel,
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-flash-latest',
      'gemini-3.7-flash',
      'gemini-2.5-pro',
    ].filter((m, idx, arr) => arr.indexOf(m) === idx);

    let chunkCount = 0;
    let activeModel = initialModel;
    let lastError: any = null;

    try {
      for (const currentModel of candidateModels) {
        try {
          activeModel = currentModel;
          const responseStream = await client.models.generateContentStream({
            model: currentModel,
            contents: formattedContents,
            config: {
              systemInstruction: options.systemPrompt,
              temperature: options.temperature ?? 0.7,
            },
          });

          for await (const chunk of responseStream) {
            if (controller.signal.aborted) {
              throw new Error(`Gemini stream timed out after ${timeoutMs}ms`);
            }
            const text = chunk.text || '';
            if (text) {
              chunkCount++;
              options.onChunk(text);
            }
          }

          return { modelUsed: activeModel, chunks: chunkCount };
        } catch (err: any) {
          lastError = err;
          if (controller.signal.aborted) {
            throw new Error(`Gemini request timed out after ${timeoutMs}ms`);
          }
          if (chunkCount > 0) {
            // If already emitted chunks to client, re-throw to avoid duplicate generation
            throw err;
          }
          const isRetriable =
            err.status === 503 ||
            err.status === 429 ||
            err.status === 404 ||
            err.status === 500 ||
            err.message?.includes('high demand') ||
            err.message?.includes('UNAVAILABLE') ||
            err.message?.includes('RESOURCE_EXHAUSTED') ||
            err.message?.includes('not found');

          if (isRetriable && currentModel !== candidateModels[candidateModels.length - 1]) {
            console.warn(`[GeminiProvider] Model '${currentModel}' failed (${err.message?.slice(0, 80)}), trying fallback model...`);
            continue;
          }
          throw err;
        }
      }

      throw lastError || new Error('Gemini failed to generate content across all models');
    } catch (err: any) {
      if (controller.signal.aborted) {
        throw new Error(`Gemini request timed out after ${timeoutMs}ms`);
      }
      if (err.status === 401 || err.message?.includes('API key not valid')) {
        throw new Error(`Gemini Authentication failed (401): Invalid GEMINI_API_KEY`);
      }
      if (err.status === 429 || err.message?.includes('RESOURCE_EXHAUSTED')) {
        throw new Error(`Gemini Quota exceeded (429): Rate limit reached`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutTimer);
    }
  }

  public async generate(options: GenerateOptions): Promise<GenerateResult> {
    if (!this.isConfigured()) {
      throw new Error('Google Gemini is not configured: GEMINI_API_KEY missing');
    }

    const client = this.getClient();
    const initialModel = this.resolveModel(options.model);
    const formattedContents = this.formatContents(options.messages);

    const candidateModels = [
      initialModel,
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-flash-latest',
      'gemini-3.7-flash',
      'gemini-2.5-pro',
    ].filter((m, idx, arr) => arr.indexOf(m) === idx);

    let lastError: any = null;
    for (const currentModel of candidateModels) {
      try {
        const res = await client.models.generateContent({
          model: currentModel,
          contents: formattedContents,
          config: {
            systemInstruction: options.systemPrompt,
            temperature: options.temperature ?? 0.7,
          },
        });

        return {
          text: res.text || '',
          modelUsed: currentModel,
        };
      } catch (err: any) {
        lastError = err;
        const isRetriable =
          err.status === 503 ||
          err.status === 429 ||
          err.status === 404 ||
          err.status === 500 ||
          err.message?.includes('high demand') ||
          err.message?.includes('UNAVAILABLE') ||
          err.message?.includes('RESOURCE_EXHAUSTED') ||
          err.message?.includes('not found');

        if (isRetriable && currentModel !== candidateModels[candidateModels.length - 1]) {
          console.warn(`[GeminiProvider] Model '${currentModel}' failed (${err.message?.slice(0, 80)}), trying fallback model...`);
          continue;
        }
        throw err;
      }
    }

    throw lastError || new Error('Gemini failed to generate content');
  }
}

export const geminiProvider = new GeminiProvider();
