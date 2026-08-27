import { useState } from 'react';
import { ScrollText, Trash2, Filter, Terminal } from 'lucide-react';
import { useAppStore } from '../lib/store';

export function LogsPage() {
  const logEntries = useAppStore((s) => s.logEntries);
  const clearLogs = useAppStore((s) => s.clearLogs);
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');

  const filtered = logEntries.filter((l) =>
    levelFilter === 'all' ? true : l.level === levelFilter,
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
              <ScrollText className="w-6 h-6 text-cyan-400" />
              Journal des Événements & Traces Système
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Traçabilité complète des appels d'outils, décompositions d'agents, inférences et requêtes Android.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as any)}
              className="bg-slate-900 border border-slate-800 text-xs rounded-xl px-3 py-1.5 text-slate-300 focus:outline-none"
            >
              <option value="all">Tous les niveaux</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
            </select>

            <button
              onClick={clearLogs}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs text-rose-400 flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Effacer</span>
            </button>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 font-mono text-xs max-h-[600px] overflow-y-auto space-y-1.5">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              Aucun log enregistré pour le moment.
            </div>
          ) : (
            filtered.map((log, idx) => {
              const isError = log.level === 'error';
              const isWarn = log.level === 'warn';
              return (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 py-1 px-2 rounded hover:bg-slate-800/40 text-slate-300"
                >
                  <span className="text-slate-500 shrink-0 select-none">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={`uppercase text-[10px] px-1.5 py-0.2 rounded font-bold shrink-0 ${
                      isError
                        ? 'bg-rose-500/20 text-rose-400'
                        : isWarn
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-cyan-500/20 text-cyan-400'
                    }`}
                  >
                    {log.level}
                  </span>
                  <span className="text-slate-400 font-bold text-[10px] uppercase">
                    [{log.category}]
                  </span>
                  <span className="flex-1 break-words">{log.message}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
