/**
 * AUDIO VISUALIZER (JARVIS Voice-Reactive Audio & Spectrum Analyzer)
 * 
 * ÉTAPE 5/10 : VOICE-REACTIVE HOLOGRAM
 * 
 * Architecture :
 * TTS / Micro / Stream
 *   ↓
 * AudioVisualizer (Web Audio AnalyserNode + FFT Spectral Splitter + RMS Engine)
 *   ↓
 * Real-time Audio Metrics (Volume, Energy, Bass, Mid, Treble, Dynamic Variation, Speech Phase)
 *   ↓
 * HologramEngine (Synchronized Visual Modulation: Core size, glow, particle speed, rings, shockwaves)
 *   ↓
 * 60 FPS Visual Canvas Animation
 */

import {
  IAudioVisualizer,
  AudioAnalysisMetrics,
  AudioEnergyLevel,
  VisualizerBarData,
  JarvisSystemState,
} from './types.js';
import { hologramEngine } from './hologram-engine.js';

export class AudioVisualizer implements IAudioVisualizer {
  private static instance: AudioVisualizer;
  public readonly barCount = 24;
  private _isRunning = false;

  // Web Audio Nodes
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private currentSourceNode: AudioNode | null = null;
  private activeAudioElement: HTMLAudioElement | null = null;
  private syntheticGeneratorCancel: (() => void) | null = null;

  // Analysis buffers
  private frequencyData: Uint8Array = new Uint8Array(64);
  private timeDomainData: Uint8Array = new Uint8Array(128);

  // Real-time metrics
  private _metrics: AudioAnalysisMetrics = {
    rms: 0,
    volume: 0,
    rawDb: -100,
    energy: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    energyLevel: 'SILENCE',
    isSpeechActive: false,
    speechVariation: 0,
    peakEnergy: 0,
    frequencyBands: new Array(16).fill(0),
    timestamp: Date.now(),
  };

  // Smoothing state for jitter-free visual interpolation
  private smoothedVolume: number = 0;
  private smoothedBass: number = 0;
  private smoothedMid: number = 0;
  private smoothedTreble: number = 0;
  private prevVolume: number = 0;
  private peakHold: number = 0;
  private peakHoldDecayTimer: number = 0;

  // Event subscribers
  private subscribers: Set<(metrics: AudioAnalysisMetrics) => void> = new Set();
  private animationFrameId: number | null = null;

  private constructor() {}

  public static getInstance(): AudioVisualizer {
    if (!AudioVisualizer.instance) {
      AudioVisualizer.instance = new AudioVisualizer();
    }
    return AudioVisualizer.instance;
  }

  public get isRunning(): boolean {
    return this._isRunning;
  }

  public get currentMetrics(): AudioAnalysisMetrics {
    return { ...this._metrics };
  }

  /**
   * Initializes or returns existing Web AudioContext
   */
  private getOrCreateAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return null;

      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      if (!this.analyser) {
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 128; // 64 frequency bins
        this.analyser.smoothingTimeConstant = 0.55; // Natural responsive decay
        this.analyser.minDecibels = -90;
        this.analyser.maxDecibels = -10;
        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.timeDomainData = new Uint8Array(this.analyser.fftSize);
      }

      return this.audioCtx;
    } catch (e) {
      console.warn('[AudioVisualizer] Failed to initialize AudioContext:', e);
      return null;
    }
  }

  /**
   * Starts real-time analysis processing loop
   */
  public startProcessing(stream?: MediaStream): void {
    const ctx = this.getOrCreateAudioContext();
    if (!ctx || !this.analyser) return;

    if (stream) {
      this.attachMediaStream(stream);
    }

    if (!this._isRunning) {
      this._isRunning = true;
      this.startLoop();
    }
  }

  /**
   * Stops real-time analysis processing loop
   */
  public stopProcessing(): void {
    this._isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.detachAudioElement();
    this.detachMediaStream();
    if (this.syntheticGeneratorCancel) {
      this.syntheticGeneratorCancel();
      this.syntheticGeneratorCancel = null;
    }
    this.resetMetrics();
  }

  /**
   * Attaches an HTMLAudioElement (from Deepgram TTS or audio player) to the analyzer
   */
  public attachAudioElement(element: HTMLAudioElement): void {
    try {
      const ctx = this.getOrCreateAudioContext();
      if (!ctx || !this.analyser) return;

      this.detachAudioElement();
      this.activeAudioElement = element;

      // Note: HTMLAudioElement might already have a source node in some browser sessions
      try {
        const source = ctx.createMediaElementSource(element);
        source.connect(this.analyser);
        this.analyser.connect(ctx.destination);
        this.currentSourceNode = source;
      } catch (err: any) {
        // In case createMediaElementSource was already called on this element
        // or cross-origin restrictions apply, fallback to polling element amplitude simulation
        this.setupAudioElementTimeSync(element);
      }

      if (!this._isRunning) {
        this._isRunning = true;
        this.startLoop();
      }
    } catch (e) {
      console.warn('[AudioVisualizer] attachAudioElement error:', e);
    }
  }

  /**
   * Detaches active HTMLAudioElement
   */
  public detachAudioElement(): void {
    if (this.currentSourceNode) {
      try {
        this.currentSourceNode.disconnect();
      } catch {}
      this.currentSourceNode = null;
    }
    this.activeAudioElement = null;
  }

  /**
   * Attaches a MediaStream (Microphone input) to the analyzer
   */
  public attachMediaStream(stream: MediaStream): void {
    try {
      const ctx = this.getOrCreateAudioContext();
      if (!ctx || !this.analyser) return;

      this.detachMediaStream();
      const source = ctx.createMediaStreamSource(stream);
      source.connect(this.analyser);
      this.currentSourceNode = source;

      if (!this._isRunning) {
        this._isRunning = true;
        this.startLoop();
      }
    } catch (e) {
      console.warn('[AudioVisualizer] attachMediaStream error:', e);
    }
  }

  /**
   * Detaches active MediaStream
   */
  public detachMediaStream(): void {
    if (this.currentSourceNode) {
      try {
        this.currentSourceNode.disconnect();
      } catch {}
      this.currentSourceNode = null;
    }
  }

  /**
   * Attaches a synthetic vocal formant envelope generator for Web Speech API.
   * Enables precise syllable-by-syllable real-time animation even on engines where raw audio capture is OS-isolated.
   */
  public attachSyntheticUtterance(text: string, options: { rate?: number; pitch?: number } = {}): () => void {
    const ctx = this.getOrCreateAudioContext();
    if (!ctx || !this.analyser) return () => {};

    if (this.syntheticGeneratorCancel) {
      this.syntheticGeneratorCancel();
    }

    if (!this._isRunning) {
      this._isRunning = true;
      this.startLoop();
    }

    let isCanceled = false;
    const rate = Math.max(0.7, Math.min(1.8, options.rate || 1.0));
    const words = text.trim().split(/\s+/);
    const totalChars = text.length;

    // Approximate duration: ~75ms per character divided by rate
    const estimatedDurationMs = Math.max(800, (totalChars * 75) / rate);
    const startTime = performance.now();

    // Create a sub-audible vocal envelope oscillator routed to the analyser
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'bandpass';
    filter.frequency.value = 550 * (options.pitch || 1.0); // Vocal formant center
    filter.Q.value = 3.0;

    osc.type = 'sawtooth';
    osc.frequency.value = 130 * (options.pitch || 1.0); // Human speech fundamental

    gain.gain.value = 0.0001;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.analyser);
    // DO NOT connect to destination (it's pure analysis telemetry so user doesn't hear hum)

    const now = ctx.currentTime;
    try {
      osc.start(now);
    } catch {}

    // Animate gain envelope based on words and punctuation
    let charIdx = 0;
    const interval = setInterval(() => {
      if (isCanceled) {
        clearInterval(interval);
        return;
      }

      const elapsed = performance.now() - startTime;
      const progress = elapsed / estimatedDurationMs;

      if (progress >= 1.0) {
        clearInterval(interval);
        try {
          osc.stop();
          osc.disconnect();
          gain.disconnect();
          filter.disconnect();
        } catch {}
        return;
      }

      // Word stress & rhythm simulation
      const currentWordIdx = Math.floor(progress * words.length);
      const curWord = words[currentWordIdx] || '';
      const isPunctuation = /[,\.\?!:;]/.test(curWord);

      let targetLevel = 0.45;
      if (isPunctuation) {
        targetLevel = 0.05; // Conversational pause
      } else if (curWord.length > 6 || /!|\?/.test(curWord)) {
        targetLevel = 0.85 + Math.random() * 0.15; // Stressed/long word
      } else {
        targetLevel = 0.35 + Math.random() * 0.45; // Syllabic oscillation
      }

      // Natural speech vibrato & pitch contour
      const vibrato = Math.sin(elapsed / 80) * 0.15;
      const finalGain = Math.max(0.01, Math.min(1.0, targetLevel + vibrato));

      const audioNow = ctx.currentTime;
      gain.gain.cancelScheduledValues(audioNow);
      gain.gain.setValueAtTime(gain.gain.value, audioNow);
      gain.gain.linearRampToValueAtTime(finalGain * 0.25, audioNow + 0.04);
    }, 45);

    const cancel = () => {
      isCanceled = true;
      clearInterval(interval);
      try {
        osc.stop();
        osc.disconnect();
        gain.disconnect();
        filter.disconnect();
      } catch {}
    };

    this.syntheticGeneratorCancel = cancel;
    return cancel;
  }

  /**
   * Fallback for HTMLAudioElement where Web Audio graph routing is restricted by CORS
   */
  private setupAudioElementTimeSync(audio: HTMLAudioElement): void {
    const checkInterval = setInterval(() => {
      if (!this.activeAudioElement || this.activeAudioElement.paused || this.activeAudioElement.ended) {
        clearInterval(checkInterval);
        return;
      }
      // Simulate natural speech modulation during playback
      const simVolume = Math.floor(45 + Math.sin(Date.now() / 120) * 30 + (Math.random() * 20 - 10));
      this.feedManualLevel(simVolume);
    }, 50);
  }

  /**
   * Feeds a manual volume level (0 to 100) and computes synthetic metrics
   */
  public feedManualLevel(level: number): void {
    const normalized = Math.max(0, Math.min(100, level)) / 100;
    const rms = normalized;
    const rawDb = normalized > 0.01 ? 20 * Math.log10(normalized) : -100;

    const bass = Math.min(1.0, normalized * (0.8 + Math.random() * 0.3));
    const mid = Math.min(1.0, normalized * (1.0 + Math.random() * 0.2));
    const treble = Math.min(1.0, normalized * (0.6 + Math.random() * 0.4));

    let energyLevel: AudioEnergyLevel = 'SILENCE';
    if (level < 4) energyLevel = 'SILENCE';
    else if (level < 28) energyLevel = 'LOW';
    else if (level < 62) energyLevel = 'MEDIUM';
    else if (level < 85) energyLevel = 'HIGH';
    else energyLevel = 'PEAK';

    // 16-band normalized spectrum
    const bands: number[] = [];
    for (let i = 0; i < 16; i++) {
      const bell = Math.sin((i / 15) * Math.PI);
      bands.push(Math.min(1.0, normalized * (0.4 + bell * 0.6) + Math.random() * 0.1));
    }

    this._metrics = {
      rms,
      volume: level,
      rawDb,
      energy: normalized,
      bass,
      mid,
      treble,
      energyLevel,
      isSpeechActive: level > 8,
      speechVariation: Math.abs(level - this.prevVolume),
      peakEnergy: Math.max(this._metrics.peakEnergy * 0.95, normalized),
      frequencyBands: bands,
      timestamp: Date.now(),
    };

    this.prevVolume = level;
    this.notifySubscribers();
    hologramEngine.feedAudioMetrics(this._metrics);
  }

  /**
   * Main Real-time FFT & RMS Analysis Loop (60 FPS)
   */
  private startLoop(): void {
    const analyzeFrame = () => {
      if (!this._isRunning) return;

      if (this.analyser) {
        // 1. Get Frequency Domain Data (0 - 255 per bin)
        this.analyser.getByteFrequencyData(this.frequencyData);
        // 2. Get Time Domain Data (Waveform PCM)
        this.analyser.getByteTimeDomainData(this.timeDomainData);

        // --- Calculate RMS Volume & Decibels ---
        let sumSquares = 0;
        for (let i = 0; i < this.timeDomainData.length; i++) {
          const sample = (this.timeDomainData[i] - 128) / 128; // [-1.0, 1.0]
          sumSquares += sample * sample;
        }
        const rms = Math.sqrt(sumSquares / this.timeDomainData.length);
        const rawDb = rms > 0.0001 ? 20 * Math.log10(rms) : -100;

        // Normalized Volume [0 - 100] with dynamic speech expander
        const instantVolume = Math.min(100, Math.round(rms * 140));

        // --- Calculate Spectral Bands ---
        const binCount = this.frequencyData.length; // 64 bins
        // Assuming ~44.1kHz sample rate -> bin width ~344 Hz
        // Bass: bins 0..3 (~0 - 1000 Hz)
        // Mid: bins 4..14 (~1000 - 4800 Hz)
        // Treble: bins 15..31 (~4800 - 11000 Hz)
        let bassSum = 0;
        let midSum = 0;
        let trebleSum = 0;

        for (let i = 0; i < binCount; i++) {
          const val = this.frequencyData[i] / 255;
          if (i <= 3) bassSum += val;
          else if (i <= 14) midSum += val;
          else trebleSum += val;
        }

        const rawBass = bassSum / 4;
        const rawMid = midSum / 11;
        const rawTreble = trebleSum / (binCount - 15);

        // --- Smooth Interpolation (Quick Attack, Smooth Decay) ---
        const attackFactor = 0.45;
        const decayFactor = 0.18;

        this.smoothedVolume =
          instantVolume > this.smoothedVolume
            ? this.smoothedVolume + (instantVolume - this.smoothedVolume) * attackFactor
            : this.smoothedVolume + (instantVolume - this.smoothedVolume) * decayFactor;

        this.smoothedBass =
          rawBass > this.smoothedBass
            ? this.smoothedBass + (rawBass - this.smoothedBass) * attackFactor
            : this.smoothedBass + (rawBass - this.smoothedBass) * decayFactor;

        this.smoothedMid =
          rawMid > this.smoothedMid
            ? this.smoothedMid + (rawMid - this.smoothedMid) * attackFactor
            : this.smoothedMid + (rawMid - this.smoothedMid) * decayFactor;

        this.smoothedTreble =
          rawTreble > this.smoothedTreble
            ? this.smoothedTreble + (rawTreble - this.smoothedTreble) * attackFactor
            : this.smoothedTreble + (rawTreble - this.smoothedTreble) * decayFactor;

        // Energy level categorization: LOW / MEDIUM / HIGH / PEAK
        const finalVol = Math.round(this.smoothedVolume);
        let energyLevel: AudioEnergyLevel = 'SILENCE';

        if (finalVol < 4) {
          energyLevel = 'SILENCE';
        } else if (finalVol < 25) {
          energyLevel = 'LOW';
        } else if (finalVol < 60) {
          energyLevel = 'MEDIUM';
        } else if (finalVol < 82) {
          energyLevel = 'HIGH';
        } else {
          energyLevel = 'PEAK';
        }

        // Peak Hold
        if (finalVol > this.peakHold) {
          this.peakHold = finalVol;
          this.peakHoldDecayTimer = Date.now() + 600;
        } else if (Date.now() > this.peakHoldDecayTimer) {
          this.peakHold = Math.max(0, this.peakHold - 1.5);
        }

        // 16-band downsampled frequency array
        const bands16: number[] = [];
        const chunkSize = Math.floor(binCount / 16);
        for (let b = 0; b < 16; b++) {
          let bSum = 0;
          for (let k = 0; k < chunkSize; k++) {
            bSum += this.frequencyData[b * chunkSize + k] / 255;
          }
          bands16.push(Math.min(1.0, bSum / chunkSize));
        }

        const variation = Math.abs(finalVol - this.prevVolume);
        this.prevVolume = finalVol;

        this._metrics = {
          rms,
          volume: finalVol,
          rawDb,
          energy: finalVol / 100,
          bass: this.smoothedBass,
          mid: this.smoothedMid,
          treble: this.smoothedTreble,
          energyLevel,
          isSpeechActive: finalVol > 6,
          speechVariation: variation,
          peakEnergy: this.peakHold / 100,
          frequencyBands: bands16,
          timestamp: Date.now(),
        };

        // Emit metrics to subscribers
        this.notifySubscribers();

        // Feed directly to Hologram Engine
        hologramEngine.feedAudioMetrics(this._metrics);
      }

      this.animationFrameId = requestAnimationFrame(analyzeFrame);
    };

    this.animationFrameId = requestAnimationFrame(analyzeFrame);
  }

  public getMetrics(): AudioAnalysisMetrics {
    return { ...this._metrics };
  }

  public getFrequencyBands(): Float32Array | number[] {
    return this._metrics.frequencyBands;
  }

  /**
   * Computes futuristic 24-band Gaussian Equalizer bars for UI HUD displays
   */
  public computeEqualizerBars(audioLevel: number, state: JarvisSystemState): VisualizerBarData[] {
    const normalizedLevel = Math.min(100, Math.max(0, audioLevel)) / 100;
    const bars: VisualizerBarData[] = [];
    const bands = this._metrics.frequencyBands;

    for (let i = 0; i < this.barCount; i++) {
      // Gaussian distribution for center-peaking
      const centerDist = Math.abs(i - this.barCount / 2) / (this.barCount / 2);
      const bellFactor = Math.cos(centerDist * (Math.PI / 2.2));
      const baseScale = Math.max(0.15, bellFactor);

      // Get real band data if available
      const bandIdx = Math.floor((i / this.barCount) * bands.length);
      const bandVal = bands[bandIdx] || normalizedLevel;

      let heightPercent = 6;
      let colorClass = 'bg-slate-800';

      if (state === 'listening') {
        const reactive = 0.15 + baseScale * (0.65 * bandVal + 0.25 * normalizedLevel);
        heightPercent = Math.max(8, Math.min(100, Math.round(reactive * 100)));
        colorClass = 'bg-gradient-to-t from-cyan-600 via-cyan-400 to-emerald-400';
      } else if (state === 'thinking') {
        const phase = (Date.now() / 140 + i * 0.35) % (Math.PI * 2);
        const wave = Math.sin(phase) * 0.4 + 0.5;
        heightPercent = Math.max(10, Math.min(100, Math.round((0.2 + wave * 0.6 * baseScale) * 100)));
        colorClass = 'bg-gradient-to-t from-amber-600 via-amber-400 to-cyan-400';
      } else if (state === 'speaking') {
        // High reactive voice visualization
        const reactive = 0.2 + baseScale * (0.75 * bandVal + 0.2 * this._metrics.mid);
        heightPercent = Math.max(12, Math.min(100, Math.round(reactive * 100)));
        if (this._metrics.energyLevel === 'PEAK') {
          colorClass = 'bg-gradient-to-t from-cyan-400 via-blue-300 to-white';
        } else if (this._metrics.energyLevel === 'HIGH') {
          colorClass = 'bg-gradient-to-t from-cyan-500 via-blue-400 to-indigo-300';
        } else {
          colorClass = 'bg-gradient-to-t from-cyan-600 via-cyan-400 to-blue-400';
        }
      } else if (state === 'error') {
        heightPercent = 16;
        colorClass = 'bg-rose-500';
      }

      bars.push({
        id: i,
        heightPercent,
        intensity: heightPercent / 100,
        colorClass,
      });
    }

    return bars;
  }

  public subscribe(listener: (metrics: AudioAnalysisMetrics) => void): () => void {
    this.subscribers.add(listener);
    listener(this.currentMetrics);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notifySubscribers(): void {
    const snapshot = this.currentMetrics;
    this.subscribers.forEach((fn) => {
      try {
        fn(snapshot);
      } catch (err) {
        console.error('[AudioVisualizer] Subscriber error:', err);
      }
    });
  }

  private resetMetrics(): void {
    this._metrics = {
      rms: 0,
      volume: 0,
      rawDb: -100,
      energy: 0,
      bass: 0,
      mid: 0,
      treble: 0,
      energyLevel: 'SILENCE',
      isSpeechActive: false,
      speechVariation: 0,
      peakEnergy: 0,
      frequencyBands: new Array(16).fill(0),
      timestamp: Date.now(),
    };
    this.notifySubscribers();
  }
}

export const audioVisualizer = AudioVisualizer.getInstance();
