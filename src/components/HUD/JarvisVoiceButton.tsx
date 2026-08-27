import React from 'react';
import { Mic, MicOff, Sparkles, Volume2, Radio, Zap } from 'lucide-react';
import type { JarvisCoreState } from './JarvisNeuralCore';

interface JarvisVoiceButtonProps {
  state: JarvisCoreState;
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  interimTranscript: string;
  onToggleListening: () => void;
  onSelectSuggestion?: (text: string) => void;
  audioLevel?: number;
  className?: string;
}

export const JarvisVoiceButton: React.FC<JarvisVoiceButtonProps> = ({
  state,
  isListening,
  isSpeaking,
  transcript,
  interimTranscript,
  onToggleListening,
  onSelectSuggestion,
  audioLevel = 0,
  className = '',
}) => {
  const suggestions = [
    'Donne-moi le briefing du matin',
    'Quels sont mes rappels aujourd\'hui ?',
    'Allume la lampe torche',
    'Recherche les actualités IA',
  ];

  const displayText = interimTranscript || transcript;

  return (
    <div className={`w-full flex flex-col items-center select-none ${className}`}>
      {/* Live Voice Transcription Terminal Box */}
      <div className="w-full max-w-lg mb-4 min-h-[58px] px-4 py-2.5 rounded-2xl bg-slate-950/90 border border-cyan-500/30 backdrop-blur-xl relative overflow-hidden shadow-xl hud-corner-bracket">
        <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <Radio className={`w-3 h-3 ${isListening ? 'text-emerald-400 animate-pulse' : isSpeaking ? 'text-blue-400 animate-bounce' : 'text-cyan-400'}`} />
            <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-semibold">
              {isListening ? 'TRANSCRIPTION AUDIO EN DIRECT' : isSpeaking ? 'SYNTHÈSE VOCALE J.A.R.V.I.S.' : 'TERMINAL VOCAL PRÊT'}
            </span>
          </div>
          {audioLevel > 5 && (
            <span className="text-[10px] font-mono text-emerald-400">
              MIC RMS: {Math.round(audioLevel)}%
            </span>
          )}
        </div>

        {displayText ? (
          <p className="text-xs text-cyan-200 font-mono leading-relaxed break-words">
            <span className="text-cyan-500 mr-1.5 font-bold">{'>'}</span>
            {displayText}
            <span className="inline-block w-1.5 h-3.5 ml-1 bg-cyan-400 animate-pulse align-middle" />
          </p>
        ) : (
          <p className="text-xs text-slate-500 font-mono italic">
            Dites "Hey Jarvis" ou touchez le bouton ci-dessous pour parler...
          </p>
        )}
      </div>

      {/* Futuristic Main Voice Trigger Button */}
      <div className="relative flex items-center justify-center">
        {/* Animated outer pulsing halo when listening */}
        {isListening && (
          <>
            <div className="absolute -inset-4 rounded-full bg-cyan-500/20 animate-jarvis-ripple pointer-events-none" />
            <div className="absolute -inset-8 rounded-full bg-emerald-500/10 animate-jarvis-ripple pointer-events-none delay-300" />
          </>
        )}

        <button
          type="button"
          onClick={onToggleListening}
          className={`relative group px-6 py-3.5 sm:px-8 sm:py-4 rounded-2xl border-2 transition-all duration-300 flex items-center gap-3 shadow-2xl active:scale-95 cursor-pointer ${
            isListening
              ? 'bg-gradient-to-r from-emerald-950 via-cyan-950 to-slate-950 border-emerald-400 text-emerald-300 shadow-[0_0_40px_rgba(16,185,129,0.45)]'
              : isSpeaking
              ? 'bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-950 border-blue-400 text-blue-200 shadow-[0_0_40px_rgba(59,130,246,0.45)]'
              : 'bg-gradient-to-r from-cyan-950/90 via-slate-900 to-slate-950 border-cyan-500/50 hover:border-cyan-400 text-cyan-200 hover:text-white shadow-[0_0_35px_rgba(6,182,212,0.25)] hover:shadow-[0_0_50px_rgba(6,182,212,0.45)]'
          }`}
        >
          {/* Glowing button corner brackets */}
          <div className="absolute top-1 left-1 w-2 h-2 border-t-2 border-l-2 border-cyan-400 opacity-60" />
          <div className="absolute bottom-1 right-1 w-2 h-2 border-b-2 border-r-2 border-cyan-400 opacity-60" />

          {/* Button Icon */}
          <div className={`p-2 rounded-xl ${isListening ? 'bg-emerald-500/20 text-emerald-400' : 'bg-cyan-500/20 text-cyan-400'} group-hover:scale-110 transition-transform`}>
            {isListening ? (
              <Mic className="w-5 h-5 animate-pulse" />
            ) : isSpeaking ? (
              <Volume2 className="w-5 h-5 animate-bounce" />
            ) : (
              <Mic className="w-5 h-5 text-cyan-400" />
            )}
          </div>

          {/* Button Text */}
          <div className="text-left">
            <span className="text-sm sm:text-base font-bold tracking-wider font-mono block">
              {isListening ? 'JARVIS VOUS ÉCOUTE...' : isSpeaking ? 'INTERROMPRE LA PAROLE' : 'PARLEZ À JARVIS'}
            </span>
            <span className="text-[10px] font-mono text-cyan-400/80 block">
              {isListening ? 'Appuyez pour envoyer' : 'Ou dites simplement « Hey Jarvis »'}
            </span>
          </div>

          <Sparkles className="w-4 h-4 text-cyan-400 group-hover:rotate-12 transition-transform" />
        </button>
      </div>

      {/* Vocal Suggestion Chips */}
      {onSelectSuggestion && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3 max-w-lg">
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectSuggestion(s)}
              className="px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-cyan-950/60 border border-slate-800 hover:border-cyan-500/40 text-[10px] font-mono text-slate-400 hover:text-cyan-300 transition-all cursor-pointer active:scale-95 whitespace-nowrap"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
