/**
 * JARVIS Audio & Voice Engine
 * Handles high-fidelity audio playback, PCM decoding, Web Speech API fallback with Chrome GC protection,
 * and AudioContext unlocking for continuous voice interaction.
 */

import { audioVisualizer } from './core/audio-visualizer';

declare global {
  interface Window {
    __jarvisActiveUtterance?: SpeechSynthesisUtterance | null;
    __jarvisAudioContext?: AudioContext | null;
  }
}

// Convert 16-bit linear PCM ArrayBuffer/Uint8Array to WAV Uint8Array
export function pcm16ToWavArray(pcmData: Uint8Array, sampleRate: number = 24000, numChannels: number = 1): Uint8Array {
  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const dataSize = pcmData.byteLength;
  const chunkSize = 36 + dataSize;

  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  // RIFF identifier
  view.setUint8(0, 0x52); // 'R'
  view.setUint8(1, 0x49); // 'I'
  view.setUint8(2, 0x46); // 'F'
  view.setUint8(3, 0x46); // 'F'
  view.setUint32(4, chunkSize, true);
  // WAVE identifier
  view.setUint8(8, 0x57);  // 'W'
  view.setUint8(9, 0x41);  // 'A'
  view.setUint8(10, 0x56); // 'V'
  view.setUint8(11, 0x45); // 'E'
  // fmt subchunk
  view.setUint8(12, 0x66); // 'f'
  view.setUint8(13, 0x6d); // 'm'
  view.setUint8(14, 0x74); // 't'
  view.setUint8(15, 0x20); // ' '
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample (16)
  // data subchunk
  view.setUint8(36, 0x64); // 'd'
  view.setUint8(37, 0x61); // 'a'
  view.setUint8(38, 0x74); // 't'
  view.setUint8(39, 0x61); // 'a'
  view.setUint32(40, dataSize, true);

  const outBytes = new Uint8Array(wavBuffer);
  outBytes.set(pcmData, 44);
  return outBytes;
}

/**
 * Gets or creates the global Web Audio Context and unlocks it on user gesture.
 */
export function getJarvisAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!window.__jarvisAudioContext || window.__jarvisAudioContext.state === 'closed') {
    window.__jarvisAudioContext = new AudioCtx();
  }

  if (window.__jarvisAudioContext.state === 'suspended') {
    window.__jarvisAudioContext.resume().catch(() => {});
  }

  return window.__jarvisAudioContext;
}

/**
 * Global unlock handler for browser autoplay policies.
 */
export function unlockAudioPlayback(): void {
  if (typeof window === 'undefined') return;

  const ctx = getJarvisAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  if ('speechSynthesis' in window && window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }
}

if (typeof window !== 'undefined') {
  const unlockEvents = ['click', 'touchstart', 'keydown'];
  const handler = () => {
    unlockAudioPlayback();
  };
  unlockEvents.forEach((evt) => {
    window.addEventListener(evt, handler, { passive: true, capture: true });
  });
}

/**
 * Plays a JARVIS HUD Sound Effect (e.g. Wake chime, processing blip, completion ping)
 */
export function playJarvisSoundEffect(type: 'wake' | 'ack' | 'complete' | 'alert' | 'listening'): void {
  try {
    const ctx = getJarvisAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'wake') {
      // Iron Man HUD Arc-Reactor Double Chime (880Hz -> 1320Hz)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.29);
    } else if (type === 'listening') {
      // Soft listening radar blip (520Hz)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.linearRampToValueAtTime(660, now + 0.08);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.17);
    } else if (type === 'ack') {
      // Processing acknowledgment ping
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1040, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.16);
    } else if (type === 'complete') {
      // Success completion chord (harmonic)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.setValueAtTime(987.77, now + 0.08); // B5
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.36);
    } else if (type === 'alert') {
      // Alert pulse
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(330, now + 0.1);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.26);
    }
  } catch (err) {
    // Non-blocking sound effect failure
  }
}

/**
 * Decodes Base64 audio into an HTMLAudioElement or Blob URL with automatic format detection (PCM -> WAV, MP3, etc.).
 */
export function createAudioElementFromBase64(base64Audio: string, mimeType: string = 'audio/mp3', sampleRate: number = 24000): HTMLAudioElement {
  let cleanBase64 = base64Audio.replace(/^data:audio\/[a-zA-Z0-9_-]+;base64,/, '');
  const binaryString = window.atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  let finalBlob: Blob;
  if (mimeType.includes('pcm') || mimeType === 'audio/raw') {
    const wavBytes = pcm16ToWavArray(bytes, sampleRate, 1);
    finalBlob = new Blob([wavBytes.buffer], { type: 'audio/wav' });
  } else {
    finalBlob = new Blob([bytes.buffer], { type: mimeType });
  }

  const audioUrl = URL.createObjectURL(finalBlob);
  const audio = new Audio(audioUrl);
  
  // Attach real-time audio visualization to the HTMLAudioElement
  audio.addEventListener('play', () => {
    audioVisualizer.attachAudioElement(audio);
  });

  // Cleanup object URL & visualizer when finished or failed
  const cleanup = () => {
    URL.revokeObjectURL(audioUrl);
    audioVisualizer.detachAudioElement();
  };
  audio.addEventListener('ended', cleanup, { once: true });
  audio.addEventListener('pause', () => audioVisualizer.detachAudioElement());
  audio.addEventListener('error', cleanup, { once: true });

  return audio;
}

/**
 * High-reliability Web Speech Synthesis execution with Chrome GC protection, sentence chunking, Android AudioFocus handling, and watchdogs.
 */
export function playWebSpeechUtterance(
  text: string,
  options: {
    language?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
    voiceURI?: string;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  } = {}
): () => void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (options.onEnd) options.onEnd();
    return () => {};
  }

  const synth = window.speechSynthesis;
  let completed = false;
  let watchdogInterval: any = null;
  let cancelSyntheticEnvelope: (() => void) | null = null;

  const finish = (isError = false, errObj?: any) => {
    if (completed) return;
    completed = true;
    if (watchdogInterval) clearInterval(watchdogInterval);
    if (cancelSyntheticEnvelope) {
      cancelSyntheticEnvelope();
      cancelSyntheticEnvelope = null;
    }
    window.__jarvisActiveUtterance = null;
    if (isError) {
      if (options.onError) options.onError(errObj);
    } else {
      if (options.onEnd) options.onEnd();
    }
  };

  const executeSpeech = () => {
    if (completed) return;

    try {
      if (synth.paused) {
        synth.resume();
      }

      const lang = options.language || 'fr-FR';
      const utterance = new SpeechSynthesisUtterance(text);
      window.__jarvisActiveUtterance = utterance; // Prevent Chromium garbage collection bug!

      utterance.lang = lang;
      utterance.rate = Math.max(0.7, Math.min(1.8, options.rate ?? 1.0));
      utterance.pitch = Math.max(0.7, Math.min(1.4, options.pitch ?? 1.0));
      utterance.volume = 1.0;

      // Voice selection strategy
      const voices = synth.getVoices();
      if (voices && voices.length > 0) {
        if (options.voiceURI) {
          const matched = voices.find((v) => v.voiceURI === options.voiceURI);
          if (matched) utterance.voice = matched;
        }
        if (!utterance.voice) {
          const isFr = lang.toLowerCase().startsWith('fr');
          // Prioritize high-quality French voices
          const preferred = voices.find(
            (v) =>
              (isFr && (v.name.includes('Google français') || v.name.includes('Thomas') || v.name.includes('Nicolas') || v.name.includes('Bernard') || v.name.includes('Henri') || v.name.includes('Amélie') || v.lang.startsWith('fr'))) ||
              (!isFr && (v.name.includes('Google US English') || v.name.includes('Daniel') || v.name.includes('George') || v.name.includes('David') || v.lang.startsWith('en')))
          );
          if (preferred) {
            utterance.voice = preferred;
          }
        }
      }

      utterance.onstart = () => {
        // Start real-time vocal formant & harmonic analyzer for Web Speech
        cancelSyntheticEnvelope = audioVisualizer.attachSyntheticUtterance(text, {
          rate: utterance.rate,
          pitch: utterance.pitch,
        });
        if (options.onStart) options.onStart();
      };

      utterance.onend = () => {
        finish(false);
      };

      utterance.onerror = (e: any) => {
        // If canceled because of next speech or user gesture, finish cleanly
        if (e?.error === 'canceled' || e?.error === 'interrupted') {
          finish(false);
        } else {
          console.warn('[WebSpeechUtterance] SpeechSynthesis error:', e?.error || e);
          finish(true, e);
        }
      };

      // Chromium watchdog: SpeechSynthesis pauses silently on long texts or background tabs
      watchdogInterval = setInterval(() => {
        if (synth.speaking && synth.paused) {
          synth.resume();
        }
      }, 500);

      synth.speak(utterance);
      if (synth.paused) {
        synth.resume();
      }
    } catch (err) {
      console.warn('Speech synthesis speak threw error:', err);
      finish(true, err);
    }
  };

  // On Android Chrome, if synth is already speaking, cancel cleanly and give 30ms before speaking
  if (synth.speaking || synth.pending) {
    synth.cancel();
    setTimeout(executeSpeech, 40);
  } else {
    executeSpeech();
  }

  return () => {
    if (!completed) {
      completed = true;
      if (watchdogInterval) clearInterval(watchdogInterval);
      if (cancelSyntheticEnvelope) {
        cancelSyntheticEnvelope();
        cancelSyntheticEnvelope = null;
      }
      window.__jarvisActiveUtterance = null;
      try {
        synth.cancel();
      } catch {}
    }
  };
}
