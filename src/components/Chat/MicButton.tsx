import { Mic, MicOff, Loader2, Radio } from 'lucide-react';
import type { SpeechState } from '../../hooks/useSpeech';
import { AndroidBridge } from '../../lib/android-bridge';

interface Props {
  state: SpeechState;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  reason?: 'not-enabled' | 'no-backend' | 'streaming' | undefined;
}

export function MicButton({ state, onClick, disabled, reason }: Props) {
  const isRecording = state === 'recording';
  const isTranscribing = state === 'transcribing';

  const handleClick = () => {
    AndroidBridge.vibrate(isRecording ? 'light' : 'medium');
    onClick();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={
        isRecording
          ? 'Arrêter la dictée vocale'
          : reason === 'streaming'
          ? 'Inférence en cours'
          : 'Dicter un message à JARVIS'
      }
      className={`relative p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
        isRecording
          ? 'bg-rose-600/30 text-rose-300 border border-rose-500/60 shadow-[0_0_15px_rgba(244,63,94,0.5)] animate-pulse'
          : isTranscribing
          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
          : 'text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-500/30 border border-transparent'
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {isRecording && (
        <span className="absolute -top-1 -right-1 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
        </span>
      )}
      {isTranscribing ? (
        <Loader2 size={16} className="animate-spin text-amber-400" />
      ) : isRecording ? (
        <MicOff size={16} className="text-rose-400" />
      ) : (
        <Mic size={16} />
      )}
    </button>
  );
}
