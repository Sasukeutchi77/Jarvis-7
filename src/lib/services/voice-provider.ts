/**
 * JARVIS Voice Provider Interface & Types
 * 
 * Defines unified contracts for Speech-to-Text (STT), Text-to-Speech (TTS),
 * Voice Activity Detection (VAD), Streaming Audio and Fallback Engines.
 */

export interface SttOptions {
  language?: string;
  model?: string;
  smartFormat?: boolean;
  punctuate?: boolean;
  detectLanguage?: boolean;
  endpointing?: number;
  vadEvents?: boolean;
  timeoutMs?: number;
}

export interface SttWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export interface SttResult {
  text: string;
  confidence: number;
  durationSeconds: number;
  languageDetected?: string;
  words?: SttWord[];
  providerUsed: string;
  modelUsed: string;
}

export interface TtsOptions {
  voice?: string;
  model?: string;
  language?: string;
  speed?: number;
  pitch?: number;
  sampleRate?: number;
  encoding?: 'mp3' | 'wav' | 'pcm' | 'opus';
  timeoutMs?: number;
}

export interface TtsResult {
  audioBase64?: string;
  audioBuffer?: Buffer | Uint8Array;
  mimeType: string;
  sampleRate: number;
  durationSeconds?: number;
  providerUsed: string;
  modelUsed: string;
  text: string;
}

export interface VoiceCapabilities {
  supportsStt: boolean;
  supportsTts: boolean;
  supportsVad: boolean;
  supportsStreamingStt: boolean;
  supportsStreamingTts: boolean;
  supportedLanguages: string[];
  supportedTtsVoices: string[];
  supportedSttModels: string[];
}

export interface IVoiceProvider {
  readonly id: string;
  readonly name: string;
  isConfigured(): boolean;
  getCapabilities(): VoiceCapabilities;
  transcribe(audioData: Buffer | Uint8Array | string, options?: SttOptions): Promise<SttResult>;
  synthesize(text: string, options?: TtsOptions): Promise<TtsResult>;
  healthCheck(): Promise<boolean>;
}
