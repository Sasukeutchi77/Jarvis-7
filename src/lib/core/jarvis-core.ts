/**
 * JARVIS CORE — CENTRAL INTELLIGENCE ENGINE (ÉTAPE 8/10)
 * 
 * Orchestrates the full cognitive pipeline:
 * 
 *  VOICE (STT, WakeWord, Barge-in)
 *    ↓
 *  INTENT UNDERSTANDING (Intent classification, entity extraction, risk assessment)
 *    ↓
 *  CONTEXT ENGINE (Phone state, active app, notifications, time, location, user prefs)
 *    ↓
 *  AI ENGINE (Supervisor agent & specialized agent selection)
 *    ↓
 *  ACTION PLANNER (Security tiers: READ, SAFE_ACTION, SENSITIVE_ACTION & token gating)
 *    ↓
 *  ANDROID CONTROL (Hardware toggles, intents, settings, communication)
 *    ↓
 *  RESPONSE (Formatting, authentic JARVIS persona & concise spoken synthesis)
 *    ↓
 *  TTS (Sanitized audio streaming with Deepgram Aura / WebSpeech)
 *    ↓
 *  HOLOGRAM (Visual mode transitions & acoustic shockwave reactivity)
 */

import {
  IJarvisCore,
  JarvisSystemState,
  JarvisCoreConfig,
  JarvisCoreEvent,
  JarvisEventListener,
} from './types.js';

import { voiceEngine, VoiceEngine } from './voice-engine.js';
import { aiEngine, AIEngine } from './ai-engine.js';
import { wakeWordEngine, WakeWordEngine } from './wakeword-engine.js';
import { hologramEngine, HologramEngine } from './hologram-engine.js';
import { overlayEngine, OverlayEngine } from './overlay-engine.js';
import { androidControlEngine, AndroidControlEngine } from './android-control-engine.js';
import { permissionManager, PermissionManager } from './permission-manager.js';
import { notificationEngine, NotificationEngine } from './notification-engine.js';
import { audioVisualizer, AudioVisualizer } from './audio-visualizer.js';
import { actionManager, ActionManager } from './action-manager.js';
import { intentUnderstandingEngine, IntentUnderstandingEngine, ParsedIntent } from './intent-engine.js';
import { actionPlanner, ActionPlanner, ActionPlan } from './action-planner.js';
import { contextEngine, ContextEngine, ContextSnapshot } from '../services/context/index.js';
import { supervisorAgent, SupervisorAgent } from '../agents/supervisor-agent.js';
import { jarvisPermissionManager, JarvisPermissionManager } from '../android/jarvis-permission-manager.js';

export interface PipelineExecutionResult {
  reply: string;
  spokenSummary: string;
  parsedIntent: ParsedIntent;
  contextSnapshot: ContextSnapshot;
  agentUsed: string;
  actionPlan?: ActionPlan;
  latencyMs: number;
  securityStatus: 'APPROVED' | 'CONFIRMATION_REQUIRED' | 'BLOCKED_PERMISSION';
  tokenRequired?: any;
}

export class JarvisCore implements IJarvisCore {
  private static instance: JarvisCore;
  private _state: JarvisSystemState = 'uninitialized';
  private _listeners: Set<JarvisEventListener> = new Set();

  private _config: JarvisCoreConfig = {
    voiceActivationEnabled: true,
    wakeWordSensitivity: 0.85,
    preferredAIProvider: 'auto',
    hudTheme: 'cyan_prime',
    hologramDetailLevel: 'ultra',
    overlayPosition: { x: 20, y: 80 },
    overlaySize: 'standard',
    bargeInEnabled: true,
    offlineFallbackEnabled: true,
    audioFeedbackEnabled: true,
    hapticFeedbackEnabled: true,
  };

  // Sub-engine references
  public readonly voice: VoiceEngine = voiceEngine;
  public readonly ai: AIEngine = aiEngine;
  public readonly wakeWord: WakeWordEngine = wakeWordEngine;
  public readonly hologram: HologramEngine = hologramEngine;
  public readonly overlay: OverlayEngine = overlayEngine;
  public readonly android: AndroidControlEngine = androidControlEngine;
  public readonly permissions: PermissionManager = permissionManager;
  public readonly androidPermissions: JarvisPermissionManager = jarvisPermissionManager;
  public readonly notifications: NotificationEngine = notificationEngine;
  public readonly visualizer: AudioVisualizer = audioVisualizer;
  public readonly actions: ActionManager = actionManager;
  public readonly intent: IntentUnderstandingEngine = intentUnderstandingEngine;
  public readonly context: ContextEngine = contextEngine;
  public readonly supervisor: SupervisorAgent = supervisorAgent;
  public readonly planner: ActionPlanner = actionPlanner;

  private constructor() {}

  public static getInstance(): JarvisCore {
    if (!JarvisCore.instance) {
      JarvisCore.instance = new JarvisCore();
    }
    return JarvisCore.instance;
  }

  public get state(): JarvisSystemState {
    return this._state;
  }

  public get config(): JarvisCoreConfig {
    return { ...this._config };
  }

  public get isReady(): boolean {
    return this._state !== 'uninitialized' && this._state !== 'error';
  }

  /**
   * Initializes Jarvis Core, audits Android capabilities, and arms listeners
   */
  public async initialize(): Promise<boolean> {
    if (this._state === 'idle' || this._state === 'listening' || this._state === 'thinking') {
      return true;
    }

    this._state = 'initializing';
    this.dispatchEvent({
      type: 'system:initializing',
      source: 'JarvisCore',
      data: { config: this._config },
    });

    try {
      // 1. Audit Android Capabilities
      const audit = await this.permissions.auditAllCapabilities();

      // 2. Wire Wake-Word to Voice Activation
      this.wakeWord.onWakeWordDetected((evt) => {
        this.dispatchEvent({
          type: 'wakeword:detected',
          source: 'WakeWordEngine',
          data: evt,
        });

        if (this._config.voiceActivationEnabled) {
          this.triggerVoiceSession();
        }
      });

      // 3. Wire Transcript to AI Processing Pipeline
      this.voice.onTranscript(async (text, isFinal) => {
        if (isFinal && text.trim().length > 0) {
          await this.processUserVoiceInput(text);
        }
      });

      // Start wake-word detection if configured
      if (this._config.voiceActivationEnabled) {
        await this.wakeWord.startDetection({ sensitivity: this._config.wakeWordSensitivity });
      }

      this._state = 'idle';
      this.hologram.setHologramMode('idle');

      this.dispatchEvent({
        type: 'system:ready',
        source: 'JarvisCore',
        data: { auditStatus: audit.overallStatus },
      });

      return true;
    } catch (err: any) {
      this._state = 'error';
      this.hologram.setHologramMode('error');
      this.dispatchEvent({
        type: 'system:error',
        source: 'JarvisCore',
        data: { error: err?.message || 'Erreur inconnue lors de l\'initialisation' },
      });
      return false;
    }
  }

  public async shutdown(): Promise<void> {
    await this.wakeWord.stopDetection();
    await this.voice.stopListening();
    this.voice.stopSpeaking();
    this.visualizer.stopProcessing();
    this._state = 'uninitialized';
    this.dispatchEvent({
      type: 'system:shutdown',
      source: 'JarvisCore',
      data: {},
    });
  }

  public updateConfig(partial: Partial<JarvisCoreConfig>): JarvisCoreConfig {
    this._config = { ...this._config, ...partial };
    if (partial.bargeInEnabled !== undefined) {
      this.voice.setBargeInEnabled(partial.bargeInEnabled);
    }
    if (partial.voiceActivationEnabled !== undefined) {
      if (partial.voiceActivationEnabled) {
        this.wakeWord.startDetection({ sensitivity: this._config.wakeWordSensitivity });
      } else {
        this.wakeWord.stopDetection();
      }
    }
    return { ...this._config };
  }

  public addEventListener(listener: JarvisEventListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  public dispatchEvent(event: Omit<JarvisCoreEvent, 'timestamp'>): void {
    const fullEvent: JarvisCoreEvent = {
      ...event,
      timestamp: Date.now(),
    };
    this._listeners.forEach((fn) => {
      try {
        fn(fullEvent);
      } catch (e) {
        console.error('[JarvisCore] Event listener error', e);
      }
    });
  }

  public async triggerVoiceSession(): Promise<void> {
    this._state = 'listening';
    this.hologram.setHologramMode('listening');
    await this.voice.startListening({ continuous: false });
  }

  /**
   * Complete 9-Stage Cognitive Pipeline Execution
   * VOICE -> INTENT -> CONTEXT -> AI -> PLANNER -> ANDROID -> RESPONSE -> TTS -> HOLOGRAM
   */
  public async executeCognitivePipeline(
    userInput: string,
    options?: {
      conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
      skipTTS?: boolean;
    }
  ): Promise<PipelineExecutionResult> {
    const startTime = Date.now();
    const cleanText = userInput.trim();

    // 1. HOLOGRAM TRANSITION TO THINKING
    this._state = 'thinking';
    this.hologram.setThinking();

    this.dispatchEvent({
      type: 'pipeline:start',
      source: 'JarvisCore',
      data: { query: cleanText },
    });

    try {
      // 2. INTENT UNDERSTANDING
      const parsedIntent = this.intent.understandIntent(cleanText);
      this.dispatchEvent({
        type: 'pipeline:intent_resolved',
        source: 'IntentUnderstandingEngine',
        data: { intent: parsedIntent },
      });

      // 3. CONTEXT ENGINE SNAPSHOT & SYNTHESIS
      const contextSnapshot = await this.context.getSnapshot();
      this.dispatchEvent({
        type: 'pipeline:context_acquired',
        source: 'ContextEngine',
        data: {
          battery: contextSnapshot.device.batteryLevel,
          activeApp: contextSnapshot.activeApp.appName || contextSnapshot.activeApp.packageName,
          notificationsCount: contextSnapshot.notifications.recentNotifications.length,
          time: contextSnapshot.time.timeFormatted,
        },
      });

      // 4. ACTION PLANNER & SECURITY GATING
      const actionPlan = await this.planner.planActions(parsedIntent, contextSnapshot);
      this.dispatchEvent({
        type: 'pipeline:plan_generated',
        source: 'ActionPlanner',
        data: { plan: actionPlan },
      });

      // 5. AI ENGINE & SUPERVISOR DELEGATION
      const agentResult = await this.supervisor.execute({
        id: `inp-${Date.now()}`,
        query: cleanText,
        context: {
          history: options?.conversationHistory as any,
          deviceState: {
            battery: contextSnapshot.device.batteryLevel,
            charging: contextSnapshot.device.isCharging,
            currentApp: contextSnapshot.activeApp.appName,
          },
        },
      });

      // 6. ANDROID CONTROL EXECUTION (If action required)
      let securityStatus: PipelineExecutionResult['securityStatus'] = 'APPROVED';
      let tokenRequired: any = undefined;

      if (actionPlan.steps.length > 0) {
        const planExec = await this.planner.executePlan(actionPlan);
        if (!planExec.success) {
          if (planExec.tokenRequired) {
            securityStatus = 'CONFIRMATION_REQUIRED';
            tokenRequired = planExec.tokenRequired;
          } else {
            securityStatus = 'BLOCKED_PERMISSION';
          }
        }
      }

      // 7. RESPONSE FORMULATION
      const reply = agentResult.reply;
      const spokenSummary = agentResult.spokenSummary || reply;
      const latencyMs = Date.now() - startTime;

      // 8. TTS & AUDIO VISUALIZER
      if (!options?.skipTTS) {
        this._state = 'speaking';
        this.hologram.setSpeaking();
        await this.voice.speak(spokenSummary, {
          onDone: () => {
            this._state = 'idle';
            this.hologram.setIdle();
          },
        });
      } else {
        this._state = 'idle';
        this.hologram.setIdle();
      }

      const result: PipelineExecutionResult = {
        reply,
        spokenSummary,
        parsedIntent,
        contextSnapshot,
        agentUsed: agentResult.agentId,
        actionPlan,
        latencyMs,
        securityStatus,
        tokenRequired,
      };

      this.dispatchEvent({
        type: 'pipeline:completed',
        source: 'JarvisCore',
        data: {
          agentUsed: agentResult.agentId,
          latencyMs,
          securityStatus,
        },
      });

      return result;
    } catch (err: any) {
      this._state = 'error';
      this.hologram.triggerAlertPulse();

      const errReply = "Une anomalie s'est produite lors de l'exécution de la requête, Monsieur.";
      if (!options?.skipTTS) {
        await this.voice.speak(errReply, {
          onDone: () => {
            this._state = 'idle';
            this.hologram.setIdle();
          },
        });
      }

      return {
        reply: errReply,
        spokenSummary: errReply,
        parsedIntent: this.intent.understandIntent(cleanText),
        contextSnapshot: await this.context.getSnapshot(),
        agentUsed: 'general_ai',
        latencyMs: Date.now() - startTime,
        securityStatus: 'APPROVED',
      };
    }
  }

  /**
   * Processes voice input from microphone through the full cognitive pipeline
   */
  public async processUserVoiceInput(text: string): Promise<string> {
    const res = await this.executeCognitivePipeline(text);
    return res.reply;
  }

  /**
   * Returns central health and subsystem status
   */
  public getDiagnosticHealth(): Record<string, any> {
    return {
      state: this._state,
      isReady: this.isReady,
      voiceListening: this.voice.isListening,
      voiceSpeaking: this.voice.isSpeaking,
      wakeWordRunning: this.wakeWord.isRunning,
      wakeWordHits: this.wakeWord.detectedCount,
      overlayActive: this.overlay.isOverlayActive,
      visualState: this.hologram.visualState,
      availableAIProviders: this.ai.getAvailableProviders(),
      registeredAgentsCount: 8,
    };
  }
}

export const jarvisCore = JarvisCore.getInstance();
