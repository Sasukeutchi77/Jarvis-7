import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  Mic,
  MicOff,
  KeyRound,
  Delete,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  Volume2,
  Sparkles,
  Fingerprint,
} from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { AndroidBridge } from '../../lib/android-bridge';
import { sanitizeSpeechText, matchSecurityCode } from '../../lib/tts-sanitizer';

interface IdentityConfirmationModalProps {
  isOpen: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
  title?: string;
  reason?: string;
}

export const IdentityConfirmationModal: React.FC<IdentityConfirmationModalProps> = ({
  isOpen,
  onSuccess,
  onCancel,
  title = "Confirmation d'Identité Requise",
  reason = "Accès intégral au téléphone et aux commandes système protégé",
}) => {
  const jarvisSecurityCode = useAppStore((s) => s.jarvisSecurityCode);
  const userName = useAppStore((s) => s.userName);
  const unlockJarvis = useAppStore((s) => s.unlockJarvis);
  const settings = useAppStore((s) => s.settings);

  const [inputCode, setInputCode] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [spokenTranscript, setSpokenTranscript] = useState('');
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const recognitionRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const hasPromptedVocallyRef = useRef(false);

  // Play vocal prompt when the modal opens
  const speakPrompt = useCallback((text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && settings.ttsEnabled) {
      try {
        window.speechSynthesis.cancel();
        const cleanText = sanitizeSpeechText(text);
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = settings.voiceLanguage || 'fr-FR';
        utterance.rate = Math.max(0.8, Math.min(1.4, settings.voiceRate || 1.0));
        utterance.pitch = settings.voicePitch || 1.0;
        utterance.volume = settings.voiceVolume ?? 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Speech prompt error:', e);
      }
    }
  }, [settings]);

  // Handle successful validation
  const handleSuccess = useCallback(() => {
    setStatus('success');
    setErrorMessage(null);
    AndroidBridge.vibrate('success');

    const successMessage = `Identité confirmée, Monsieur ${userName || 'Stark'}. Protocoles de sécurité déverrouillés, accès complet au téléphone accordé.`;
    speakPrompt(successMessage);

    setTimeout(() => {
      unlockJarvis(jarvisSecurityCode);
      if (onSuccess) onSuccess();
      // Reset local states
      setStatus('idle');
      setInputCode('');
      setSpokenTranscript('');
    }, 1200);
  }, [userName, jarvisSecurityCode, unlockJarvis, onSuccess, speakPrompt]);

  // Handle verification failure
  const handleFailure = useCallback((attempted: string) => {
    setStatus('failed');
    AndroidBridge.vibrate('error');
    setErrorMessage('Code vocal ou PIN incorrect. Accès restreint.');

    speakPrompt("Accès refusé. Code de confirmation incorrect. Protection des accès système active.");

    setTimeout(() => {
      setStatus('idle');
      setInputCode('');
      setSpokenTranscript('');
    }, 1800);
  }, [speakPrompt]);

  // Check code candidate
  const evaluateCode = useCallback((candidate: string) => {
    if (!candidate.trim()) return;
    setStatus('verifying');

    const isMatch = matchSecurityCode(candidate, jarvisSecurityCode);
    if (isMatch) {
      handleSuccess();
    } else {
      handleFailure(candidate);
    }
  }, [jarvisSecurityCode, handleSuccess, handleFailure]);

  // Start voice recognition to capture spoken passcode
  const startVoiceCapture = useCallback(() => {
    if (typeof window === 'undefined') return;

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setErrorMessage('Reconnaissance vocale non supportée par votre navigateur.');
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }

      const rec = new SpeechRec();
      rec.lang = settings.voiceLanguage || 'fr-FR';
      rec.continuous = true;
      rec.interimResults = true;

      rec.onstart = () => {
        setIsListening(true);
        setErrorMessage(null);
      };

      rec.onresult = (event: any) => {
        let current = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          current += event.results[i][0].transcript;
        }

        if (current) {
          setSpokenTranscript(current);
          // Check if the current spoken transcript matches the master code
          if (matchSecurityCode(current, jarvisSecurityCode)) {
            try { rec.stop(); } catch {}
            setIsListening(false);
            handleSuccess();
          }
        }
      };

      rec.onerror = (e: any) => {
        if (e.error !== 'no-speech') {
          console.warn('Voice security recognition error:', e.error);
        }
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (e: any) {
      console.warn('Failed to start voice recognition:', e);
      setIsListening(false);
    }
  }, [settings.voiceLanguage, jarvisSecurityCode, handleSuccess]);

  const stopVoiceCapture = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  // When modal opens: start voice recognition and prompt user vocally
  useEffect(() => {
    if (isOpen) {
      setInputCode('');
      setSpokenTranscript('');
      setStatus('idle');
      setErrorMessage(null);

      if (!hasPromptedVocallyRef.current) {
        hasPromptedVocallyRef.current = true;
        speakPrompt(
          `Protocole de sécurité. Veuillez énoncer ou saisir votre code secret pour déverrouiller l'accès complet au téléphone.`
        );
      }

      // Auto start voice listening after slight delay for speech synthesis initialization
      const timer = setTimeout(() => {
        startVoiceCapture();
      }, 700);

      return () => {
        clearTimeout(timer);
        stopVoiceCapture();
      };
    } else {
      hasPromptedVocallyRef.current = false;
      stopVoiceCapture();
    }
  }, [isOpen, speakPrompt, startVoiceCapture, stopVoiceCapture]);

  if (!isOpen) return null;

  // Keypad click handler
  const handleKeypadPress = (val: string) => {
    AndroidBridge.vibrate('light');
    if (inputCode.length < 12) {
      const next = inputCode + val;
      setInputCode(next);
      if (next.length >= jarvisSecurityCode.length) {
        evaluateCode(next);
      }
    }
  };

  const handleKeypadDelete = () => {
    AndroidBridge.vibrate('light');
    setInputCode((prev) => prev.slice(0, -1));
  };

  const handleKeypadSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    evaluateCode(inputCode || spokenTranscript);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900/95 border border-cyan-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-cyan-950/70 text-center space-y-5 overflow-hidden">
        {/* Background Arc Reactor Ambient Glow */}
        <div
          className={`absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl pointer-events-none transition-all duration-500 ${
            status === 'success'
              ? 'bg-emerald-500/25'
              : status === 'failed'
              ? 'bg-rose-500/25'
              : 'bg-cyan-500/15'
          }`}
        />

        {/* Central Arc Reactor Biometric Lock Visual */}
        <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
          {/* Animated concentric HUD rings */}
          <div
            className={`absolute inset-0 rounded-full border border-dashed transition-colors duration-300 ${
              status === 'success'
                ? 'border-emerald-400 animate-[spin_4s_linear_infinite]'
                : status === 'failed'
                ? 'border-rose-500 animate-[spin_1s_linear_infinite]'
                : isListening
                ? 'border-cyan-400/80 animate-[spin_6s_linear_infinite]'
                : 'border-cyan-500/30 animate-[spin_12s_linear_infinite]'
            }`}
          />
          <div
            className={`absolute inset-2 rounded-full border transition-colors duration-300 ${
              status === 'success'
                ? 'border-emerald-500/60 animate-[spin_3s_linear_infinite_reverse]'
                : status === 'failed'
                ? 'border-rose-500/60 animate-[spin_1s_linear_infinite_reverse]'
                : 'border-cyan-400/40 animate-[spin_8s_linear_infinite_reverse]'
            }`}
          />

          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl ${
              status === 'success'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400 shadow-emerald-500/50 scale-110'
                : status === 'failed'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500 shadow-rose-500/50 scale-95'
                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-400 shadow-cyan-500/40'
            }`}
          >
            {status === 'success' ? (
              <Unlock className="w-7 h-7 animate-bounce" />
            ) : status === 'failed' ? (
              <ShieldAlert className="w-7 h-7 animate-pulse text-rose-400" />
            ) : isListening ? (
              <Mic className="w-7 h-7 animate-pulse text-cyan-300" />
            ) : (
              <Lock className="w-7 h-7" />
            )}
          </div>
        </div>

        {/* Title & Security Context */}
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <span
              className={`text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full border ${
                status === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : status === 'failed'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
              }`}
            >
              Protocole de Sécurité JARVIS
            </span>
          </div>

          <h3 className="text-lg font-bold text-slate-100">
            {status === 'success'
              ? `Identité Validée : Bonjour ${userName}`
              : status === 'failed'
              ? 'Accès au Téléphone Refusé'
              : title}
          </h3>

          <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
            {status === 'success'
              ? "Tous les privilèges matériels, vocaux et agents sont déverrouillés."
              : status === 'failed'
              ? "Le code de confirmation ne correspond pas. Réessayez à voix haute ou au clavier."
              : reason}
          </p>
        </div>

        {/* Spoken Voice Bar & Feedback */}
        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-left space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
              <Mic className={`w-3.5 h-3.5 ${isListening ? 'text-cyan-400 animate-pulse' : 'text-slate-500'}`} />
              <span>{isListening ? 'Écoute vocale active...' : 'Microphone en pause'}</span>
            </div>

            <button
              type="button"
              onClick={isListening ? stopVoiceCapture : startVoiceCapture}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
            >
              {isListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3 text-cyan-400" />}
              <span>{isListening ? 'Arrêter' : 'Parler'}</span>
            </button>
          </div>

          {/* Transcript / Spoken Feedback display */}
          <div className="min-h-[28px] flex items-center justify-center px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-center">
            {spokenTranscript ? (
              <span className="text-cyan-300 font-semibold truncate animate-pulse">
                « {spokenTranscript} »
              </span>
            ) : isListening ? (
              <span className="text-slate-500 italic text-[11px]">
                Énoncez votre code secret à voix haute... (ex: "{jarvisSecurityCode}")
              </span>
            ) : (
              <span className="text-slate-500 text-[11px]">Cliquez sur 'Parler' ou composez le code ci-dessous</span>
            )}
          </div>
        </div>

        {/* PIN Dots Display */}
        <div className="flex items-center justify-center gap-2.5 py-1">
          {Array.from({ length: Math.max(4, jarvisSecurityCode.length) }).map((_, idx) => {
            const isFilled = idx < inputCode.length;
            return (
              <div
                key={idx}
                className={`w-3.5 h-3.5 rounded-full border transition-all duration-200 ${
                  status === 'success'
                    ? 'bg-emerald-400 border-emerald-300 shadow-[0_0_8px_#34d399]'
                    : status === 'failed'
                    ? 'bg-rose-500 border-rose-400 shadow-[0_0_8px_#f43f5e]'
                    : isFilled
                    ? 'bg-cyan-400 border-cyan-300 shadow-[0_0_8px_#22d3ee] scale-110'
                    : 'bg-slate-950 border-slate-700'
                }`}
              />
            );
          })}
        </div>

        {errorMessage && (
          <div className="text-xs text-rose-400 font-medium flex items-center justify-center gap-1.5 animate-in fade-in duration-150">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Holographic Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleKeypadPress(digit)}
              className="h-11 rounded-xl bg-slate-950/90 hover:bg-cyan-950/40 border border-slate-800/80 hover:border-cyan-500/40 text-slate-100 hover:text-cyan-300 font-mono font-bold text-sm transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleKeypadDelete}
            title="Effacer"
            className="h-11 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
          >
            <Delete className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleKeypadPress('0')}
            className="h-11 rounded-xl bg-slate-950/90 hover:bg-cyan-950/40 border border-slate-800/80 hover:border-cyan-500/40 text-slate-100 hover:text-cyan-300 font-mono font-bold text-sm transition-all active:scale-95 cursor-pointer shadow-sm"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleKeypadSubmit()}
            title="Valider"
            className="h-11 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-md shadow-cyan-500/30"
          >
            <Fingerprint className="w-5 h-5" />
          </button>
        </div>

        {/* Footer actions */}
        <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/60">
          <span className="text-[11px] flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            Terminal Android Sécurisé
          </span>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              Fermer
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
