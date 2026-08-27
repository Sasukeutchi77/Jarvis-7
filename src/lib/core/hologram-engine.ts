/**
 * HOLOGRAM ENGINE (JARVIS Holographic Projection & Real-Time Sci-Fi Renderer)
 * 
 * ÉTAPE 4/10 : SYSTÈME VISUEL HOLOGRAPHIQUE DE JARVIS
 * 
 * Manages the full real-time holographic simulation lifecycle across 6 distinct states:
 * - ÉTAT 1 : APPARITION (base lumineuse -> faisceau vertical -> nuage de particules -> condensation noyau -> stabilisation)
 * - ÉTAT 2 : VEILLE (mouvement lent, particules flottantes, rotation légère, pulsation douce du noyau)
 * - ÉTAT 3 : ÉCOUTE (activité accrue, particules réactives au son, anneaux dynamiques, onde de fréquence)
 * - ÉTAT 4 : RÉFLEXION (rotation accélérée, convergence centripète des particules, noyau intense, flux circulaire)
 * - ÉTAT 5 : PAROLE (hologramme animé, noyau pulsant au rythme audio, anneaux réactifs, ondes de choc)
 * - ÉTAT 6 : FIN (désactivation progressive, repli vers la base, extinction du faisceau)
 * 
 * Features:
 * - Dynamic FPS performance monitor with auto-degradation for mid-range Android devices
 * - Low overhead vector calculations for 60 FPS Canvas rendering
 * - Pub/Sub telemetry stream for React components
 */

import {
  IHologramEngine,
  HologramState,
  HologramVisualTelemetry,
  JarvisSystemState,
  AudioAnalysisMetrics,
  AudioEnergyLevel,
} from './types.js';

export class HologramEngine implements IHologramEngine {
  private static instance: HologramEngine;

  private _state: HologramState = 'idle';
  private _intensity: number = 1.0;
  private _audioLevel: number = 0;
  private _ecoMode: boolean = false;
  private _isVisible: boolean = true;

  // Telemetry state
  private _telemetry: HologramVisualTelemetry = {
    state: 'idle',
    intensity: 1.0,
    audioLevel: 0,
    rotationSpeed: 1.0,
    glowIntensity: 0.45,
    auraRadius: 140,
    corePulseFreq: 1.0,
    particleDensity: 220,
    activeHexCount: 8,
    glitchFactor: 0.0,
    beamHeight: 1.0,
    coreCondensation: 1.0,
    fps: 60,
    autoDegraded: false,
    energyLevel: 'SILENCE',
    bassEnergy: 0,
    midEnergy: 0,
    trebleEnergy: 0,
  };

  // Listeners
  private _listeners: Set<(telemetry: HologramVisualTelemetry) => void> = new Set();

  // Animation and transition timers
  private _transitionTimeout: any = null;
  private _appearanceStepTimer: any = null;

  // Performance monitoring for Android devices
  private _fpsHistory: number[] = [];
  private _lowFpsStreak: number = 0;
  private _highFpsStreak: number = 0;

  private constructor() {
    this.applyStateDefaults('idle');
  }

  public static getInstance(): HologramEngine {
    if (!HologramEngine.instance) {
      HologramEngine.instance = new HologramEngine();
    }
    return HologramEngine.instance;
  }

  public get state(): HologramState {
    return this._state;
  }

  public get visualState(): JarvisSystemState {
    switch (this._state) {
      case 'appearing':
        return 'initializing';
      case 'listening':
        return 'listening';
      case 'thinking':
        return 'thinking';
      case 'speaking':
        return 'speaking';
      case 'disappearing':
      case 'hidden':
        return 'idle';
      case 'idle':
      default:
        return 'idle';
    }
  }

  public get telemetry(): HologramVisualTelemetry {
    return { ...this._telemetry };
  }

  public get isVisible(): boolean {
    return this._isVisible && this._state !== 'hidden';
  }

  public get intensity(): number {
    return this._intensity;
  }

  public get audioLevel(): number {
    return this._audioLevel;
  }

  public get ecoMode(): boolean {
    return this._ecoMode;
  }

  /**
   * Show hologram with full sequence (État 1 : Apparition)
   */
  public show(options?: { state?: HologramState; autoAppear?: boolean }): void {
    const targetState = options?.state || 'idle';
    const autoAppear = options?.autoAppear !== false;

    this._isVisible = true;

    if (autoAppear) {
      this.setAppearing(targetState);
    } else {
      this.setState(targetState);
    }
  }

  /**
   * Hide hologram with full disappearing sequence (État 6 : Fin)
   */
  public hide(): void {
    this.setDisappearing();
  }

  /**
   * ÉTAT 1 — APPARITION
   * Progression séquentielle :
   * 1. Base lumineuse s'allume
   * 2. Faisceau vertical monte
   * 3. Particules jaillissent du faisceau
   * 4. Condensation du noyau au centre
   * 5. Stabilisation vers l'état cible (idle ou listening)
   */
  public setAppearing(targetFinalState: HologramState = 'idle'): void {
    this.clearTimers();
    this._state = 'appearing';
    this._isVisible = true;

    // Step 0: Reset to base ignition
    this._telemetry = {
      ...this._telemetry,
      state: 'appearing',
      beamHeight: 0.05,
      coreCondensation: 0.0,
      glowIntensity: 0.3,
      rotationSpeed: 0.4,
      auraRadius: 60,
      corePulseFreq: 0.8,
      glitchFactor: 0.1,
    };
    this.notify();

    // Step 1: Vertical beam projection (0ms -> 500ms)
    let beamProgress = 0.05;
    const beamInterval = setInterval(() => {
      beamProgress += 0.08;
      if (beamProgress >= 1.0) {
        beamProgress = 1.0;
        clearInterval(beamInterval);
      }
      this._telemetry.beamHeight = beamProgress;
      this._telemetry.glowIntensity = 0.3 + beamProgress * 0.4;
      this.notify();
    }, 40);

    // Step 2: Particles emergence & core condensation (500ms -> 1400ms)
    this._appearanceStepTimer = setTimeout(() => {
      let condensation = 0.0;
      const condensationInterval = setInterval(() => {
        condensation += 0.07;
        if (condensation >= 1.0) {
          condensation = 1.0;
          clearInterval(condensationInterval);
        }
        this._telemetry.coreCondensation = condensation;
        this._telemetry.auraRadius = 60 + condensation * 80;
        this._telemetry.rotationSpeed = 0.4 + condensation * 0.8;
        this._telemetry.glowIntensity = 0.7 + Math.sin(condensation * Math.PI) * 0.3;
        this.notify();
      }, 50);

      // Step 3: Stabilization to target state (1600ms)
      this._transitionTimeout = setTimeout(() => {
        this._telemetry.glitchFactor = 0.0;
        this._telemetry.beamHeight = 1.0;
        this._telemetry.coreCondensation = 1.0;
        this.setState(targetFinalState);
      }, 1200);
    }, 450);
  }

  /**
   * ÉTAT 2 — VEILLE
   * Mouvement lent, particules flottantes, rotation légère, pulsation douce.
   */
  public setIdle(): void {
    this.clearTimers();
    this._state = 'idle';
    this.applyStateDefaults('idle');
    this.notify();
  }

  /**
   * ÉTAT 3 — ÉCOUTE
   * Augmentation d'activité, particules réactives au son, anneaux plus dynamiques.
   */
  public setListening(): void {
    this.clearTimers();
    this._state = 'listening';
    this.applyStateDefaults('listening');
    this.notify();
  }

  /**
   * ÉTAT 4 — RÉFLEXION
   * Rotation accélérée, particules qui convergent en vortex centripète, noyau intense.
   */
  public setThinking(): void {
    this.clearTimers();
    this._state = 'thinking';
    this.applyStateDefaults('thinking');
    this.notify();
  }

  /**
   * ÉTAT 5 — PAROLE
   * Hologramme animé, noyau pulsant avec l'audio, onde de choc, synchronisation vocale.
   */
  public setSpeaking(): void {
    this.clearTimers();
    this._state = 'speaking';
    this.applyStateDefaults('speaking');
    this.notify();
  }

  /**
   * ÉTAT 6 — FIN (DÉSACTIVATION PROGRESSIVE)
   * Condensation vers le bas, extinction du faisceau, retour à hidden.
   */
  public setDisappearing(): void {
    this.clearTimers();
    this._state = 'disappearing';
    this._telemetry.state = 'disappearing';
    this._telemetry.glitchFactor = 0.15;
    this.notify();

    // Step 1: Core decondensation & particles collapsing downwards (0 -> 600ms)
    let decondensation = 1.0;
    const collapseInterval = setInterval(() => {
      decondensation -= 0.1;
      if (decondensation <= 0) {
        decondensation = 0;
        clearInterval(collapseInterval);
      }
      this._telemetry.coreCondensation = decondensation;
      this._telemetry.auraRadius = Math.max(20, 140 * decondensation);
      this._telemetry.glowIntensity = 0.6 * decondensation;
      this.notify();
    }, 40);

    // Step 2: Vertical beam retracts into base (500ms -> 1000ms)
    this._appearanceStepTimer = setTimeout(() => {
      let beam = 1.0;
      const beamCollapseInterval = setInterval(() => {
        beam -= 0.12;
        if (beam <= 0) {
          beam = 0;
          clearInterval(beamCollapseInterval);
        }
        this._telemetry.beamHeight = beam;
        this.notify();
      }, 40);

      // Step 3: Full shutdown (1100ms)
      this._transitionTimeout = setTimeout(() => {
        this._state = 'hidden';
        this._isVisible = false;
        this._telemetry.state = 'hidden';
        this._telemetry.beamHeight = 0;
        this._telemetry.coreCondensation = 0;
        this._telemetry.glowIntensity = 0;
        this._telemetry.glitchFactor = 0;
        this.notify();
      }, 600);
    }, 500);
  }

  /**
   * Generic state setter
   */
  public setState(state: HologramState): void {
    if (state === 'appearing') {
      this.setAppearing('idle');
      return;
    }
    if (state === 'disappearing') {
      this.setDisappearing();
      return;
    }
    if (state === 'hidden') {
      this.clearTimers();
      this._state = 'hidden';
      this._isVisible = false;
      this._telemetry.state = 'hidden';
      this.notify();
      return;
    }

    this.clearTimers();
    this._state = state;
    this._isVisible = true;
    this.applyStateDefaults(state);
    this.notify();
  }

  /**
   * Adjust global visual intensity (0.0 to 2.0)
   */
  public setIntensity(intensity: number): void {
    this._intensity = Math.max(0.1, Math.min(2.5, intensity));
    this._telemetry.intensity = this._intensity;
    this.notify();
  }

  /**
   * Update current audio level (0 to 100) for real-time reactivity
   */
  public setAudioLevel(level: number): void {
    const clamped = Math.max(0, Math.min(100, level));
    this._audioLevel = clamped;
    this._telemetry.audioLevel = clamped;

    const norm = clamped / 100;

    if (this._state === 'listening') {
      this._telemetry.glowIntensity = 0.65 + norm * 0.35;
      this._telemetry.auraRadius = 140 + norm * 50;
      this._telemetry.corePulseFreq = 2.0 + norm * 3.5;
    } else if (this._state === 'speaking') {
      this._telemetry.glowIntensity = 0.75 + norm * 0.25;
      this._telemetry.auraRadius = 150 + norm * 60;
      this._telemetry.corePulseFreq = 2.5 + norm * 4.0;
    }
    this.notify();
  }

  /**
   * ÉTAPE 5 : Synchronisation FFT Granulaire (Moteur Vocal -> Moteur Holographique)
   * Reçoit les métriques d'analyse audio complètes (RMS, Bass, Mid, Treble, Niveaux d'énergie)
   */
  public feedAudioMetrics(metrics: AudioAnalysisMetrics): void {
    this._audioLevel = metrics.volume;
    this._telemetry.audioLevel = metrics.volume;
    this._telemetry.audioMetrics = metrics;
    this._telemetry.energyLevel = metrics.energyLevel;
    this._telemetry.bassEnergy = metrics.bass;
    this._telemetry.midEnergy = metrics.mid;
    this._telemetry.trebleEnergy = metrics.treble;

    const norm = metrics.volume / 100;

    if (this._state === 'speaking') {
      // Voice-reactive modulation
      // 1. Light intensity modulated by vocal formant energy
      this._telemetry.glowIntensity = Math.min(1.0, 0.55 + metrics.mid * 0.35 + norm * 0.2);
      // 2. Halo aura modulated by bass impact
      this._telemetry.auraRadius = 135 + metrics.bass * 75 + norm * 40;
      // 3. Core pulsation speed driven by speech rate and treble sibilants
      this._telemetry.corePulseFreq = 1.8 + metrics.mid * 3.8 + metrics.treble * 2.2;
      // 4. Particle rotation speed
      this._telemetry.rotationSpeed = 1.2 + norm * 2.6;

      // 5. Automatic acoustic shockwaves on emphasis / peaks
      if (metrics.energyLevel === 'PEAK' || (metrics.speechVariation > 24 && metrics.volume > 55)) {
        this.triggerAcousticShockwave(metrics.energy);
      }
    } else if (this._state === 'listening') {
      this._telemetry.glowIntensity = Math.min(1.0, 0.65 + norm * 0.35);
      this._telemetry.auraRadius = 140 + norm * 50;
      this._telemetry.corePulseFreq = 2.0 + norm * 3.2;
      this._telemetry.rotationSpeed = 1.4 + norm * 1.8;
    }

    this.notify();
  }

  /**
   * Triggers an acoustic shockwave ring animation on the hologram canvas
   */
  public triggerAcousticShockwave(intensity: number = 1.0): void {
    // Subtle temporary glitch/energy burst
    this._telemetry.glitchFactor = Math.min(0.08, 0.02 + intensity * 0.05);
    this.notify();
    setTimeout(() => {
      if (this._telemetry.glitchFactor > 0) {
        this._telemetry.glitchFactor = 0.0;
        this.notify();
      }
    }, 180);
  }

  /**
   * Interactive core pulse trigger
   */
  public pulse(intensity: number = 1.0): void {
    this.triggerAcousticShockwave(intensity);
  }

  /**
   * Toggle Eco Mode for mobile / battery saving
   */
  public setEcoMode(enabled: boolean): void {
    this._ecoMode = enabled;
    if (enabled) {
      this._telemetry.particleDensity = 90;
      this._telemetry.autoDegraded = true;
    } else if (!this._telemetry.autoDegraded) {
      this._telemetry.particleDensity = 220;
    }
    this.notify();
  }

  /**
   * Compatibility bridge with JarvisSystemState
   */
  public setHologramMode(mode: JarvisSystemState): void {
    switch (mode) {
      case 'listening':
        this.setListening();
        break;
      case 'thinking':
        this.setThinking();
        break;
      case 'speaking':
        this.setSpeaking();
        break;
      case 'initializing':
        this.setAppearing('idle');
        break;
      case 'idle':
      default:
        this.setIdle();
        break;
    }
  }

  public updateFromAudioLevel(level: number): void {
    this.setAudioLevel(level);
  }

  /**
   * Performance Monitor (Android Adaptive Fallback):
   * Collects FPS reports from the renderer canvas loop.
   * If framerate drops below 32 FPS consistently, automatically lowers density.
   */
  public reportFps(fps: number): void {
    if (fps <= 0) return;
    this._telemetry.fps = Math.round(fps);

    this._fpsHistory.push(fps);
    if (this._fpsHistory.length > 30) this._fpsHistory.shift();

    if (fps < 32) {
      this._lowFpsStreak++;
      this._highFpsStreak = 0;
      if (this._lowFpsStreak > 45 && !this._telemetry.autoDegraded) {
        // Automatically degrade for mid-range Android devices
        this._telemetry.autoDegraded = true;
        this._telemetry.particleDensity = Math.max(70, Math.floor(this._telemetry.particleDensity * 0.55));
        this.notify();
      }
    } else if (fps > 52) {
      this._highFpsStreak++;
      this._lowFpsStreak = 0;
      if (this._highFpsStreak > 120 && this._telemetry.autoDegraded && !this._ecoMode) {
        // Smoothly restore
        this._telemetry.autoDegraded = false;
        this._telemetry.particleDensity = 200;
        this.notify();
      }
    }
  }

  public triggerScanAnimation(durationMs = 2000): void {
    const prevSpeed = this._telemetry.rotationSpeed;
    this._telemetry.rotationSpeed = 4.5;
    this._telemetry.glowIntensity = 1.0;
    this._telemetry.glitchFactor = 0.1;
    this.notify();

    setTimeout(() => {
      this._telemetry.rotationSpeed = prevSpeed;
      this._telemetry.glitchFactor = 0.0;
      this.applyStateDefaults(this._state);
      this.notify();
    }, durationMs);
  }

  public triggerAlertPulse(colorHex = '#ef4444'): void {
    this._telemetry.glitchFactor = 0.35;
    this.notify();
    setTimeout(() => {
      this._telemetry.glitchFactor = 0.0;
      this.notify();
    }, 1200);
  }

  public getRenderMatrix(): Record<string, any> {
    return {
      ...this._telemetry,
      state: this._state,
      intensity: this._intensity,
      audioLevel: this._audioLevel,
      isVisible: this._isVisible,
      ecoMode: this._ecoMode,
      themePalette: {
        primary: '#06b6d4',      // Electric Cyan
        secondary: '#3b82f6',    // Deep Sci-Fi Blue
        highlight: '#38bdf8',    // Bright Sky
        coreWhite: '#ffffff',    // Fusion Core
        baseRing: '#0284c7',     // Base energy ring
      },
    };
  }

  public subscribe(listener: (telemetry: HologramVisualTelemetry) => void): () => void {
    this._listeners.add(listener);
    // Emit current state immediately
    listener(this.telemetry);
    return () => {
      this._listeners.delete(listener);
    };
  }

  private applyStateDefaults(state: HologramState): void {
    const baseDensity = this._ecoMode || this._telemetry.autoDegraded ? 80 : 220;

    switch (state) {
      case 'idle':
        this._telemetry = {
          ...this._telemetry,
          state: 'idle',
          rotationSpeed: 0.8,
          glowIntensity: 0.45,
          auraRadius: 130,
          corePulseFreq: 1.0,
          particleDensity: baseDensity,
          activeHexCount: 6,
          glitchFactor: 0.0,
          beamHeight: 1.0,
          coreCondensation: 1.0,
        };
        break;

      case 'listening':
        this._telemetry = {
          ...this._telemetry,
          state: 'listening',
          rotationSpeed: 2.2,
          glowIntensity: 0.85,
          auraRadius: 165,
          corePulseFreq: 2.5,
          particleDensity: Math.floor(baseDensity * 1.15),
          activeHexCount: 12,
          glitchFactor: 0.02,
          beamHeight: 1.0,
          coreCondensation: 1.0,
        };
        break;

      case 'thinking':
        this._telemetry = {
          ...this._telemetry,
          state: 'thinking',
          rotationSpeed: 4.8,
          glowIntensity: 0.92,
          auraRadius: 145,
          corePulseFreq: 4.0,
          particleDensity: Math.floor(baseDensity * 1.25),
          activeHexCount: 18,
          glitchFactor: 0.06,
          beamHeight: 1.0,
          coreCondensation: 1.0,
        };
        break;

      case 'speaking':
        this._telemetry = {
          ...this._telemetry,
          state: 'speaking',
          rotationSpeed: 2.0,
          glowIntensity: 0.95,
          auraRadius: 175,
          corePulseFreq: 2.2,
          particleDensity: baseDensity,
          activeHexCount: 14,
          glitchFactor: 0.01,
          beamHeight: 1.0,
          coreCondensation: 1.0,
        };
        break;

      default:
        break;
    }
  }

  private clearTimers(): void {
    if (this._transitionTimeout) {
      clearTimeout(this._transitionTimeout);
      this._transitionTimeout = null;
    }
    if (this._appearanceStepTimer) {
      clearTimeout(this._appearanceStepTimer);
      this._appearanceStepTimer = null;
    }
  }

  private notify(): void {
    const snapshot = this.telemetry;
    this._listeners.forEach((fn) => {
      try {
        fn(snapshot);
      } catch (e) {
        console.error('[HologramEngine] listener error', e);
      }
    });
  }
}

export const hologramEngine = HologramEngine.getInstance();
