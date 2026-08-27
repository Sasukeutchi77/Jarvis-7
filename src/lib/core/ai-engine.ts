/**
 * AI ENGINE (JARVIS Intelligence & Agent Coordinator)
 * 
 * Unified AI reasoning gateway integrating:
 * - Groq (LPU Ultra-fast response)
 * - Google Gemini (Multimodal reasoning, 1M+ context, Vision)
 * - Anthropic Claude (Complex coding, architecture)
 * - OpenRouter (Aggregator)
 * - OpenAI (GPT-4o)
 * - Local on-device fallback
 */

import { IAIEngine } from './types.js';
import { supervisorAgent } from '../agents/supervisor-agent.js';
import { agentRegistry } from '../agents/agent-registry.js';
import { AgentAttachment } from '../agents/agent-protocol.js';

export class AIEngine implements IAIEngine {
  private static instance: AIEngine;

  private constructor() {}

  public static getInstance(): AIEngine {
    if (!AIEngine.instance) {
      AIEngine.instance = new AIEngine();
    }
    return AIEngine.instance;
  }

  public async processPrompt(
    prompt: string,
    options?: {
      conversationHistory?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
      agentId?: string;
      onStreamChunk?: (chunk: string) => void;
      images?: string[];
    }
  ): Promise<{
    reply: string;
    spokenSummary?: string;
    agentUsed: string;
    providerUsed: string;
    latencyMs: number;
    toolCalls?: any[];
  }> {
    const startTime = Date.now();

    // 1. If explicit agent requested or routed via supervisor
    const chosenAgentId = options?.agentId || 'supervisor';
    const agent = agentRegistry.getAgent(chosenAgentId as any) || supervisorAgent;

    const attachments: AgentAttachment[] = (options?.images || []).map((img, idx) => ({
      type: 'image',
      data: img,
      name: `image_${idx}.png`,
    }));

    const output = await agent.execute({
      id: `input_${Date.now()}`,
      query: prompt,
      context: {
        history: (options?.conversationHistory || []).map((h) => ({
          role: h.role,
          content: h.content,
        })),
        attachments: attachments.length > 0 ? attachments : undefined,
      },
    });

    return {
      reply: output.reply,
      spokenSummary: output.spokenSummary,
      agentUsed: output.agentName || chosenAgentId,
      providerUsed: typeof output.telemetry?.providerUsed === 'string' ? output.telemetry.providerUsed : 'router',
      latencyMs: Date.now() - startTime,
      toolCalls: output.structuredData?.toolCalls,
    };
  }

  public getAvailableProviders(): Array<{ id: string; name: string; available: boolean }> {
    const knownProviders = [
      { id: 'groq', name: 'Groq LPU', available: Boolean(process.env.GROQ_API_KEY) },
      { id: 'gemini', name: 'Google Gemini', available: Boolean(process.env.GEMINI_API_KEY) },
      { id: 'anthropic', name: 'Anthropic Claude', available: Boolean(process.env.ANTHROPIC_API_KEY) },
      { id: 'openrouter', name: 'OpenRouter Aggregator', available: Boolean(process.env.OPENROUTER_API_KEY) },
      { id: 'openai', name: 'OpenAI GPT-4o', available: Boolean(process.env.OPENAI_API_KEY) },
      { id: 'local', name: 'JARVIS Local Core', available: true },
    ];
    return knownProviders;
  }
}

export const aiEngine = AIEngine.getInstance();
