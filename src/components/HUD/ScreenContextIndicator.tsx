import React, { useEffect, useState } from 'react';
import { Shield, ShieldAlert, ShieldCheck, Eye, EyeOff, X, Activity, Lock } from 'lucide-react';
import { screenContextProvider } from '../../lib/android/screen/screen-context-provider';
import { ScreenIndicatorState } from '../../lib/android/screen/types';

export function ScreenContextIndicator() {
  const [state, setState] = useState<ScreenIndicatorState>(screenContextProvider.getCurrentState());
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const unsubscribe = screenContextProvider.subscribeIndicator((newState) => {
      setState(newState);
      if (newState.isActive || newState.status === 'blocked_privacy') {
        setIsDismissed(false);
      }
    });
    return unsubscribe;
  }, []);

  // Only render if actively doing something or blocked, and not dismissed
  if ((!state.isActive && state.status !== 'blocked_privacy') || isDismissed) {
    return null;
  }

  const isBlocked = state.status === 'blocked_privacy';
  const isAuditing = state.status === 'auditing_privacy';
  const isCapturing = state.status === 'capturing';

  return (
    <div
      id="jarvis-screen-privacy-indicator"
      className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-md transition-all duration-300 border ${
        isBlocked
          ? 'bg-rose-950/90 text-rose-200 border-rose-500/50 shadow-rose-900/30'
          : isAuditing
          ? 'bg-amber-950/90 text-amber-200 border-amber-500/50 shadow-amber-900/30'
          : 'bg-emerald-950/90 text-emerald-200 border-emerald-500/50 shadow-emerald-900/30'
      }`}
      role="status"
      aria-live="polite"
    >
      {/* Animated Status Pulse */}
      <div className="relative flex items-center justify-center">
        <span
          className={`animate-ping absolute inline-flex h-3 w-3 rounded-full opacity-75 ${
            isBlocked ? 'bg-rose-400' : isAuditing ? 'bg-amber-400' : 'bg-emerald-400'
          }`}
        />
        <span
          className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
            isBlocked ? 'bg-rose-500' : isAuditing ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
        />
      </div>

      {/* Status Icon */}
      <div className="flex items-center gap-1.5">
        {isBlocked ? (
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
        ) : isAuditing ? (
          <Lock className="w-4 h-4 text-amber-400 shrink-0" />
        ) : (
          <Eye className="w-4 h-4 text-emerald-400 shrink-0" />
        )}
        <span className="text-xs font-semibold uppercase tracking-wider">
          {isBlocked
            ? 'FLAG_SECURE / Privé'
            : isAuditing
            ? 'Audit Confidentialité'
            : 'Capture Écran Ponctuelle'}
        </span>
      </div>

      {/* Message */}
      <p className="text-xs text-slate-200 max-w-[240px] truncate hidden sm:inline-block">
        {state.message}
      </p>

      {/* Dismiss / Stop Button */}
      <button
        id="dismiss-screen-indicator-btn"
        onClick={() => setIsDismissed(true)}
        className="ml-1 p-1 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
        title="Fermer l'indicateur"
        aria-label="Fermer l'indicateur de capture d'écran"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
