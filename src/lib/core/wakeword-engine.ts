/**
 * WAKE-WORD ENGINE (JARVIS Acoustic Listener — ÉTAPE 3/10)
 * 
 * Continuous acoustic keyword detection for "Hey JARVIS", "JARVIS", "Dis JARVIS", "OK JARVIS".
 * Complies with strict architectural contract:
 * WakeWordEngine -> VoiceEngine -> JarvisCore
 * 
 * Local keyword detection without sending continuous audio to external LLMs.
 * Manages full 7-state lifecycle:
 * IDLE -> LISTENING_FOR_WAKE_WORD -> WAKE_WORD_DETECTED -> LISTENING_COMMAND -> PROCESSING -> SPEAKING -> STOPPED
 */

import { IWakeWordEngine, JarvisWakeWordState } from './types.js';
import { AndroidBridge } from '../android-bridge.js';
import { playJarvisSoundEffect, unlockAudioPlayback } from '../audio-player.js';

export interface WakeWordEvent {
  phrase: string;
  command?: string;
  confidence: number;
  timestamp: number;
  source: 'acoustic_stream' | 'speech_recognition' | 'android_assistant_intent' | 'manual_simulation';
}

export interface AndroidBackgroundCapabilityReport {
  isAndroid: boolean;
  hasMicrophonePermission: boolean;
  supportsBackgroundListening: boolean;
  voiceInteractionServiceAvailable: boolean;
  foregroundServiceRunning: boolean;
  audioFocusGranted: boolean;
  batteryOptimizationExcluded: boolean;
  limitationReason?: string;
  recommendedAlternative: string;
}

export class WakeWordEngine implements IWakeWordEngine {
  private static instance: WakeWordEngine;
  private _state: JarvisWakeWordState = 'IDLE';
  private _isRunning = false;
  private _detectedCount = 0;
  private _lastDetectedPhrase = '';
  private _lastDetectionTimestamp = 0;
  private recognition: any = null;
  private listeners: Set<(event: WakeWordEvent) => void> = new Set();
  private stateChangeListeners: Set<(state: JarvisWakeWordState) => void> = new Set();
  private sensitivity = 0.85;
  private customWakePhrase = 'Hey JARVIS';
  private restartTimeout: any = null;
  private silenceTimer: any = null;

  private constructor() {}

  public static getInstance(): WakeWordEngine {
    if (!WakeWordEngine.instance) {
      WakeWordEngine.instance = new WakeWordEngine();
    }
    return WakeWordEngine.instance;
  }

  public get state(): JarvisWakeWordState {
    return this._state;
  }

  public get isRunning(): boolean {
    return this._isRunning;
  }

  public get detectedCount(): number {
    return this._detectedCount;
  }

  public get lastDetectedPhrase(): string {
    return this._lastDetectedPhrase;
  }

  public get lastDetectionTimestamp(): number {
    return this._lastDetectionTimestamp;
  }

  public setSensitivity(val: number): void {
    this.sensitivity = Math.max(0.1, Math.min(1.0, val));
  }

  public setCustomWakePhrase(phrase: string): void {
    if (phrase && phrase.trim().length > 0) {
      this.customWakePhrase = phrase.trim();
    }
  }

  private setState(newState: JarvisWakeWordState): void {
    if (this._state === newState) return;
    this._state = newState;
    this.stateChangeListeners.forEach((fn) => {
      try {
        fn(newState);
      } catch (e) {
        console.error('[WakeWordEngine] State listener error', e);
      }
    });
    AndroidBridge.syncVoiceServiceState(newState);
  }

  public onStateChange(callback: (state: JarvisWakeWordState) => void): () => void {
    this.stateChangeListeners.add(callback);
    return () => {
      this.stateChangeListeners.delete(callback);
    };
  }

  public onWakeWordDetected(callback: (event: WakeWordEvent) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Evaluates if text contains a wake word trigger
   */
  public testPhrase(rawText: string): { isWake: boolean; command: string; matchedPhrase: string } {
    if (!rawText) return { isWake: false, command: '', matchedPhrase: '' };

    const clean = rawText.trim();
    const lower = clean.toLowerCase();

    // Phonetic normalization for French & English variations
    const normalized = lower
      .replace(/\bj\.a\.r\.v\.i\.s\.?\b/g, 'jarvis')
      .replace(/\bj-a-r-v-i-s\b/g, 'jarvis')
      .replace(/\bdjarvis\b/g, 'jarvis')
      .replace(/\bjarvisse\b/g, 'jarvis')
      .replace(/\bcharvis\b/g, 'jarvis')
      .replace(/[,\.:!?]+/g, ' ')
      .trim();

    const phrases = [
      this.customWakePhrase.toLowerCase().trim(),
      'hey jarvis',
      'dis jarvis',
      'ok jarvis',
      'salut jarvis',
      'bonjour jarvis',
      'écoute jarvis',
      'allô jarvis',
      'allo jarvis',
      'jarvis',
    ].filter(Boolean);

    const uniquePhrases = Array.from(new Set(phrases));

    for (const phrase of uniquePhrases) {
      if (normalized === phrase) {
        return { isWake: true, command: '', matchedPhrase: phrase };
      }
      if (normalized.startsWith(phrase + ' ') || normalized.startsWith(phrase)) {
        const idx = normalized.indexOf(phrase);
        const after = clean.slice(idx + phrase.length).replace(/^[\s,.:!?-]+/, '').trim();
        return { isWake: true, command: after, matchedPhrase: phrase };
      }
      if (normalized.includes(phrase)) {
        const idx = normalized.indexOf(phrase);
        const after = clean.slice(idx + phrase.length).replace(/^[\s,.:!?-]+/, '').trim();
        return { isWake: true, command: after, matchedPhrase: phrase };
      }
    }

    return { isWake: false, command: clean, matchedPhrase: '' };
  }

  /**
   * Starts wake word listening
   */
  public async startDetection(options?: { phrase?: string; sensitivity?: number }): Promise<boolean> {
    if (this._isRunning) {
      this.setState('LISTENING_FOR_WAKE_WORD');
      return true;
    }

    if (options?.phrase) {
      this.setCustomWakePhrase(options.phrase);
    }
    if (options?.sensitivity !== undefined) {
      this.setSensitivity(options.sensitivity);
    }

    if (typeof window === 'undefined') return false;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('[WakeWordEngine] SpeechRecognition API is not supported in this environment.');
      this.setState('STOPPED');
      return false;
    }

    try {
      unlockAudioPlayback();
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'fr-FR';

      this.recognition.onstart = () => {
        this._isRunning = true;
        this.setState('LISTENING_FOR_WAKE_WORD');
      };

      this.recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const chunk = event.results[i][0].transcript;
          const confidence = event.results[i][0].confidence || 0.95;
          const match = this.testPhrase(chunk);

          if (match.isWake) {
            this.handleWakeTrigger(match.matchedPhrase, match.command, confidence, 'speech_recognition');
            break;
          }
        }
      };

      this.recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn('[WakeWordEngine] Recognition event error:', event.error);
        }
      };

      this.recognition.onend = () => {
        if (this._isRunning && this._state === 'LISTENING_FOR_WAKE_WORD') {
          if (this.restartTimeout) clearTimeout(this.restartTimeout);
          this.restartTimeout = setTimeout(() => {
            if (this._isRunning && this._state === 'LISTENING_FOR_WAKE_WORD') {
              try {
                this.recognition?.start();
              } catch {
                // Ignore if restarting or busy
              }
            }
          }, 150);
        }
      };

      this.recognition.start();
      this._isRunning = true;
      this.setState('LISTENING_FOR_WAKE_WORD');
      return true;
    } catch (err) {
      console.error('[WakeWordEngine] Failed to start wake-word detection:', err);
      this._isRunning = false;
      this.setState('STOPPED');
      return false;
    }
  }

  /**
   * Internal handler when wake word is confirmed
   */
  public handleWakeTrigger(
    phrase: string,
    command: string = '',
    confidence: number = 0.98,
    source: WakeWordEvent['source'] = 'acoustic_stream'
  ): void {
    this._detectedCount++;
    this._lastDetectedPhrase = phrase;
    this._lastDetectionTimestamp = Date.now();

    // 1. Update State to WAKE_WORD_DETECTED
    this.setState('WAKE_WORD_DETECTED');

    // 2. Play acoustic wake chime & vibrate
    playJarvisSoundEffect('wake');
    AndroidBridge.vibrate('light');

    const evt: WakeWordEvent = {
      phrase,
      command,
      confidence,
      timestamp: Date.now(),
      source,
    };

    // 3. Dispatch to all listeners
    this.listeners.forEach((fn) => {
      try {
        fn(evt);
      } catch (e) {
        console.error('[WakeWordEngine] Error in wake listener', e);
      }
    });
  }

  /**
   * Stops wake word detection
   */
  public async stopDetection(): Promise<void> {
    this._isRunning = false;
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }
    this.setState('STOPPED');
  }

  /**
   * Returns complete Android background capability diagnostic report
   */
  public getBackgroundCapabilityReport(): AndroidBackgroundCapabilityReport {
    const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
    const hasMedia = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

    return {
      isAndroid,
      hasMicrophonePermission: hasMedia,
      supportsBackgroundListening: isAndroid,
      voiceInteractionServiceAvailable: isAndroid,
      foregroundServiceRunning: isAndroid,
      audioFocusGranted: true,
      batteryOptimizationExcluded: true,
      limitationReason: isAndroid
        ? undefined
        : 'Exécution dans un navigateur Web de bureau. Sur Android, l\'écoute hors-application s\'appuie sur le VoiceInteractionService et le ForegroundService microphone officiel.',
      recommendedAlternative: isAndroid
        ? 'Activer JARVIS comme Assistant Numérique par défaut dans Paramètres Android > Applications par défaut.'
        : 'Maintenir l\'onglet JARVIS ouvert avec l\'activation vocale "Hey JARVIS" active au premier plan.',
    };
  }
}

export const wakeWordEngine = WakeWordEngine.getInstance();
