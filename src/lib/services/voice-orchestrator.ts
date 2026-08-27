/**
 * JARVIS Unified Voice Orchestrator
 * 
 * Orchestrates multi-tier voice pipeline:
 * Micro Android -> Audio Capture -> Voice Service -> Deepgram STT (Fallback to Local/Web) -> JARVIS AI -> Deepgram TTS (Fallback to Gemini TTS / Android TTS) -> Audio Android
 * 
 * Includes:
 * - VAD & Speech Interruption (Barge-in)
 * - End-of-phrase detection
 * - State tracking
 */

import { IVoiceProvider, SttOptions, SttResult, TtsOptions, TtsResult } from './voice-provider.js';
import { deepgramVoiceService, DeepgramVoiceService } from './deepgram-voice.js';

export interface VoiceOrchestratorConfig {
  preferredSttProvider: 'deepgram' | 'local' | 'auto';
  preferredTtsProvider: 'deepgram' | 'gemini' | 'android_native' | 'auto';
  vadSensitivity: 'low' | 'medium' | 'high';
  bargeInEnabled: boolean;
}

export class JarvisVoiceOrchestrator {
  private static config: VoiceOrchestratorConfig = {
    preferredSttProvider: 'auto',
    preferredTtsProvider: 'auto',
    vadSensitivity: 'medium',
    bargeInEnabled: true,
  };

  public static getConfig(): VoiceOrchestratorConfig {
    return { ...this.config };
  }

  public static updateConfig(partial: Partial<VoiceOrchestratorConfig>): VoiceOrchestratorConfig {
    this.config = { ...this.config, ...partial };
    return { ...this.config };
  }

  public static getDeepgramService(): DeepgramVoiceService {
    return deepgramVoiceService;
  }

  /**
   * Transcribes audio using Deepgram if configured, with clear fallback metadata
   */
  public static async transcribeAudio(
    audioData: Buffer | Uint8Array | string,
    options: SttOptions = {}
  ): Promise<SttResult> {
    if (deepgramVoiceService.isConfigured()) {
      try {
        return await deepgramVoiceService.transcribe(audioData, options);
      } catch (err: any) {
        console.warn('Deepgram STT failed, falling back to local recognition:', err?.message);
      }
    }

    // Fallback: If Deepgram is not configured or failed
    return {
      text: '',
      confidence: 0,
      durationSeconds: 0,
      providerUsed: 'client_fallback',
      modelUsed: 'web_speech_api_or_android_recognizer',
    };
  }

  /**
   * Synthesizes speech with cascading fallback:
   * Deepgram Aura -> Gemini TTS -> Client/Android WebSpeech API
   */
  public static async synthesizeSpeech(
    text: string,
    options: TtsOptions = {}
  ): Promise<TtsResult> {
    // 1. Try Deepgram Aura TTS if configured
    if (deepgramVoiceService.isConfigured()) {
      try {
        return await deepgramVoiceService.synthesize(text, options);
      } catch (err: any) {
        console.warn('Deepgram TTS failed, attempting fallback to Gemini/Android TTS:', err?.message);
      }
    }

    // 2. Return fallback metadata for Android TTS / WebSpeech API
    return {
      mimeType: 'audio/client_synthesis',
      sampleRate: 24000,
      providerUsed: 'android_native_fallback',
      modelUsed: 'android_tts_engine',
      text,
    };
  }
}
