import { useState } from 'react';
import { Search, CheckCircle, Loader2, ChevronDown, ChevronUp, Globe } from 'lucide-react';
import type { ResearchSearchTrace } from '../../types';

interface Props {
  traces: ResearchSearchTrace[];
  isLive?: boolean;
  hasContent?: boolean;
}

export function ResearchTimeline({ traces, isLive }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  if (!traces || traces.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-3 text-xs">
      <div 
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between cursor-pointer font-medium text-cyan-300"
      >
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-cyan-400" />
          <span>Décomposition & Recherches en direct ({traces.length})</span>
        </div>
        <button className="text-cyan-400 hover:text-cyan-200">
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="mt-3 space-y-2">
          {traces.map((trace) => {
            const isPending = trace.status === 'pending';
            return (
              <div 
                key={trace.id} 
                className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-start gap-2.5"
              >
                <div className="mt-0.5">
                  {isPending ? (
                    <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-200 truncate">
                      {trace.query}
                    </span>
                    {trace.numHits !== undefined && (
                      <span className="text-[10px] text-cyan-400 shrink-0 font-mono">
                        {trace.numHits} sources
                      </span>
                    )}
                  </div>
                  {trace.topTitles && trace.topTitles.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-[11px] text-slate-400 list-disc list-inside">
                      {trace.topTitles.slice(0, 2).map((t, idx) => (
                        <li key={idx} className="truncate">{t}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
