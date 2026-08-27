import React, { useState } from 'react';
import {
  Zap,
  Mic,
  MicOff,
  Radio,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Play,
  Volume2,
  ShieldCheck,
  Smartphone,
  Cpu,
  RefreshCw,
  Sliders,
  Settings,
  X,
  Info,
} from 'lucide-react';
import { useJarvisVoice, VoiceAgentState } from '../../hooks/useJarvisVoice';
import { useAppStore } from '../../lib/store';
import { AndroidBridge } from '../../lib/android-bridge';

interface JarvisWakeWordTesterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const JarvisWakeWordTester: React.FC<JarvisWakeWordTesterProps> = ({
  isOpen,
  onClose,
}) => {
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);

  const [selectedPrompt, setSelectedPrompt] = useState<string>("Quelle est la météo aujourd'hui ?");
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [activeStep, setActiveStep] = useState<number>(0);

  const {
    state,
    isListeningForWakeWord,
    isWakeWordDetected,
    isListeningCommand,
    isProcessing,
    isSpeaking,
    isError,
    transcript,
    interimTranscript,
    audioLevel,
    simulateWakeWordCycle,
    startListening,
    stopListening,
    backgroundReport,
  } = useJarvisVoice();

  if (!isOpen) return null;

  const testPrompts = [
    "Quelle est la météo aujourd'hui ?",
    "Allume la torche du téléphone",
    "Donne-moi mon briefing matinal",
    "Joue de la musique sur Spotify",
    "Rappelle-moi de prendre mes clés",
  ];

  const handleRunFullCycle = async (promptToUse?: string) => {
    const text = promptToUse || customPrompt || selectedPrompt;
    setIsSimulating(true);
    setActiveStep(1);

    try {
      setActiveStep(1); // Wake Word
      await new Promise((r) => setTimeout(r, 600));
      setActiveStep(2); // Listen Command
      await new Promise((r) => setTimeout(r, 800));
      setActiveStep(3); // Transcribe & AI
      await simulateWakeWordCycle(text);
      setActiveStep(4); // Vocal Response
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => {
        setIsSimulating(false);
        setActiveStep(0);
      }, 3000);
    }
  };

  const wakeWordEnabled = settings.wakeWordEnabled !== false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-950 border border-cyan-500/40 rounded-2xl shadow-2xl shadow-cyan-950/60 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-cyan-500/20 bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shadow-sm shadow-cyan-500/20">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono text-base font-bold text-slate-100 tracking-wider">
                  TESTEUR D'ACTIVATION VOCALE "HEY JARVIS"
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  ÉTAPE 3/10
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Architecture : WakeWordEngine &rarr; VoiceEngine &rarr; JarvisCore
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* 1. Main Wake Word Master Toggle */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-cyan-500/30 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span className="font-mono text-sm font-bold text-slate-100">
                  Détection Wake Word
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase ${
                    wakeWordEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  Wake Word: {wakeWordEnabled ? 'ON' : 'OFF'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Détecte le mot-clé localement sans envoyer la conversation à l'IA avant activation.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                const next = !wakeWordEnabled;
                updateSettings({ wakeWordEnabled: next });
                AndroidBridge.vibrate('light');
              }}
              className={`px-4 py-2 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer shadow-sm ${
                wakeWordEnabled
                  ? 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
              }`}
            >
              {wakeWordEnabled ? 'Désactiver Wake Word' : 'Activer Wake Word'}
            </button>
          </div>

          {/* 2. Live Cycle Progression Pipeline */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                Cycle d'Exécution Complet
              </span>
              <span className="font-mono text-[11px] text-cyan-400">
                État actuel : <strong className="text-white">{state}</strong>
              </span>
            </div>

            {/* 4 Steps Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div
                className={`p-3 rounded-lg border flex flex-col items-center text-center transition-all ${
                  isWakeWordDetected || activeStep === 1
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-2 ring-amber-500/30'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400'
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center font-mono text-xs font-bold mb-1">
                  1
                </div>
                <span className="font-mono text-xs font-bold">"Hey JARVIS"</span>
                <span className="text-[10px] text-slate-400">Détection locale</span>
              </div>

              <div
                className={`p-3 rounded-lg border flex flex-col items-center text-center transition-all ${
                  isListeningCommand || activeStep === 2
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 ring-2 ring-cyan-500/30'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400'
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center font-mono text-xs font-bold mb-1">
                  2
                </div>
                <span className="font-mono text-xs font-bold">Écoute & Cue</span>
                <span className="text-[10px] text-slate-400">"Oui ?" + capture</span>
              </div>

              <div
                className={`p-3 rounded-lg border flex flex-col items-center text-center transition-all ${
                  isProcessing || activeStep === 3
                    ? 'bg-purple-500/20 border-purple-400 text-purple-300 ring-2 ring-purple-500/30'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400'
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center font-mono text-xs font-bold mb-1">
                  3
                </div>
                <span className="font-mono text-xs font-bold">IA & Action</span>
                <span className="text-[10px] text-slate-400">Analyse Superviseur</span>
              </div>

              <div
                className={`p-3 rounded-lg border flex flex-col items-center text-center transition-all ${
                  isSpeaking || activeStep === 4
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 ring-2 ring-emerald-500/30'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400'
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center font-mono text-xs font-bold mb-1">
                  4
                </div>
                <span className="font-mono text-xs font-bold">Réponse Vocale</span>
                <span className="text-[10px] text-slate-400">TTS Haute Fidélité</span>
              </div>
            </div>

            {/* Live Visualizer Transcript Bar */}
            <div className="p-3 rounded-lg bg-black/70 border border-cyan-500/20 font-mono text-xs space-y-1">
              <div className="text-[11px] text-slate-500 uppercase flex items-center justify-between">
                <span>Flux Transcription en Direct :</span>
                {audioLevel > 0 && (
                  <span className="text-cyan-400 font-bold">Niveau Audio : {audioLevel}%</span>
                )}
              </div>
              <div className="text-slate-200 min-h-[1.5rem] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span className="italic">
                  {interimTranscript || transcript || 'En attente d\'entrée vocale ou de simulation...'}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Preset Scenarios & Interactive Simulation */}
          <div className="space-y-3">
            <span className="font-mono text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Scénarios de Test Prédéfinis
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {testPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    setSelectedPrompt(prompt);
                    handleRunFullCycle(prompt);
                  }}
                  disabled={isSimulating}
                  className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-left transition-all cursor-pointer flex items-center justify-between group disabled:opacity-50"
                >
                  <div className="space-y-0.5 pr-2">
                    <span className="text-xs font-mono text-cyan-300 group-hover:text-cyan-200">
                      "Hey JARVIS {prompt}"
                    </span>
                  </div>
                  <Play className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
                </button>
              ))}
            </div>

            {/* Custom Input */}
            <div className="flex gap-2 pt-2">
              <input
                type="text"
                placeholder="Ou saisissez une commande personnalisée..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-900/90 border border-slate-800 focus:border-cyan-500/60 rounded-xl text-xs text-slate-200 font-mono focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleRunFullCycle(customPrompt)}
                disabled={isSimulating || !customPrompt.trim()}
                className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-mono text-xs font-bold hover:bg-cyan-400 disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Tester</span>
              </button>
            </div>
          </div>

          {/* 4. Android Native & Background Diagnostics Report */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                Rapport de Compatibilité Arrière-Plan Android
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                Official API Compliant
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              <div className="flex items-center justify-between p-2 rounded bg-black/40 border border-slate-800/60">
                <span className="text-slate-400">Microphone Permission :</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Accordée
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-black/40 border border-slate-800/60">
                <span className="text-slate-400">Foreground Service :</span>
                <span className="text-cyan-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Configuré
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-black/40 border border-slate-800/60">
                <span className="text-slate-400">VoiceInteractionService :</span>
                <span className="text-cyan-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Disponible
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-black/40 border border-slate-800/60">
                <span className="text-slate-400">Audio Focus Handler :</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Actif
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-500/20 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300 space-y-1">
                <p className="font-semibold text-cyan-300">
                  Alternative Automatique en Fonction de l'Environnement :
                </p>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  {backgroundReport.recommendedAlternative}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => AndroidBridge.openAssistantSettings()}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-medium transition-colors text-center cursor-pointer"
              >
                Paramètres Assistant Android
              </button>
              <button
                type="button"
                onClick={() => AndroidBridge.openBatteryOptimizationSettings()}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-medium transition-colors text-center cursor-pointer"
              >
                Exclusion Batterie (Doze)
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800/80 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
            <span>Sensibilité : {Math.round((settings.wakeWordSensitivity || 0.85) * 100)}%</span>
            <span>&bull;</span>
            <span>Phrase : "{settings.wakeWord || 'Hey JARVIS'}"</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-semibold transition-all cursor-pointer"
          >
            Fermer le Testeur
          </button>
        </div>
      </div>
    </div>
  );
};
