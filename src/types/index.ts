// --- SSE Event Types ---

export interface SSEEvent {
  event?: string;
  data: string;
}

export interface AgentTurnStartEvent {
  agent: string;
  input: string;
}

export interface InferenceStartEvent {
  model: string;
  engine: string;
  turn: number;
}

export interface InferenceEndEvent {
  model: string;
  engine: string;
  turn: number;
}

export interface ToolCallStartEvent {
  tool: string;
  arguments: string;
}

export interface ToolCallEndEvent {
  tool: string;
  success: boolean;
  latency: number;
}

// --- Chat Types ---

export interface ToolCallInfo {
  id: string;
  tool: string;
  arguments: string;
  status: 'running' | 'success' | 'error';
  result?: string;
  latency?: number;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface MessageTelemetry {
  engine?: string;
  model_id?: string;
  tokens_per_sec?: number;
  ttft_ms?: number;
  total_ms?: number;
  complexity_score?: number;
  complexity_tier?: string;
  suggested_max_tokens?: number;
}

export interface TimeRange {
  start?: string;
  end?: string;
}

export interface ResearchSource {
  ref: number;
  title?: string;
  sender?: string;
  date?: string;
  url?: string;
}

export interface ResearchSearchTrace {
  id: string;
  query: string;
  person?: string;
  timeRange?: TimeRange | string;
  status: 'pending' | 'complete';
  numHits?: number;
  topTitles?: string[];
}

export type ResearchEvent =
  | {
      type: 'search_call';
      arguments: {
        query: string;
        person?: string;
        time_range?: TimeRange | string;
      };
    }
  | {
      type: 'search_result';
      num_hits: number;
      top_titles?: string[];
      sources?: ResearchSource[];
    }
  | { type: 'synthesis'; text: string }
  | {
      type: 'system_metrics';
      power_w: number;
      energy_j: number;
      duration_s: number;
    }
  | { type: 'done'; usage?: TokenUsage }
  | { type: 'error'; message: string };

export interface LiveEnergyMetrics {
  power_w: number;
  energy_j: number;
  duration_s: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolCalls?: ToolCallInfo[];
  researchTraces?: ResearchSearchTrace[];
  researchSources?: ResearchSource[];
  isResearch?: boolean;
  usage?: TokenUsage;
  telemetry?: MessageTelemetry;
  audio?: { url: string };
  images?: string[];
  vocalSummary?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  messages: ChatMessage[];
}

export interface ConversationStore {
  version: 1;
  conversations: Record<string, Conversation>;
  activeId: string | null;
}

// --- Stream State ---

export interface StreamState {
  conversationId: string | null;
  isStreaming: boolean;
  phase: string;
  elapsedMs: number;
  activeToolCalls: ToolCallInfo[];
  content: string;
}

// --- API Types ---

export interface ModelInfo {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  name?: string;
  owner?: string;
  context_length?: number;
  quantization?: string;
}

export interface ProviderSavings {
  provider: string;
  label: string;
  input_cost: number;
  output_cost: number;
  total_cost: number;
  energy_wh: number;
  energy_joules: number;
  flops: number;
}

export interface SavingsData {
  total_calls: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  local_cost: number;
  per_provider: ProviderSavings[];
  total_cost_saved?: number;
  token_counting_version?: number;
}

export interface ServerInfo {
  model: string;
  agent: string | null;
  engine: string;
  active_agents?: number;
  version?: string;
  platform?: string;
  default_engine?: string;
  uptime?: number;
}

// --- Log Types ---

export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  category: 'server' | 'model' | 'chat' | 'tool';
  message: string;
}

// --- Voice & Vision Types ---

export type VisionTaskType =
  | 'photo'
  | 'screenshot'
  | 'document'
  | 'ocr'
  | 'error_diagnosis'
  | 'ui_guidance'
  | 'general'
  | 'objects';

export interface VisionAnalysisResult {
  status: 'success' | 'error';
  task: VisionTaskType;
  analysis: string;
  vocalSummary: string;
  timestamp: number;
  engine?: string;
  ocrText?: string;
  confidence?: number;
  detectedObjects?: string[];
  errorDiagnosis?: {
    errorMessage?: string;
    probableCause?: string;
    suggestedFix?: string;
  };
  uiGuidance?: {
    screenTitle?: string;
    recommendedAction?: string;
  };
  privacyStatus?: {
    sanitized: boolean;
    exifStripped: boolean;
    sensitiveDataRedacted: boolean;
    providerUsed: string;
    localOnly: boolean;
  };
  error?: string;
}

export type VoicePersona =
  | 'classic_jarvis'
  | 'iron_tactical'
  | 'cyber_friday'
  | 'sleek_assistant'
  | 'french_elegance';

export interface MorningBriefingData {
  greeting: string;
  weather: {
    temperature: string;
    condition: string;
    location: string;
    highLow: string;
  };
  schedule: Array<{
    time: string;
    title: string;
    category: string;
  }>;
  urgentReminders: ScheduledReminder[];
  systemStatus: {
    battery: string;
    powerState: string;
    neuralCore: string;
    activeConnectors: number;
  };
  learnedHabitInsight?: string;
  motivationalQuote: string;
  spokenSummary: string;
  timestamp: number;
}

export interface VoiceSettings {
  speechEnabled: boolean;
  ttsEnabled: boolean;
  ttsProvider?: 'gemini' | 'browser';
  voicePersona: VoicePersona;
  voiceLanguage: string;
  voiceRate: number;
  voicePitch: number;
  voiceVolume: number;
  voiceURI?: string;
  wakeWordEnabled: boolean;
  wakeWord: string;
  wakeWordSensitivity?: number;
  autoVocalize: boolean;
  vadEnabled: boolean;
  vadSensitivity: number; // 0.1 to 1.0
  continuousListening: boolean;
  soundEffectsEnabled: boolean;
}

export interface VoiceActionResponse {
  status: 'success' | 'handled' | 'error';
  command: string;
  intent: string;
  message: string;
  routedAgent?: string;
  payload?: Record<string, unknown>;
  timestamp: number;
}

// --- Android Deep Integration Types (Phase 8 & Permission Center) ---

export type AndroidPermissionType =
  | 'microphone'
  | 'camera'
  | 'notifications'
  | 'notification_listener'
  | 'contacts'
  | 'calendar'
  | 'phone'
  | 'sms'
  | 'geolocation'
  | 'bluetooth'
  | 'storage'
  | 'overlay'
  | 'accessibility'
  | 'screen_capture'
  | 'assistant'
  | 'device_admin'
  | 'vibration';

export type AndroidPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported';

export type AndroidCapabilityState =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'REQUIRES_PERMISSION'
  | 'REQUIRES_SPECIAL_ACCESS'
  | 'UNAVAILABLE';

export type AndroidCapabilityKey =
  | 'microphone'
  | 'camera'
  | 'contacts'
  | 'phone'
  | 'sms'
  | 'calendar'
  | 'location'
  | 'notifications'
  | 'notification_listener'
  | 'accessibility'
  | 'overlay'
  | 'media_projection'
  | 'voice_assistant'
  | 'bluetooth'
  | 'network'
  | 'storage';

export interface AndroidCapabilityInfo {
  id: AndroidCapabilityKey;
  name: string;
  category: 'hardware' | 'privacy' | 'system_service' | 'communication' | 'storage_network';
  state: AndroidCapabilityState;
  description: string;
  technicalDetails: string;
  requiredPermissions: string[];
  isSpecialAccess: boolean;
  targetApiLevel: number;
  modernApiNotes: string;
  configureIntent: string;
  iconName: string;
  isRealCheck: boolean;
  hardwareAvailable: boolean;
  canExecute: boolean;
  lastVerifiedAt: number;
}

export interface AndroidDeviceCapabilitiesReport {
  timestamp: number;
  osVersion: string;
  sdkInt: number;
  deviceModel: string;
  isAndroid: boolean;
  battery: { level: number; charging: boolean };
  network: { type: string; online: boolean; effectiveType?: string };
  overallHealth: 'optimal' | 'warning' | 'restricted';
  activeCount: number;
  inactiveCount: number;
  requiresPermissionCount: number;
  requiresSpecialAccessCount: number;
  unavailableCount: number;
  totalCapabilities: number;
  capabilities: Record<AndroidCapabilityKey, AndroidCapabilityInfo>;
}

export interface AndroidPermissionAuditRecord {
  id: AndroidPermissionType;
  name: string;
  category: 'core' | 'privacy' | 'system' | 'device_admin';
  categoryLabel: string;
  kind: 'runtime' | 'special_access' | 'service_binding' | 'device_admin_policy';
  kindLabel: string;
  declaredManifest: boolean;
  targetApiMin: number;
  isGranted: boolean;
  status: AndroidPermissionStatus;
  whyNeeded: string;
  officialIntentAction?: string | null;
  settingsResolutionPath: string;
  iconName: string;
  isCritical: boolean;
}

export interface AndroidPermissionDetail {
  id: AndroidPermissionType;
  title: string;
  description: string;
  rationale: string;
  iconName: string;
  status: AndroidPermissionStatus;
  isCritical: boolean;
}

export interface SystemUpdateInfo {
  isUpdateAvailable: boolean;
  currentOsVersion: string;
  currentSecurityPatch: string;
  latestVersionAvailable: string;
  downloadSizeMb?: number;
  changelog?: string;
  status: 'up_to_date' | 'download_ready' | 'installing' | 'reboot_required';
}

export interface ScreenVisionContext {
  activeAppPackage: string;
  activeAppTitle: string;
  extractedScreenText: string;
  detectedUIElements: string[];
  screenshotBase64?: string;
  timestamp: number;
}

export interface AndroidAppIntent {
  id: string;
  name: string;
  packageName?: string;
  urlScheme?: string;
  webFallbackUrl?: string;
  iconName: string;
  category: 'communication' | 'media' | 'productivity' | 'navigation' | 'system';
  description: string;
  keywords: string[];
}

export interface AndroidActionConfirmation {
  id: string;
  actionType: 'delete_file' | 'clear_memory' | 'send_message' | 'system_action' | 'dismiss_reminder' | 'factory_reset' | 'system_update' | 'phone_call';
  title: string;
  prompt: string;
  targetDescription: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  confirmed?: boolean;
  payload?: Record<string, unknown>;
}

export interface ScheduledReminder {
  id: string;
  title: string;
  time: string;
  createdAt: number;
  status: 'scheduled' | 'triggered' | 'dismissed';
  recurrence?: 'once' | 'daily' | 'weekly';
  priority?: 'normal' | 'high';
}

// --- 1. Smart Routines & Automations ---

export type RoutineTriggerType = 'voice' | 'time' | 'battery' | 'location';

export type RoutineActionType =
  | 'toggle_dnd'
  | 'smart_home'
  | 'spotify'
  | 'volume'
  | 'flashlight'
  | 'notification'
  | 'voice_briefing'
  | 'screen_brightness'
  | 'custom_prompt';

export interface RoutineAction {
  id: string;
  type: RoutineActionType;
  label: string;
  params: Record<string, any>;
}

export interface JarvisRoutine {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  triggerType: RoutineTriggerType;
  triggerValue: string; // e.g. "Mode Travail", "07:30", "battery_low", "Maison"
  isEnabled: boolean;
  lastTriggeredAt?: number;
  actions: RoutineAction[];
}

// --- 2. Smart Home & Connected Devices ---

export type SmartDeviceType = 'light' | 'thermostat' | 'plug' | 'ac' | 'lock' | 'curtains' | 'speaker';
export type SmartRoom = 'Salon' | 'Bureau' | 'Chambre' | 'Cuisine' | 'Extérieur' | 'Entrée';

export interface SmartHomeDevice {
  id: string;
  name: string;
  room: SmartRoom;
  type: SmartDeviceType;
  state: boolean;
  value?: number; // Brightness % (0-100), Temp in °C (16-30), etc.
  color?: string; // Hex color for RGB lights
  isOnline: boolean;
  protocol: 'Matter' | 'Zigbee' | 'Home Assistant' | 'Philips Hue' | 'MQTT';
}

// --- 3. Knowledge Graph & Episodic Memory ---

export type GraphNodeType = 'user' | 'preference' | 'habit' | 'project' | 'contact' | 'device' | 'fact' | 'location' | 'concept';

export interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  importance?: number;
  properties?: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  weight?: number;
}

export type KnowledgeGraphNode = GraphNode;
export type KnowledgeGraphEdge = GraphEdge;

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// --- 4. Web Browsing & Live Grounding ---

export interface WebSearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source?: string;
  publishedDate?: string;
}

export interface WebBrowsingResult {
  url: string;
  title: string;
  content: string;
  keyPoints: string[];
  vocalSummary: string;
  timestamp: number;
}

// --- 5. Voice Keyword Macros (Multi-Action Trigger Keywords) ---

export type MacroActionType =
  | 'battery_saver'
  | 'bluetooth'
  | 'connect_device'
  | 'wifi'
  | 'open_app'
  | 'spotify_play'
  | 'smart_home'
  | 'volume'
  | 'dnd'
  | 'screen_brightness'
  | 'tts_speak'
  | 'flashlight';

export interface VoiceKeywordMacroAction {
  id: string;
  type: MacroActionType;
  label: string;
  params: Record<string, any>;
}

export interface VoiceKeywordMacro {
  id: string;
  keyword: string; // e.g. "mode nuit blanche"
  aliases: string[]; // e.g. ["nuit blanche", "active la nuit blanche"]
  name: string;
  description: string;
  color: string;
  icon: string;
  isEnabled: boolean;
  actions: VoiceKeywordMacroAction[];
  lastExecutedAt?: number;
}

// --- 6. IF -> THEN Automation Rules ---

export type AutomationTriggerType =
  | 'time'
  | 'battery_level'
  | 'battery_charging'
  | 'location'
  | 'wifi_ssid'
  | 'bluetooth_connected';

export interface AutomationCondition {
  id?: string;
  type: string;
  operator: string;
  value: string | number | boolean;
  label?: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  color?: string;
  icon?: string;
  isEnabled: boolean;
  condition?: AutomationCondition;
  trigger?: AutomationCondition;
  actions: any[];
  lastEvaluatedAt?: number;
  lastTriggeredAt?: number;
  executionCount?: number;
}

// --- 7. JARVIS Proactif & Contextual Alerts ---

export type ProactiveCategory =
  | 'calendar_departure'
  | 'calendar_traffic'
  | 'battery_health'
  | 'battery'
  | 'productivity_goal'
  | 'weather'
  | 'wellbeing'
  | 'health'
  | 'home_security';

export interface ProactiveAlert {
  id: string;
  category?: ProactiveCategory;
  type?: string;
  icon?: string;
  title: string;
  message: string;
  spokenText?: string;
  priority: 'urgent' | 'important' | 'medium' | 'info' | 'suggestion';
  actionLabel?: string;
  actionPayload?: { type: string; params?: Record<string, any> };
  timestamp: number;
  dismissed?: boolean;
  isDismissed?: boolean;
  autoSpoken?: boolean;
}

export interface DialogueContext {
  lastApp?: string | null;
  lastMedia?: string | null;
  lastTopic?: string | null;
  lastAction?: string | null;
  history?: Array<{ role: 'user' | 'assistant'; text: string; timestamp?: number }>;
  recentTurns?: Array<{ role: 'user' | 'assistant'; text: string; timestamp?: number }>;
}

// --- 8. Apprentissage des Raccourcis & Habitudes ---
export interface HabitPattern {
  id: string;
  normalizedCommand: string;
  originalPhrases: string[];
  count: number;
  lastUsed: number;
  suggestedShortcutName: string;
  suggestedVoiceTrigger: string;
  actions: Array<{ type: string; label: string; params: Record<string, any> }>;
  status: 'detecting' | 'suggested' | 'approved' | 'dismissed';
  suggestedAt?: number;
}

export interface LearnedShortcut {
  id: string;
  name: string;
  trigger: string;
  aliases: string[];
  description: string;
  actions: Array<{ type: string; label: string; params: Record<string, any> }>;
  isEnabled: boolean;
  frequency: number;
  lastExecuted?: number;
  confidenceScore: number; // 0 to 1
  createdAt: number;
}

// --- 9. Tâches Différées & Superviseur Planifié ---
export type ScheduledTaskType = 'delayed_once' | 'recurring_interval' | 'recurring_weekly' | 'recurring_daily';

export interface ScheduledTask {
  id: string;
  title: string;
  rawVoicePrompt: string;
  taskType: ScheduledTaskType;
  executeAt?: number; // timestamp for one-time delayed tasks
  delayMinutes?: number;
  recurrence?: {
    daysOfWeek?: number[]; // 0=Sunday, 1=Monday, etc.
    timeOfDay?: string; // "08:00"
    intervalMinutes?: number;
  };
  actionType: 'reminder' | 'project_audit' | 'system_report' | 'device_action' | 'custom_agent';
  actionPayload: Record<string, any>;
  status: 'pending' | 'completed' | 'recurring' | 'failed' | 'paused';
  createdAt: number;
  lastRunAt?: number;
  nextRunAt?: number;
  lastReportSummary?: string;
  spokenOutput: string;
}

// --- 10. Auto-Diagnostic & Auto-Guérison Système ---
export type SubsystemStatus = 'operational' | 'degraded' | 'error' | 'healing';

export interface DiagnosticSubsystem {
  id: string;
  name: string;
  category: 'core' | 'ai' | 'voice' | 'hardware' | 'storage' | 'network' | 'services';
  status: SubsystemStatus;
  latencyMs?: number;
  message: string;
  lastChecked: number;
  details?: Record<string, any>;
  autoFixable: boolean;
  autoFixAction?: string;
}

export interface DiagnosticReport {
  id: string;
  timestamp: number;
  overallHealth: 'optimal' | 'warning' | 'critical';
  operationalCount: number;
  warningCount: number;
  criticalCount: number;
  totalSubsystems: number;
  subsystems: DiagnosticSubsystem[];
  spokenSummary: string;
  healingHistory?: Array<{
    timestamp: number;
    subsystemId: string;
    actionTaken: string;
    success: boolean;
  }>;
}

// --- 11. Communication Assistant & Notification Listener ---
export type CommunicationSourceType = 'whatsapp' | 'sms' | 'telegram' | 'messenger' | 'signal' | 'generic' | 'other';

export type MessageCategory = 'urgent' | 'important' | 'to_reply' | 'info' | 'other';

export interface IncomingMessage {
  id: string;
  source: CommunicationSourceType;
  packageName: string;
  appName: string;
  sender: string;
  title: string;
  content: string;
  timestamp: number;
  conversationId?: string;
  notificationKey?: string;
  notificationId?: number;
  replyAvailable: boolean;
  replyActionIndex?: number;
  category: MessageCategory;
  isGroup?: boolean;
  groupTitle?: string;
  isRead: boolean;
  isSpoken: boolean;
  isProtected: boolean;
  suggestedReply?: string;
  repliedAt?: number;
  sentReplyText?: string;
  isMemorized?: boolean;
  metadata?: Record<string, any>;
}

export interface AutoReplyRule {
  id: string;
  contact: string;
  source: CommunicationSourceType | 'all';
  conditionText: string;
  replyTemplate: string;
  isEnabled: boolean;
  safetyGuard: boolean;
}

export interface CommunicationSettings {
  listenerEnabled: boolean;
  autoRead: boolean;
  readOnlyImportant: boolean;
  readOnlyVip: boolean;
  silentMode: boolean;
  confirmBeforeSend: boolean;
  autoReplyEnabled: boolean;
  privateMode: boolean;
  enabledSources: Record<string, boolean>;
  protectedContacts: string[];
  protectedApps: string[];
  autoReplyRules: AutoReplyRule[];
}

export interface CommunicationSummary {
  totalCount: number;
  bySource: Record<string, { count: number; senders: string[] }>;
  urgentCount: number;
  toReplyCount: number;
  importantCount: number;
  messagesToReply: IncomingMessage[];
  spokenSummary: string;
  timestamp: number;
}

// --- 12. Voice Agent & State Machine Architecture (Phase 2 & Étape 3) ---
export type VoiceAgentState =
  | 'IDLE'
  | 'LISTENING_FOR_WAKE_WORD'
  | 'WAKE_WORD_DETECTED'
  | 'LISTENING_COMMAND'
  | 'LISTENING'
  | 'PROCESSING'
  | 'EXECUTING'
  | 'SPEAKING'
  | 'STOPPED'
  | 'ERROR';

export type JarvisVoiceState =
  | VoiceAgentState
  | 'idle'
  | 'listening_for_wake_word'
  | 'wake_word_detected'
  | 'listening_command'
  | 'listening'
  | 'processing'
  | 'executing'
  | 'speaking'
  | 'stopped'
  | 'error';

export interface VoiceAgentConfig {
  wakeWord: string;
  wakeWordEnabled: boolean;
  microphonePermission: boolean;
  autoListening: boolean;
  voiceResponseEnabled: boolean;
  interruptionEnabled: boolean;
  silenceTimeoutSeconds: number;
  noiseSuppressionEnabled: boolean;
  vadSensitivity: number;
  voiceLanguage: string;
  voicePersona: VoicePersona;
  ttsProvider: 'deepgram' | 'gemini' | 'browser';
}

export interface VoiceAgentTelemetry {
  sttProvider: string;
  ttsProvider: string;
  state: VoiceAgentState;
  wakeWordTriggered: boolean;
  lastTranscript?: string;
  confidence?: number;
  routedAgent?: string;
  executionLatencyMs?: number;
  bargeInTriggered?: boolean;
}




