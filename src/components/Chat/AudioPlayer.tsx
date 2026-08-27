import { useState, useRef } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

interface Props {
  src: string;
}

export function AudioPlayer({ src }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  return (
    <div className="my-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
      <audio
        ref={audioRef}
        src={src}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />
      <button
        onClick={toggle}
        className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 flex items-center justify-center transition-colors"
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      <div className="flex-1 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-slate-200">
          <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
          <span>Synthèse Audio JARVIS</span>
        </div>
        <span className="text-[11px] text-slate-400">Écouter la réponse vocale</span>
      </div>
    </div>
  );
}
