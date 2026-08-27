import type { ModelInfo, MorningBriefingData, SavingsData, ServerInfo, VisionAnalysisResult, VisionTaskType, VoiceActionResponse } from '../types';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase';
import { serializeToolCallArguments } from './tool-call';
import { ClientFallbackEngine } from './services/fallback/client-fallback-engine';

// ---------------------------------------------------------------------------
// Supabase config
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export const isTauri = () => typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;

export type CloudKeyStatus = Record<string, boolean>;

export async function getCloudKeyStatus(): Promise<CloudKeyStatus> {
  if (!isTauri()) return {};
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const rows = await invoke<Array<{ key: string; set: boolean }>>('get_cloud_key_status');
    return Object.fromEntries(rows.map((row) => [row.key, row.set]));
  } catch (e: any) {
    throw new Error(e?.message ?? e ?? 'Failed to read cloud key status');
  }
}

export async function saveCloudKey(keyName: string, keyValue: string): Promise<void> {
  if (!isTauri()) {
    throw new Error('Cloud API keys can be saved in the desktop app only.');
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('save_cloud_key', { keyName, keyValue });
  } catch (e: any) {
    throw new Error(e?.message ?? e ?? 'Failed to save cloud key');
  }
}

// Cached API base URL fetched from the Tauri backend at startup.
// This avoids hardcoding the port — the Rust backend is the single
// source of truth for JARVIS_PORT.
let _tauriApiBase: string | null = null;

/** Pre-fetch the API base URL from the Tauri backend (call once at init). */
export async function initApiBase(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    _tauriApiBase = await invoke<string>('get_api_base');
  } catch {
    // Command may not exist on older builds; fall through to default.
  }
}

const DESKTOP_API_FALLBACK = 'http://127.0.0.1:8000';

const getSettingsApiUrl = (): string => {
  try {
    const raw = localStorage.getItem('openjarvis-settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.apiUrl) return parsed.apiUrl.replace(/\/+$/, '');
    }
  } catch {}
  return '';
};

export const getBase = (): string => {
  const settingsUrl = getSettingsApiUrl();
  if (settingsUrl) return settingsUrl;
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (isTauri()) return _tauriApiBase || DESKTOP_API_FALLBACK;
  return '';
};

// Resolve the local server API key (OPENJARVIS_API_KEY). When `jarvis serve`
// is started with a key, AuthMiddleware 401s every /v1 and /api request that
// lacks a Bearer token — so the frontend must send it (#266). Sourced from the
// same settings blob as the API URL, with an optional build-time env override.
// Returns '' when unset, so a keyless local server keeps working unchanged.
export const getApiKey = (): string => {
  try {
    const raw = localStorage.getItem('openjarvis-settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.apiKey) return String(parsed.apiKey);
    }
  } catch {}
  if (import.meta.env.VITE_OPENJARVIS_API_KEY) {
    return import.meta.env.VITE_OPENJARVIS_API_KEY as string;
  }
  return '';
};

// Build request headers with the Bearer Authorization token when a local key
// is configured, merging any caller-supplied headers. Adds no Authorization
// header when no key is set, so keyless local dev is byte-for-byte unchanged.
export const authHeaders = (
  extra: Record<string, string> = {},
): Record<string, string> => {
  const key = getApiKey();
  return key ? { ...extra, Authorization: `Bearer ${key}` } : { ...extra };
};

// Centralized fetch for the local server: prepends getBase() and injects the
// Bearer auth header (when a key is set) on every call. Using this everywhere
// guarantees no /v1 or /api request is sent without auth — the bug in #266 was
// that direct fetch() calls omitted the header and 401'd. `path` is the
// server-relative path (e.g. "/v1/savings").
export const apiFetch = (
  path: string,
  init: RequestInit = {},
): Promise<Response> => {
  const headers = authHeaders(
    (init.headers as Record<string, string> | undefined) ?? {},
  );
  return fetch(`${getBase()}${path}`, { ...init, headers });
};

async function tauriInvoke<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  const apiUrl = getBase();
  return invoke<T>(command, { apiUrl, ...args });
}

// ---------------------------------------------------------------------------
// Setup status (desktop only)
// ---------------------------------------------------------------------------

export interface SetupStatus {
  phase: string;
  detail: string;
  ollama_ready: boolean;
  server_ready: boolean;
  model_ready: boolean;
  error: string | null;
  source?: 'ollama' | 'custom'; // drives source-aware setup labels
}

export async function getSetupStatus(): Promise<SetupStatus | null> {
  if (!isTauri()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<SetupStatus>('get_setup_status');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function fetchModels(): Promise<ModelInfo[]> {
  if (isTauri()) {
    try {
      const result = await tauriInvoke<{ data?: ModelInfo[] }>('fetch_models');
      return result?.data || [];
    } catch {
      // Fall through to fetch
    }
  }
  const res = await apiFetch(`/v1/models`);
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
  const data = await res.json();
  return data.data || [];
}

export async function fetchRecommendedModel(): Promise<{ model: string; reason: string }> {
  const res = await apiFetch(`/v1/recommended-model`);
  if (!res.ok) return { model: '', reason: 'Failed to fetch' };
  return res.json();
}

export async function pullModel(modelName: string): Promise<void> {
  // In Tauri, go through the Rust backend directly (avoids CORS / timeout
  // issues with long model downloads via fetch).
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('pull_ollama_model', { modelName });
      return;
    } catch (e: any) {
      throw new Error(e?.message || e || 'Download failed');
    }
  }
  const res = await apiFetch(`/v1/models/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelName }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`Failed to pull model: ${detail}`);
  }
}

export async function deleteModel(modelName: string): Promise<void> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_ollama_model', { modelName });
      return;
    } catch (e: any) {
      throw new Error(e?.message || e || 'Delete failed');
    }
  }
  const res = await apiFetch(`/v1/models/${encodeURIComponent(modelName)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`Failed to delete model: ${detail}`);
  }
}

const _CLOUD_PREFIXES = ['gpt-', 'o1-', 'o3-', 'o4-', 'claude-', 'gemini-', 'openrouter/'];

export async function preloadModel(modelName: string, owner?: string): Promise<void> {
  // Cloud models don't need Ollama preloading
  if (owner === 'litellm' || _CLOUD_PREFIXES.some(p => modelName.startsWith(p))) {
    return;
  }
  // Trigger Ollama to load the model into memory (empty prompt, no generation).
  const ollamaUrl = 'http://127.0.0.1:11434';
  try {
    const res = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName, prompt: '', keep_alive: '5m' }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(`Preload failed: ${res.status}`);
  } catch (e: any) {
    if (e.name === 'TimeoutError') throw new Error('Model load timed out (120s)');
    throw e;
  }
}

export async function fetchSavings(): Promise<SavingsData> {
  const res = await apiFetch(`/v1/savings`);
  if (!res.ok) throw new Error(`Failed to fetch savings: ${res.status}`);
  return res.json();
}

export async function fetchServerInfo(): Promise<ServerInfo> {
  const res = await apiFetch(`/v1/info`);
  if (!res.ok) throw new Error(`Failed to fetch server info: ${res.status}`);
  return res.json();
}

export async function checkHealth(): Promise<boolean> {
  if (isTauri()) {
    try {
      await tauriInvoke('check_health', { apiUrl: getBase() });
      return true;
    } catch {
      return false;
    }
  }
  // In the browser, hit /health relative to the page origin so the request
  // flows through whatever path is already serving the SPA — the Vite
  // proxy in dev, FastAPI's static mount in prod. This avoids the
  // false-negative "Cannot reach backend" banner when getBase() points at
  // an absolute URL the browser can't reach directly.
  //
  // If /health itself fails for any reason (proxy quirk, stale service
  // worker, etc.) fall back to an arbitrary API endpoint we know the rest
  // of the app polls successfully. If THAT also fails we genuinely can't
  // reach the backend.
  const probe = async (url: string): Promise<boolean> => {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      return res.ok;
    } catch {
      return false;
    }
  };
  if (await probe('/health')) return true;
  return probe('/v1/connectors');
}

export async function fetchEnergy(): Promise<unknown> {
  if (isTauri()) {
    try {
      return await tauriInvoke('fetch_energy', { apiUrl: getBase() });
    } catch {}
  }
  const res = await apiFetch(`/v1/telemetry/energy`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function fetchTelemetry(): Promise<unknown> {
  if (isTauri()) {
    try {
      return await tauriInvoke('fetch_telemetry', { apiUrl: getBase() });
    } catch {}
  }
  const res = await apiFetch(`/v1/telemetry/stats`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function fetchTraces(limit: number = 50): Promise<unknown> {
  if (isTauri()) {
    try {
      return await tauriInvoke('fetch_traces', { apiUrl: getBase(), limit });
    } catch {}
  }
  const res = await apiFetch(`/v1/traces?limit=${limit}`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Speech
// ---------------------------------------------------------------------------

export interface TranscriptionResult {
  text: string;
  language: string | null;
  confidence: number | null;
  duration_seconds: number;
}

export interface SpeechHealth {
  available: boolean;
  backend?: string;
  reason?: string;
}

export async function transcribeAudio(audioBlob: Blob, filename = 'recording.webm'): Promise<TranscriptionResult> {
  if (isTauri()) {
    try {
      const buffer = await audioBlob.arrayBuffer();
      return await tauriInvoke<TranscriptionResult>('transcribe_audio', {
        audioData: Array.from(new Uint8Array(buffer)),
        filename,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(msg || 'Transcription failed');
    }
  }
  const formData = new FormData();
  formData.append('file', audioBlob, filename);
  const res = await apiFetch(`/v1/speech/transcribe`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = typeof body.detail === 'string' ? body.detail : "";
    } catch {
      // Keep the status-only message below when the body is not JSON.
    }
    throw new Error(detail || `Transcription failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchSpeechHealth(): Promise<SpeechHealth> {
  if (isTauri()) {
    try {
      return await tauriInvoke<SpeechHealth>('speech_health');
    } catch {
      return { available: false };
    }
  }
  const res = await apiFetch(`/v1/speech/health`);
  if (!res.ok) return { available: false };
  return res.json();
}

// ---------------------------------------------------------------------------
// Agent Manager
// ---------------------------------------------------------------------------

export interface ManagedAgentConfig extends Record<string, unknown> {
  schedule_type?: string;
  schedule_value?: string | number;
}

export interface ManagedAgent {
  id: string;
  name: string;
  agent_type: string;
  config: ManagedAgentConfig;
  status: 'idle' | 'running' | 'paused' | 'error' | 'archived' | 'needs_attention' | 'budget_exceeded' | 'stalled';
  summary_memory: string;
  created_at: number;
  updated_at: number;
  // Runtime stats
  total_runs?: number;
  total_cost?: number;
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  last_run_at?: number | null;
  // Budget
  budget?: number;
  // Learning
  learning_enabled?: boolean;
  // Live progress
  current_activity?: string;
}

export interface AgentTask {
  id: string;
  agent_id: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  progress: Record<string, unknown>;
  findings: unknown[];
  created_at: number;
}

export interface ChannelBinding {
  id: string;
  agent_id: string;
  channel_type: string;
  config: Record<string, unknown>;
  session_id: string;
  routing_mode: string;
}

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  source: 'built-in' | 'user';
  agent_type: string;
  [key: string]: unknown;
}

export interface PersistedToolCall {
  tool: string;
  arguments: string;
  result?: string;
  success?: boolean;
  latency?: number;
}

export interface AgentMessage {
  id: string;
  agent_id: string;
  direction: 'user_to_agent' | 'agent_to_user';
  content: string;
  mode: 'immediate' | 'queued';
  status: 'pending' | 'delivered' | 'responded';
  created_at: number;
  tool_calls?: PersistedToolCall[] | null;
}

export async function fetchManagedAgents(): Promise<ManagedAgent[]> {
  const res = await apiFetch(`/v1/managed-agents`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  const data = await res.json();
  return data.agents || [];
}

export async function fetchManagedAgent(agentId: string): Promise<ManagedAgent> {
  const res = await apiFetch(`/v1/managed-agents/${agentId}`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function createManagedAgent(body: {
  name: string;
  agent_type?: string;
  template_id?: string;
  config?: Record<string, unknown>;
}): Promise<ManagedAgent> {
  const res = await apiFetch(`/v1/managed-agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function updateManagedAgent(
  agentId: string,
  body: Partial<{ name: string; agent_type: string; config: Record<string, unknown> }>,
): Promise<ManagedAgent> {
  const res = await apiFetch(`/v1/managed-agents/${agentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function deleteManagedAgent(agentId: string): Promise<void> {
  const res = await apiFetch(`/v1/managed-agents/${agentId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
}

export async function pauseManagedAgent(agentId: string): Promise<void> {
  const res = await apiFetch(`/v1/managed-agents/${agentId}/pause`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
}

export async function resumeManagedAgent(agentId: string): Promise<void> {
  const res = await apiFetch(`/v1/managed-agents/${agentId}/resume`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
}

export async function fetchAgentTasks(agentId: string): Promise<AgentTask[]> {
  const res = await apiFetch(`/v1/managed-agents/${agentId}/tasks`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  const data = await res.json();
  return data.tasks || [];
}

export async function createAgentTask(agentId: string, description: string): Promise<AgentTask> {
  const res = await apiFetch(`/v1/managed-agents/${agentId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function fetchAgentChannels(agentId: string): Promise<ChannelBinding[]> {
  const res = await apiFetch(`/v1/managed-agents/${agentId}/channels`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  const data = await res.json();
  return data.bindings || [];
}

export async function bindAgentChannel(
  agentId: string,
  channelType: string,
  config?: Record<string, unknown>,
): Promise<ChannelBinding> {
  const res = await fetch(
    `${getBase()}/v1/managed-agents/${agentId}/channels`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel_type: channelType,
        config: config || {},
        routing_mode: 'dedicated',
      }),
    },
  );
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function unbindAgentChannel(
  agentId: string,
  bindingId: string,
): Promise<void> {
  const res = await fetch(
    `${getBase()}/v1/managed-agents/${agentId}/channels/${bindingId}`,
    { method: 'DELETE' },
  );
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
}

// -- SendBlue auto-setup helpers ------------------------------------------

export async function sendblueVerify(
  apiKeyId: string,
  apiSecretKey: string,
): Promise<{ valid: boolean; numbers: string[]; raw: unknown }> {
  const res = await apiFetch(`/v1/channels/sendblue/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key_id: apiKeyId, api_secret_key: apiSecretKey }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Verification failed: ${res.status}`);
  }
  return res.json();
}

export async function sendblueRegisterWebhook(
  apiKeyId: string,
  apiSecretKey: string,
  webhookUrl: string,
): Promise<{ registered: boolean; status: number }> {
  const res = await apiFetch(`/v1/channels/sendblue/register-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key_id: apiKeyId,
      api_secret_key: apiSecretKey,
      webhook_url: webhookUrl,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Webhook registration failed: ${res.status}`);
  }
  return res.json();
}

export async function sendblueTest(
  apiKeyId: string,
  apiSecretKey: string,
  fromNumber: string,
  toNumber: string,
): Promise<{ sent: boolean; status: number }> {
  const res = await apiFetch(`/v1/channels/sendblue/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key_id: apiKeyId,
      api_secret_key: apiSecretKey,
      from_number: fromNumber,
      to_number: toNumber,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Test message failed: ${res.status}`);
  }
  return res.json();
}

export async function sendblueHealth(): Promise<{ channel_connected: boolean; bridge_wired: boolean; ready: boolean }> {
  const res = await apiFetch(`/v1/channels/sendblue/health`);
  if (!res.ok) return { channel_connected: false, bridge_wired: false, ready: false };
  return res.json();
}

export async function fetchTemplates(): Promise<AgentTemplate[]> {
  const res = await apiFetch(`/v1/templates`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  const data = await res.json();
  return data.templates || [];
}

export async function runManagedAgent(agentId: string): Promise<void> {
  const res = await apiFetch(`/v1/managed-agents/${agentId}/run`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `Failed: ${res.status}`);
  }
}

export async function recoverManagedAgent(agentId: string): Promise<{ recovered: boolean; checkpoint: unknown }> {
  const res = await apiFetch(`/v1/managed-agents/${agentId}/recover`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `Failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchAgentState(agentId: string): Promise<{
  agent: ManagedAgent;
  tasks: AgentTask[];
  channels: ChannelBinding[];
  messages: AgentMessage[];
  checkpoint: unknown;
}> {
  const res = await apiFetch(`/v1/managed-agents/${agentId}/state`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export interface AgentToolCallStart {
  tool: string;
  arguments: string;
}

export interface AgentToolCallEnd {
  tool: string;
  success: boolean;
  latency: number;
  result?: string;
}

export async function sendAgentMessage(
  agentId: string,
  content: string,
  mode: 'immediate' | 'queued' = 'queued',
  callbacks?: {
    onProgress?: (label: string) => void;
    onContentDelta?: (delta: string, fullContent: string) => void;
    onToolCallStart?: (info: AgentToolCallStart) => void;
    onToolCallEnd?: (info: AgentToolCallEnd) => void;
    onDone?: (fullContent: string, usage?: Record<string, number>, telemetry?: Record<string, unknown>) => void;
  },
): Promise<AgentMessage> {
  const res = await apiFetch(`/v1/managed-agents/${agentId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, mode, stream: true }),
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);

  // If streaming, consume the SSE response so the agent runs
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/event-stream') && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';
    let lastUsage: Record<string, number> | undefined;
    let lastTelemetry: Record<string, unknown> | undefined;
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
          if (!line.startsWith('data: ')) {
            if (line.trim() === '') currentEvent = undefined;
            continue;
          }
          const data = line.slice(6);
          if (data === '[DONE]') {
            currentEvent = undefined;
            continue;
          }
          const evName = currentEvent;
          currentEvent = undefined;

          if (evName === 'tool_call_start') {
            try {
              const parsed = JSON.parse(data);
              callbacks?.onToolCallStart?.({
                tool: parsed.tool,
                arguments: serializeToolCallArguments(parsed.arguments),
              });
            } catch {
              /* skip */
            }
            continue;
          }
          if (evName === 'tool_call_end') {
            try {
              const parsed = JSON.parse(data);
              callbacks?.onToolCallEnd?.({
                tool: parsed.tool,
                success: !!parsed.success,
                latency: typeof parsed.latency === 'number' ? parsed.latency : 0,
                result: parsed.result,
              });
            } catch {
              /* skip */
            }
            continue;
          }

          try {
            const chunk = JSON.parse(data);
            // Deep-research branch still uses tool_progress in a data chunk
            const toolProgress = chunk.choices?.[0]?.tool_progress;
            if (toolProgress) {
              callbacks?.onProgress?.(toolProgress);
            }
            const delta = chunk.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullContent += delta;
              callbacks?.onContentDelta?.(delta, fullContent);
            }
            if (chunk.usage) lastUsage = chunk.usage;
            if (chunk.telemetry) lastTelemetry = chunk.telemetry;
          } catch {
            /* skip malformed chunks */
          }
        }
      }
    } catch { /* stream ended */ }

    callbacks?.onDone?.(fullContent, lastUsage, lastTelemetry);

    return {
      id: '',
      agent_id: agentId,
      direction: 'agent_to_user',
      content: fullContent,
      mode,
      status: 'delivered',
      created_at: Date.now() / 1000,
    };
  }

  return res.json();
}

/**
 * Ask the agent a question by triggering an ad-hoc run.
 *
 * Posts the question as an `immediate`, non-streamed message — the backend
 * stores it and spawns a real agent tick (`execute_tick`) that consumes it as
 * the run's input (tools, trace, and all), rather than a raw one-shot chat.
 * Returns immediately with the stored user message; progress is observed via
 * the `/v1/agents/events` WebSocket and the resulting trace.
 */
export async function askAgent(agentId: string, content: string): Promise<AgentMessage> {
  const res = await apiFetch(`/v1/managed-agents/${agentId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, mode: 'immediate', stream: false }),
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function fetchAgentMessages(agentId: string): Promise<AgentMessage[]> {
  const res = await apiFetch(`/v1/managed-agents/${agentId}/messages`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  const data = await res.json();
  return data.messages || [];
}

export async function fetchErrorAgents(): Promise<ManagedAgent[]> {
  const res = await apiFetch(`/v1/agents/errors`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  const data = await res.json();
  return data.agents || [];
}

// ---------------------------------------------------------------------------
// Agent Learning + Traces
// ---------------------------------------------------------------------------

export interface LearningLogEntry {
  id: string;
  agent_id: string;
  event_type: string;
  description: string;
  data: Record<string, unknown>;
  created_at: number;
}

export interface AgentTrace {
  id: string;
  outcome: string;
  duration: number;
  started_at: number;
  steps: number;
  error_message?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolInfo {
  name: string;
  description: string;
  category: string;
  source: 'tool' | 'channel';
  requires_credentials: boolean;
  credential_keys: string[];
  configured: boolean;
}

export async function fetchAvailableTools(): Promise<ToolInfo[]> {
  const res = await apiFetch(`/v1/tools`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  const data = await res.json();
  return data.tools || [];
}

export async function saveToolCredentials(
  toolName: string,
  credentials: Record<string, string>,
): Promise<void> {
  const res = await apiFetch(`/v1/tools/${toolName}/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
}

export async function fetchToolCredentialStatus(
  toolName: string,
): Promise<Record<string, boolean>> {
  const res = await apiFetch(`/v1/tools/${toolName}/credentials/status`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return await res.json();
}

export async function deleteToolCredential(
  toolName: string,
  keyName: string,
): Promise<void> {
  const res = await apiFetch(
    `/v1/tools/${encodeURIComponent(toolName)}/credentials/${encodeURIComponent(keyName)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
}

export interface AgentTraceDetail {
  id: string;
  agent: string;
  outcome: string;
  duration: number;
  started_at: number;
  steps: Array<{
    step_type: string;
    input: unknown;
    output: string;
    duration: number;
    metadata: Record<string, unknown>;
  }>;
}

export async function fetchLearningLog(agentId: string): Promise<LearningLogEntry[]> {
  const res = await apiFetch(`/v1/managed-agents/${agentId}/learning`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  const data = await res.json();
  return data.learning_log || [];
}

export async function triggerLearning(agentId: string): Promise<void> {
  const res = await apiFetch(`/v1/managed-agents/${agentId}/learning/run`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
}

export async function fetchAgentTraces(agentId: string, limit = 20): Promise<AgentTrace[]> {
  const res = await apiFetch(`/v1/managed-agents/${agentId}/traces?limit=${limit}`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  const data = await res.json();
  return data.traces || [];
}

export async function fetchAgentTrace(agentId: string, traceId: string): Promise<AgentTraceDetail> {
  const res = await apiFetch(`/v1/managed-agents/${agentId}/traces/${traceId}`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Leaderboard savings submission (Supabase)
// ---------------------------------------------------------------------------

export interface SavingsSubmission {
  anon_id: string;
  display_name: string;
  email: string;
  total_calls: number;
  total_tokens: number;
  dollar_savings: number;
  energy_wh_saved: number;
  flops_saved: number;
  token_counting_version?: number;
}

export async function submitSavings(data: SavingsSubmission): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/savings_entries?on_conflict=anon_id`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(data),
      },
    );
    return res.ok || res.status === 201 || res.status === 200;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

export interface MemorySearchResult {
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface MemoryStats {
  entries: number;
  backend: string;
  [key: string]: unknown;
}

export interface MemoryConfig {
  backend: string;
  // Set by the server when the native `openjarvis_rust` extension is missing,
  // so the UI can show the real cause instead of a healthy-looking config.
  available?: boolean;
  detail?: string | null;
  context_from_memory: boolean;
  context_top_k: number;
  context_min_score: number;
  context_max_tokens: number;
}

/**
 * Extract the server's `detail` message from a failed JSON response so the UI
 * surfaces the real cause (e.g. "openjarvis_rust extension is not installed")
 * instead of a blanket fallback string (#502).
 */
async function memoryErrorDetail(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (data && typeof data.detail === 'string' && data.detail) return data.detail;
  } catch {
    // Non-JSON body — fall through to the generic message below.
  }
  return fallback;
}

export async function getMemoryStats(): Promise<MemoryStats> {
  const res = await apiFetch(`/v1/memory/stats`);
  if (!res.ok) throw new Error('Failed to fetch memory stats');
  return res.json();
}

export async function searchMemory(query: string, topK: number = 5): Promise<MemorySearchResult[]> {
  const res = await apiFetch(`/v1/memory/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, top_k: topK }),
  });
  if (!res.ok) throw new Error('Failed to search memory');
  const data = await res.json();
  return data.results;
}

export async function storeMemory(content: string, metadata?: Record<string, unknown>): Promise<void> {
  const res = await apiFetch(`/v1/memory/store`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, metadata }),
  });
  if (!res.ok) throw new Error(await memoryErrorDetail(res, 'Failed to store memory'));
}

export async function indexMemoryPath(path: string): Promise<{ chunks_indexed: number; note?: string }> {
  const res = await apiFetch(`/v1/memory/index`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error(await memoryErrorDetail(res, 'Failed to index path'));
  return res.json();
}

export async function getMemoryConfig(): Promise<MemoryConfig> {
  const res = await apiFetch(`/v1/memory/config`);
  if (!res.ok) throw new Error('Failed to fetch memory config');
  return res.json();
}

// ---------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------

export interface PendingApproval {
  id: string;
  action_type: string;
  description: string;
  payload: Record<string, unknown>;
  permission_key: string;
  tier: 'trivial' | 'low' | 'medium' | 'high';
  status: string;
  created_at: string;
  expires_at: string;
}

export async function fetchPendingApprovals(): Promise<PendingApproval[]> {
  const res = await apiFetch(`/v1/approvals/pending`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  const data = await res.json();
  return data.actions || [];
}

export async function approveAction(actionId: string): Promise<void> {
  const res = await apiFetch(`/v1/approvals/${actionId}/approve`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
}

export async function denyAction(actionId: string): Promise<void> {
  const res = await apiFetch(`/v1/approvals/${actionId}/deny`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
}

// ---------------------------------------------------------------------------
// Inference source (desktop only)
// ---------------------------------------------------------------------------

export type InferenceSource = {
  kind: 'ollama' | 'custom';
  model?: string;
  host?: string;
  engine?: string;
};

export async function getInferenceSource(): Promise<InferenceSource> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<InferenceSource>('get_inference_source');
    } catch (e: any) {
      throw new Error(e?.message ?? e ?? 'Failed to read inference source');
    }
  }
  return { kind: 'ollama' };
}

export async function setInferenceSource(
  src: InferenceSource & { apiKey?: string },
): Promise<void> {
  if (!isTauri()) throw new Error('Inference source is configurable in the desktop app only.');
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke<void>('set_inference_source', {
      kind: src.kind,
      model: src.model ?? null,
      host: src.host ?? null,
      engine: src.engine ?? null,
      apiKey: src.apiKey ?? null,
    });
  } catch (e: any) {
    // Surface the backend's actionable error strings (e.g. "A server URL is
    // required…", "Could not store the API key…") as proper Error instances.
    throw new Error(e?.message ?? e ?? 'Failed to save inference source');
  }
}

// ---------------------------------------------------------------------------
// Vision & Multimodal
// ---------------------------------------------------------------------------

export async function analyzeVisionImage(params: {
  image: string;
  prompt?: string;
  commandIntent?: string;
  task?: VisionTaskType;
  language?: string;
  allowExternalCloud?: boolean;
  privacyMode?: boolean;
  modelOverride?: string;
}): Promise<VisionAnalysisResult> {
  const res = await apiFetch(`/v1/vision/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    let errorDetail = `Vision analysis failed (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson.error) errorDetail = errJson.error;
    } catch {}
    throw new Error(errorDetail);
  }
  return res.json();
}

export async function testVisionFormats(): Promise<{
  success: boolean;
  formats: Record<string, { valid: boolean; mimeType: string }>;
}> {
  const res = await apiFetch(`/api/vision/formats/test`);
  if (!res.ok) throw new Error('Format verification test failed');
  return res.json();
}


// ---------------------------------------------------------------------------
// Speech Synthesis, Transcription & Voice Intent
// ---------------------------------------------------------------------------

export async function getVoiceStatus(): Promise<{
  stt: { provider: string; model: string; configured: boolean; features: string[] };
  tts: { provider: string; model: string; configured: boolean; fallbackOrder: string[] };
  vad: { enabled: boolean; endpointingMs: number; bargeInSupport: boolean };
}> {
  const res = await apiFetch('/api/voice/status');
  if (!res.ok) throw new Error('Failed to fetch voice status');
  return res.json();
}

export async function transcribeVoiceAudio(audioData: Blob | ArrayBuffer | string, options: { language?: string; model?: string } = {}): Promise<{
  success: boolean;
  data: {
    text: string;
    confidence: number;
    durationSeconds: number;
    languageDetected?: string;
    providerUsed: string;
    modelUsed: string;
  };
}> {
  let base64Audio = '';
  if (typeof audioData === 'string') {
    base64Audio = audioData;
  } else if (audioData instanceof Blob) {
    base64Audio = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(audioData);
    });
  } else if (audioData instanceof ArrayBuffer) {
    const bytes = new Uint8Array(audioData);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64Audio = btoa(binary);
  }

  const res = await apiFetch('/api/voice/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio: base64Audio, ...options }),
  });

  if (!res.ok) {
    let errorDetail = `Voice transcription failed (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson.error) errorDetail = errJson.error;
    } catch {}
    throw new Error(errorDetail);
  }
  return res.json();
}

export async function synthesizeSpeech(params: {
  text: string;
  voice?: string;
  language?: string;
  speed?: number;
}): Promise<{
  status: string;
  audioBase64?: string;
  mimeType?: string;
  sampleRate?: number;
  text: string;
  voice?: string;
  language?: string;
  engine?: string;
}> {
  const res = await apiFetch(`/v1/speech/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    let errorDetail = `Speech synthesis failed (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson.error) errorDetail = errJson.error;
    } catch {}
    throw new Error(errorDetail);
  }
  return res.json();
}

export async function executeVoiceAction(
  command: string,
  context?: Record<string, unknown>,
): Promise<VoiceActionResponse> {
  try {
    const res = await apiFetch(`/v1/actions/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, context }),
    });
    if (!res.ok) {
      console.warn(`Server action execution returned ${res.status}, engaging client local fallback.`);
      const local = ClientFallbackEngine.executeLocalCommand(command, context);
      return local.response;
    }
    return res.json();
  } catch (err: any) {
    console.warn(`Network/Server error during voice action execution: ${err?.message}, engaging client local fallback.`);
    const local = ClientFallbackEngine.executeLocalCommand(command, context);
    return local.response;
  }
}

export async function fetchMorningBriefing(): Promise<MorningBriefingData> {
  try {
    const res = await apiFetch(`/v1/briefing/morning`);
    if (!res.ok) {
      throw new Error(`Morning briefing failed: ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    // Robust local fallback briefing
    const now = new Date();
    const hours = now.getHours();
    const greeting = hours < 12 ? 'Bonjour' : hours < 18 ? 'Bon après-midi' : 'Bonsoir';
    return {
      greeting: `${greeting} Monsieur`,
      weather: {
        temperature: '20°C',
        condition: 'Climat local stable (Mode hors-ligne)',
        location: 'Système Autonome',
        highLow: 'Min 16°C • Max 23°C',
      },
      schedule: [
        { time: '09:00', title: 'Mode autonome opérationnel', category: 'Système' },
        { time: '14:00', title: 'Gestion locale des protocoles', category: 'Sécurité' },
      ],
      urgentReminders: [],
      systemStatus: {
        battery: 'Mode Autonome',
        powerState: 'Surveillance active',
        neuralCore: 'Moteur local On-Device prêt',
        activeConnectors: 3,
      },
      learnedHabitInsight: 'JARVIS fonctionne avec le moteur autonome local.',
      motivationalQuote: '"La persévérance est le secret de toutes les victoires." — Victor Hugo',
      spokenSummary: `${greeting} Monsieur. Tous les protocoles locaux sont opérationnels.`,
      timestamp: Date.now(),
    };
  }
}

// --- Voice Keyword Macros (Multi-Task Chains) API ---
export async function fetchKeywordMacros(): Promise<{ status: string; macros: any[]; total: number }> {
  const res = await apiFetch('/v1/keyword-macros');
  if (!res.ok) throw new Error(`Fetch keyword macros failed: ${res.status}`);
  return res.json();
}

export async function createKeywordMacro(macro: any): Promise<any> {
  const res = await apiFetch('/v1/keyword-macros', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(macro),
  });
  if (!res.ok) throw new Error(`Create keyword macro failed: ${res.status}`);
  return res.json();
}

export async function updateKeywordMacro(id: string, macro: any): Promise<any> {
  const res = await apiFetch(`/v1/keyword-macros/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(macro),
  });
  if (!res.ok) throw new Error(`Update keyword macro failed: ${res.status}`);
  return res.json();
}

export async function deleteKeywordMacro(id: string): Promise<any> {
  const res = await apiFetch(`/v1/keyword-macros/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Delete keyword macro failed: ${res.status}`);
  return res.json();
}

export async function executeKeywordMacro(id: string): Promise<{
  success: boolean;
  macroId: string;
  macroName: string;
  executedSteps: any[];
  spokenMessage: string;
}> {
  const res = await apiFetch(`/v1/keyword-macros/${id}/execute`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Execute keyword macro failed: ${res.status}`);
  return res.json();
}

// --- IF -> THEN Automations Engine API ---
export async function fetchAutomationRules(): Promise<{ status: string; rules: any[]; total: number }> {
  const res = await apiFetch('/v1/automations');
  if (!res.ok) throw new Error(`Fetch automations failed: ${res.status}`);
  return res.json();
}

export async function createAutomationRule(rule: any): Promise<any> {
  const res = await apiFetch('/v1/automations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule),
  });
  if (!res.ok) throw new Error(`Create automation failed: ${res.status}`);
  return res.json();
}

export async function updateAutomationRule(id: string, rule: any): Promise<any> {
  const res = await apiFetch(`/v1/automations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule),
  });
  if (!res.ok) throw new Error(`Update automation failed: ${res.status}`);
  return res.json();
}

export async function deleteAutomationRule(id: string): Promise<any> {
  const res = await apiFetch(`/v1/automations/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Delete automation failed: ${res.status}`);
  return res.json();
}

export async function evaluateAutomationRule(id: string): Promise<{
  success: boolean;
  ruleId: string;
  ruleName: string;
  executedActions: any[];
  spokenMessage: string;
}> {
  const res = await apiFetch(`/v1/automations/${id}/evaluate`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Evaluate automation failed: ${res.status}`);
  return res.json();
}

export async function simulateAutomationTrigger(eventType: string, eventValue?: any): Promise<{
  success: boolean;
  triggeredCount: number;
  triggeredRules: any[];
  message: string;
}> {
  const res = await apiFetch('/v1/automations/simulate-trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType, eventValue }),
  });
  if (!res.ok) throw new Error(`Simulate trigger failed: ${res.status}`);
  return res.json();
}

// --- JARVIS Proactive Intelligence API ---
export async function fetchProactiveAlerts(): Promise<{
  status: string;
  alerts: any[];
  activeCount: number;
  urgentCount: number;
}> {
  const res = await apiFetch('/v1/proactive/alerts');
  if (!res.ok) throw new Error(`Fetch proactive alerts failed: ${res.status}`);
  return res.json();
}

export async function dismissProactiveAlert(id: string): Promise<any> {
  const res = await apiFetch(`/v1/proactive/alerts/${id}/dismiss`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Dismiss proactive alert failed: ${res.status}`);
  return res.json();
}

export async function executeProactiveAlert(id: string): Promise<{
  success: boolean;
  alertId: string;
  actionPayload?: any;
  spokenMessage: string;
}> {
  const res = await apiFetch(`/v1/proactive/alerts/${id}/execute`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Execute proactive alert failed: ${res.status}`);
  return res.json();
}

export async function generateProactiveSuggestion(): Promise<{
  success: boolean;
  alert: any;
}> {
  const res = await apiFetch('/v1/proactive/generate-suggestion', {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Generate proactive suggestion failed: ${res.status}`);
  return res.json();
}

// --- Dialogue Context API ---
export async function fetchDialogueContext(): Promise<{ status: string; context: any }> {
  const res = await apiFetch('/v1/dialogue/context');
  if (!res.ok) throw new Error(`Fetch dialogue context failed: ${res.status}`);
  return res.json();
}

export async function updateDialogueContext(context: any): Promise<{ status: string; context: any }> {
  const res = await apiFetch('/v1/dialogue/context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(context),
  });
  if (!res.ok) throw new Error(`Update dialogue context failed: ${res.status}`);
  return res.json();
}

// --- 1. Learned Shortcuts & Habit Learning API ---
export async function fetchHabitPatterns(): Promise<{
  status: string;
  patterns: any[];
  shortcuts: any[];
}> {
  const res = await apiFetch('/v1/learning/patterns');
  if (!res.ok) throw new Error(`Fetch habit patterns failed: ${res.status}`);
  return res.json();
}

export async function approveHabitSuggestion(patternId: string, customName?: string, customTrigger?: string): Promise<{
  success: boolean;
  shortcut: any;
  message: string;
}> {
  const res = await apiFetch('/v1/learning/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patternId, customName, customTrigger }),
  });
  if (!res.ok) throw new Error(`Approve habit suggestion failed: ${res.status}`);
  return res.json();
}

export async function dismissHabitSuggestion(patternId: string): Promise<any> {
  const res = await apiFetch('/v1/learning/dismiss', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patternId }),
  });
  if (!res.ok) throw new Error(`Dismiss habit suggestion failed: ${res.status}`);
  return res.json();
}

export async function fetchLearnedShortcuts(): Promise<{ status: string; shortcuts: any[] }> {
  const res = await apiFetch('/v1/learning/shortcuts');
  if (!res.ok) throw new Error(`Fetch learned shortcuts failed: ${res.status}`);
  return res.json();
}

export async function saveLearnedShortcut(shortcut: any): Promise<{ status: string; shortcut: any }> {
  const res = await apiFetch('/v1/learning/shortcuts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(shortcut),
  });
  if (!res.ok) throw new Error(`Save learned shortcut failed: ${res.status}`);
  return res.json();
}

export async function deleteLearnedShortcut(id: string): Promise<any> {
  const res = await apiFetch(`/v1/learning/shortcuts/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Delete learned shortcut failed: ${res.status}`);
  return res.json();
}

// --- 2. Scheduled & Delayed Tasks API ---
export async function fetchScheduledTasks(): Promise<{ status: string; tasks: any[] }> {
  const res = await apiFetch('/v1/scheduled-tasks');
  if (!res.ok) throw new Error(`Fetch scheduled tasks failed: ${res.status}`);
  return res.json();
}

export async function createScheduledTask(task: any): Promise<{ status: string; task: any; spokenConfirmation: string }> {
  const res = await apiFetch('/v1/scheduled-tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error(`Create scheduled task failed: ${res.status}`);
  return res.json();
}

export async function updateScheduledTask(id: string, updates: any): Promise<{ status: string; task: any }> {
  const res = await apiFetch(`/v1/scheduled-tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Update scheduled task failed: ${res.status}`);
  return res.json();
}

export async function deleteScheduledTask(id: string): Promise<any> {
  const res = await apiFetch(`/v1/scheduled-tasks/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Delete scheduled task failed: ${res.status}`);
  return res.json();
}

export async function runScheduledTaskNow(id: string): Promise<{
  success: boolean;
  task: any;
  reportSummary: string;
  spokenOutput: string;
}> {
  const res = await apiFetch(`/v1/scheduled-tasks/${id}/run-now`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Run scheduled task failed: ${res.status}`);
  return res.json();
}

// --- 3. Self-Diagnostics & Auto-Healing API ---
export async function runSelfDiagnostics(): Promise<{
  status: string;
  report: any;
}> {
  const res = await apiFetch('/v1/diagnostics/run');
  if (!res.ok) throw new Error(`Run self-diagnostics failed: ${res.status}`);
  return res.json();
}

export async function executeAutoHealing(): Promise<{
  status: string;
  healedCount: number;
  report: any;
  message: string;
}> {
  const res = await apiFetch('/v1/diagnostics/auto-heal', {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Auto-healing failed: ${res.status}`);
  return res.json();
}

export async function fetchDiagnosticHistory(): Promise<{
  status: string;
  history: any[];
}> {
  const res = await apiFetch('/v1/diagnostics/history');
  if (!res.ok) throw new Error(`Fetch diagnostic history failed: ${res.status}`);
  return res.json();
}

// --- 4. Supervisor & Specialized Agents API (Phase 1) ---
export async function fetchSupervisorAgents(): Promise<{
  success: boolean;
  count: number;
  agents: Array<{
    id: string;
    name: string;
    description: string;
    permissionLevel: string;
    capabilitiesCount: number;
    capabilities: any[];
    allowedTools: string[];
  }>;
}> {
  const res = await apiFetch('/api/supervisor/agents');
  if (!res.ok) throw new Error(`Fetch supervisor agents failed: ${res.status}`);
  return res.json();
}

export async function evaluateSupervisorRoute(params: {
  query: string;
  context?: any;
  attachments?: any[];
  userPreferences?: any;
}): Promise<{
  success: boolean;
  routePlan: any;
}> {
  const res = await apiFetch('/api/supervisor/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Evaluate supervisor route failed: ${res.status}`);
  return res.json();
}

export async function executeSupervisorRequest(params: {
  query: string;
  intent?: string;
  context?: any;
  attachments?: any[];
  userPreferences?: any;
  preferredProvider?: string;
  modelOverride?: string;
  timeoutMs?: number;
}): Promise<{
  success: boolean;
  output: any;
}> {
  const res = await apiFetch('/api/supervisor/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Execute supervisor request failed: ${res.status}`);
  return res.json();
}

export async function fetchSupervisorStats(): Promise<{
  success: boolean;
  stats: any;
}> {
  const res = await apiFetch('/api/supervisor/stats');
  if (!res.ok) throw new Error(`Fetch supervisor stats failed: ${res.status}`);
  return res.json();
}

export async function fetchSupervisorLogs(): Promise<{
  success: boolean;
  count: number;
  logs: any[];
}> {
  const res = await apiFetch('/api/supervisor/logs');
  if (!res.ok) throw new Error(`Fetch supervisor logs failed: ${res.status}`);
  return res.json();
}

// --- 5. Screen Context Agent API (Phase 6) ---
export async function checkScreenPrivacy(params: {
  activePackage?: string;
  screenText?: string;
  isFlagSecure?: boolean;
}): Promise<{
  actionAllowed: boolean;
  flagSecureViolation: boolean;
  bankingAppDetected: boolean;
  passwordDetected: boolean;
  rejectionReason?: string;
  timestamp: number;
}> {
  const res = await apiFetch('/api/android/screen/privacy-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Privacy check failed: ${res.status}`);
  return res.json();
}

export async function analyzeScreenContextApi(params: {
  query: string;
  task?: 'screen_explanation' | 'screen_guidance' | 'screen_error_diagnosis';
  activePackage?: string;
  screenText?: string;
}): Promise<{
  success: boolean;
  task: string;
  reply: string;
  spokenSummary: string;
  nextSuggestions: string[];
  blocked?: boolean;
  timestamp: number;
}> {
  const res = await apiFetch('/api/android/screen/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Screen analysis failed: ${res.status}`);
  return res.json();
}

// --- 6. Personal Assistant API (Phase 11) ---
export async function fetchAssistantOverview(): Promise<{ success: boolean; overview: any }> {
  const res = await apiFetch('/api/assistant/overview');
  if (!res.ok) throw new Error(`Fetch assistant overview failed: ${res.status}`);
  return res.json();
}

export async function fetchAssistantSync(): Promise<{ success: boolean; syncStatus: any }> {
  const res = await apiFetch('/api/assistant/sync');
  if (!res.ok) throw new Error(`Fetch assistant sync failed: ${res.status}`);
  return res.json();
}

export async function setAssistantSync(mode: string, email?: string): Promise<{ success: boolean; syncStatus: any }> {
  const res = await apiFetch('/api/assistant/sync/set', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, email }),
  });
  if (!res.ok) throw new Error(`Set assistant sync failed: ${res.status}`);
  return res.json();
}

export async function fetchAssistantTasks(filter?: { completed?: boolean; category?: string }): Promise<{ success: boolean; count: number; tasks: any[] }> {
  const params = new URLSearchParams();
  if (filter?.completed !== undefined) params.append('completed', String(filter.completed));
  if (filter?.category) params.append('category', filter.category);
  const res = await apiFetch(`/api/assistant/tasks?${params.toString()}`);
  if (!res.ok) throw new Error(`Fetch assistant tasks failed: ${res.status}`);
  return res.json();
}

export async function createAssistantTask(data: {
  title: string;
  description?: string;
  dueDate?: string;
  dueTime?: string;
  priority?: string;
  category?: string;
}): Promise<{ success: boolean; task: any }> {
  const res = await apiFetch('/api/assistant/tasks/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Create assistant task failed: ${res.status}`);
  return res.json();
}

export async function toggleAssistantTask(taskId: string): Promise<{ success: boolean; task: any }> {
  const res = await apiFetch('/api/assistant/tasks/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId }),
  });
  if (!res.ok) throw new Error(`Toggle assistant task failed: ${res.status}`);
  return res.json();
}

export async function deleteAssistantTask(id: string): Promise<{ success: boolean; message: string; deletedTask?: any }> {
  const res = await apiFetch(`/api/assistant/tasks/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Delete assistant task failed: ${res.status}`);
  return res.json();
}

export async function fetchAssistantReminders(status?: string): Promise<{ success: boolean; count: number; reminders: any[] }> {
  const url = status ? `/api/assistant/reminders?status=${status}` : '/api/assistant/reminders';
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`Fetch assistant reminders failed: ${res.status}`);
  return res.json();
}

export async function createAssistantReminder(data: {
  title: string;
  timeExpression?: string;
  scheduledTime?: number;
  repeat?: string;
}): Promise<{ success: boolean; reminder: any }> {
  const res = await apiFetch('/api/assistant/reminders/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Create assistant reminder failed: ${res.status}`);
  return res.json();
}

export async function deleteAssistantReminder(id: string): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/assistant/reminders/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Delete assistant reminder failed: ${res.status}`);
  return res.json();
}

export async function fetchAssistantEvents(upcomingOnly?: boolean): Promise<{ success: boolean; count: number; events: any[] }> {
  const res = await apiFetch(`/api/assistant/events?upcomingOnly=${Boolean(upcomingOnly)}`);
  if (!res.ok) throw new Error(`Fetch assistant events failed: ${res.status}`);
  return res.json();
}

export async function createAssistantEvent(data: {
  title: string;
  description?: string;
  startTime: number;
  endTime: number;
  location?: string;
  attendees?: string[];
  calendarName?: string;
}): Promise<{ success: boolean; event: any }> {
  const res = await apiFetch('/api/assistant/events/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Create assistant event failed: ${res.status}`);
  return res.json();
}

export async function deleteAssistantEvent(id: string): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/assistant/events/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Delete assistant event failed: ${res.status}`);
  return res.json();
}

export async function fetchAssistantAlarms(): Promise<{ success: boolean; count: number; alarms: any[] }> {
  const res = await apiFetch('/api/assistant/alarms');
  if (!res.ok) throw new Error(`Fetch assistant alarms failed: ${res.status}`);
  return res.json();
}

export async function setAssistantAlarm(data: {
  hour: number;
  minute: number;
  label?: string;
  daysOfWeek?: number[];
  vibrate?: boolean;
}): Promise<{ success: boolean; alarm: any }> {
  const res = await apiFetch('/api/assistant/alarms/set', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Set assistant alarm failed: ${res.status}`);
  return res.json();
}

export async function toggleAssistantAlarm(alarmId: string): Promise<{ success: boolean; alarm: any }> {
  const res = await apiFetch('/api/assistant/alarms/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alarmId }),
  });
  if (!res.ok) throw new Error(`Toggle assistant alarm failed: ${res.status}`);
  return res.json();
}

export async function deleteAssistantAlarm(id: string): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/assistant/alarms/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Delete assistant alarm failed: ${res.status}`);
  return res.json();
}

export async function fetchAssistantNotes(query?: string): Promise<{ success: boolean; count: number; notes: any[] }> {
  const url = query ? `/api/assistant/notes?q=${encodeURIComponent(query)}` : '/api/assistant/notes';
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`Fetch assistant notes failed: ${res.status}`);
  return res.json();
}

export async function createAssistantNote(data: {
  title?: string;
  content: string;
  tags?: string[];
  pinned?: boolean;
  color?: string;
}): Promise<{ success: boolean; note: any }> {
  const res = await apiFetch('/api/assistant/notes/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Create assistant note failed: ${res.status}`);
  return res.json();
}

export async function deleteAssistantNote(id: string): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/assistant/notes/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Delete assistant note failed: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// JARVIS Smart Routines API (Phase 12)
// ---------------------------------------------------------------------------

export async function fetchSmartRoutines(): Promise<{
  success: boolean;
  count: number;
  routines: any[];
  schedulerStatus: any;
}> {
  const res = await apiFetch('/api/routines');
  if (!res.ok) throw new Error(`Fetch routines failed: ${res.status}`);
  return res.json();
}

export async function fetchRoutineSchedulerStatus(): Promise<{
  success: boolean;
  schedulerStatus: any;
  registeredJobs: any[];
}> {
  const res = await apiFetch('/api/routines/scheduler-status');
  if (!res.ok) throw new Error(`Fetch scheduler status failed: ${res.status}`);
  return res.json();
}

export async function fetchRoutineHistory(): Promise<{
  success: boolean;
  count: number;
  history: any[];
}> {
  const res = await apiFetch('/api/routines/history');
  if (!res.ok) throw new Error(`Fetch routine history failed: ${res.status}`);
  return res.json();
}

export async function createSmartRoutine(data: {
  name: string;
  description: string;
  icon?: string;
  color?: string;
  triggers?: any[];
  actions?: any[];
  executionPolicy?: any;
}): Promise<{ success: boolean; routine: any }> {
  const res = await apiFetch('/api/routines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Create routine failed: ${res.status}`);
  return res.json();
}

export async function updateSmartRoutine(
  id: string,
  updates: Record<string, any>
): Promise<{ success: boolean; routine: any }> {
  const res = await apiFetch(`/api/routines/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Update routine failed: ${res.status}`);
  return res.json();
}

export async function deleteSmartRoutine(id: string): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/routines/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Delete routine failed: ${res.status}`);
  return res.json();
}

export async function executeSmartRoutine(
  id: string,
  triggerSource?: string,
  confirmationTokens?: Record<string, string>
): Promise<{ success: boolean; report: any }> {
  const res = await apiFetch(`/api/routines/${id}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ triggerSource: triggerSource || 'manual_ui', confirmationTokens }),
  });
  if (!res.ok) throw new Error(`Execute routine failed: ${res.status}`);
  return res.json();
}

export async function toggleSmartRoutine(id: string): Promise<{ success: boolean; enabled: boolean }> {
  const res = await apiFetch(`/api/routines/${id}/toggle`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Toggle routine failed: ${res.status}`);
  return res.json();
}

export async function confirmRoutineSensitiveAction(
  token: string
): Promise<{ success: boolean; message: string; tokenData?: any }> {
  const res = await apiFetch('/api/routines/confirm-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error(`Confirm sensitive action failed: ${res.status}`);
  return res.json();
}

export async function testRoutineTrigger(payload: Record<string, any>): Promise<any> {
  const res = await apiFetch('/api/routines/test-trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Test routine trigger failed: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// 🌦️ Real Weather Engine API (Phase 3)
// ---------------------------------------------------------------------------

export async function fetchWeatherStatus(): Promise<{ success: boolean; status: any }> {
  const res = await apiFetch('/api/weather/status');
  if (!res.ok) throw new Error(`Fetch weather status failed: ${res.status}`);
  return res.json();
}

export async function fetchCurrentWeather(params?: { city?: string; lat?: number; lon?: number }): Promise<{ success: boolean; weather: any }> {
  const query = new URLSearchParams();
  if (params?.city) query.set('city', params.city);
  if (params?.lat !== undefined) query.set('lat', params.lat.toString());
  if (params?.lon !== undefined) query.set('lon', params.lon.toString());
  const queryString = query.toString() ? `?${query.toString()}` : '';
  const res = await apiFetch(`/api/weather/current${queryString}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Je ne peux pas récupérer les données météo actuellement.' }));
    throw new Error(errorData.error || 'Je ne peux pas récupérer les données météo actuellement.');
  }
  return res.json();
}

export async function fetchWeatherForecast(params?: { city?: string; lat?: number; lon?: number }): Promise<{ success: boolean; weather: any }> {
  const query = new URLSearchParams();
  if (params?.city) query.set('city', params.city);
  if (params?.lat !== undefined) query.set('lat', params.lat.toString());
  if (params?.lon !== undefined) query.set('lon', params.lon.toString());
  const queryString = query.toString() ? `?${query.toString()}` : '';
  const res = await apiFetch(`/api/weather/forecast${queryString}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Je ne peux pas récupérer les données météo actuellement.' }));
    throw new Error(errorData.error || 'Je ne peux pas récupérer les données météo actuellement.');
  }
  return res.json();
}

export async function fetchFullWeatherReport(params?: { city?: string; lat?: number; lon?: number }): Promise<{ success: boolean; report: any }> {
  const query = new URLSearchParams();
  if (params?.city) query.set('city', params.city);
  if (params?.lat !== undefined) query.set('lat', params.lat.toString());
  if (params?.lon !== undefined) query.set('lon', params.lon.toString());
  const queryString = query.toString() ? `?${query.toString()}` : '';
  const res = await apiFetch(`/api/weather/report${queryString}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Je ne peux pas récupérer les données météo actuellement.' }));
    throw new Error(errorData.error || 'Je ne peux pas récupérer les données météo actuellement.');
  }
  return res.json();
}

export async function clearWeatherCache(): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch('/api/weather/cache/clear', {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Clear weather cache failed: ${res.status}`);
  return res.json();
}






