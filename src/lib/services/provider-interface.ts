/**
 * Unified AI Provider Abstraction Interface for JARVIS
 * 
 * Standard contract implemented by all LLM engines (Groq, Gemini, Anthropic, OpenRouter, OpenAI, Local).
 */

export interface ChatImage {
  mimeType: string; // e.g. 'image/jpeg', 'image/png', 'image/webp'
  data: string;     // Base64 encoded or URL
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: ChatImage[];
}

export interface StreamOptions {
  messages: ChatMessage[];
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  onChunk: (delta: string) => void;
  onTokenUsage?: (usage: { promptTokens: number; completionTokens: number }) => void;
}

export interface GenerateOptions {
  messages: ChatMessage[];
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface GenerateResult {
  text: string;
  modelUsed: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface AIProvider {
  readonly id: string;
  readonly name: string;
  isConfigured(): boolean;
  getDefaultModel(): string;
  getSupportedModels(): string[];
  supportsVision(): boolean;
  resolveModel(requestedModel?: string): string;
  healthCheck(): Promise<boolean>;
  stream(options: StreamOptions): Promise<{ modelUsed: string; chunks: number }>;
  generate(options: GenerateOptions): Promise<GenerateResult>;
}
