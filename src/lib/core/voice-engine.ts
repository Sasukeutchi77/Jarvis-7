/**
 * VOICE ENGINE (JARVIS Multi-Tier Voice Processor)
 * 
 * Coordinates:
 * - STT: Deepgram Nova-3 -> Web Speech API fallback -> Android Recognizer
 * - TTS: Deepgram Aura -> Gemini Voice -> Android TextToSpeech
 * - Real-time Audio Level Telemetry
 * - Dynamic Barge-in Interruption
 */

import { IVoiceEngine } from './types.js';
import { JarvisVoiceOrchestrator } from '../services/voice-orchestrator.js';
import { sanitizeSpeechText } from '../tts-sanitizer.js';

export class VoiceEngine implements IVoiceEngine {
  private static instance: VoiceEngine;
  private _isListening = false;
  private _isSpeaking = false;
  private _currentAudioLevel = 0;
  private _bargeInEnabled = true;

  private recognition: any = null;
  private transcriptListeners: Set<(text: string, isFinal: boolean) => void> = new Set();
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private activeAudioElement: HTMLAudioElement | null = null;

  private constructor() {}

  public static getInstance(): VoiceEngine {
    if (!VoiceEngine.instance) {
      VoiceEngine.instance = new VoiceEngine();
    }
    return VoiceEngine.instance;
  }

  public get isListening(): boolean {
    return this._isListening;
  }

  public get isSpeaking(): boolean {
    return this._isSpeaking;
  }

  public get currentAudioLevel(): number {
    return this._currentAudioLevel;
  }

  public setBargeInEnabled(enabled: boolean): void {
    this._bargeInEnabled = enabled;
  }

  public onTranscript(callback: (text: string, isFinal: boolean) => void): () => void {
    this.transcriptListeners.add(callback);
    return () => {
      this.transcriptListeners.delete(callback);
    };
  }

  public async startListening(options?: { continuous?: boolean; language?: string }): Promise<void> {
    if (this._isListening) return;

    if (this._isSpeaking && this._bargeInEnabled) {
      this.stopSpeaking();
    }

    if (typeof window === 'undefined') return;

    try {
      // 1. Initialize Micro Stream for Level Telemetry
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            this.audioContext = new AudioContextClass();
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 64;
            source.connect(this.analyser);
            this.startLevelTracking();
          }
        } catch (e) {
          console.warn('[VoiceEngine] Micro stream analysis not available, using synthetic meter', e);
        }
      }

      // 2. Start Speech Recognition
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = options?.continuous ?? true;
        this.recognition.interimResults = true;
        this.recognition.lang = options?.language || 'fr-FR';

        this.recognition.onresult = (event: any) => {
          if (this._isSpeaking && this._bargeInEnabled) {
            this.stopSpeaking();
          }

          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          if (finalTranscript) {
            this.transcriptListeners.forEach((fn) => fn(finalTranscript.trim(), true));
          } else if (interimTranscript) {
            this.transcriptListeners.forEach((fn) => fn(interimTranscript.trim(), false));
          }
        };

        this.recognition.onerror = (event: any) => {
          if (event.error !== 'no-speech') {
            console.warn('[VoiceEngine] Recognition event error:', event.error);
          }
        };

        this.recognition.onend = () => {
          if (this._isListening && options?.continuous) {
            try {
              this.recognition?.start();
            } catch {
              // best effort
            }
          } else {
            this._isListening = false;
          }
        };

        this.recognition.start();
        this._isListening = true;
      }
    } catch (err) {
      console.error('[VoiceEngine] Failed to start speech listening:', err);
      this._isListening = false;
    }
  }

  private startLevelTracking(): void {
    if (!this.analyser) return;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const update = () => {
      if (!this._isListening || !this.analyser) {
        this._currentAudioLevel = 0;
        return;
      }
      this.analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      this._currentAudioLevel = Math.min(100, Math.round((avg / 255) * 100));
      this.animFrameId = requestAnimationFrame(update);
    };

    update();
  }

  public async stopListening(): Promise<void> {
    this._isListening = false;
    this._currentAudioLevel = 0;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
      this.recognition = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.close();
      } catch {
        // ignore
      }
      this.audioContext = null;
    }
  }

  public async speak(
    text: string,
    options?: { voice?: string; rate?: number; onDone?: () => void }
  ): Promise<void> {
    this.stopSpeaking();

    const cleanText = sanitizeSpeechText(text);
    if (!cleanText.trim()) {
      options?.onDone?.();
      return;
    }

    this._isSpeaking = true;

    try {
      // 1. Try Deepgram Aura TTS via Voice Orchestrator
      const synthesis = await JarvisVoiceOrchestrator.synthesizeSpeech(cleanText, {
        voice: options?.voice || 'aura-asteria-en',
      });

      if (synthesis.audioBase64 && typeof window !== 'undefined') {
        const audioSrc = `data:${synthesis.mimeType || 'audio/mp3'};base64,${synthesis.audioBase64}`;
        const audio = new Audio(audioSrc);
        this.activeAudioElement = audio;

        audio.onended = () => {
          this._isSpeaking = false;
          this.activeAudioElement = null;
          options?.onDone?.();
        };

        audio.onerror = () => {
          this.fallbackWebSpeech(cleanText, options);
        };

        await audio.play();
        return;
      }

      // 2. Fallback to Web Speech Synthesis / Android TTS
      this.fallbackWebSpeech(cleanText, options);
    } catch (err) {
      console.warn('[VoiceEngine] TTS pipeline fallback to browser synthesis:', err);
      this.fallbackWebSpeech(cleanText, options);
    }
  }

  private fallbackWebSpeech(text: string, options?: { rate?: number; onDone?: () => void }): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      this._isSpeaking = false;
      options?.onDone?.();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = options?.rate || 1.0;

    utterance.onend = () => {
      this._isSpeaking = false;
      options?.onDone?.();
    };

    utterance.onerror = () => {
      this._isSpeaking = false;
      options?.onDone?.();
    };

    window.speechSynthesis.speak(utterance);
  }

  public stopSpeaking(): void {
    this._isSpeaking = false;
    if (this.activeAudioElement) {
      try {
        this.activeAudioElement.pause();
        this.activeAudioElement.currentTime = 0;
      } catch {
        // ignore
      }
      this.activeAudioElement = null;
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}

export const voiceEngine = VoiceEngine.getInstance();
