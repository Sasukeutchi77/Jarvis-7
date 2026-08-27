export interface ToolCallPayload {
  tool: string;
  arguments?: Record<string, any> | string;
  result?: any;
  success?: boolean;
  latency?: number;
}

export function serializeToolCallArguments(args: unknown): string {
  if (args === undefined || args === null) return '';
  if (typeof args === 'string') return args;
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return String(args);
  }
}

export function parseToolCallArguments<T = Record<string, any>>(raw: string): T {
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw);
  } catch {
    return { query: raw } as unknown as T;
  }
}
