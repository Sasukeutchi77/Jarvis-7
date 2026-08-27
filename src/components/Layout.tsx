import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { Mic, Sparkles, Lock, Unlock, ShieldCheck, ShieldAlert, Zap } from 'lucide-react';
import { Sidebar } from './Sidebar/Sidebar';
import { JarvisVoiceOverlay } from './Voice/JarvisVoiceOverlay';
import { IdentityConfirmationModal } from './Security/IdentityConfirmationModal';
import { ScreenContextIndicator } from './HUD/ScreenContextIndicator';
import { JarvisPermissionCenterModal } from './Android/JarvisPermissionCenterModal';
import { useAppStore } from '../lib/store';

export function Layout() {
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [permissionCenterOpen, setPermissionCenterOpen] = useState(false);
  const navigate = useNavigate();

  const jarvisIsLocked = useAppStore((s) => s.jarvisIsLocked);
  const jarvisAuthEnabled = useAppStore((s) => s.jarvisAuthEnabled);
  const identityModalOpen = useAppStore((s) => s.identityModalOpen);
  const setIdentityModalOpen = useAppStore((s) => s.setIdentityModalOpen);
  const lockJarvis = useAppStore((s) => s.lockJarvis);

  const handleVoiceTrigger = () => {
    if (jarvisAuthEnabled && jarvisIsLocked) {
      setIdentityModalOpen(true);
    } else {
      setVoiceOpen(true);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 antialiased relative">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* Top Quick Status Bar for JARVIS Device Readiness */}
        <header className="h-10 px-4 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md flex items-center justify-between text-xs shrink-0 z-20">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-slate-400 font-mono text-[11px]">J.A.R.V.I.S. Android Core</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="btn-layout-voice-trigger"
              onClick={handleVoiceTrigger}
              className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-cyan-500/20 active:scale-95 animate-pulse"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Expérience Vocale JARVIS</span>
            </button>

            <button
              onClick={() => setPermissionCenterOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:shadow-cyan-500/10 active:scale-95"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Permission Center</span>
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          <Outlet />
        </div>
      </main>

      <JarvisVoiceOverlay
        isOpen={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onNavigateToVision={() => navigate('/vision')}
      />

      {/* Visible Screen Privacy & MediaProjection Indicator (Phase 6) */}
      <ScreenContextIndicator />

      {/* JARVIS Permission & Capability Center Modal */}
      <JarvisPermissionCenterModal
        isOpen={permissionCenterOpen}
        onClose={() => setPermissionCenterOpen(false)}
      />

      {/* Identity Verification Modal */}
      <IdentityConfirmationModal
        isOpen={identityModalOpen}
        onSuccess={() => {
          setIdentityModalOpen(false);
          setVoiceOpen(true);
        }}
        onCancel={() => setIdentityModalOpen(false)}
        title="Confirmation d'Identité Vocale ou PIN"
        reason="Accès complet au téléphone protégé contre toute utilisation non autorisée."
      />
    </div>
  );
}
