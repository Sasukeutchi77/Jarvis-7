/**
 * Deepgram Voice Service for JARVIS
 * 
 * Implements Deepgram Nova-3 / Nova-2 for Speech-to-Text (STT) and
 * Deepgram Aura / Aura-2 for Text-to-Speech (TTS) with:
 * - VAD (Voice Activity Detection) & Endpointing
 * - Barge-in / Speech Interruption Support
 * - Graceful Fallback to Android / Browser Native Speech Engines
 * - Server-side API key containment (DEEPGRAM_API_KEY)
 */

import {
  IVoiceProvider,
  SttOptions,
  SttResult,
  TtsOptions,
  TtsResult,
  VoiceCapabilities,
} from './voice-provider.js';

export class DeepgramVoiceService implements IVoiceProvider {
  public readonly id = 'deepgram';
  public readonly name = 'Deepgram Nova/Aura Voice Engine';

  /**
   * Returns true if server has DEEPGRAM_API_KEY configured
   */
  public isConfigured(): boolean {
    return !!process.env.DEEPGRAM_API_KEY && process.env.DEEPGRAM_API_KEY.trim().length > 0;
  }

  public getCapabilities(): VoiceCapabilities {
    return {
      supportsStt: true,
      supportsTts: true,
      supportsVad: true,
      supportsStreamingStt: true,
      supportsStreamingTts: true,
      supportedLanguages: ['fr', 'fr-FR', 'en', 'en-US', 'es', 'de', 'it', 'pt', 'ja', 'auto'],
      supportedSttModels: ['nova-3', 'nova-2', 'nova-2-general', 'enhanced'],
      supportedTtsVoices: [
        'aura-orpheus-en',
        'aura-asteria-en',
        'aura-luna-en',
        'aura-stella-en',
        'aura-athena-en',
        'aura-helios-en',
        'aura-zeus-en',
        'aura-perseus-en',
        'aura-angus-en',
      ],
    };
  }

  /**
   * Validates Deepgram credentials
   */
  public async healthCheck(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const apiKey = process.env.DEEPGRAM_API_KEY;
      const res = await fetch('https://api.deepgram.com/v1/projects', {
        headers: { Authorization: `Token ${apiKey}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Transcribe Audio Buffer or Base64 string to Text via Deepgram Listen REST API
   */
  public async transcribe(
    audioData: Buffer | Uint8Array | string,
    options: SttOptions = {}
  ): Promise<SttResult> {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error('Deepgram STT is not configured: DEEPGRAM_API_KEY missing from server');
    }

    const model = options.model || process.env.DEEPGRAM_STT_MODEL || 'nova-3';
    const language = options.language || 'fr';
    const timeoutMs = options.timeoutMs || parseInt(process.env.DEEPGRAM_TIMEOUT_MS || '15000', 10);
    const endpointing = typeof options.endpointing === 'number' ? options.endpointing : 300;

    // Convert audioData to binary Buffer / Uint8Array
    let rawBytes: Uint8Array;
    let contentType = 'audio/wav';

    if (typeof audioData === 'string') {
      if (audioData.startsWith('data:')) {
        const mimeMatch = audioData.match(/^data:([^;]+);base64,/);
        if (mimeMatch) {
          contentType = mimeMatch[1];
        }
        const base64Content = audioData.replace(/^data:[^;]+;base64,/, '');
        rawBytes = Buffer.from(base64Content, 'base64');
      } else {
        rawBytes = Buffer.from(audioData, 'base64');
      }
    } else {
      rawBytes = audioData;
    }

    if (!rawBytes || rawBytes.length === 0) {
      throw new Error('Audio payload is empty or invalid');
    }

    const queryParams = new URLSearchParams({
      model,
      smart_format: options.smartFormat !== false ? 'true' : 'false',
      punctuate: options.punctuate !== false ? 'true' : 'false',
      endpointing: String(endpointing),
    });

    if (language === 'auto' || options.detectLanguage) {
      queryParams.set('detect_language', 'true');
    } else {
      queryParams.set('language', language.startsWith('fr') ? 'fr' : language.slice(0, 2));
    }

    if (options.vadEvents) {
      queryParams.set('vad_events', 'true');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`https://api.deepgram.com/v1/listen?${queryParams.toString()}`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': contentType,
        },
        body: rawBytes,
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        if (res.status === 401 || res.status === 403) {
          throw new Error(`Deepgram STT Auth Failed (${res.status}): Invalid DEEPGRAM_API_KEY`);
        }
        if (res.status === 429) {
          throw new Error(`Deepgram STT Rate limit reached (429)`);
        }
        throw new Error(`Deepgram STT Failed (HTTP ${res.status}): ${errorText.slice(0, 200)}`);
      }

      const data = await res.json();
      const channel = data.results?.channels?.[0];
      const alt = channel?.alternatives?.[0];

      const transcript = alt?.transcript || '';
      const confidence = alt?.confidence || 0;
      const durationSeconds = data.metadata?.duration || 0;
      const detectedLang = channel?.detected_language || language;

      const words = (alt?.words || []).map((w: any) => ({
        word: w.word,
        start: w.start,
        end: w.end,
        confidence: w.confidence,
      }));

      return {
        text: transcript.trim(),
        confidence,
        durationSeconds,
        languageDetected: detectedLang,
        words,
        providerUsed: 'deepgram',
        modelUsed: model,
      };
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        throw new Error(`Deepgram STT request timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Synthesize Text to Audio via Deepgram Speak REST API (Aura)
   */
  public async synthesize(text: string, options: TtsOptions = {}): Promise<TtsResult> {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error('Deepgram TTS is not configured: DEEPGRAM_API_KEY missing from server');
    }

    if (!text || !text.trim()) {
      throw new Error('Text parameter for speech synthesis cannot be empty');
    }

    const voice = options.voice || process.env.DEEPGRAM_TTS_MODEL || 'aura-orpheus-en';
    const encoding = options.encoding || 'mp3';
    const timeoutMs = options.timeoutMs || parseInt(process.env.DEEPGRAM_TIMEOUT_MS || '15000', 10);

    const effectiveEncoding = encoding === 'wav' || encoding === 'pcm' ? 'linear16' : (encoding || 'mp3');
    const queryParams = new URLSearchParams({
      model: voice,
      encoding: effectiveEncoding,
    });

    // Deepgram Aura only supports sample_rate for uncompressed raw linear16 encodings.
    // Specifying sample_rate for mp3/opus results in UNSUPPORTED_AUDIO_FORMAT error (HTTP 400).
    if (options.sampleRate && effectiveEncoding === 'linear16') {
      queryParams.set('sample_rate', String(options.sampleRate));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`https://api.deepgram.com/v1/speak?${queryParams.toString()}`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: text.trim() }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        if (res.status === 401 || res.status === 403) {
          throw new Error(`Deepgram TTS Auth Failed (${res.status}): Invalid DEEPGRAM_API_KEY`);
        }
        if (res.status === 429) {
          throw new Error(`Deepgram TTS Rate limit reached (429)`);
        }
        throw new Error(`Deepgram TTS Failed (HTTP ${res.status}): ${errorText.slice(0, 200)}`);
      }

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Audio = buffer.toString('base64');
      const mimeType = encoding === 'wav' ? 'audio/wav' : 'audio/mp3';

      return {
        audioBase64: base64Audio,
        audioBuffer: buffer,
        mimeType,
        sampleRate: options.sampleRate || 24000,
        providerUsed: 'deepgram',
        modelUsed: voice,
        text,
      };
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        throw new Error(`Deepgram TTS request timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

export const deepgramVoiceService = new DeepgramVoiceService();
