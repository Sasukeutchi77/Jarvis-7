import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Sparkles, 
  Eye, 
  EyeOff, 
  Play, 
  Volume2, 
  Mic, 
  MicOff,
  Brain, 
  Power, 
  Cpu, 
  Activity, 
  Sliders, 
  RotateCw,
  Zap,
  Radio
} from 'lucide-react';
import { JarvisHologramCanvas } from './JarvisHologramCanvas';
import { hologramEngine } from '../../lib/core/hologram-engine';
import { audioVisualizer } from '../../lib/core/audio-visualizer';
import { playWebSpeechUtterance } from '../../lib/audio-player';
import { HologramState, HologramVisualTelemetry, AudioAnalysisMetrics } from '../../lib/core/types';

interface JarvisHologramStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const JarvisHologramStudioModal: React.FC<JarvisHologramStudioModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [telemetry, setTelemetry] = useState<HologramVisualTelemetry>(() => hologramEngine.telemetry);
  const [audioMetrics, setAudioMetrics] = useState<AudioAnalysisMetrics | null>(null);
  const [testAudioLevel, setTestAudioLevel] = useState<number>(45);
  const [testIntensity, setTestIntensity] = useState<number>(1.0);
  const [isSimulatingAudio, setIsSimulatingAudio] = useState<boolean>(false);
  const [ecoMode, setEcoMode] = useState<boolean>(false);
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [testPhrase, setTestPhrase] = useState<string>("Bonjour Monsieur. Tous les protocoles holographiques sont synchronisés sur ma voix.");
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const micStreamRef = useRef<MediaStream | null>(null);
  const speechCancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsubHolo = hologramEngine.subscribe((t) => setTelemetry(t));
    const unsubAudio = audioVisualizer.subscribe((m) => setAudioMetrics(m));
    return () => {
      unsubHolo();
      unsubAudio();
    };
  }, []);

  // Cleanup microphone on unmount or close
  useEffect(() => {
    return () => {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
      audioVisualizer.detachMediaStream();
      if (speechCancelRef.current) {
        speechCancelRef.current();
        speechCancelRef.current = null;
      }
    };
  }, [isOpen]);

  const toggleMicrophone = async () => {
    if (isMicActive) {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
      audioVisualizer.detachMediaStream();
      setIsMicActive(false);
      hologramEngine.setIdle();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        audioVisualizer.attachMediaStream(stream);
        setIsMicActive(true);
        hologramEngine.setListening();
      } catch (e) {
        console.warn('Microphone access denied or error:', e);
      }
    }
  };

  const handleSpeakPhrase = (text: string, presetName?: string) => {
    if (speechCancelRef.current) {
      speechCancelRef.current();
      speechCancelRef.current = null;
    }

    if (presetName) setActivePreset(presetName);
    hologramEngine.setSpeaking();

    const cancel = playWebSpeechUtterance(text, {
      language: 'fr-FR',
      rate: 1.0,
      pitch: 1.0,
      onStart: () => {
        hologramEngine.setSpeaking();
      },
      onEnd: () => {
        hologramEngine.setIdle();
        setActivePreset(null);
      },
      onError: () => {
        hologramEngine.setIdle();
        setActivePreset(null);
      },
    });

    speechCancelRef.current = cancel;
  };

  // Audio level simulation loop for listening / speaking demonstration
  useEffect(() => {
    if (!isSimulatingAudio || !isOpen) return;

    const interval = setInterval(() => {
      const randomLevel = Math.floor(Math.sin(Date.now() / 150) * 35 + Math.random() * 45 + 20);
      const clamped = Math.max(5, Math.min(100, randomLevel));
      setTestAudioLevel(clamped);
      hologramEngine.setAudioLevel(clamped);
    }, 70);

    return () => clearInterval(interval);
  }, [isSimulatingAudio, isOpen]);

  if (!isOpen) return null;

  const handleStateSelect = (st: HologramState) => {
    if (st === 'appearing') {
      hologramEngine.show({ autoAppear: true });
    } else if (st === 'disappearing' || st === 'hidden') {
      hologramEngine.hide();
    } else {
      hologramEngine.setState(st);
    }
  };

  const handleIntensityChange = (val: number) => {
    setTestIntensity(val);
    hologramEngine.setIntensity(val);
  };

  const handleAudioLevelChange = (val: number) => {
    setTestAudioLevel(val);
    hologramEngine.setAudioLevel(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="relative w-full max-w-5xl max-h-[94vh] flex flex-col rounded-2xl bg-slate-900/95 border border-cyan-500/40 shadow-[0_0_50px_rgba(6,182,212,0.25)] overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-cyan-500/20 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold font-mono text-cyan-300 tracking-wider">
                  JARVIS — HOLOGRAM & AUDIO-REACTIVE STUDIO
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-400">
                  ÉTAPE 5/10
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Moteur holographique 3D asservi en temps réel au signal audio réel (FFT, Énergie, Formants)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Left Column: Hologram Stage + Live Audio Telemetry (6 cols) */}
          <div className="lg:col-span-6 flex flex-col gap-3">
            <div className="flex-1 flex flex-col items-center justify-center rounded-xl bg-slate-950/90 border border-cyan-500/30 p-2 relative min-h-[350px]">
              <div className="absolute inset-0 jarvis-grid-bg opacity-20 pointer-events-none rounded-xl" />
              
              {/* Telemetry live badges */}
              <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5 font-mono text-[10px]">
                <div className="px-2 py-1 rounded bg-slate-900/90 border border-cyan-500/40 text-cyan-300 flex items-center gap-2">
                  <Activity className="w-3 h-3 text-cyan-400 animate-pulse" />
                  <span>FPS: <strong className="text-white">{Math.round(telemetry.fps)}</strong></span>
                </div>
                <div className="px-2 py-1 rounded bg-slate-900/90 border border-cyan-500/40 text-cyan-300 flex items-center gap-2">
                  <Cpu className="w-3 h-3 text-blue-400" />
                  <span>PARTICULES: <strong className="text-white">{telemetry.particleDensity}</strong></span>
                </div>
              </div>

              {/* Energy Level Badge Top-Right */}
              <div className="absolute top-3 right-3 z-20 font-mono text-[10px]">
                <div className={`px-2.5 py-1 rounded font-bold border flex items-center gap-1.5 ${
                  telemetry.energyLevel === 'PEAK'
                    ? 'bg-red-950/90 text-red-300 border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                    : telemetry.energyLevel === 'HIGH'
                    ? 'bg-amber-950/90 text-amber-300 border-amber-500'
                    : telemetry.energyLevel === 'MEDIUM'
                    ? 'bg-cyan-950/90 text-cyan-300 border-cyan-500'
                    : 'bg-slate-900/90 text-slate-400 border-slate-700'
                }`}>
                  <Zap className="w-3 h-3" />
                  <span>RÉACTIVITÉ: {telemetry.energyLevel || 'SILENCE'}</span>
                </div>
              </div>

              {/* Hologram Canvas */}
              <JarvisHologramCanvas
                height={340}
                interactive={true}
                ecoMode={ecoMode}
                onCoreClick={() => hologramEngine.pulse()}
              />
            </div>

            {/* Live Audio Spectrum Bar Visualizer */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-cyan-500/20 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  SPECTRE AUDIO TEMPS RÉEL (16 Bandes FFT)
                </span>
                <span className="text-[10px] text-slate-400">
                  RMS: {audioMetrics ? Math.round(audioMetrics.volume * 100) : telemetry.audioLevel}%
                </span>
              </div>

              {/* 16 Frequency Equalizer Bars */}
              <div className="flex items-end gap-1 h-10 pt-1 px-1">
                {(audioMetrics?.frequencyBands || Array.from({ length: 16 }, () => 0.05)).map((val, idx) => {
                  const normalizedH = Math.max(6, Math.min(100, Math.round(val * 100)));
                  return (
                    <div key={idx} className="flex-1 bg-slate-800 rounded-t overflow-hidden flex flex-col justify-end h-full">
                      <div
                        className={`w-full transition-all duration-75 ${
                          idx < 4
                            ? 'bg-blue-500'
                            : idx < 10
                            ? 'bg-cyan-400'
                            : 'bg-indigo-400'
                        }`}
                        style={{ height: `${normalizedH}%` }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Granular Spectral Energy Ratios */}
              <div className="grid grid-cols-3 gap-2 pt-1 text-[10px] font-mono text-center">
                <div className="p-1 rounded bg-slate-900 border border-blue-500/30">
                  <span className="text-slate-400 block">GRAVES (Bass)</span>
                  <span className="text-blue-400 font-bold">{Math.round((telemetry.bassEnergy || 0) * 100)}%</span>
                </div>
                <div className="p-1 rounded bg-slate-900 border border-cyan-500/30">
                  <span className="text-slate-400 block">MÉDIUMS (Formants)</span>
                  <span className="text-cyan-300 font-bold">{Math.round((telemetry.midEnergy || 0) * 100)}%</span>
                </div>
                <div className="p-1 rounded bg-slate-900 border border-indigo-500/30">
                  <span className="text-slate-400 block">AIGUS (Harmoniques)</span>
                  <span className="text-indigo-400 font-bold">{Math.round((telemetry.trebleEnergy || 0) * 100)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Audio-Reactive Test Matrix & Control (6 cols) */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            
            {/* 1. VOCAL AUDIO-REACTIVE TESTING BENCH (ÉTAPE 5) */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-cyan-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                  MOTEUR VOCAL RÉACTIF EN DIRECT
                </span>
                <button
                  onClick={toggleMicrophone}
                  className={`px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1.5 transition-all ${
                    isMicActive
                      ? 'bg-rose-500/20 border border-rose-400 text-rose-300 animate-pulse'
                      : 'bg-slate-800 border border-slate-700 text-slate-300 hover:border-cyan-500/40'
                  }`}
                >
                  {isMicActive ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  <span>{isMicActive ? 'COUPER MICRO' : 'TESTER MICRO RÉEL'}</span>
                </button>
              </div>

              {/* Preset Vocal Phrases to Demonstrate Dynamic Reactivity */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSpeakPhrase("Oui Monsieur. Tout est calme.", 'soft')}
                  className={`p-2 rounded-lg border text-left text-xs font-mono transition-all ${
                    activePreset === 'soft'
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-cyan-500/40'
                  }`}
                >
                  <div className="font-bold text-cyan-400">1. Phrase Douce (LOW)</div>
                  <div className="text-[10px] text-slate-400">Pulsation subtile</div>
                </button>

                <button
                  onClick={() => handleSpeakPhrase("J'analyse les données de télémétrie en cours.", 'normal')}
                  className={`p-2 rounded-lg border text-left text-xs font-mono transition-all ${
                    activePreset === 'normal'
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-cyan-500/40'
                  }`}
                >
                  <div className="font-bold text-blue-400">2. Phrase Standard (MEDIUM)</div>
                  <div className="text-[10px] text-slate-400">Harmoniques fluides</div>
                </button>

                <button
                  onClick={() => handleSpeakPhrase("Attention ! Pic de surcharge thermique détecté !", 'emphasis')}
                  className={`p-2 rounded-lg border text-left text-xs font-mono transition-all ${
                    activePreset === 'emphasis'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-amber-500/40'
                  }`}
                >
                  <div className="font-bold text-amber-400">3. Mot Accentué (HIGH)</div>
                  <div className="text-[10px] text-slate-400">Élévation de vitesse</div>
                </button>

                <button
                  onClick={() => {
                    hologramEngine.triggerAcousticShockwave(1.0);
                    handleSpeakPhrase("DANGER CRITIQUE ! Déploiement immédiat du protocole de sécurité !", 'peak');
                  }}
                  className={`p-2 rounded-lg border text-left text-xs font-mono transition-all ${
                    activePreset === 'peak'
                      ? 'bg-red-500/20 border-red-400 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-red-500/40'
                  }`}
                >
                  <div className="font-bold text-red-400">4. Pic Acoustique (PEAK)</div>
                  <div className="text-[10px] text-slate-400">Onde de choc & Plasma blanc</div>
                </button>
              </div>

              {/* Custom Text Synthesizer Input */}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={testPhrase}
                  onChange={(e) => setTestPhrase(e.target.value)}
                  placeholder="Écrivez une phrase pour JARVIS..."
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                />
                <button
                  onClick={() => handleSpeakPhrase(testPhrase, 'custom')}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold transition-colors shrink-0"
                >
                  Faire Parler
                </button>
              </div>
            </div>

            {/* 2. ÉTATS DU CYCLE DE VIE HOLOGRAPHIQUE (1 à 6) */}
            <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2.5">
              <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider block">
                SÉLECTEUR D'ÉTATS HOLOGRAPHIQUES
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  onClick={() => handleStateSelect('appearing')}
                  className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-all ${
                    telemetry.state === 'appearing'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-cyan-500/50'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold font-mono">1. APPARITION</div>
                  </div>
                </button>

                <button
                  onClick={() => handleStateSelect('idle')}
                  className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-all ${
                    telemetry.state === 'idle'
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-cyan-500/50'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold font-mono">2. VEILLE</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    handleStateSelect('listening');
                    setIsSimulatingAudio(true);
                  }}
                  className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-all ${
                    telemetry.state === 'listening'
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                      : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-cyan-500/50'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold font-mono">3. ÉCOUTE</div>
                  </div>
                </button>

                <button
                  onClick={() => handleStateSelect('thinking')}
                  className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-all ${
                    telemetry.state === 'thinking'
                      ? 'bg-purple-500/20 border-purple-400 text-purple-300'
                      : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-cyan-500/50'
                  }`}
                >
                  <Brain className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold font-mono">4. RÉFLEXION</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    handleStateSelect('speaking');
                    setIsSimulatingAudio(true);
                  }}
                  className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-all ${
                    telemetry.state === 'speaking'
                      ? 'bg-blue-500/20 border-blue-400 text-blue-300'
                      : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-cyan-500/50'
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold font-mono">5. PAROLE</div>
                  </div>
                </button>

                <button
                  onClick={() => handleStateSelect('disappearing')}
                  className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-all ${
                    telemetry.state === 'disappearing' || telemetry.state === 'hidden'
                      ? 'bg-rose-500/20 border-rose-400 text-rose-300'
                      : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-cyan-500/50'
                  }`}
                >
                  <Power className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold font-mono">6. FIN</div>
                  </div>
                </button>
              </div>
            </div>

            {/* 3. CONTRÔLES TÉLÉMÉTRIQUES & PARAMÈTRES */}
            <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2.5">
              <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider block">
                PARAMÈTRES HOLOGRAPHIQUES
              </span>

              <div className="grid grid-cols-2 gap-3">
                {/* Intensity Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-400">Intensité Lumineuse :</span>
                    <span className="text-cyan-300 font-bold">{testIntensity.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="2.0"
                    step="0.1"
                    value={testIntensity}
                    onChange={(e) => handleIntensityChange(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>

                {/* Audio Reactivity Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-400">Volume Simulé :</span>
                    <span className="text-cyan-300 font-bold">{testAudioLevel}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={testAudioLevel}
                    onChange={(e) => {
                      setIsSimulatingAudio(false);
                      handleAudioLevelChange(parseInt(e.target.value, 10));
                    }}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-400"
                  />
                </div>
              </div>

              {/* Eco Mode Toggle */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                <div className="text-[11px] font-mono text-slate-300">
                  Optimisation Android (GPU Mobile) :
                </div>
                <button
                  onClick={() => {
                    const next = !ecoMode;
                    setEcoMode(next);
                    hologramEngine.setEcoMode(next);
                  }}
                  className={`px-2.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                    ecoMode
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-400'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {ecoMode ? 'ÉCO ACTIF' : 'STANDARD'}
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-cyan-500/20 bg-slate-950/80 text-xs font-mono text-slate-400">
          <div>STATUT AUDIO & HOLOGRAMME : <span className="text-emerald-400 font-bold">SYNCHRONISÉ TEMPS RÉEL (60 FPS)</span></div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-colors"
          >
            Fermer le Studio
          </button>
        </div>

      </div>
    </div>
  );
};

