import { getBase, authHeaders } from './api';
import type { SSEEvent } from '../types';

export interface ChatCompletionPayload {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

/**
 * Stream chat responses from /v1/chat/completions
 */
export async function* streamChat(
  payload: ChatCompletionPayload,
  signal?: AbortSignal,
): AsyncGenerator<SSEEvent, void, unknown> {
  const base = getBase();
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(errorText || `Chat completion failed: ${res.status}`);
  }

  if (!res.body) {
    throw new Error('Readable stream not supported on response body');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let currentEvent: string | undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
          continue;
        }
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data.trim() === '[DONE]') {
            yield { event: currentEvent, data: '[DONE]' };
            currentEvent = undefined;
            return;
          }
          yield { event: currentEvent, data };
          currentEvent = undefined;
        } else if (line.trim() === '') {
          currentEvent = undefined;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Stream deep research responses from /api/research
 */
export async function* streamResearch(
  query: string,
  model?: string,
  signal?: AbortSignal,
): AsyncGenerator<any, void, unknown> {
  const base = getBase();
  const res = await fetch(`${base}/api/research`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ query, model }),
    signal,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(err || `Research failed: ${res.status}`);
  }

  if (!res.body) {
    throw new Error('Readable stream not supported on response body');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') return;
          try {
            const parsed = JSON.parse(raw);
            yield parsed;
          } catch {}
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
