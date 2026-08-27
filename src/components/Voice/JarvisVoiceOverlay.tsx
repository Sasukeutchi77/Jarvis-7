import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  Zap,
  Sparkles,
  ShieldCheck,
  Globe,
  Settings,
  X,
  Eye,
  Info,
  Bot,
  WifiOff,
  AlertTriangle,
  Cpu,
  Smartphone,
  Square,
  Play,
  CheckCircle2,
  RotateCcw,
  Clock,
  ExternalLink,
  Flame,
  Activity,
  Layers,
  PhoneCall,
  Video,
  CloudSun,
  ListRestart
} from 'lucide-react';
import { useJarvisVoice, VoiceAgentState, isStopCommand } from '../../hooks/useJarvisVoice';
import { useAppStore } from '../../lib/store';
import { executeVoiceAction } from '../../lib/api';
import { AndroidBridge } from '../../lib/android-bridge';
import { JarvisHologramCanvas } from '../HUD/JarvisHologramCanvas';
import { hologramEngine } from '../../lib/core/hologram-engine';

interface JarvisVoiceOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToVision?: () => void;
}

const FIFTEEN_STEPS = [
  { id: 1, label: '1. Wake Word', desc: 'Détection "Hey JARVIS"' },
  { id: 2, label: '2. Apparition', desc: 'Projection Holographique' },
  { id: 3, label: '3. Listening', desc: 'Hologramme en écoute' },
  { id: 4, label: '4. "Oui, je vous écoute"', desc: 'Salutation vocale' },
  { id: 5, label: '5. Réactivité Voix', desc: 'Oscillation acoustique' },
  { id: 6, label: '6. Commande', desc: 'Énonciation utilisateur' },
  { id: 7, label: '7. Transcription', desc: 'STT temps réel' },
  { id: 8, label: '8. Compréhension', desc: 'Routage Agent Superviseur' },
  { id: 9, label: '9. Thinking', desc: 'Hologramme en calcul' },
  { id: 10, label: '10. Action Planner', desc: 'Exécution Android & API' },
  { id: 11, label: '11. Speaking', desc: 'Hologramme en parole' },
  { id: 12, label: '12. Visualisation TTS', desc: 'Spectre audio synchronisé' },
  { id: 13, label: '13. Réponse JARVIS', desc: 'Synthèse vocale Deepgram/Web' },
  { id: 14, label: '14. Retour IDLE', desc: 'Stabilisation holographique' },
  { id: 15, label: '15. Auto-Dismiss', desc: 'Compte à rebours & fermeture' },
];

export const JarvisVoiceOverlay: React.FC<JarvisVoiceOverlayProps> = ({
  isOpen,
  onClose,
  onNavigateToVision,
}) => {
  const [showAndroidHelp, setShowAndroidHelp] = useState(false);
  const [showScenarioDrawer, setShowScenarioDrawer] = useState(false);
  const [activeStepId, setActiveStepId] = useState<number | null>(null);
  const [stepDetailText, setStepDetailText] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulatedApp, setSimulatedApp] = useState<string>('Écran d\'accueil (Launcher)');

  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);

  const {
    state,
    isIdle,
    isListening,
    isProcessing,
    isExecuting,
    isSpeaking,
    isStopped,
    isError,
    transcript,
    interimTranscript,
    audioLevel,
    wakeWordDetected,
    errorMessage,
    activeRoutedAgent,
    isOfflineMode,
    autoDismissCountdown,
    resetAutoDismissTimer,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    simulate15StepScenario,
    lastAction,
  } = useJarvisVoice({
    autoExecuteWakeCommands: true,
    onAutoDismiss: () => {
      if (!isSimulating) {
        onClose();
      }
    },
  });

  // Map VoiceAgentState to 15-step visual stepper highlight
  useEffect(() => {
    if (isSimulating) return; // Managed by scenario runner

    switch (state) {
      case 'WAKE_WORD_DETECTED':
        setActiveStepId(1);
        setStepDetailText('Mot-clé réveillé — Initialisation du canal holographique');
        break;
      case 'LISTENING_COMMAND':
      case 'LISTENING':
      case 'LISTENING_FOR_WAKE_WORD':
        if (interimTranscript) {
          setActiveStepId(7);
          setStepDetailText(`Transcription en cours : "${interimTranscript}"`);
        } else {
          setActiveStepId(3);
          setStepDetailText('Prêt pour la commande vocale...');
        }
        break;
      case 'PROCESSING':
        setActiveStepId(8);
        setStepDetailText('Compréhension de l\'intention & Planification de l\'action');
        break;
      case 'EXECUTING':
        setActiveStepId(10);
        setStepDetailText(`Exécution en cours via l'agent ${activeRoutedAgent || 'Android Control'}`);
        break;
      case 'SPEAKING':
        setActiveStepId(11);
        setStepDetailText('Synthèse vocale active');
        break;
      case 'STOPPED':
        setActiveStepId(null);
        setStepDetailText('Opération interrompue par l\'utilisateur');
        break;
      case 'IDLE':
        if (autoDismissCountdown !== null && autoDismissCountdown > 0) {
          setActiveStepId(15);
          setStepDetailText(`Compte à rebours avant fermeture automatique (${autoDismissCountdown}s)`);
        } else {
          setActiveStepId(14);
          setStepDetailText('En attente ou veille active');
        }
        break;
      default:
        break;
    }
  }, [state, interimTranscript, activeRoutedAgent, autoDismissCountdown, isSimulating]);

  // Sync Hologram Engine state with Voice interaction lifecycle
  useEffect(() => {
    if (!isOpen) return;

    if (wakeWordDetected) {
      hologramEngine.setAppearing('listening');
    } else if (isListening) {
      hologramEngine.setListening();
    } else if (isProcessing || isExecuting) {
      hologramEngine.setThinking();
    } else if (isSpeaking) {
      hologramEngine.setSpeaking();
    } else if (isIdle || isStopped) {
      hologramEngine.setIdle();
    }
  }, [isOpen, wakeWordDetected, isListening, isProcessing, isExecuting, isSpeaking, isIdle, isStopped]);

  // Auto-start listening on open with hologram apparition
  useEffect(() => {
    if (isOpen) {
      hologramEngine.show({ autoAppear: true, state: 'listening' });
      if (!isListening && !isSpeaking && !isProcessing && !isExecuting) {
        startListening();
      }
    } else {
      hologramEngine.setIdle();
    }
  }, [isOpen]);

  const handleRun15StepScenario = async (cmd: string, app: string) => {
    setIsSimulating(true);
    setSimulatedApp(app);
    try {
      await simulate15StepScenario({
        command: cmd,
        appContext: app,
        onStepChange: (stepNum, title) => {
          setActiveStepId(stepNum);
          setStepDetailText(title);
        },
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleEmergencyStop = () => {
    stopSpeaking();
    stopListening();
    setStepDetailText('Opération interrompue immédiatement ("JARVIS, arrête")');
    setActiveStepId(null);
  };

  if (!isOpen) return null;

  const currentDisplayCaption = interimTranscript || transcript || (
    isListening
      ? `À l'écoute... Dites "${settings.wakeWord || 'Hey JARVIS'}" ou une commande directe.`
      : isProcessing
      ? "Analyse de la commande par l'AI Intent Router..."
      : isExecuting
      ? `Exécution de l'action par le Superviseur${activeRoutedAgent ? ` (Agent: ${activeRoutedAgent})` : ''}...`
      : isSpeaking
      ? "JARVIS répond oralement (Interruption vocale active)..."
      : isStopped
      ? "Opération arrêtée."
      : isError
      ? (errorMessage || "Erreur de capture ou de transcription audio.")
      : "Prêt pour l'écoute vocale."
  );

  const getStateConfig = (s: VoiceAgentState) => {
    switch (s) {
      case 'WAKE_WORD_DETECTED':
        return {
          label: 'WAKE WORD DÉTECTÉ',
          description: 'Initialisation de la session...',
          ringColor: 'border-emerald-400/50',
          ambientColor: 'bg-emerald-500/20',
          btnGradient: 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white ring-4 ring-emerald-500/30 shadow-emerald-500/40 animate-pulse',
          badgeClass: 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300',
        };
      case 'LISTENING_COMMAND':
      case 'LISTENING':
      case 'LISTENING_FOR_WAKE_WORD':
        return {
          label: 'LISTENING',
          description: "À l'écoute de votre voix...",
          ringColor: 'border-cyan-400/50',
          ambientColor: 'bg-cyan-500/20',
          btnGradient: 'bg-gradient-to-tr from-cyan-600 to-blue-500 text-white ring-4 ring-cyan-500/30 shadow-cyan-500/40 animate-pulse',
          badgeClass: 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300',
        };
      case 'PROCESSING':
        return {
          label: 'PROCESSING',
          description: "Compréhension & Routage IA...",
          ringColor: 'border-amber-400/50',
          ambientColor: 'bg-amber-500/20',
          btnGradient: 'bg-gradient-to-tr from-amber-600 to-yellow-500 text-white ring-4 ring-amber-500/30 shadow-amber-500/40',
          badgeClass: 'bg-amber-950/80 border-amber-500/40 text-amber-300',
        };
      case 'EXECUTING':
        return {
          label: 'EXECUTING',
          description: activeRoutedAgent ? `Agent ${activeRoutedAgent} en action...` : "Superviseur en cours d'exécution...",
          ringColor: 'border-violet-400/50',
          ambientColor: 'bg-violet-500/20',
          btnGradient: 'bg-gradient-to-tr from-violet-600 to-purple-500 text-white ring-4 ring-violet-500/30 shadow-violet-500/40 animate-pulse',
          badgeClass: 'bg-violet-950/80 border-violet-500/40 text-violet-300',
        };
      case 'SPEAKING':
        return {
          label: 'SPEAKING',
          description: "Synthèse vocale active (Barge-in dispo)...",
          ringColor: 'border-indigo-400/50',
          ambientColor: 'bg-indigo-500/20',
          btnGradient: 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white ring-4 ring-indigo-500/30 shadow-indigo-500/40',
          badgeClass: 'bg-indigo-950/80 border-indigo-500/40 text-indigo-300',
        };
      case 'STOPPED':
        return {
          label: 'INTERROMPU',
          description: 'Session interrompue',
          ringColor: 'border-rose-400/50',
          ambientColor: 'bg-rose-500/20',
          btnGradient: 'bg-gradient-to-tr from-rose-600 to-red-500 text-white ring-4 ring-rose-500/30 shadow-rose-500/40',
          badgeClass: 'bg-rose-950/80 border-rose-500/40 text-rose-300',
        };
      case 'ERROR':
        return {
          label: 'ERREUR',
          description: errorMessage || "Erreur de traitement vocal",
          ringColor: 'border-rose-500/60',
          ambientColor: 'bg-rose-500/20',
          btnGradient: 'bg-rose-600 text-white ring-4 ring-rose-500/30 shadow-rose-500/40',
          badgeClass: 'bg-rose-950/80 border-rose-500/40 text-rose-300',
        };
      case 'IDLE':
      default:
        return {
          label: 'IDLE',
          description: "Prêt pour l'écoute vocale",
          ringColor: 'border-slate-700',
          ambientColor: 'bg-cyan-500/5',
          btnGradient: 'bg-gradient-to-tr from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500',
          badgeClass: 'bg-slate-900 border-slate-700 text-slate-400',
        };
    }
  };

  const currentConfig = getStateConfig(state);

  return (
    <div
      id="jarvis-voice-overlay-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          resetAutoDismissTimer();
        }
      }}
    >
      {/* Background Holographic Cybernetic Ambient Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
        <div className={`w-[600px] h-[600px] rounded-full blur-[140px] transition-all duration-700 ${currentConfig.ambientColor}`} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.8)_100%)]" />
      </div>

      <div
        className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-slate-900/90 border border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.15)] p-4 sm:p-6 flex flex-col items-center text-center backdrop-blur-2xl scrollbar-thin scrollbar-thumb-cyan-500/20"
        onClick={() => resetAutoDismissTimer()}
      >
        {/* Top Control Bar with App Simulation & OS Badges */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800/80 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase">
              JARVIS AI • VOCAL ENGINE 9.0
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${currentConfig.badgeClass}`}>
              {currentConfig.label}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Simulated Android App Context Pill */}
            <div
              title="Application Android d'origine simulée"
              className="px-2 py-0.5 rounded-full bg-slate-800/90 border border-slate-700 text-slate-300 text-[10px] font-mono flex items-center gap-1"
            >
              <Smartphone className="w-3 h-3 text-cyan-400" />
              <span className="truncate max-w-[120px]">{simulatedApp}</span>
            </div>

            {isOfflineMode && (
              <span className="px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/30 text-amber-300 text-[10px] font-mono flex items-center gap-1">
                <WifiOff className="w-3 h-3" />
                <span>Hors-ligne</span>
              </span>
            )}

            <button
              onClick={() => setShowScenarioDrawer(!showScenarioDrawer)}
              title="Simulateur Scénario 15 Étapes"
              className={`p-1.5 rounded-xl border text-xs flex items-center gap-1 transition-colors ${
                showScenarioDrawer
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 font-semibold'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Scénarios</span>
            </button>

            <button
              onClick={() => setShowAndroidHelp(!showAndroidHelp)}
              title="Paramètres & Restrictions Android Assistant"
              className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 15-Step Interactive Scenario Drawer */}
        {showScenarioDrawer && (
          <div className="w-full mt-3 p-4 rounded-2xl bg-slate-950/95 border border-cyan-500/30 text-left text-xs text-slate-300 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-cyan-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-400" />
                Simulateur de Scénarios Vocaux Complets (15 Étapes)
              </h4>
              <span className="text-[10px] font-mono text-slate-400">Étape 9/10</span>
            </div>
            <p className="mb-3 text-[11px] text-slate-400 leading-relaxed">
              Testez le scénario complet en direct : détection depuis une application tierce, salutation <em>"Oui, je vous écoute."</em>, compréhension de l'intention, animation holographique, parole TTS et fermeture automatique.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              <button
                disabled={isSimulating}
                onClick={() => handleRun15StepScenario('Ouvre YouTube et cherche les documentaires IA', 'YouTube')}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/40 flex items-center gap-2.5 text-left transition-all group cursor-pointer disabled:opacity-50"
              >
                <div className="p-1.5 rounded-lg bg-red-950/60 border border-red-500/30 text-red-400">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-200 group-hover:text-cyan-300">Dans YouTube &gt; Commande Vidéo</div>
                  <div className="text-[10px] text-slate-400">Routage Android Control Agent</div>
                </div>
              </button>

              <button
                disabled={isSimulating}
                onClick={() => handleRun15StepScenario('Quelle est la météo aujourd\'hui ?', 'Google Maps')}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/40 flex items-center gap-2.5 text-left transition-all group cursor-pointer disabled:opacity-50"
              >
                <div className="p-1.5 rounded-lg bg-sky-950/60 border border-sky-500/30 text-sky-400">
                  <CloudSun className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-200 group-hover:text-cyan-300">Dans Maps &gt; Météo Instantanée</div>
                  <div className="text-[10px] text-slate-400">Routage Weather Agent</div>
                </div>
              </button>

              <button
                disabled={isSimulating}
                onClick={() => handleRun15StepScenario('Appelle Sarah sur son portable', 'WhatsApp')}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/40 flex items-center gap-2.5 text-left transition-all group cursor-pointer disabled:opacity-50"
              >
                <div className="p-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-200 group-hover:text-cyan-300">Dans WhatsApp &gt; Appel Téléphonique</div>
                  <div className="text-[10px] text-slate-400">Routage Contact/Telephony Agent</div>
                </div>
              </button>

              <button
                disabled={isSimulating}
                onClick={() => handleRun15StepScenario('JARVIS, arrête', 'Écran verrouillé')}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-rose-500/40 flex items-center gap-2.5 text-left transition-all group cursor-pointer disabled:opacity-50"
              >
                <div className="p-1.5 rounded-lg bg-rose-950/60 border border-rose-500/30 text-rose-400">
                  <Square className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-200 group-hover:text-rose-300">Test "JARVIS, arrête"</div>
                  <div className="text-[10px] text-slate-400">Interruption immédiate du flux</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Android OS Helper Modal */}
        {showAndroidHelp && (
          <div className="w-full mt-3 p-4 rounded-2xl bg-slate-950/95 border border-cyan-500/30 text-left text-xs text-slate-300 animate-in fade-in slide-in-from-top-2 duration-150">
            <h4 className="font-semibold text-cyan-300 flex items-center gap-1.5 mb-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              Intégration Assistant Vocal & Restrictions Android OS
            </h4>
            <p className="mb-2 leading-relaxed text-slate-400">
              Conformément aux directives de sécurité Android pour les assistants vocaux :
            </p>
            <ul className="list-disc pl-4 space-y-1 text-slate-400 mb-3">
              <li><strong>Assistant Vocal par défaut</strong> : Définir JARVIS comme application d'assistance par défaut.</li>
              <li><strong>Écoute Arrière-plan</strong> : Le <em>VoiceAssistantForegroundService</em> maintient le focus micro.</li>
              <li><strong>Interruption Vocale (Barge-in)</strong> : Active via le module VAD d'analyse spectrale.</li>
            </ul>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => void AndroidBridge.openAssistantSettings()}
                className="px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-[11px] transition-colors"
              >
                Paramètres Assistant Android
              </button>
              <button
                onClick={() => void AndroidBridge.openBatteryOptimizationSettings()}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700 transition-colors"
              >
                Optimisation Batterie
              </button>
            </div>
          </div>
        )}

        {/* 15-Step Compact Horizontal Live Tracker */}
        <div className="w-full mt-3 py-2 px-3 rounded-2xl bg-slate-950/80 border border-slate-800/90 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-mono text-slate-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              Cycle Vocal en Direct :
            </span>
            <span className="font-semibold text-cyan-300 truncate max-w-[320px]">
              {stepDetailText || currentConfig.description}
            </span>
          </div>

          <div className="w-full flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
            {FIFTEEN_STEPS.map((s) => {
              const isActive = activeStepId === s.id;
              const isPast = activeStepId !== null && s.id < activeStepId;
              return (
                <div
                  key={s.id}
                  title={`${s.label} : ${s.desc}`}
                  className={`px-2 py-1 rounded-lg text-[10px] font-mono whitespace-nowrap shrink-0 transition-all border ${
                    isActive
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 font-bold shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                      : isPast
                      ? 'bg-slate-900 border-slate-700 text-emerald-400/80'
                      : 'bg-slate-900/40 border-slate-800/60 text-slate-500'
                  }`}
                >
                  {isPast ? '✓ ' : ''}{s.label}
                </div>
              );
            })}
          </div>
        </div>

        {/* Central Holographic 3D Projection Stage */}
        <div className="relative my-2 w-full flex flex-col items-center justify-center">
          <JarvisHologramCanvas
            audioLevel={audioLevel}
            height={240}
            interactive={true}
            onCoreClick={isListening ? stopListening : startListening}
          />
          
          {/* Action toggle mic overlay pill & Barge-in controls */}
          <div className="mt-1 flex items-center gap-2 flex-wrap justify-center">
            <button
              id="btn-voice-overlay-mic"
              onClick={isListening ? stopListening : startListening}
              className={`px-5 py-2 rounded-full flex items-center gap-2 text-xs font-mono font-bold transition-all shadow-lg active:scale-95 cursor-pointer ${currentConfig.btnGradient}`}
            >
              {isListening ? (
                <>
                  <Mic className="w-4 h-4 animate-pulse" />
                  <span>ÉCOUTE EN COURS</span>
                </>
              ) : isSpeaking ? (
                <>
                  <Volume2 className="w-4 h-4 animate-bounce" />
                  <span>JARVIS PARLE</span>
                </>
              ) : isProcessing || isExecuting ? (
                <>
                  <Cpu className="w-4 h-4 animate-spin" />
                  <span>TRAITEMENT IA</span>
                </>
              ) : isError ? (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  <span>RÉESSAYER</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span>PARLER À JARVIS</span>
                </>
              )}
            </button>

            {/* Emergency Stop / Barge-In Button */}
            {(isSpeaking || isExecuting || isProcessing) && (
              <button
                onClick={handleEmergencyStop}
                title="Interrompre immédiatement la parole ou l'exécution"
                className="px-3.5 py-2 rounded-full bg-rose-950/80 hover:bg-rose-900/80 border border-rose-500/40 text-rose-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer animate-pulse"
              >
                <Square className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                <span>INTERROMPRE ("ARRÊTE")</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Audio Level Meter */}
        {(isListening || isSpeaking) && (
          <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden my-1.5">
            <div
              className={`h-full transition-all duration-75 rounded-full ${
                isSpeaking
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-500'
              }`}
              style={{ width: `${Math.max(8, audioLevel)}%` }}
            />
          </div>
        )}

        {/* Live Caption Display */}
        <div className="w-full mt-2.5 p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 min-h-[60px] flex items-center justify-center">
          <p className="text-sm text-slate-300 italic font-mono text-center leading-relaxed">
            "{currentDisplayCaption}"
          </p>
        </div>

        {/* Supervisor Routing & Last Executed Intent Badge */}
        {lastAction && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/20 text-xs text-cyan-300 flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-left truncate">
              <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">
                <strong>{lastAction.intent}</strong> : {lastAction.message}
              </span>
            </div>
            {lastAction.routedAgent && (
              <span className="px-2 py-0.5 rounded-md bg-violet-900/60 border border-violet-500/40 text-[10px] font-mono text-violet-200 shrink-0 ml-2">
                Agent: {lastAction.routedAgent}
              </span>
            )}
          </div>
        )}

        {/* Auto-Dismiss Countdown Indicator */}
        {isIdle && autoDismissCountdown !== null && autoDismissCountdown > 0 && (
          <div className="w-full mt-2.5 p-2 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
              <span>Fermeture automatique dans <strong>{autoDismissCountdown}s</strong></span>
            </div>
            <button
              onClick={() => updateSettings({ autoDismissDelaySeconds: 0 })}
              className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition-colors"
            >
              Garder Ouvert
            </button>
          </div>
        )}

        {/* Quick Voice Command Chips */}
        <div className="w-full mt-3 flex flex-wrap items-center justify-center gap-1.5">
          <button
            onClick={() => void executeVoiceAction('JARVIS, vérifie ton système')}
            className="px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-500/30 text-[11px] text-emerald-300 transition-colors flex items-center gap-1"
          >
            <span>🩺 Diagnostic</span>
          </button>

          <button
            onClick={() => void executeVoiceAction('Quelle est la météo ?')}
            className="px-2.5 py-1 rounded-lg bg-sky-950/80 hover:bg-sky-900/80 border border-sky-500/30 text-[11px] text-sky-300 transition-colors flex items-center gap-1"
          >
            <span>🌦️ Météo</span>
          </button>

          <button
            onClick={() => void executeVoiceAction('Ouvre YouTube')}
            className="px-2.5 py-1 rounded-lg bg-red-950/80 hover:bg-red-900/80 border border-red-500/30 text-[11px] text-red-300 transition-colors flex items-center gap-1"
          >
            <span>▶️ YouTube</span>
          </button>

          <button
            onClick={() => void executeVoiceAction('Appelle maman')}
            className="px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-500/30 text-[11px] text-emerald-300 transition-colors flex items-center gap-1"
          >
            <span>📞 Appelle</span>
          </button>

          <button
            onClick={() => void executeVoiceAction('JARVIS, arrête')}
            className="px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900/80 border border-rose-500/30 text-[11px] text-rose-300 transition-colors flex items-center gap-1"
          >
            <span>🛑 Arrête</span>
          </button>
        </div>

        {/* Bottom Control Bar: Delays, Continuous listening & Barge-in toggles */}
        <div className="w-full mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap text-xs">
          {/* Continuous Auto-Listening Pill */}
          <button
            onClick={() =>
              updateSettings({
                continuousListening: !settings.continuousListening,
                autoListening: !settings.continuousListening,
              })
            }
            title="Activer ou désactiver l'écoute permanente"
            className={`px-2.5 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition-colors ${
              settings.continuousListening
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 font-semibold shadow-sm'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${settings.continuousListening ? 'text-cyan-400 animate-pulse' : ''}`} />
            <span>{settings.continuousListening ? 'Auto-Écoute On' : 'Micro Manuel'}</span>
          </button>

          {/* Barge-in Interruption Toggle */}
          <button
            onClick={() =>
              updateSettings({
                interruptionEnabled: settings.interruptionEnabled === false,
                bargeInEnabled: settings.interruptionEnabled === false,
              })
            }
            title="Permet de couper la parole de JARVIS en commençant à parler"
            className={`px-2.5 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition-colors ${
              settings.interruptionEnabled !== false
                ? 'bg-violet-500/20 border-violet-500/40 text-violet-300 font-semibold'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-violet-400" />
            <span>Barge-In (Interruption)</span>
          </button>

          {/* Auto-Dismiss Delay Switcher */}
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <span>Délai fermeture :</span>
            <select
              value={settings.autoDismissDelaySeconds ?? 5}
              onChange={(e) => updateSettings({ autoDismissDelaySeconds: Number(e.target.value) })}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
            >
              <option value="0">Désactivé</option>
              <option value="3">3s</option>
              <option value="5">5s (défaut)</option>
              <option value="8">8s</option>
              <option value="12">12s</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
