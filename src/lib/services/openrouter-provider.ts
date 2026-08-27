/**
 * OpenRouter & OpenAI Providers for JARVIS
 * 
 * Implements AIProvider for OpenRouter Unified Gateway & OpenAI models.
 * Supports: Multimodal vision, custom models, dynamic fallbacks, detailed error classification.
 * Security: API keys are strictly server-side (process.env).
 */

import {
  AIProvider,
  ChatMessage,
  GenerateOptions,
  GenerateResult,
  StreamOptions,
} from './provider-interface.js';

export class OpenRouterProvider implements AIProvider {
  public readonly id = 'openrouter';
  public readonly name = 'OpenRouter Multi-Model Gateway';

  public isConfigured(): boolean {
    return !!process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim().length > 0;
  }

  public getDefaultModel(): string {
    return process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';
  }

  public getSupportedModels(): string[] {
    return [
      'anthropic/claude-3.7-sonnet',
      'anthropic/claude-3.5-sonnet',
      'meta-llama/llama-3.3-70b-instruct',
      'deepseek/deepseek-r1',
      'google/gemini-2.0-flash-001',
      'mistralai/mistral-large-2411',
      'openai/gpt-4o',
    ];
  }

  public supportsVision(): boolean {
    return true;
  }

  public resolveModel(requestedModel?: string): string {
    if (!requestedModel || !requestedModel.trim()) {
      return this.getDefaultModel();
    }
    const clean = requestedModel.trim();
    const lower = clean.toLowerCase();

    // Valid OpenRouter organization prefixes
    const validOrPrefixes = [
      'anthropic/',
      'meta-llama/',
      'openai/',
      'deepseek/',
      'google/',
      'mistralai/',
      'qwen/',
      'cohere/',
      'nousresearch/',
      'liquid/',
      'perplexity/',
    ];

    if (validOrPrefixes.some((p) => lower.startsWith(p))) {
      return clean;
    }

    // Strip any other provider prefixes like groq/, gemini/, local/
    const stripped = clean.replace(/^(groq|gemini|anthropic|openai|local)\//i, '').toLowerCase();

    if (stripped.includes('deepseek')) return 'deepseek/deepseek-r1';
    if (stripped.includes('llama') || stripped.includes('versatile') || stripped.includes('groq')) return 'meta-llama/llama-3.3-70b-instruct';
    if (stripped.includes('mistral') || stripped.includes('mixtral')) return 'mistralai/mistral-large-2411';
    if (stripped.includes('claude-3.7') || stripped.includes('claude-3-7') || stripped.includes('sonnet-3.7')) return 'anthropic/claude-3.7-sonnet';
    if (stripped.includes('claude') || stripped.includes('sonnet')) return 'anthropic/claude-3.5-sonnet';
    if (stripped.includes('gemini') || stripped.includes('flash')) return 'google/gemini-2.0-flash-001';
    if (stripped.includes('gpt') || stripped.includes('openai')) return 'openai/gpt-4o';

    return this.getDefaultModel();
  }

  public async healthCheck(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const apiKey = process.env.OPENROUTER_API_KEY;
      const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private formatMessages(messages: ChatMessage[], systemPrompt?: string): any[] {
    const formatted: any[] = [];
    if (systemPrompt) {
      formatted.push({ role: 'system', content: systemPrompt });
    }

    for (const m of messages) {
      const role = m.role === 'assistant' ? 'assistant' : 'user';

      if (m.images && m.images.length > 0) {
        const contentParts: any[] = [];
        if (m.content) {
          contentParts.push({ type: 'text', text: m.content });
        }
        for (const img of m.images) {
          const url = img.data.startsWith('http') || img.data.startsWith('data:')
            ? img.data
            : `data:${img.mimeType || 'image/jpeg'};base64,${img.data}`;
          contentParts.push({
            type: 'image_url',
            image_url: { url },
          });
        }
        formatted.push({ role, content: contentParts });
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
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenRouter is not configured: OPENROUTER_API_KEY missing');
    }

    const model = this.resolveModel(options.model);
    const timeoutMs = options.timeoutMs || parseInt(process.env.OPENROUTER_TIMEOUT_MS || process.env.AI_TIMEOUT_MS || '20000', 10);

    const formattedMessages = this.formatMessages(options.messages, options.systemPrompt);

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

    let activeModel = model;
    let chunks = 0;

    try {
      let res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://openjarvis.ai',
          'X-Title': 'JARVIS System',
        },
        body: JSON.stringify({
          model: activeModel,
          messages: formattedMessages,
          stream: true,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 4096,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        // If the model was invalid or not found, retry once with default robust model
        if (
          (res.status === 400 && errorText.includes('valid model ID')) ||
          res.status === 404 ||
          errorText.includes('model_not_found')
        ) {
          const fallbackModel = 'meta-llama/llama-3.3-70b-instruct';
          console.warn(`[OpenRouterProvider] Model '${activeModel}' failed (${errorText.slice(0, 80)}), retrying with '${fallbackModel}'...`);
          activeModel = fallbackModel;
          res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
              'HTTP-Referer': 'https://openjarvis.ai',
              'X-Title': 'JARVIS System',
            },
            body: JSON.stringify({
              model: activeModel,
              messages: formattedMessages,
              stream: true,
              temperature: options.temperature ?? 0.7,
              max_tokens: options.maxTokens ?? 4096,
            }),
            signal: controller.signal,
          });
        }

        if (!res.ok) {
          const finalErrorText = await res.text().catch(() => '');
          if (res.status === 401 || res.status === 403) {
            throw new Error(`OpenRouter Authentication failed (${res.status}): Invalid or unauthorized OPENROUTER_API_KEY`);
          }
          if (res.status === 402) {
            throw new Error(`OpenRouter Credits exhausted (402): Please refill account balance`);
          }
          if (res.status === 429) {
            throw new Error(`OpenRouter Rate limit exceeded (429): Quota reached for model ${activeModel}`);
          }
          if (res.status === 404 || finalErrorText.includes('model_not_found') || finalErrorText.includes('not found')) {
            throw new Error(`OpenRouter model '${activeModel}' not available: ${finalErrorText.slice(0, 150)}`);
          }
          throw new Error(`OpenRouter HTTP ${res.status}: ${finalErrorText.slice(0, 250)}`);
        }
      }

      if (!res.body) {
        throw new Error('OpenRouter response has no readable stream body');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed === 'data: [DONE]') break;
          if (trimmed.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                chunks++;
                options.onChunk(delta);
              }
              if (parsed.usage) {
                options.onTokenUsage?.({
                  promptTokens: parsed.usage.prompt_tokens || 0,
                  completionTokens: parsed.usage.completion_tokens || 0,
                });
              }
            } catch {}
          }
        }
      }

      if (chunks === 0) {
        throw new Error(`OpenRouter returned empty stream response for model ${model}`);
      }

      return { modelUsed: model, chunks };
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        throw new Error(`OpenRouter request timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutTimer);
    }
  }

  public async generate(options: GenerateOptions): Promise<GenerateResult> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenRouter is not configured: OPENROUTER_API_KEY missing');
    }
    const model = this.resolveModel(options.model);
    const timeoutMs = options.timeoutMs || parseInt(process.env.OPENROUTER_TIMEOUT_MS || process.env.AI_TIMEOUT_MS || '20000', 10);

    const formattedMessages = this.formatMessages(options.messages, options.systemPrompt);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://openjarvis.ai',
          'X-Title': 'JARVIS System',
        },
        body: JSON.stringify({
          model,
          messages: formattedMessages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 4096,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`OpenRouter HTTP ${res.status}: ${errorText.slice(0, 200)}`);
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      if (!text) {
        throw new Error('OpenRouter returned empty response content');
      }

      return {
        text,
        modelUsed: model,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
        },
      };
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        throw new Error(`OpenRouter request timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

export class OpenAiProvider implements AIProvider {
  public readonly id = 'openai';
  public readonly name = 'OpenAI GPT Engine';

  public isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0;
  }

  public getDefaultModel(): string {
    return process.env.OPENAI_MODEL || 'gpt-4o';
  }

  public getSupportedModels(): string[] {
    return ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o3-mini'];
  }

  public supportsVision(): boolean {
    return true;
  }

  public resolveModel(requestedModel?: string): string {
    if (!requestedModel) return this.getDefaultModel();
    const clean = requestedModel.toLowerCase().trim();
    if (clean.includes('mini')) return 'gpt-4o-mini';
    if (clean.includes('gpt-4o')) return 'gpt-4o';
    return clean || this.getDefaultModel();
  }

  public async healthCheck(): Promise<boolean> {
    return this.isConfigured();
  }

  public async stream(options: StreamOptions): Promise<{ modelUsed: string; chunks: number }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY missing');

    const model = this.resolveModel(options.model);
    const timeoutMs = options.timeoutMs || 20000;

    const messages = [
      ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
      ...options.messages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content || '',
      })),
    ];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          temperature: options.temperature ?? 0.7,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`OpenAI HTTP ${res.status}: ${text.slice(0, 200)}`);
      }

      if (!res.body) throw new Error('OpenAI response has no body stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let chunks = 0;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed === 'data: [DONE]') break;
          if (trimmed.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                chunks++;
                options.onChunk(delta);
              }
            } catch {}
          }
        }
      }

      return { modelUsed: model, chunks };
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        throw new Error(`OpenAI request timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  public async generate(options: GenerateOptions): Promise<GenerateResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY missing');
    const model = this.resolveModel(options.model);

    const messages = [
      ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
      ...options.messages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content || '',
      })),
    ];

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
      }),
    });

    const data = await res.json();
    return {
      text: data.choices?.[0]?.message?.content || '',
      modelUsed: model,
    };
  }
}

export const openRouterProvider = new OpenRouterProvider();
export const openAiProvider = new OpenAiProvider();
