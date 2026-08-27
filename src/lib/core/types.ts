/**
 * JARVIS CORE ARCHITECTURE — TYPES & SPECIFICATIONS (ÉTAPE 1)
 * 
 * Modular engine interfaces and contracts for:
 * 1. JarvisCore (Central Coordinator)
 * 2. VoiceEngine (STT, TTS, VAD, Barge-in)
 * 3. AIEngine (Multi-LLM Router, Streaming, Agents)
 * 4. WakeWordEngine (Acoustic keyword detection "Hey JARVIS")
 * 5. HologramEngine (Futuristic HUD, 3D/Vector Hologram, Reactive Telemetry)
 * 6. OverlayEngine (Out-of-app Floating HUD, SYSTEM_ALERT_WINDOW)
 * 7. AndroidControlEngine (Hardware toggles, App launching, Accessibility)
 * 8. PermissionManager (Unified Android & Agent Security Auditing)
 * 9. NotificationEngine (NotificationListener, Categorization, Summarization)
 * 10. AudioVisualizer (FFT Frequency & Waveform Math, Equalizer normalization)
 * 11. ActionManager (Composite action execution, Sensitive confirmation gating)
 */

export type JarvisSystemState = 'uninitialized' | 'initializing' | 'idle' | 'listening' | 'thinking' | 'speaking' | 'executing' | 'error';

export type JarvisWakeWordState =
  | 'IDLE'
  | 'LISTENING_FOR_WAKE_WORD'
  | 'WAKE_WORD_DETECTED'
  | 'LISTENING_COMMAND'
  | 'PROCESSING'
  | 'SPEAKING'
  | 'STOPPED';

export interface JarvisCoreConfig {
  voiceActivationEnabled: boolean;
  wakeWordSensitivity: number; // 0.0 to 1.0
  preferredAIProvider: 'groq' | 'gemini' | 'anthropic' | 'openrouter' | 'openai' | 'local' | 'auto';
  hudTheme: 'cyan_prime' | 'stealth_amber' | 'arc_reactor_blue' | 'crimson_alert';
  hologramDetailLevel: 'ultra' | 'balanced' | 'eco';
  overlayPosition: { x: number; y: number };
  overlaySize: 'compact' | 'standard' | 'expanded';
  bargeInEnabled: boolean;
  offlineFallbackEnabled: boolean;
  audioFeedbackEnabled: boolean;
  hapticFeedbackEnabled: boolean;
}

export interface JarvisCoreEvent {
  type: string;
  timestamp: number;
  source: string;
  data: Record<string, any>;
}

export type JarvisEventListener = (event: JarvisCoreEvent) => void;

// --- 1. JarvisCore Interface ---
export interface IJarvisCore {
  readonly state: JarvisSystemState;
  readonly config: JarvisCoreConfig;
  readonly isReady: boolean;

  initialize(): Promise<boolean>;
  shutdown(): Promise<void>;
  updateConfig(partial: Partial<JarvisCoreConfig>): JarvisCoreConfig;
  addEventListener(listener: JarvisEventListener): () => void;
  dispatchEvent(event: Omit<JarvisCoreEvent, 'timestamp'>): void;
  getDiagnosticHealth(): Record<string, any>;
}

// --- 2. VoiceEngine Interface ---
export interface IVoiceEngine {
  readonly isListening: boolean;
  readonly isSpeaking: boolean;
  readonly currentAudioLevel: number; // 0 to 100

  startListening(options?: { continuous?: boolean; language?: string }): Promise<void>;
  stopListening(): Promise<void>;
  speak(text: string, options?: { voice?: string; rate?: number; onDone?: () => void }): Promise<void>;
  stopSpeaking(): void;
  setBargeInEnabled(enabled: boolean): void;
  onTranscript(callback: (text: string, isFinal: boolean) => void): () => void;
}

// --- 3. AIEngine Interface ---
export interface IAIEngine {
  processPrompt(
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
  }>;
  getAvailableProviders(): Array<{ id: string; name: string; available: boolean }>;
}

// --- 4. WakeWordEngine Interface ---
export interface IWakeWordEngine {
  readonly state: JarvisWakeWordState;
  readonly isRunning: boolean;
  readonly detectedCount: number;

  startDetection(options?: { phrase?: string; sensitivity?: number }): Promise<boolean>;
  stopDetection(): Promise<void>;
  onWakeWordDetected(callback: (event: any) => void): () => void;
  onStateChange?(callback: (state: JarvisWakeWordState) => void): () => void;
}

// --- 5. HologramEngine Interface ---
export type HologramState =
  | 'hidden'
  | 'appearing'    // ÉTAT 1 : base lumineuse -> faisceau vertical -> particules -> formation noyau -> stabilisation
  | 'idle'         // ÉTAT 2 : mouvement lent, particules flottantes, rotation légère, pulsation douce
  | 'listening'    // ÉTAT 3 : augmentation activité, particules réactives, anneaux dynamiques, onde audio
  | 'thinking'     // ÉTAT 4 : rotation accélérée, particules convergentes, noyau intense, activité circulaire
  | 'speaking'     // ÉTAT 5 : hologramme animé, noyau pulsant avec l'audio, onde de choc, particules dynamiques
  | 'disappearing';// ÉTAT 6 : désactivation progressive, repli vers la base, extinction

export interface HologramVisualTelemetry {
  state: HologramState;
  intensity: number;      // 0.0 to 2.0
  audioLevel: number;     // 0 to 100
  rotationSpeed: number;  // Multiplier
  glowIntensity: number;  // 0.0 to 1.0
  auraRadius: number;     // Radius in px
  corePulseFreq: number;  // Frequency in Hz
  particleDensity: number;// Count of active particles
  activeHexCount: number;
  glitchFactor: number;
  beamHeight: number;     // 0.0 to 1.0 (for vertical projection beam)
  coreCondensation: number; // 0.0 to 1.0 (during appearance sequence)
  fps: number;
  autoDegraded: boolean;  // True if Android performance fallback kicked in
  energyLevel?: AudioEnergyLevel;
  audioMetrics?: AudioAnalysisMetrics;
  bassEnergy?: number;
  midEnergy?: number;
  trebleEnergy?: number;
}

export interface IHologramEngine {
  readonly state: HologramState;
  readonly visualState: JarvisSystemState;
  readonly telemetry: HologramVisualTelemetry;
  readonly isVisible: boolean;
  readonly intensity: number;
  readonly audioLevel: number;
  readonly ecoMode: boolean;

  show(options?: { state?: HologramState; autoAppear?: boolean }): void;
  hide(): void;
  setState(state: HologramState): void;
  setIntensity(intensity: number): void;
  setAudioLevel(level: number): void;
  feedAudioMetrics(metrics: AudioAnalysisMetrics): void;
  setListening(): void;
  setThinking(): void;
  setSpeaking(): void;
  setIdle(): void;
  setAppearing(): void;
  setDisappearing(): void;
  setEcoMode(enabled: boolean): void;
  setHologramMode(mode: JarvisSystemState): void;
  updateFromAudioLevel(level: number): void;
  reportFps(fps: number): void;
  triggerScanAnimation(durationMs?: number): void;
  triggerAlertPulse(colorHex?: string): void;
  triggerAcousticShockwave(intensity?: number): void;
  getRenderMatrix(): Record<string, any>;
  subscribe(listener: (telemetry: HologramVisualTelemetry) => void): () => void;
}

// --- 6. OverlayEngine Interface ---
export interface OverlayConfig {
  visible: boolean;
  mode: 'bubble' | 'hud_panel' | 'voice_orb' | 'stealth_pill';
  pinnedToCorner: boolean;
  interactive: boolean;
  coordinates: { x: number; y: number };
}

export interface IOverlayEngine {
  readonly isOverlayActive: boolean;
  readonly overlayConfig: OverlayConfig;

  showOverlay(mode?: OverlayConfig['mode']): Promise<boolean>;
  hideOverlay(): Promise<boolean>;
  toggleOverlay(): Promise<boolean>;
  updatePosition(x: number, y: number): void;
  canDrawOverlays(): boolean;
  requestOverlayPermission(): Promise<boolean>;
}

// --- 7. AndroidControlEngine Interface ---
export interface AndroidCommand {
  action: 'launch_app' | 'toggle_hardware' | 'set_volume' | 'set_brightness' | 'perform_gesture' | 'press_key';
  target: string;
  parameters?: Record<string, any>;
}

export interface AndroidCommandResult {
  success: boolean;
  action: string;
  message: string;
  nativeExecuted: boolean;
  timestamp: number;
  data?: Record<string, any>;
}

export interface IAndroidControlEngine {
  executeCommand(command: AndroidCommand): Promise<AndroidCommandResult>;
  launchApp(packageNameOrKeyword: string): Promise<AndroidCommandResult>;
  toggleHardware(feature: 'flashlight' | 'wifi' | 'bluetooth' | 'vibration' | 'mute', state?: boolean): Promise<AndroidCommandResult>;
  setDeviceVolume(levelPercent: number): Promise<AndroidCommandResult>;
  setDeviceBrightness(levelPercent: number): Promise<AndroidCommandResult>;
  performAccessibilityGesture(gesture: 'back' | 'home' | 'recents' | 'notifications' | 'scroll_down' | 'scroll_up'): Promise<AndroidCommandResult>;
}

// --- 8. PermissionManager Interface ---
export interface PermissionAuditSummary {
  totalCapabilities: number;
  authorizedCount: number;
  missingCount: number;
  overallStatus: 'JARVIS_READY' | 'JARVIS_PARTIALLY_READY' | 'SETUP_REQUIRED';
  capabilities: Array<{
    id: string;
    name: string;
    status: 'AUTHORIZED' | 'NOT_AUTHORIZED' | 'REQUIRES_ROLE' | 'REQUIRES_USER_ACTION' | 'UNAVAILABLE';
    resolutionSteps?: string;
  }>;
}

export interface IPermissionManager {
  auditAllCapabilities(): Promise<PermissionAuditSummary>;
  isCapabilityGranted(id: string): boolean;
  requestCapability(id: string): Promise<{ success: boolean; resolutionUrl?: string; message: string }>;
  openAndroidSettings(intentAction?: string): Promise<void>;
}

// --- 9. NotificationEngine Interface ---
export interface ProcessedNotification {
  id: string;
  packageName: string;
  appName: string;
  title: string;
  text: string;
  category: 'message' | 'call' | 'email' | 'system' | 'alarm' | 'reminder' | 'other';
  timestamp: number;
  isUrgent: boolean;
  spokenSummary?: string;
}

export interface INotificationEngine {
  getActiveNotifications(): Promise<ProcessedNotification[]>;
  getUrgentAlerts(): Promise<ProcessedNotification[]>;
  summarizeNotifications(): Promise<string>;
  dismissNotification(id: string): Promise<boolean>;
  onNotificationReceived(callback: (notification: ProcessedNotification) => void): () => void;
}

// --- 10. AudioVisualizer Interface ---
export type AudioEnergyLevel = 'SILENCE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'PEAK';

export interface AudioAnalysisMetrics {
  rms: number;            // Root Mean Square [0.0 - 1.0]
  volume: number;         // Normalized volume [0 - 100]
  rawDb: number;          // Decibels [-100 to 0]
  energy: number;         // Instantaneous acoustic energy [0.0 - 1.0]
  bass: number;           // Low-end impact [0.0 - 1.0] (20 - 250 Hz)
  mid: number;            // Vocal formants [0.0 - 1.0] (250 - 2500 Hz)
  treble: number;         // Sibilance & high clarity [0.0 - 1.0] (2500 - 8000 Hz)
  energyLevel: AudioEnergyLevel;
  isSpeechActive: boolean;
  speechVariation: number; // Rate of variation / emphasis detection
  peakEnergy: number;     // Recent peak hold
  frequencyBands: number[]; // 16 to 32 normalized frequency bins [0 - 1]
  timestamp: number;
}

export interface VisualizerBarData {
  id: number;
  heightPercent: number; // 0 to 100
  intensity: number;     // 0 to 1
  colorClass: string;
}

export interface IAudioVisualizer {
  readonly barCount: number;
  readonly isRunning: boolean;
  readonly currentMetrics: AudioAnalysisMetrics;

  startProcessing(stream?: MediaStream): void;
  stopProcessing(): void;
  attachAudioElement(element: HTMLAudioElement): void;
  detachAudioElement(): void;
  attachMediaStream(stream: MediaStream): void;
  detachMediaStream(): void;
  attachSyntheticUtterance(text: string, options?: { rate?: number; pitch?: number }): () => void;
  getMetrics(): AudioAnalysisMetrics;
  computeEqualizerBars(audioLevel: number, state: JarvisSystemState): VisualizerBarData[];
  getFrequencyBands(): Float32Array | number[];
  subscribe(listener: (metrics: AudioAnalysisMetrics) => void): () => void;
}

// --- 11. ActionManager Interface ---
export interface ActionExecutionToken {
  token: string;
  actionId: string;
  actionName: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  payload: Record<string, any>;
  expiresAt: number;
}

export interface IActionManager {
  executeAction(
    actionName: string,
    params: Record<string, any>,
    options?: { bypassConfirmation?: boolean }
  ): Promise<{ success: boolean; result?: any; error?: string; tokenRequired?: ActionExecutionToken }>;
  confirmSensitiveAction(token: string): Promise<{ success: boolean; result?: any; error?: string }>;
  listPendingConfirmations(): ActionExecutionToken[];
}
