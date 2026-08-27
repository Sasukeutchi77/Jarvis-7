import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Wifi, 
  WifiOff, 
  Battery, 
  BatteryCharging, 
  Clock, 
  Activity, 
  Zap, 
  Leaf, 
  MessageSquare, 
  LayoutGrid,
  Radio,
  Sparkles
} from 'lucide-react';
import type { JarvisCoreState } from './JarvisNeuralCore';

interface JarvisHeaderHUDProps {
  systemState: JarvisCoreState;
  viewMode: 'hud' | 'chat';
  onToggleViewMode: () => void;
  ecoMode: boolean;
  onToggleEcoMode: () => void;
  onOpenPermissionCenter: () => void;
  wakeWordEnabled?: boolean;
  onToggleWakeWord?: () => void;
  onOpenWakeWordTester?: () => void;
  onOpenHologramStudio?: () => void;
  className?: string;
}

export const JarvisHeaderHUD: React.FC<JarvisHeaderHUDProps> = ({
  systemState,
  viewMode,
  onToggleViewMode,
  ecoMode,
  onToggleEcoMode,
  onOpenPermissionCenter,
  wakeWordEnabled = true,
  onToggleWakeWord,
  onOpenWakeWordTester,
  onOpenHologramStudio,
  className = '',
}) => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [batteryLevel, setBatteryLevel] = useState<number>(92);
  const [isCharging, setIsCharging] = useState<boolean>(false);
  const [ping, setPing] = useState<number>(16);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      setDateStr(
        now.toLocaleDateString('fr-FR', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
        }).toUpperCase()
      );
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any).getBattery().then((b: any) => {
        setBatteryLevel(Math.round(b.level * 100));
        setIsCharging(b.charging);
      }).catch(() => {});
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getStatusDisplay = () => {
    switch (systemState) {
      case 'listening':
        return { text: 'STATUS: LISTENING', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
      case 'thinking':
        return { text: 'STATUS: PROCESSING', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' };
      case 'speaking':
        return { text: 'STATUS: SPEAKING', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' };
      case 'executing':
        return { text: 'STATUS: EXECUTING', color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10 border-fuchsia-500/30' };
      case 'error':
        return { text: 'STATUS: ALERT', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' };
      case 'idle':
      default:
        return { text: 'STATUS: ONLINE', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/30' };
    }
  };

  const status = getStatusDisplay();

  return (
    <header
      className={`w-full px-3 py-2 sm:px-4 sm:py-2.5 bg-slate-950/90 border-b border-cyan-500/20 backdrop-blur-xl flex flex-wrap items-center justify-between gap-2 text-xs select-none relative z-30 ${className}`}
    >
      {/* Left: Brand / Title + Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-base sm:text-lg font-black tracking-widest font-mono text-cyan-400 jarvis-glow-text">
            J.A.R.V.I.S.
          </span>
          <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
            MARK VII
          </span>
        </div>

        {/* Dynamic Status Pill */}
        <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-bold tracking-wider ${status.bg} ${status.color}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
          <span>{status.text}</span>
        </div>
      </div>

      {/* Center: Live Clock & Date */}
      <div className="hidden md:flex items-center gap-3 font-mono text-[11px] text-slate-300">
        <div className="flex items-center gap-1 text-cyan-300">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-bold tracking-wider">{timeStr || '00:00:00'}</span>
        </div>
        <span className="text-slate-600">•</span>
        <span className="text-slate-400">{dateStr}</span>
      </div>

      {/* Right: Telemetry Badges & Control Toggles */}
      <div className="flex items-center gap-2">
        {/* Network status */}
        <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300">
          {isOnline ? (
            <Wifi className="w-3 h-3 text-cyan-400" />
          ) : (
            <WifiOff className="w-3 h-3 text-rose-400" />
          )}
          <span>{isOnline ? `${ping}ms` : 'OFFLINE'}</span>
        </div>

        {/* Battery status */}
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300">
          {isCharging ? (
            <BatteryCharging className="w-3 h-3 text-cyan-400 animate-pulse" />
          ) : (
            <Battery className="w-3 h-3 text-emerald-400" />
          )}
          <span>{batteryLevel}%</span>
        </div>

        {/* Wake Word Status & Toggle */}
        <button
          type="button"
          onClick={onToggleWakeWord || onOpenWakeWordTester}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border font-mono text-[10px] font-bold transition-all cursor-pointer ${
            wakeWordEnabled
              ? 'bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/40 text-cyan-300 shadow-sm shadow-cyan-500/10'
              : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-500'
          }`}
          title={
            wakeWordEnabled
              ? 'Activation Vocale "Hey JARVIS" Active — Cliquez pour configurer/tester'
              : 'Activation Vocale Désactivée — Cliquez pour activer'
          }
        >
          <Radio className={`w-3 h-3 ${wakeWordEnabled ? 'text-cyan-400 animate-pulse' : 'text-slate-600'}`} />
          <span className="hidden sm:inline">WAKE WORD:</span>
          <span>{wakeWordEnabled ? 'ON' : 'OFF'}</span>
        </button>

        {/* Hologram Studio Trigger */}
        {onOpenHologramStudio && (
          <button
            type="button"
            onClick={onOpenHologramStudio}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-cyan-500/40 bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 font-mono text-[10px] font-bold transition-all cursor-pointer shadow-sm shadow-cyan-500/10"
            title="Ouvrir le Studio Hologramme JARVIS (Contrôles 6 États & Rendu 3D)"
          >
            <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
            <span className="hidden sm:inline">HOLOGRAMME</span>
          </button>
        )}

        {/* Eco Mode Toggle */}
        <button
          type="button"
          onClick={onToggleEcoMode}
          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
            ecoMode
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title={ecoMode ? 'Mode Éco Activé (Animations réduites)' : 'Activer le Mode Éco'}
        >
          <Leaf className="w-3.5 h-3.5" />
        </button>

        {/* Switch View Mode (HUD vs Chat Log) */}
        <button
          type="button"
          onClick={onToggleViewMode}
          className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-mono text-[10px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
          title="Basculer entre le HUD Futuriste et le Journal de Discussion"
        >
          {viewMode === 'hud' ? (
            <>
              <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Journal Chat</span>
            </>
          ) : (
            <>
              <LayoutGrid className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">HUD Principal</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
