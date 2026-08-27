import React, { useMemo } from 'react';

interface JarvisAudioVisualizerProps {
  state: 'idle' | 'listening' | 'thinking' | 'speaking';
  audioLevel?: number; // 0 to 100
  barCount?: number;
  height?: number;
  className?: string;
  ecoMode?: boolean;
}

export const JarvisAudioVisualizer: React.FC<JarvisAudioVisualizerProps> = ({
  state,
  audioLevel = 0,
  barCount = 20,
  height = 36,
  className = '',
  ecoMode = false,
}) => {
  // Generate deterministic heights and phase offsets for the equalizer bars
  const bars = useMemo(() => {
    return Array.from({ length: barCount }, (_, i) => {
      // Gaussian bell-curve weighting for center peak
      const centerDist = Math.abs(i - barCount / 2) / (barCount / 2);
      const bellFactor = Math.cos(centerDist * (Math.PI / 2.2));
      return {
        id: i,
        baseScale: Math.max(0.15, bellFactor),
        delay: (i * 0.04).toFixed(2),
        duration: (0.5 + (i % 5) * 0.1).toFixed(2),
      };
    });
  }, [barCount]);

  if (ecoMode && state === 'idle') {
    return (
      <div className={`flex items-center justify-center gap-1 h-[${height}px] ${className}`}>
        <div className="w-24 h-1 rounded-full bg-slate-800" />
      </div>
    );
  }

  const isActive = state === 'listening' || state === 'speaking' || state === 'thinking';
  const levelNormalized = Math.min(100, Math.max(5, audioLevel)) / 100;

  return (
    <div
      className={`flex items-center justify-center gap-1 sm:gap-1.5 h-[${height}px] px-2 ${className}`}
      aria-hidden="true"
    >
      {bars.map((bar) => {
        // Calculate dynamic height based on state & audio level
        let dynamicHeight = 4;
        let barColor = 'bg-slate-800';

        if (state === 'listening') {
          // Dynamic microphone audio level
          const reactiveFactor = 0.2 + bar.baseScale * (0.8 * levelNormalized + Math.random() * 0.2);
          dynamicHeight = Math.max(4, Math.round(reactiveFactor * height));
          barColor = 'bg-gradient-to-t from-cyan-600 via-cyan-400 to-emerald-400 shadow-sm shadow-cyan-500/50';
        } else if (state === 'speaking') {
          // Dynamic vocal speech modulation
          const reactiveFactor = 0.3 + bar.baseScale * (0.7 + Math.sin(Date.now() / 150 + bar.id) * 0.3);
          dynamicHeight = Math.max(6, Math.round(reactiveFactor * height));
          barColor = 'bg-gradient-to-t from-indigo-600 via-cyan-400 to-blue-300 shadow-sm shadow-cyan-500/40';
        } else if (state === 'thinking') {
          // Oscillating thought ripple
          const reactiveFactor = 0.2 + bar.baseScale * 0.5 * (1 + Math.sin(Date.now() / 200 + bar.id * 0.5));
          dynamicHeight = Math.max(4, Math.round(reactiveFactor * (height * 0.75)));
          barColor = 'bg-gradient-to-t from-amber-600 via-amber-400 to-cyan-400 shadow-sm shadow-amber-500/30';
        } else {
          // Idle calm breathing
          dynamicHeight = Math.max(3, Math.round(bar.baseScale * 8));
          barColor = 'bg-slate-800/80';
        }

        return (
          <div
            key={bar.id}
            className={`w-1 sm:w-1.5 rounded-full transition-all duration-100 ease-out ${barColor}`}
            style={{
              height: `${dynamicHeight}px`,
              transitionDuration: state === 'listening' ? '75ms' : '150ms',
            }}
          />
        );
      })}
    </div>
  );
};
