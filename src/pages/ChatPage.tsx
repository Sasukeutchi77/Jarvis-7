import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Zap,
  Sparkles,
  MessageSquare,
  LayoutGrid,
  Volume2,
  VolumeX,
  Plus,
  Compass,
  ArrowRight,
  ShieldCheck,
  Activity,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAppStore } from '../lib/store';
import { useJarvisVoice } from '../hooks/useJarvisVoice';
import { MessageBubble } from '../components/Chat/MessageBubble';
import { InputArea } from '../components/Chat/InputArea';
import { JarvisFuturisticHUD } from '../components/HUD/JarvisFuturisticHUD';
import { JarvisTelemetryBar } from '../components/HUD/JarvisTelemetryBar';
import { JarvisMemoryDrawer } from '../components/HUD/JarvisMemoryDrawer';
import { JarvisSettingsHUD } from '../components/HUD/JarvisSettingsHUD';
import { JarvisVoiceOverlay } from '../components/Voice/JarvisVoiceOverlay';

export function ChatPage() {
  const navigate = useNavigate();

  // App Store
  const messages = useAppStore((s) => s.messages);
  const streamState = useAppStore((s) => s.streamState);
  const activeId = useAppStore((s) => s.activeId);
  const addMessage = useAppStore((s) => s.addMessage);
  const createConversation = useAppStore((s) => s.createConversation);
  const settings = useAppStore((s) => s.settings);

  // View mode: 'hud' (futuristic sci-fi assistant HUD) vs 'chat' (detailed message journal)
  const [viewMode, setViewMode] = useState<'hud' | 'chat'>('hud');
  const [memoryDrawerOpen, setMemoryDrawerOpen] = useState(false);
  const [settingsHUDOpen, setSettingsHUDOpen] = useState(false);
  const [voiceOverlayOpen, setVoiceOverlayOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll in chat mode
  useEffect(() => {
    if (viewMode === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamState.content, viewMode]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-black text-slate-100 relative">
      {viewMode === 'hud' ? (
        /* -----------------------------------------------------------
           1. PRIMARY SCI-FI FUTURISTIC HUD INTERFACE (ÉTAPE 2/10)
        ----------------------------------------------------------- */
        <JarvisFuturisticHUD
          viewMode="hud"
          onToggleViewMode={() => setViewMode('chat')}
          onNavigateToVision={() => navigate('/vision')}
        />
      ) : (
        /* -----------------------------------------------------------
           2. DETAILED CHAT JOURNAL & TRACE TIMELINE VIEW
        ----------------------------------------------------------- */
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100 relative">
          {/* Top Bar */}
          <div className="w-full px-4 py-2 bg-slate-900/90 border-b border-cyan-500/20 backdrop-blur-md flex items-center justify-between z-20">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span className="font-mono text-xs font-bold text-cyan-400">
                JOURNAL DE CONVERSATION & TRACES IA
              </span>
              <span className="text-slate-500 text-xs font-mono">
                ({messages.length} messages)
              </span>
            </div>

            <button
              type="button"
              onClick={() => setViewMode('hud')}
              className="px-3 py-1 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-cyan-400" />
              <span>Ouvrir le HUD Principal</span>
            </button>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 max-w-4xl mx-auto w-full z-10">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-16">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-3 shadow-lg shadow-cyan-500/10">
                  <Zap className="w-7 h-7 animate-pulse" />
                </div>
                <h3 className="text-base font-bold text-slate-100 mb-1">
                  Journal de Dialogue Ouvert
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Les réponses vocales, actions Android et décompositions d'agents s'afficheront ici avec le détail technique.
                </p>
                <button
                  type="button"
                  onClick={() => setViewMode('hud')}
                  className="px-4 py-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-semibold hover:bg-cyan-500/30 transition-all cursor-pointer active:scale-95"
                >
                  Revenir au HUD Futuriste
                </button>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Chat Input Bar */}
          <div className="relative z-20">
            <InputArea />
          </div>
        </div>
      )}
    </div>
  );
}
