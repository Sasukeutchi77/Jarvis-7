export function engineFromCompletionChunk(chunk: any): string | undefined {
  if (!chunk) return undefined;
  if (chunk.engine) return chunk.engine;
  if (chunk.model_engine) return chunk.model_engine;
  if (chunk.telemetry?.engine) return chunk.telemetry.engine;
  return undefined;
}

export function resolveChatEngine({
  routedEngine,
  serverEngine,
  selectedModel,
  selectedOwner,
}: {
  routedEngine?: string;
  serverEngine?: string;
  selectedModel?: string;
  selectedOwner?: string;
}): string {
  if (routedEngine) return routedEngine;
  if (selectedOwner === 'cloud') return 'Cloud Engine (Gemini)';
  if (selectedModel?.startsWith('gemini')) return 'Gemini Cloud Multimodal';
  if (selectedOwner === 'local') return 'On-Device Accelerated Engine';
  return serverEngine || 'OpenJarvis Core Engine';
}
