/**
 * JARVIS SPECIALIZED AGENT PROTOCOL & CORE INTERFACES (PHASE 1)
 * 
 * Standardized contract implemented by all specialized agents in the JARVIS ecosystem.
 * Defines inputs, outputs, capabilities, permission boundaries, and error handling.
 */

import { AIProviderId } from '../ai-router.js';

export type AgentId =
  | 'supervisor'
  | 'voice'
  | 'vision'
  | 'screen'
  | 'android'
  | 'accessibility'
  | 'notification'
  | 'communication'
  | 'research'
  | 'coding'
  | 'phone'
  | 'calendar'
  | 'task'
  | 'reminder'
  | 'notes'
  | 'routine'
  | 'media'
  | 'security'
  | 'memory'
  | 'weather'
  | 'general_ai';

export type AgentPermissionLevel = 'public' | 'user' | 'sensitive' | 'admin' | 'root';

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  tags: string[];
  requiredPermissions: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  requiredPermission?: string;
  isSensitive?: boolean;
}

export interface AgentAttachment {
  type: 'image' | 'audio' | 'file' | 'code';
  mimeType?: string;
  data: string; // Base64 or URI or text
  name?: string;
}

export interface AgentDeviceState {
  battery?: number;
  charging?: boolean;
  network?: 'wifi' | 'cellular' | 'offline' | 'unknown';
  screenOn?: boolean;
  currentApp?: string;
  volumeLevel?: number;
  ringerMode?: 'normal' | 'vibrate' | 'silent';
  bluetoothConnected?: boolean;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
}

export interface AgentInput {
  id: string;
  query: string;
  intent?: string;
  userId?: string;
  sessionId?: string;
  conversationId?: string;
  context?: {
    history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    attachments?: AgentAttachment[];
    deviceState?: AgentDeviceState;
    permissionsGranted?: string[];
    parameters?: Record<string, any>;
    callerAgent?: AgentId;
    confirmationToken?: string;
  };
  userPreferences?: {
    language?: string;
    persona?: string;
    conciseMode?: boolean;
    autoSpeak?: boolean;
    privacyMode?: boolean;
  };
  preferredProvider?: AIProviderId;
  modelOverride?: string;
  timeoutMs?: number;
  stream?: boolean;
  onChunk?: (chunk: string) => void;
}

export interface AgentActionExecuted {
  tool: string;
  arguments: Record<string, any>;
  result: any;
  latencyMs: number;
  success: boolean;
  error?: string;
}

export interface AgentTelemetry {
  providerUsed: AIProviderId | string;
  modelUsed: string;
  fallbackOccurred: boolean;
  providerChainAttempted: string[];
  executionTimeMs: number;
  routingScore?: number;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface AgentErrorPayload {
  code: string;
  message: string;
  recoverable: boolean;
  suggestedAction?: string;
  details?: Record<string, any>;
}

export interface AgentOutput {
  id: string;
  agentId: AgentId;
  agentName: string;
  success: boolean;
  reply: string;
  spokenSummary?: string;
  actionTaken?: boolean;
  actionsExecuted?: AgentActionExecuted[];
  telemetry: AgentTelemetry;
  nextSuggestions?: string[];
  structuredData?: Record<string, any>;
  error?: AgentErrorPayload;
  delegatedTo?: AgentId[];
}

export interface AgentRoutingEvaluation {
  agentId: AgentId;
  score: number; // 0.0 to 1.0
  confidence: number; // 0.0 to 1.0
  reason: string;
  matchedCapabilities: string[];
  requiredPermissions: string[];
  isPermissionMet: boolean;
}

export interface SupervisorRoutePlan {
  primaryAgent: AgentId;
  confidence: number;
  reasoning: string;
  intent: string;
  candidates: AgentRoutingEvaluation[];
  isMultiStep: boolean;
  executionPlan?: Array<{
    step: number;
    agentId: AgentId;
    purpose: string;
    passContextFromStep?: number;
  }>;
}

/**
 * Standard Contract implemented by all Specialized Agents
 */
export interface SpecializedAgent {
  readonly id: AgentId;
  readonly name: string;
  readonly description: string;
  readonly capabilities: AgentCapability[];
  readonly allowedTools: AgentToolDefinition[];
  readonly permissionLevel: AgentPermissionLevel;
  readonly defaultProvider?: AIProviderId;

  /**
   * Evaluates if this agent is suitable to handle the provided input
   */
  canHandle(input: AgentInput): Promise<AgentRoutingEvaluation> | AgentRoutingEvaluation;

  /**
   * Executes the agent logic with given input
   */
  execute(input: AgentInput): Promise<AgentOutput>;

  /**
   * Gracefully handles and formats any internal failure
   */
  handleError(error: Error | any, input: AgentInput, startTime: number): AgentOutput;
}
