import { Zap, Cpu, Clock, Layers } from 'lucide-react';
import type { MessageTelemetry, TokenUsage } from '../../types';

interface Props {
  usage?: TokenUsage;
  telemetry?: MessageTelemetry;
  isResearch?: boolean;
}

export function XRayFooter({ usage, telemetry, isResearch }: Props) {
  if (!usage && !telemetry && !isResearch) return null;

  return (
    <div className="mt-2 pt-1.5 border-t border-slate-800/60 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 font-mono">
      {telemetry?.engine && (
        <div className="flex items-center gap-1 text-slate-400">
          <Cpu className="w-3 h-3 text-cyan-400" />
          <span>{telemetry.engine}</span>
        </div>
      )}

      {telemetry?.total_ms !== undefined && (
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-500" />
          <span>{(telemetry.total_ms / 1000).toFixed(2)}s</span>
        </div>
      )}

      {usage && (
        <div className="flex items-center gap-1">
          <Zap className="w-3 h-3 text-amber-500/80" />
          <span>{usage.total_tokens} tokens</span>
        </div>
      )}

      {telemetry?.tokens_per_sec !== undefined && (
        <div className="flex items-center gap-1">
          <span>{telemetry.tokens_per_sec.toFixed(1)} t/s</span>
        </div>
      )}

      {telemetry?.complexity_tier && (
        <div className="flex items-center gap-1">
          <Layers className="w-3 h-3 text-purple-400" />
          <span className="capitalize">{telemetry.complexity_tier} tier</span>
        </div>
      )}
    </div>
  );
}
