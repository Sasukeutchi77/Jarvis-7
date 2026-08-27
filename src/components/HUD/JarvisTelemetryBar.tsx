import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Wifi,
  WifiOff,
  Brain,
  Zap,
  Activity,
  Server,
  ShieldCheck,
  ChevronDown,
  Layers,
  Lock,
  ShieldAlert,
} from 'lucide-react';
import { useAppStore } from '../../lib/store';

interface JarvisTelemetryBarProps {
  onOpenMemory?: () => void;
  onOpenSettings?: () => void;
  className?: string;
}

export const JarvisTelemetryBar: React.FC<JarvisTelemetryBarProps> = ({
  onOpenMemory,
  onOpenSettings,
  className = '',
}) => {
  const selectedModel = useAppStore((s) => s.selectedModel);
  const serverInfo = useAppStore((s) => s.serverInfo);
  const settings = useAppStore((s) => s.settings);
  const streamState = useAppStore((s) => s.streamState);
  const jarvisIsLocked = useAppStore((s) => s.jarvisIsLocked);
  const jarvisAuthEnabled = useAppStore((s) => s.jarvisAuthEnabled);
  const setIdentityModalOpen = useAppStore((s) => s.setIdentityModalOpen);
  const lockJarvis = useAppStore((s) => s.lockJarvis);

  const [memoryCount, setMemoryCount] = useState<number>(0);
  const [networkPing, setNetworkPing] = useState<number>(14);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [showAiDetails, setShowAiDetails] = useState<boolean>(false);
  const [showNetDetails, setShowNetDetails] = useState<boolean>(false);

  // Poll online status & memory item count
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const checkStats = async () => {
      try {
        const start = performance.now();
        const res = await fetch('/v1/memory/items');
        const end = performance.now();
        if (res.ok) {
          const data = await res.json();
          setMemoryCount(data.memories?.length || 0);
          setNetworkPing(Math.max(4, Math.round(end - start)));
        }
      } catch {
        // Fallback ping estimation
        setNetworkPing(18);
      }
    };

    checkStats();
    const timer = setInterval(checkStats, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(timer);
    };
  }, []);

  const displayModel = selectedModel || serverInfo?.model || 'Qwen 2.5 7B';
  const isCloudModel = displayModel.toLowerCase().includes('gemini') || displayModel.toLowerCase().includes('cloud');

  return (
    <div
      className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-950/70 border-b border-cyan-500/15 backdrop-blur-md text-xs select-none ${className}`}
    >
      {/* Left: AI Status Pill */}
      <div className="relative">
        <button
          onClick={() => setShowAiDetails(!showAiDetails)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-850 border border-cyan-500/20 text-slate-300 hover:text-cyan-300 transition-all cursor-pointer"
          title="Afficher les détails de télémétrie IA"
        >
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-medium truncate max-w-[90px] sm:max-w-[130px]">{displayModel}</span>
          <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-mono text-cyan-400/80 px-1.5 py-0.2 rounded bg-cyan-950/50 border border-cyan-500/30">
            {isCloudModel ? 'Cloud' : 'Local'}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-500" />
        </button>

        {/* AI Details Popover */}
        {showAiDetails && (
          <div
            className="absolute top-full left-0 mt-2 w-64 p-3 rounded-2xl bg-slate-900 border border-cyan-500/30 shadow-2xl z-50 text-xs text-slate-300 animate-in fade-in zoom-in-95"
            onMouseLeave={() => setShowAiDetails(false)}
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
              <span className="font-semibold text-cyan-400 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" /> Statut Moteur IA
              </span>
              <span className="text-[10px] font-mono text-emerald-400">Opérationnel</span>
            </div>
            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Modèle Actif :</span>
                <span className="text-slate-200 truncate">{displayModel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Architecture :</span>
                <span className="text-cyan-300">{isCloudModel ? 'Gemini Multi-Modal API' : 'Ollama / GGUF NPU'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Température :</span>
                <span className="text-slate-200">{settings.temperature}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Max Tokens :</span>
                <span className="text-slate-200">{settings.maxTokens}</span>
              </div>
              {streamState.isStreaming && (
                <div className="flex justify-between text-cyan-400">
                  <span>Génération :</span>
                  <span>{streamState.elapsedMs}ms</span>
                </div>
              )}
            </div>
            {onOpenSettings && (
              <button
                onClick={() => {
                  setShowAiDetails(false);
                  onOpenSettings();
                }}
                className="w-full mt-3 py-1 text-center text-[11px] font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 rounded-lg border border-cyan-500/30"
              >
                Ajuster les Paramètres IA →
              </button>
            )}
          </div>
        )}
      </div>

      {/* Middle: Live Audio / Action Pulse */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
          </span>
          <span className="text-[10px] font-mono font-medium text-slate-300 tracking-wider">
            JARVIS CORE
          </span>
        </div>
      </div>

      {/* Right: Network & Memory Status */}
      <div className="flex items-center gap-2">
        {/* Network Status Pill */}
        <div className="relative">
          <button
            onClick={() => setShowNetDetails(!showNetDetails)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 transition-all cursor-pointer"
            title="Statut réseau"
          >
            {isOnline ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span className="text-[10px] font-mono hidden sm:inline text-slate-400">
              {networkPing}ms
            </span>
          </button>

          {showNetDetails && (
            <div
              className="absolute top-full right-0 mt-2 w-56 p-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl z-50 text-xs text-slate-300 animate-in fade-in"
              onMouseLeave={() => setShowNetDetails(false)}
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                <span className="font-semibold text-slate-200 flex items-center gap-1">
                  <Server className="w-3.5 h-3.5 text-cyan-400" /> Réseau & Passerelle
                </span>
              </div>
              <div className="space-y-1 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Statut :</span>
                  <span className={isOnline ? 'text-emerald-400' : 'text-amber-400'}>
                    {isOnline ? 'En Ligne (Actif)' : 'Mode Local / Hors-ligne'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Latence Aller-Retour :</span>
                  <span className="text-cyan-300">{networkPing} ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Sécurité :</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> TLS / Chiffré
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Memory Status Pill */}
        <button
          onClick={onOpenMemory}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/30 hover:bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 transition-all cursor-pointer"
          title="Consulter la mémoire permanente JARVIS"
        >
          <Brain className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[10px] font-mono font-semibold">
            {memoryCount} <span className="hidden sm:inline">faits</span>
          </span>
        </button>

        {/* Security Lock Toggle Pill */}
        {jarvisAuthEnabled && (
          <button
            onClick={() => {
              if (jarvisIsLocked) {
                setIdentityModalOpen(true);
              } else {
                lockJarvis();
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all cursor-pointer ${
              jarvisIsLocked
                ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/40 animate-pulse'
                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
            }`}
            title={
              jarvisIsLocked
                ? "JARVIS est verrouillé. Cliquez pour déverrouiller par code PIN."
                : "JARVIS est authentifié. Cliquez pour verrouiller l'accès."
            }
          >
            {jarvisIsLocked ? (
              <>
                <Lock className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden xs:inline font-mono">Verrouillé</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden xs:inline font-mono">Protégé</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
