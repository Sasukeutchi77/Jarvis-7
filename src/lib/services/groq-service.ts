/**
 * Groq AI Service proxy (re-exports GroqProvider)
 */

import { groqProvider, GroqProvider } from './groq-provider.js';

export { groqProvider, GroqProvider };
export const GroqService = {
  getClient: () => groqProvider.getClient(),
  isConfigured: () => groqProvider.isConfigured(),
  getDefaultModel: () => groqProvider.getDefaultModel(),
  getSupportedModels: () => groqProvider.getSupportedModels(),
  resolveModel: (model?: string) => groqProvider.resolveModel(model),
  streamChat: (options: any) => groqProvider.stream(options),
  transcribeAudio: (file: any, model?: string) => groqProvider.transcribeAudio(file, model),
};
