/**
 * Groq AI Provider for JARVIS
 * 
 * Powered by official groq-sdk.
 * Features: Ultra-low latency LPU inference (~500 tokens/sec), Whisper Large V3 STT.
 * 
 * Security: GROQ_API_KEY is loaded exclusively server-side via process.env.
 */

import Groq from 'groq-sdk';
import {
  AIProvider,
  ChatMessage,
  GenerateOptions,
  GenerateResult,
  StreamOptions,
} from './provider-interface.js';

export class GroqProvider implements AIProvider {
  public readonly id = 'groq';
  public readonly name = 'Groq LPU Ultra-Fast';

  private clientInstance: Groq | null = null;

  public getClient(): Groq {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not defined in server environment');
    }
    if (!this.clientInstance) {
      this.clientInstance = new Groq({
        apiKey,
        timeout: parseInt(process.env.GROQ_TIMEOUT_MS || '20000', 10),
      });
    }
    return this.clientInstance;
  }

  public isConfigured(): boolean {
    return !!process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim().length > 0;
  }

  public getDefaultModel(): string {
    return process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  }

  private cachedAvailableModels: string[] | null = null;
  private lastModelFetchTime = 0;

  public async getAvailableModelList(): Promise<string[]> {
    const now = Date.now();
    if (this.cachedAvailableModels && now - this.lastModelFetchTime < 300000) {
      return this.cachedAvailableModels;
    }
    try {
      const client = this.getClient();
      const modelsList = await client.models.list();
      if (modelsList && modelsList.data && modelsList.data.length > 0) {
        // Filter for chat completion models, excluding whisper/audio/embedding/guard
        const chatModels = modelsList.data
          .map((m: any) => m.id)
          .filter((id: string) => !id.includes('whisper') && !id.includes('guard') && !id.includes('embed'));
        if (chatModels.length > 0) {
          this.cachedAvailableModels = chatModels;
          this.lastModelFetchTime = now;
          return chatModels;
        }
      }
    } catch {
      // Ignore if list endpoint fails
    }
    return [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'qwen/qwen3.6-27b',
      'mixtral-8x7b-32768',
      'gemma2-9b-it',
    ];
  }

  public getSupportedModels(): string[] {
    return [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'qwen/qwen3.6-27b',
      'mixtral-8x7b-32768',
      'gemma2-9b-it',
    ];
  }

  public supportsVision(): boolean {
    return false;
  }

  public resolveModel(requestedModel?: string): string {
    if (!requestedModel || !requestedModel.trim()) {
      return this.getDefaultModel();
    }
    const clean = requestedModel.toLowerCase().trim().replace(/^groq\//, '');
    if (clean.includes('mixtral')) return 'mixtral-8x7b-32768';
    if (clean.includes('8b') || clean.includes('3.1')) return 'llama-3.1-8b-instant';
    if (clean.includes('gemma')) return 'gemma2-9b-it';
    if (clean.includes('70b') || clean.includes('3.3')) return 'llama-3.3-70b-versatile';
    return clean || this.getDefaultModel();
  }

  public async healthCheck(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const client = this.getClient();
      const res = await client.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      });
      return !!res.choices[0]?.message?.content;
    } catch {
      return false;
    }
  }

  public async stream(options: StreamOptions): Promise<{ modelUsed: string; chunks: number }> {
    if (!this.isConfigured()) {
      throw new Error('Groq AI is not configured: GROQ_API_KEY missing');
    }

    const client = this.getClient();
    const model = this.resolveModel(options.model);
    const timeoutMs = options.timeoutMs || parseInt(process.env.AI_TIMEOUT_MS || '20000', 10);

    const formattedMessages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [];

    if (options.systemPrompt) {
      formattedMessages.push({
        role: 'system',
        content: options.systemPrompt,
      });
    }

    for (const m of options.messages) {
      formattedMessages.push({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content || '',
      });
    }

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

    let chunkCount = 0;
    try {
      let activeModel = model;
      let stream;

      const attemptStream = async (targetModel: string) => {
        return await client.chat.completions.create(
          {
            model: targetModel,
            messages: formattedMessages,
            stream: true,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 4096,
          },
          {
            signal: controller.signal,
          }
        );
      };

      try {
        stream = await attemptStream(activeModel);
      } catch (initialErr: any) {
        if (
          initialErr.status === 404 ||
          initialErr.message?.includes('model_not_found') ||
          initialErr.message?.includes('does not exist')
        ) {
          // Query live model list from user's Groq account
          const available = await this.getAvailableModelList();
          const fallbackCandidates = [
            ...available,
            'llama-3.3-70b-versatile',
            'openai/gpt-oss-120b',
            'openai/gpt-oss-20b',
            'qwen/qwen3.6-27b',
            'llama3-70b-8192',
            'llama3-8b-8192',
            'mixtral-8x7b-32768',
            'gemma2-9b-it',
          ].filter((c) => c !== activeModel);

          let success = false;
          let lastErr = initialErr;

          for (const candidate of fallbackCandidates) {
            try {
              console.warn(`[GroqProvider] Retrying with available Groq model: '${candidate}'...`);
              stream = await attemptStream(candidate);
              activeModel = candidate;
              success = true;
              break;
            } catch (err: any) {
              lastErr = err;
              if (err.status !== 404 && !err.message?.includes('model_not_found')) {
                throw err;
              }
            }
          }

          if (!success) {
            throw lastErr;
          }
        } else {
          throw initialErr;
        }
      }

      if (!stream) {
        throw new Error(`Failed to initialize stream with model ${activeModel}`);
      }

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          chunkCount++;
          options.onChunk(delta);
        }
        if (chunk.x_groq?.usage) {
          options.onTokenUsage?.({
            promptTokens: chunk.x_groq.usage.prompt_tokens || 0,
            completionTokens: chunk.x_groq.usage.completion_tokens || 0,
          });
        }
      }

      return { modelUsed: activeModel, chunks: chunkCount };
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        throw new Error(`Groq request timed out after ${timeoutMs}ms`);
      }
      if (err.status === 401 || err.message?.includes('401') || err.message?.includes('Invalid API Key')) {
        throw new Error(`Groq Authentication failed (401): Invalid GROQ_API_KEY`);
      }
      if (err.status === 429 || err.message?.includes('429') || err.message?.includes('Rate limit')) {
        throw new Error(`Groq Rate limit exceeded (429): Quota reached`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutTimer);
    }
  }

  public async generate(options: GenerateOptions): Promise<GenerateResult> {
    if (!this.isConfigured()) {
      throw new Error('Groq AI is not configured: GROQ_API_KEY missing');
    }

    const client = this.getClient();
    const model = this.resolveModel(options.model);

    const formattedMessages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (options.systemPrompt) {
      formattedMessages.push({ role: 'system', content: options.systemPrompt });
    }
    for (const m of options.messages) {
      formattedMessages.push({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content || '',
      });
    }

    const res = await client.chat.completions.create({
      model,
      messages: formattedMessages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
    });

    return {
      text: res.choices[0]?.message?.content || '',
      modelUsed: model,
      usage: {
        promptTokens: res.usage?.prompt_tokens || 0,
        completionTokens: res.usage?.completion_tokens || 0,
      },
    };
  }

  public async transcribeAudio(file: File | Blob | any, model = 'whisper-large-v3'): Promise<string> {
    const client = this.getClient();
    const response = await client.audio.transcriptions.create({
      file,
      model,
      language: 'fr',
      response_format: 'json',
    });
    return response.text;
  }
}

export const groqProvider = new GroqProvider();
