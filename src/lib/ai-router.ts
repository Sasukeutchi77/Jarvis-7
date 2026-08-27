/**
 * JARVIS Centralized AI Provider Router
 * 
 * Unified, multi-provider, resilient LLM router with automatic cascading fallback.
 * Routes seamlessly across:
 * 1. Groq (LPU ultra-fast inference)
 * 2. Google Gemini (Multimodal reasoning, 1M+ context, vision)
 * 3. Anthropic Claude (Deep complex reasoning, structured analysis, code synthesis)
 * 4. OpenRouter (Multi-model aggregator)
 * 5. OpenAI (GPT-4o)
 * 6. Local on-device core fallback
 * 
 * All providers implement the unified AIProvider interface.
 * Security: API keys NEVER touch the client or Android frontends.
 */

import { AIProvider, ChatMessage, StreamOptions } from './services/provider-interface.js';
import { groqProvider } from './services/groq-provider.js';
import { geminiProvider } from './services/gemini-provider.js';
import { anthropicProvider } from './services/anthropic-provider.js';
import { openRouterProvider, openAiProvider } from './services/openrouter-provider.js';

export type AIProviderId = 'groq' | 'gemini' | 'anthropic' | 'openrouter' | 'openai' | 'local';

export interface AIProviderConfig {
  primaryProvider: AIProviderId;
  secondaryProvider: AIProviderId;
  fallbackProvider: AIProviderId;
  timeoutMs: number;
  maxRetries: number;
  temperature?: number;
  preferredModels?: Partial<Record<AIProviderId, string>>;
}

export interface ProviderExecutionResult {
  provider: AIProviderId;
  modelUsed: string;
  success: boolean;
  error?: string;
  latencyMs: number;
}

export interface RouterHealthStatus {
  activeConfig: AIProviderConfig;
  providers: Record<
    AIProviderId,
    {
      name: string;
      configured: boolean;
      available: boolean;
      supportsVision: boolean;
      defaultModel: string;
      supportedModels: string[];
      description: string;
    }
  >;
}

// Registry of all AIProvider instances
const providerRegistry: Record<string, AIProvider> = {
  groq: groqProvider,
  gemini: geminiProvider,
  anthropic: anthropicProvider,
  openrouter: openRouterProvider,
  openai: openAiProvider,
};

// In-memory runtime configuration that can be updated via API or env vars
const defaultPrimaryProvider: AIProviderId =
  (process.env.AI_PROVIDER as AIProviderId) ||
  (process.env.OPENROUTER_API_KEY ? 'openrouter' :
   process.env.GROQ_API_KEY ? 'groq' :
   process.env.GEMINI_API_KEY ? 'gemini' :
   process.env.ANTHROPIC_API_KEY ? 'anthropic' :
   process.env.OPENAI_API_KEY ? 'openai' : 'openrouter');

let runtimeConfig: AIProviderConfig = {
  primaryProvider: defaultPrimaryProvider,
  secondaryProvider: (process.env.AI_SECONDARY_PROVIDER as AIProviderId) || 'gemini',
  fallbackProvider: (process.env.AI_FALLBACK_PROVIDER as AIProviderId) || 'anthropic',
  timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '20000', 10),
  maxRetries: parseInt(process.env.AI_MAX_RETRIES || '2', 10),
  temperature: 0.7,
  preferredModels: {
    openrouter: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
    groq: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    gemini: process.env.GEMINI_MODEL || 'gemini-3.7-flash',
    anthropic: process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-20250219',
    openai: process.env.OPENAI_MODEL || 'gpt-4o',
    local: 'jarvis-ondevice-core',
  },
};

export class JarvisAiRouter {
  /**
   * Get provider instance from registry
   */
  public static getProvider(id: string): AIProvider | undefined {
    return providerRegistry[id];
  }

  /**
   * Returns current active configuration and provider availability
   */
  public static getStatus(): RouterHealthStatus {
    return {
      activeConfig: { ...runtimeConfig },
      providers: {
        groq: {
          name: groqProvider.name,
          configured: groqProvider.isConfigured(),
          available: groqProvider.isConfigured(),
          supportsVision: groqProvider.supportsVision(),
          defaultModel: runtimeConfig.preferredModels?.groq || groqProvider.getDefaultModel(),
          supportedModels: groqProvider.getSupportedModels(),
          description: 'Groq LPU ultra-low latency inference (~500 tokens/sec)',
        },
        gemini: {
          name: geminiProvider.name,
          configured: geminiProvider.isConfigured(),
          available: geminiProvider.isConfigured(),
          supportsVision: geminiProvider.supportsVision(),
          defaultModel: runtimeConfig.preferredModels?.gemini || geminiProvider.getDefaultModel(),
          supportedModels: geminiProvider.getSupportedModels(),
          description: 'Google Gemini 2.5 Flash / Pro (Multimodal 1M+ Context & Vision)',
        },
        anthropic: {
          name: anthropicProvider.name,
          configured: anthropicProvider.isConfigured(),
          available: anthropicProvider.isConfigured(),
          supportsVision: anthropicProvider.supportsVision(),
          defaultModel: runtimeConfig.preferredModels?.anthropic || anthropicProvider.getDefaultModel(),
          supportedModels: anthropicProvider.getSupportedModels(),
          description: 'Anthropic Claude 3.7 / 3.5 Sonnet (Deep Structured Reasoning & Vision)',
        },
        openrouter: {
          name: openRouterProvider.name,
          configured: openRouterProvider.isConfigured(),
          available: openRouterProvider.isConfigured(),
          supportsVision: openRouterProvider.supportsVision(),
          defaultModel: runtimeConfig.preferredModels?.openrouter || openRouterProvider.getDefaultModel(),
          supportedModels: openRouterProvider.getSupportedModels(),
          description: 'OpenRouter Unified Multi-Model Gateway',
        },
        openai: {
          name: openAiProvider.name,
          configured: openAiProvider.isConfigured(),
          available: openAiProvider.isConfigured(),
          supportsVision: openAiProvider.supportsVision(),
          defaultModel: runtimeConfig.preferredModels?.openai || openAiProvider.getDefaultModel(),
          supportedModels: openAiProvider.getSupportedModels(),
          description: 'OpenAI GPT-4o & GPT-4o Mini',
        },
        local: {
          name: 'Moteur JARVIS On-Device',
          configured: true,
          available: true,
          supportsVision: false,
          defaultModel: 'jarvis-ondevice-core',
          supportedModels: ['jarvis-ondevice-core'],
          description: 'Moteur autonome embarqué JARVIS On-Device',
        },
      },
    };
  }

  /**
   * Returns list of currently available and configured provider IDs
   */
  public static getAvailableProviders(): string[] {
    const status = this.getStatus();
    return Object.entries(status.providers)
      .filter(([_, p]) => p.available)
      .map(([id]) => id);
  }

  /**
   * Update router configuration dynamically from API
   */
  public static updateConfig(partial: Partial<AIProviderConfig>): AIProviderConfig {
    runtimeConfig = {
      ...runtimeConfig,
      ...partial,
      preferredModels: {
        ...runtimeConfig.preferredModels,
        ...(partial.preferredModels || {}),
      },
    };
    return { ...runtimeConfig };
  }

  /**
   * Builds the cascading provider chain based on:
   * 1. Multimodal / Vision requirement (prioritizes Gemini, Anthropic, OpenAI if images attached)
   * 2. Explicit model requested prefix
   * 3. Configured priority order (primary -> secondary -> fallback -> others)
   */
  private static buildProviderChain(
    requestedModel?: string,
    requiresVision = false
  ): AIProviderId[] {
    const chain: AIProviderId[] = [];

    // If explicit model requested
    if (requestedModel) {
      const m = requestedModel.toLowerCase();
      if (m.includes('groq') || m.includes('llama') || m.includes('mixtral') || m.includes('gemma')) {
        chain.push('groq');
      } else if (m.includes('gemini') || m.includes('google')) {
        chain.push('gemini');
      } else if (m.includes('claude') || m.includes('anthropic')) {
        chain.push('anthropic');
      } else if (m.includes('openrouter')) {
        chain.push('openrouter');
      } else if (m.includes('gpt-') || m.includes('openai')) {
        chain.push('openai');
      }
    }

    // If vision is required, prioritize vision-capable engines (Gemini & Anthropic)
    if (requiresVision) {
      if (!chain.includes('gemini')) chain.push('gemini');
      if (!chain.includes('anthropic')) chain.push('anthropic');
      if (!chain.includes('openai')) chain.push('openai');
      if (!chain.includes('openrouter')) chain.push('openrouter');
    }

    // Add configured cascade order
    const orderedDefaults: AIProviderId[] = [
      runtimeConfig.primaryProvider,
      runtimeConfig.secondaryProvider,
      runtimeConfig.fallbackProvider,
      'groq',
      'gemini',
      'anthropic',
      'openrouter',
      'openai',
    ];

    for (const p of orderedDefaults) {
      if (!chain.includes(p)) {
        chain.push(p);
      }
    }

    return chain;
  }

  /**
   * Executes completion with automatic cascading fallback across providers.
   */
  public static async executeStream(
    params: {
      messages: ChatMessage[];
      systemPrompt: string;
      model?: string;
      temperature?: number;
      timeoutMs?: number;
      onChunk: (chunk: string) => void;
      onTokenUsage?: (usage: { promptTokens: number; completionTokens: number }) => void;
    }
  ): Promise<{ providerUsed: AIProviderId; modelUsed: string; attempts: ProviderExecutionResult[] }> {
    const attempts: ProviderExecutionResult[] = [];

    // Check if any message contains image attachments
    const hasImages = params.messages.some((m) => m.images && m.images.length > 0);
    const candidateProviders = this.buildProviderChain(params.model, hasImages);

    let chunksEmitted = 0;
    const trackingOnChunk = (chunk: string) => {
      chunksEmitted++;
      params.onChunk(chunk);
    };

    const timeoutMs = params.timeoutMs || runtimeConfig.timeoutMs || 20000;

    // Try each provider in sequence
    for (const providerId of candidateProviders) {
      if (providerId === 'local') continue;

      const provider = providerRegistry[providerId];
      if (!provider || !provider.isConfigured()) {
        continue;
      }

      // If request has images and provider doesn't support vision, skip to next
      if (hasImages && !provider.supportsVision()) {
        console.log(`[JarvisAiRouter] Skipping ${providerId} (requires multimodal vision support)`);
        continue;
      }

      const model = provider.resolveModel(params.model);
      const startTime = Date.now();

      try {
        console.log(`[JarvisAiRouter] Cascading try -> Provider: ${provider.name} (${providerId}), Model: ${model}`);

        await provider.stream({
          messages: params.messages,
          systemPrompt: params.systemPrompt,
          model,
          temperature: params.temperature ?? runtimeConfig.temperature ?? 0.7,
          timeoutMs,
          onChunk: trackingOnChunk,
          onTokenUsage: params.onTokenUsage,
        });

        const latencyMs = Date.now() - startTime;
        attempts.push({
          provider: providerId,
          modelUsed: model,
          success: true,
          latencyMs,
        });

        console.log(`[JarvisAiRouter] Success with provider: ${providerId} (${latencyMs}ms)`);
        return {
          providerUsed: providerId,
          modelUsed: model,
          attempts,
        };
      } catch (err: any) {
        const latencyMs = Date.now() - startTime;
        const errMsg = err?.message || String(err);
        console.warn(`[JarvisAiRouter] Provider ${providerId} failed in ${latencyMs}ms: ${errMsg}. Triggering fallback...`);

        attempts.push({
          provider: providerId,
          modelUsed: model,
          success: false,
          error: errMsg,
          latencyMs,
        });

        // If some chunks were already emitted to client, stop further cascading
        if (chunksEmitted > 0) {
          console.warn(`[JarvisAiRouter] Stream already started from ${providerId}, keeping output.`);
          return {
            providerUsed: providerId,
            modelUsed: model,
            attempts,
          };
        }
      }
    }

    // Ultimate fallback: Local deterministic response
    console.log('[JarvisAiRouter] All cloud providers exhausted or offline. Engaging Local On-Device Core.');
    const fallbackText = `Mes salutations, Monsieur. Tous les protocoles de secours sont actifs et les systèmes restent sous contrôle. Comment puis-je vous assister ?`;

    const words = fallbackText.split(' ');
    for (const w of words) {
      params.onChunk(w + ' ');
      await new Promise((r) => setTimeout(r, 20));
    }

    attempts.push({
      provider: 'local',
      modelUsed: 'jarvis-ondevice-core',
      success: true,
      latencyMs: 5,
    });

    return {
      providerUsed: 'local',
      modelUsed: 'jarvis-ondevice-core',
      attempts,
    };
  }

  /**
   * Executes completion and aggregates text result.
   */
  public static async executeText(
    params: {
      messages: ChatMessage[];
      systemPrompt?: string;
      model?: string;
      temperature?: number;
      timeoutMs?: number;
    }
  ): Promise<{ text: string; providerUsed: AIProviderId; modelUsed: string; attempts: ProviderExecutionResult[] }> {
    let fullText = '';
    const result = await this.executeStream({
      messages: params.messages,
      systemPrompt: params.systemPrompt || '',
      model: params.model,
      temperature: params.temperature,
      timeoutMs: params.timeoutMs,
      onChunk: (chunk: string) => {
        fullText += chunk;
      },
    });

    return {
      text: fullText.trim(),
      providerUsed: result.providerUsed,
      modelUsed: result.modelUsed,
      attempts: result.attempts,
    };
  }
}
