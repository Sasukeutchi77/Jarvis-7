/**
 * Anthropic Claude Provider for JARVIS
 * 
 * Powered by official @anthropic-ai/sdk.
 * Features: Deep structured reasoning, complex coding analysis, multimodal image understanding.
 * 
 * Security: ANTHROPIC_API_KEY is loaded exclusively server-side via process.env.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  AIProvider,
  ChatMessage,
  GenerateOptions,
  GenerateResult,
  StreamOptions,
} from './provider-interface.js';

export class AnthropicProvider implements AIProvider {
  public readonly id = 'anthropic';
  public readonly name = 'Anthropic Claude Engine';

  private clientInstance: Anthropic | null = null;

  private getClient(): Anthropic {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not defined in server environment');
    }
    if (!this.clientInstance) {
      this.clientInstance = new Anthropic({
        apiKey,
        timeout: parseInt(process.env.ANTHROPIC_TIMEOUT_MS || '25000', 10),
      });
    }
    return this.clientInstance;
  }

  public isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim().length > 0;
  }

  public getDefaultModel(): string {
    return process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-20250219';
  }

  public getSupportedModels(): string[] {
    return [
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
    ];
  }

  public supportsVision(): boolean {
    return true;
  }

  public resolveModel(requestedModel?: string): string {
    if (!requestedModel || !requestedModel.trim()) {
      return this.getDefaultModel();
    }
    const clean = requestedModel.toLowerCase().trim().replace(/^anthropic\//, '');
    if (clean.includes('haiku')) return 'claude-3-5-haiku-20241022';
    if (clean.includes('3.5') || clean.includes('sonnet-3.5')) return 'claude-3-5-sonnet-20241022';
    if (clean.includes('3.7') || clean.includes('sonnet-3.7')) return 'claude-3-7-sonnet-20250219';
    return clean || this.getDefaultModel();
  }

  public async healthCheck(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const client = this.getClient();
      const res = await client.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return res.content.length > 0;
    } catch {
      return false;
    }
  }

  private formatMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
    const formatted: Anthropic.MessageParam[] = [];

    // Anthropic requires non-system messages alternating between user and assistant
    const conversation = messages.filter((m) => m.role !== 'system');
    if (conversation.length === 0) {
      conversation.push({ role: 'user', content: 'Bonjour JARVIS' });
    }

    for (const m of conversation) {
      const role = m.role === 'assistant' ? 'assistant' : 'user';

      if (m.images && m.images.length > 0) {
        const contentBlocks: Anthropic.ContentBlockParam[] = [];
        for (const img of m.images) {
          const base64Data = img.data.includes('base64,')
            ? img.data.split('base64,')[1]
            : img.data;
          const mediaType = (img.mimeType || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
          contentBlocks.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data,
            },
          });
        }
        if (m.content) {
          contentBlocks.push({
            type: 'text',
            text: m.content,
          });
        }
        formatted.push({ role, content: contentBlocks });
      } else {
        formatted.push({
          role,
          content: m.content || ' ',
        });
      }
    }

    return formatted;
  }

  public async stream(options: StreamOptions): Promise<{ modelUsed: string; chunks: number }> {
    if (!this.isConfigured()) {
      throw new Error('Anthropic Claude is not configured: ANTHROPIC_API_KEY missing');
    }

    const client = this.getClient();
    const model = this.resolveModel(options.model);
    const timeoutMs = options.timeoutMs || parseInt(process.env.AI_TIMEOUT_MS || '20000', 10);

    const formattedMessages = this.formatMessages(options.messages);

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

    let chunkCount = 0;
    try {
      const stream = await client.messages.stream(
        {
          model,
          system: options.systemPrompt,
          messages: formattedMessages,
          max_tokens: options.maxTokens ?? 4096,
          temperature: options.temperature ?? 0.7,
        },
        {
          signal: controller.signal,
        }
      );

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          chunkCount++;
          options.onChunk(event.delta.text);
        }
      }

      const finalMessage = await stream.finalMessage();
      if (finalMessage.usage) {
        options.onTokenUsage?.({
          promptTokens: finalMessage.usage.input_tokens || 0,
          completionTokens: finalMessage.usage.output_tokens || 0,
        });
      }

      return { modelUsed: model, chunks: chunkCount };
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        throw new Error(`Anthropic request timed out after ${timeoutMs}ms`);
      }
      if (err.status === 401 || err.message?.includes('401') || err.message?.includes('authentication_error')) {
        throw new Error(`Anthropic Authentication failed (401): Invalid ANTHROPIC_API_KEY`);
      }
      if (err.status === 429 || err.message?.includes('rate_limit_error')) {
        throw new Error(`Anthropic Rate limit exceeded (429): Quota reached`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutTimer);
    }
  }

  public async generate(options: GenerateOptions): Promise<GenerateResult> {
    if (!this.isConfigured()) {
      throw new Error('Anthropic Claude is not configured: ANTHROPIC_API_KEY missing');
    }

    const client = this.getClient();
    const model = this.resolveModel(options.model);
    const formattedMessages = this.formatMessages(options.messages);

    const res = await client.messages.create({
      model,
      system: options.systemPrompt,
      messages: formattedMessages,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.7,
    });

    let text = '';
    for (const block of res.content) {
      if (block.type === 'text') {
        text += block.text;
      }
    }

    return {
      text,
      modelUsed: model,
      usage: {
        promptTokens: res.usage.input_tokens,
        completionTokens: res.usage.output_tokens,
      },
    };
  }
}

export const anthropicProvider = new AnthropicProvider();
