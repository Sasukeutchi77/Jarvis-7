import React, { useMemo } from 'react';
import { 
  Mic, 
  Volume2, 
  Sparkles, 
  Zap, 
  Radio, 
  ShieldCheck, 
  AlertTriangle, 
  Cpu, 
  Activity,
  Compass
} from 'lucide-react';

export type JarvisCoreState =
  | 'idle'
  | 'listening_for_wake_word'
  | 'wake_word_detected'
  | 'listening_command'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'executing'
  | 'stopped'
  | 'error';

interface JarvisNeuralCoreProps {
  state: JarvisCoreState;
  audioLevel?: number; // 0 to 100
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  ecoMode?: boolean;
  activeToolName?: string | null;
  className?: string;
}

export const JarvisNeuralCore: React.FC<JarvisNeuralCoreProps> = ({
  state,
  audioLevel = 0,
  onClick,
  size = 'lg',
  ecoMode = false,
  activeToolName,
  className = '',
}) => {
  // Size metrics
  const dimensions = useMemo(() => {
    switch (size) {
      case 'sm':
        return { container: 'w-44 h-44', core: 'w-20 h-20', scale: 0.65 };
      case 'md':
        return { container: 'w-64 h-64', core: 'w-28 h-28', scale: 0.85 };
      case 'xl':
        return { container: 'w-88 h-88 sm:w-96 sm:h-96', core: 'w-36 h-36 sm:w-40 sm:h-40', scale: 1.15 };
      case 'lg':
      default:
        return { container: 'w-72 h-72 sm:w-84 sm:h-84', core: 'w-32 h-32 sm:w-36 sm:h-36', scale: 1 };
    }
  }, [size]);

  // Status configuration: colors, glows, animations, labels
  const stateConfig = useMemo(() => {
    switch (state) {
      case 'wake_word_detected':
        return {
          label: 'WAKE WORD DÉTECTÉ',
          sub: 'ACCUSÉ DE RÉCEPTION • "OUI ? "',
          auraColor: 'from-amber-400/50 via-cyan-400/40 to-blue-600/20',
          glowBorder: 'shadow-[0_0_70px_rgba(251,191,36,0.8)] border-amber-300 ring-4 ring-amber-400/40',
          primaryStroke: '#f59e0b',
          secondaryStroke: '#06b6d4',
          accentColor: '#fbbf24',
          textColor: 'text-amber-200 font-black',
          badgeBg: 'bg-amber-950/90 border-amber-400/80 text-amber-300',
          icon: Zap,
          pulseClass: 'animate-jarvis-spin-fast',
        };
      case 'listening_for_wake_word':
        return {
          label: 'VEILLE ACOUSTIQUE',
          sub: 'ATTENTE "HEY JARVIS"',
          auraColor: 'from-cyan-500/25 via-blue-500/15 to-transparent',
          glowBorder: 'shadow-[0_0_40px_rgba(6,182,212,0.35)] border-cyan-500/40',
          primaryStroke: '#06b6d4',
          secondaryStroke: '#3b82f6',
          accentColor: '#38bdf8',
          textColor: 'text-cyan-300',
          badgeBg: 'bg-cyan-950/70 border-cyan-500/40 text-cyan-300',
          icon: Radio,
          pulseClass: 'animate-jarvis-spin-slow',
        };
      case 'listening_command':
      case 'listening':
        return {
          label: 'ÉCOUTE ACTIVE',
          sub: 'TRANSCRIPTION DE COMMANDE',
          auraColor: 'from-cyan-500/45 via-emerald-500/30 to-blue-600/15',
          glowBorder: 'shadow-[0_0_65px_rgba(6,182,212,0.7)] border-cyan-400',
          primaryStroke: '#06b6d4',
          secondaryStroke: '#10b981',
          accentColor: '#34d399',
          textColor: 'text-cyan-300',
          badgeBg: 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300',
          icon: Mic,
          pulseClass: 'animate-jarvis-ripple',
        };
      case 'thinking':
        return {
          label: 'TRAITEMENT NEURONAL',
          sub: activeToolName ? `EXÉCUTION : ${activeToolName}` : 'SYNTHÈSE MULTI-AGENTS',
          auraColor: 'from-amber-500/40 via-cyan-500/25 to-purple-600/15',
          glowBorder: 'shadow-[0_0_60px_rgba(245,158,11,0.55)] border-amber-400',
          primaryStroke: '#f59e0b',
          secondaryStroke: '#06b6d4',
          accentColor: '#fbbf24',
          textColor: 'text-amber-300',
          badgeBg: 'bg-amber-950/80 border-amber-500/60 text-amber-300',
          icon: Sparkles,
          pulseClass: 'animate-jarvis-spin-fast',
        };
      case 'speaking':
        return {
          label: 'SYNTHÈSE VOCALE',
          sub: 'RETRANSMISSION AUDIO',
          auraColor: 'from-blue-500/45 via-cyan-400/30 to-indigo-600/20',
          glowBorder: 'shadow-[0_0_60px_rgba(59,130,246,0.65)] border-blue-400',
          primaryStroke: '#3b82f6',
          secondaryStroke: '#06b6d4',
          accentColor: '#60a5fa',
          textColor: 'text-blue-200',
          badgeBg: 'bg-blue-950/80 border-blue-500/60 text-blue-300',
          icon: Volume2,
          pulseClass: 'animate-jarvis-pulse',
        };
      case 'executing':
        return {
          label: 'EXÉCUTION SYSTÈME',
          sub: 'PONT ANDROID ACCESSIBILITY',
          auraColor: 'from-fuchsia-500/40 via-cyan-500/30 to-blue-600/15',
          glowBorder: 'shadow-[0_0_60px_rgba(217,70,239,0.55)] border-fuchsia-400',
          primaryStroke: '#d946ef',
          secondaryStroke: '#06b6d4',
          accentColor: '#e879f9',
          textColor: 'text-fuchsia-300',
          badgeBg: 'bg-fuchsia-950/80 border-fuchsia-500/60 text-fuchsia-300',
          icon: Zap,
          pulseClass: 'animate-jarvis-radar',
        };
      case 'error':
        return {
          label: 'DIAGNOSTIC ALERTE',
          sub: 'DÉFAILLANCE OU SÉCURITÉ',
          auraColor: 'from-rose-500/40 via-amber-500/25 to-red-600/15',
          glowBorder: 'shadow-[0_0_60px_rgba(244,63,94,0.6)] border-rose-500',
          primaryStroke: '#f43f5e',
          secondaryStroke: '#f59e0b',
          accentColor: '#fb7185',
          textColor: 'text-rose-400',
          badgeBg: 'bg-rose-950/80 border-rose-500/60 text-rose-300',
          icon: AlertTriangle,
          pulseClass: 'animate-pulse',
        };
      case 'idle':
      default:
        return {
          label: 'JARVIS ONLINE',
          sub: 'STANDBY • PRÊT',
          auraColor: 'from-cyan-500/20 via-blue-600/10 to-transparent',
          glowBorder: 'shadow-[0_0_35px_rgba(6,182,212,0.25)] border-cyan-500/40',
          primaryStroke: '#06b6d4',
          secondaryStroke: '#3b82f6',
          accentColor: '#38bdf8',
          textColor: 'text-cyan-400',
          badgeBg: 'bg-slate-900/80 border-cyan-500/30 text-cyan-300',
          icon: Radio,
          pulseClass: 'animate-jarvis-spin',
        };
    }
  }, [state, activeToolName]);

  const CurrentIcon = stateConfig.icon;
  const audioFactor = Math.min(1.3, 1 + (audioLevel / 100) * 0.35);

  return (
    <div
      onClick={onClick}
      className={`relative flex items-center justify-center ${dimensions.container} select-none cursor-pointer transition-transform duration-300 active:scale-98 ${className}`}
    >
      {/* 1. Holographic Ambient Background Blur */}
      {!ecoMode && (
        <div
          className={`absolute inset-0 rounded-full bg-gradient-radial ${stateConfig.auraColor} blur-3xl pointer-events-none transition-all duration-500`}
          style={{
            transform: `scale(${audioFactor * 1.1})`,
            opacity: state === 'idle' ? 0.35 : 0.85,
          }}
        />
      )}

      {/* 2. Concentric Multi-Ring SVG Sci-Fi HUD Engine */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 340 340"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="coreCyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.9" />
          </linearGradient>

          <linearGradient id="coreAmberGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#d946ef" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.9" />
          </linearGradient>

          <linearGradient id="coreRoseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        {/* Ring 1: Outer Tachymetric Ring (Clockwise Rotation) */}
        <g
          className={
            ecoMode
              ? ''
              : state === 'thinking'
              ? 'animate-jarvis-spin-fast'
              : 'animate-jarvis-spin'
          }
          style={{ transformOrigin: 'center' }}
        >
          <circle
            cx="170"
            cy="170"
            r="160"
            stroke={state === 'error' ? 'url(#coreRoseGrad)' : state === 'thinking' ? 'url(#coreAmberGrad)' : 'url(#coreCyanGrad)'}
            strokeWidth="1.5"
            strokeDasharray={state === 'thinking' ? '14 8 2 8' : '30 15 5 15'}
            opacity={state === 'idle' ? 0.35 : 0.8}
          />
          {/* Orbital Satellites */}
          <circle cx="170" cy="10" r="3.5" fill={stateConfig.accentColor} />
          <circle cx="330" cy="170" r="2.5" fill={stateConfig.secondaryStroke} />
          <circle cx="170" cy="330" r="3.5" fill={stateConfig.accentColor} />
          <circle cx="10" cy="170" r="2.5" fill={stateConfig.secondaryStroke} />
        </g>

        {/* Ring 2: Segmented Azimuth Ring (Counter-Clockwise Rotation) */}
        <g
          className={
            ecoMode
              ? ''
              : state === 'thinking'
              ? 'animate-jarvis-spin-reverse-fast'
              : 'animate-jarvis-spin-reverse'
          }
          style={{ transformOrigin: 'center' }}
        >
          <circle
            cx="170"
            cy="170"
            r="138"
            stroke={stateConfig.primaryStroke}
            strokeWidth="1.2"
            strokeDasharray="60 12 8 12"
            opacity={state === 'idle' ? 0.25 : 0.7}
          />
          {/* HUD Reticle Crosshairs */}
          <line x1="170" y1="38" x2="170" y2="48" stroke={stateConfig.primaryStroke} strokeWidth="2" />
          <line x1="170" y1="292" x2="170" y2="302" stroke={stateConfig.primaryStroke} strokeWidth="2" />
          <line x1="38" y1="170" x2="48" y2="170" stroke={stateConfig.primaryStroke} strokeWidth="2" />
          <line x1="292" y1="170" x2="302" y2="170" stroke={stateConfig.primaryStroke} strokeWidth="2" />
        </g>

        {/* Ring 3: Wave Reactor Ring (Audio-Reactive Scale) */}
        <circle
          cx="170"
          cy="170"
          r={114 + (audioLevel > 5 ? (audioLevel / 100) * 16 : 0)}
          stroke={stateConfig.secondaryStroke}
          strokeWidth={state === 'listening' || state === 'speaking' ? '2.5' : '1.5'}
          strokeDasharray={state === 'speaking' ? '8 4' : '20 10'}
          opacity={state === 'idle' ? 0.3 : 0.85}
          className="transition-all duration-100 ease-out"
        />

        {/* Ring 4: Inner High-Density Dotted Matrix */}
        <circle
          cx="170"
          cy="170"
          r="92"
          stroke="rgba(6, 182, 212, 0.4)"
          strokeWidth="1"
          strokeDasharray="3 7"
          className={ecoMode ? '' : 'animate-jarvis-spin-medium'}
          style={{ transformOrigin: 'center' }}
        />

        {/* Radar Sweep Effect for Executing / Active state */}
        {state === 'executing' && (
          <g className="animate-jarvis-radar" style={{ transformOrigin: 'center' }}>
            <line x1="170" y1="170" x2="170" y2="20" stroke="url(#coreCyanGrad)" strokeWidth="2" />
            <polygon points="170,170 190,25 150,25" fill="rgba(6,182,212,0.15)" />
          </g>
        )}
      </svg>

      {/* 3. Central Arc Reactor Core */}
      <div
        className={`relative ${dimensions.core} rounded-full bg-slate-950/95 border-2 flex flex-col items-center justify-center p-3 transition-all duration-300 z-10 ${stateConfig.glowBorder}`}
        style={{
          transform: `scale(${audioFactor})`,
        }}
      >
        {/* Core Reactor Texture & Glow */}
        <div className="absolute inset-2 rounded-full bg-gradient-to-b from-slate-900 to-slate-950 border border-cyan-500/30 flex items-center justify-center overflow-hidden">
          {/* Pulsing inner lattice */}
          <div
            className={`w-full h-full rounded-full opacity-30 ${
              state === 'idle' ? 'animate-jarvis-pulse' : 'animate-ping'
            }`}
            style={{ backgroundColor: stateConfig.primaryStroke }}
          />

          {/* Central Hologram Glyphs / Icon */}
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
            <CurrentIcon className={`w-8 h-8 sm:w-10 sm:h-10 ${stateConfig.textColor} transition-transform duration-300 ${state === 'speaking' ? 'animate-bounce' : ''}`} />
            
            {/* Audio Wave Amplitude Bars */}
            {(state === 'listening' || state === 'speaking') && (
              <div className="flex items-center gap-0.5 mt-1.5 h-3">
                {[40, 75, 100, 60, 90, 45, 80].map((h, i) => (
                  <span
                    key={i}
                    className="w-0.5 rounded-full bg-cyan-400 transition-all duration-75"
                    style={{
                      height: `${Math.max(3, (audioLevel / 100) * (h * 0.12))}px`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Peripheral HUD Telemetry Indicators */}
      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center pointer-events-none z-20 whitespace-nowrap">
        <div className={`px-3 py-0.5 rounded-full border text-[10px] font-mono font-bold tracking-widest uppercase shadow-lg ${stateConfig.badgeBg}`}>
          {stateConfig.label}
        </div>
        <div className="text-[9px] font-mono text-slate-400 mt-0.5 tracking-wider">
          {stateConfig.sub}
        </div>
      </div>
    </div>
  );
};
