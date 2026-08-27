import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Sparkles, Layers, Cpu } from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { useJarvisVoice } from '../../hooks/useJarvisVoice';
import { JarvisHeaderHUD } from './JarvisHeaderHUD';
import { JarvisSystemGauges } from './JarvisSystemGauges';
import { JarvisNeuralCore, JarvisCoreState } from './JarvisNeuralCore';
import { JarvisHologramCanvas } from './JarvisHologramCanvas';
import { JarvisHologramStudioModal } from './JarvisHologramStudioModal';
import { JarvisVoiceButton } from './JarvisVoiceButton';
import { JarvisQuickCommandsGrid } from './JarvisQuickCommandsGrid';
import { JarvisMemoryDrawer } from './JarvisMemoryDrawer';
import { JarvisSettingsHUD } from './JarvisSettingsHUD';
import { PhoneDialerModal, NotificationsModal, WeatherModal } from './JarvisHUDModals';
import { JarvisVoiceOverlay } from '../Voice/JarvisVoiceOverlay';
import { JarvisPermissionCenterModal } from '../Android/JarvisPermissionCenterModal';
import { JarvisWakeWordTester } from './JarvisWakeWordTester';
import { executeVoiceAction } from '../../lib/api';
import { hologramEngine } from '../../lib/core/hologram-engine';

interface JarvisFuturisticHUDProps {
  viewMode: 'hud' | 'chat';
  onToggleViewMode: () => void;
  onNavigateToVision?: () => void;
  className?: string;
}

export const JarvisFuturisticHUD: React.FC<JarvisFuturisticHUDProps> = ({
  viewMode,
  onToggleViewMode,
  onNavigateToVision,
  className = '',
}) => {
  const navigate = useNavigate();

  // App Store State
  const activeId = useAppStore((s) => s.activeId);
  const addMessage = useAppStore((s) => s.addMessage);
  const createConversation = useAppStore((s) => s.createConversation);
  const streamState = useAppStore((s) => s.streamState);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);

  // Modals & Drawers state
  const [ecoMode, setEcoMode] = useState<boolean>(false);
  const [centerDisplayMode, setCenterDisplayMode] = useState<'hologram' | 'core'>('hologram');
  const [hologramStudioOpen, setHologramStudioOpen] = useState<boolean>(false);
  const [memoryDrawerOpen, setMemoryDrawerOpen] = useState<boolean>(false);
  const [settingsHUDOpen, setSettingsHUDOpen] = useState<boolean>(false);
  const [voiceOverlayOpen, setVoiceOverlayOpen] = useState<boolean>(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState<boolean>(false);
  const [notificationsModalOpen, setNotificationsModalOpen] = useState<boolean>(false);
  const [weatherModalOpen, setWeatherModalOpen] = useState<boolean>(false);
  const [permissionModalOpen, setPermissionModalOpen] = useState<boolean>(false);
  const [wakeWordTesterOpen, setWakeWordTesterOpen] = useState<boolean>(false);
  const [isExecutingAction, setIsExecutingAction] = useState<boolean>(false);

  // Voice Interaction Hook
  const {
    state: voiceStateRaw,
    isListening,
    isListeningForWakeWord,
    isWakeWordDetected,
    isListeningCommand,
    isSpeaking,
    isProcessing,
    transcript,
    interimTranscript,
    audioLevel,
    startListening,
    stopListening,
    stopSpeaking,
    triggerManualWake,
    speak,
  } = useJarvisVoice({
    autoExecuteWakeCommands: true,
    onCommand: async (command, actionResponse) => {
      let targetConvId = activeId;
      if (!targetConvId) {
        targetConvId = createConversation();
      }
      if (targetConvId) {
        addMessage(targetConvId, {
          id: Date.now().toString(36),
          role: 'user',
          content: command,
          timestamp: Date.now(),
        });
        if (actionResponse?.message) {
          addMessage(targetConvId, {
            id: (Date.now() + 1).toString(36),
            role: 'assistant',
            content: actionResponse.message,
            timestamp: Date.now(),
          });
        }
      }
    },
  });

  // Calculate high-tech core state for Jarvis
  const coreState: JarvisCoreState = useMemo(() => {
    if (isExecutingAction) return 'executing';
    if (isWakeWordDetected) return 'wake_word_detected';
    if (isListeningForWakeWord) return 'listening_for_wake_word';
    if (isListeningCommand || isListening) return 'listening_command';
    if (isProcessing || streamState.isStreaming) return 'thinking';
    if (isSpeaking) return 'speaking';
    return 'idle';
  }, [
    isExecutingAction,
    isWakeWordDetected,
    isListeningForWakeWord,
    isListeningCommand,
    isListening,
    isProcessing,
    streamState.isStreaming,
    isSpeaking,
  ]);

  // Synchronize HologramEngine state with live system & voice states
  useEffect(() => {
    if (isWakeWordDetected) {
      hologramEngine.setAppearing('listening');
    } else if (isListeningCommand || isListening) {
      hologramEngine.setListening();
    } else if (isProcessing || streamState.isStreaming || isExecutingAction) {
      hologramEngine.setThinking();
    } else if (isSpeaking) {
      hologramEngine.setSpeaking();
    } else {
      hologramEngine.setIdle();
    }
  }, [isWakeWordDetected, isListeningCommand, isListening, isProcessing, streamState.isStreaming, isExecutingAction, isSpeaking]);

  // Execute a text command or vocal suggestion directly
  const handleExecutePrompt = async (promptText: string) => {
    setIsExecutingAction(true);
    hologramEngine.setThinking();
    try {
      let targetConvId = activeId;
      if (!targetConvId) {
        targetConvId = createConversation();
      }
      if (targetConvId) {
        addMessage(targetConvId, {
          id: Date.now().toString(36),
          role: 'user',
          content: promptText,
          timestamp: Date.now(),
        });
      }

      toast.info(`Exécution: "${promptText}"`);
      const res = await executeVoiceAction(promptText);
      if (res?.message && targetConvId) {
        addMessage(targetConvId, {
          id: (Date.now() + 1).toString(36),
          role: 'assistant',
          content: res.message,
          timestamp: Date.now(),
        });
        speak(res.message);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'exécution");
      hologramEngine.triggerAlertPulse();
    } finally {
      setIsExecutingAction(false);
    }
  };

  const handleToggleVoice = () => {
    if (isListening) {
      stopListening();
      hologramEngine.setIdle();
    } else if (isSpeaking) {
      stopSpeaking();
      hologramEngine.setIdle();
    } else {
      hologramEngine.setListening();
      startListening().catch(() => {
        setVoiceOverlayOpen(true);
      });
    }
  };

  const activeToolName = streamState.activeToolCalls?.[0]?.tool || null;

  return (
    <div
      className={`flex-1 flex flex-col h-full overflow-hidden bg-black text-slate-100 relative ${
        ecoMode ? 'jarvis-eco-mode' : ''
      } ${className}`}
    >
      {/* Dynamic Sci-Fi HUD Background Elements */}
      <div className="absolute inset-0 pointer-events-none jarvis-grid-bg opacity-35 z-0" />
      <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none z-0" />

      {/* 1. Futuristic Header HUD */}
      <JarvisHeaderHUD
        systemState={coreState}
        viewMode={viewMode}
        onToggleViewMode={onToggleViewMode}
        ecoMode={ecoMode}
        onToggleEcoMode={() => {
          const next = !ecoMode;
          setEcoMode(next);
          hologramEngine.setEcoMode(next);
        }}
        onOpenPermissionCenter={() => setPermissionModalOpen(true)}
        wakeWordEnabled={settings.wakeWordEnabled !== false}
        onToggleWakeWord={() => updateSettings({ wakeWordEnabled: settings.wakeWordEnabled === false ? true : false })}
        onOpenWakeWordTester={() => setWakeWordTesterOpen(true)}
        onOpenHologramStudio={() => setHologramStudioOpen(true)}
      />

      {/* Scrollable Container with balanced spacing for Android mobile & Desktop */}
      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6 relative z-10 space-y-6 max-w-5xl mx-auto w-full">
        {/* 2. System Zone: 6 Hardware Animated Gauges */}
        <JarvisSystemGauges ecoMode={ecoMode} />

        {/* 3. Central Zone: 3D Holographic Projection & Neural Core */}
        <div className="flex flex-col items-center justify-center py-2 sm:py-4 relative">
          
          {/* Display Mode Switcher (Hologram 3D vs Neural Core) */}
          <div className="flex items-center gap-2 mb-2 z-20">
            <div className="flex items-center p-0.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[10px] font-mono">
              <button
                onClick={() => setCenterDisplayMode('hologram')}
                className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-all ${
                  centerDisplayMode === 'hologram'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>HOLOGRAMME 3D</span>
              </button>

              <button
                onClick={() => setCenterDisplayMode('core')}
                className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-all ${
                  centerDisplayMode === 'core'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Cpu className="w-3 h-3 text-cyan-400" />
                <span>RÉACTEUR HUD</span>
              </button>
            </div>

            <button
              onClick={() => setHologramStudioOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono font-bold flex items-center gap-1 transition-colors shadow-sm"
              title="Ouvrir le Studio Holographique Complet (Contrôles 6 États)"
            >
              <Layers className="w-3 h-3 text-cyan-400" />
              <span className="hidden sm:inline">STUDIO 6 ÉTATS</span>
            </button>
          </div>

          {/* Central Visual Component */}
          {centerDisplayMode === 'hologram' ? (
            <div className="w-full max-w-md relative flex flex-col items-center">
              <JarvisHologramCanvas
                audioLevel={audioLevel}
                ecoMode={ecoMode}
                height={350}
                interactive={true}
                onCoreClick={handleToggleVoice}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-4 relative">
              <div className="absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full border border-cyan-500/10 pointer-events-none animate-pulse" />
              <JarvisNeuralCore
                state={coreState}
                audioLevel={audioLevel}
                onClick={handleToggleVoice}
                size="lg"
                ecoMode={ecoMode}
                activeToolName={activeToolName}
              />
            </div>
          )}
        </div>

        {/* 4. Assistant Zone: Interactive Futuristic Voice Trigger Button */}
        <div className="pt-2">
          <JarvisVoiceButton
            state={coreState}
            isListening={isListening}
            isSpeaking={isSpeaking}
            transcript={transcript}
            interimTranscript={interimTranscript}
            onToggleListening={handleToggleVoice}
            onSelectSuggestion={handleExecutePrompt}
            audioLevel={audioLevel}
          />
        </div>

        {/* 5. Quick Commands Zone: 9 Modular Functional Sci-Fi Cards */}
        <div className="pt-2">
          <JarvisQuickCommandsGrid
            onOpenAssistant={() => setVoiceOverlayOpen(true)}
            onOpenMessages={() => navigate('/communications')}
            onOpenNotifications={() => setNotificationsModalOpen(true)}
            onOpenPhone={() => setPhoneModalOpen(true)}
            onOpenWeather={() => setWeatherModalOpen(true)}
            onOpenSearch={() => navigate('/search')}
            onOpenAutomations={() => navigate('/automations')}
            onOpenMemory={() => setMemoryDrawerOpen(true)}
            onOpenSettings={() => setSettingsHUDOpen(true)}
            notificationCount={3}
          />
        </div>
      </div>

      {/* ----------------- Integrated Modals & Drawers ----------------- */}
      {/* 1. Hologram Studio Modal (Étape 4) */}
      <JarvisHologramStudioModal
        isOpen={hologramStudioOpen}
        onClose={() => setHologramStudioOpen(false)}
      />

      {/* 2. Phone Dialer */}
      <PhoneDialerModal
        isOpen={phoneModalOpen}
        onClose={() => setPhoneModalOpen(false)}
        onPlaceCall={(num) => handleExecutePrompt(`Appelle le numéro ${num}`)}
      />

      {/* 3. Notifications Modal */}
      <NotificationsModal
        isOpen={notificationsModalOpen}
        onClose={() => setNotificationsModalOpen(false)}
        onReadVocal={(text) => speak(text)}
      />

      {/* 4. Weather Modal */}
      <WeatherModal
        isOpen={weatherModalOpen}
        onClose={() => setWeatherModalOpen(false)}
      />

      {/* 5. Memory Drawer */}
      <JarvisMemoryDrawer
        isOpen={memoryDrawerOpen}
        onClose={() => setMemoryDrawerOpen(false)}
      />

      {/* 6. Settings HUD */}
      <JarvisSettingsHUD
        isOpen={settingsHUDOpen}
        onClose={() => setSettingsHUDOpen(false)}
        ecoMode={ecoMode}
        onToggleEcoMode={setEcoMode}
        onOpenWakeWordTester={() => setWakeWordTesterOpen(true)}
      />

      {/* 7. Voice Fullscreen Overlay */}
      <JarvisVoiceOverlay
        isOpen={voiceOverlayOpen}
        onClose={() => setVoiceOverlayOpen(false)}
        onNavigateToVision={() => {
          setVoiceOverlayOpen(false);
          if (onNavigateToVision) onNavigateToVision();
          else navigate('/vision');
        }}
      />

      {/* 8. Permission Center Modal */}
      <JarvisPermissionCenterModal
        isOpen={permissionModalOpen}
        onClose={() => setPermissionModalOpen(false)}
      />

      {/* 9. Wake Word Full Cycle Tester (Étape 3) */}
      <JarvisWakeWordTester
        isOpen={wakeWordTesterOpen}
        onClose={() => setWakeWordTesterOpen(false)}
      />
    </div>
  );
};

