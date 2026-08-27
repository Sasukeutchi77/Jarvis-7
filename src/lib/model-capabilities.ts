export interface ModelCapabilities {
  supportsTools: boolean;
  supportsVision: boolean;
  supportsReasoning: boolean;
  supportsStreaming: boolean;
  contextWindow: number;
}

export function getModelCapabilities(modelId: string): ModelCapabilities {
  const lower = modelId.toLowerCase();
  return {
    supportsTools: true,
    supportsVision: lower.includes('vision') || lower.includes('gemini') || lower.includes('qwen'),
    supportsReasoning: lower.includes('r1') || lower.includes('deepseek') || lower.includes('qwen'),
    supportsStreaming: true,
    contextWindow: lower.includes('llama') ? 131072 : 32768,
  };
}

export function isEmbedOnlyModel(modelId: string): boolean {
  const lower = (modelId || '').toLowerCase();
  return lower.includes('embed') || lower.includes('bge') || lower.includes('nomic-embed');
}
