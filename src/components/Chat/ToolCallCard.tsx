import { useState } from 'react';
import { 
  Wrench, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  Calculator, 
  Clock, 
  Smartphone, 
  Eye, 
  Cpu,
  FolderGit2,
  Terminal,
  Database
} from 'lucide-react';
import type { ToolCallInfo } from '../../types';

interface Props {
  toolCall: ToolCallInfo;
}

export function ToolCallCard({ toolCall }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isRunning = toolCall.status === 'running';
  const isSuccess = toolCall.status === 'success';
  const isError = toolCall.status === 'error';

  const getToolIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('calc')) return <Calculator className="w-3.5 h-3.5 text-amber-400" />;
    if (lower.includes('search') || lower.includes('web')) return <Search className="w-3.5 h-3.5 text-cyan-400" />;
    if (lower.includes('remind') || lower.includes('sched') || lower.includes('time')) return <Clock className="w-3.5 h-3.5 text-emerald-400" />;
    if (lower.includes('android') || lower.includes('intent') || lower.includes('device')) return <Smartphone className="w-3.5 h-3.5 text-green-400" />;
    if (lower.includes('vision') || lower.includes('camera')) return <Eye className="w-3.5 h-3.5 text-purple-400" />;
    if (lower.includes('shell') || lower.includes('bash')) return <Terminal className="w-3.5 h-3.5 text-yellow-400" />;
    if (lower.includes('memory') || lower.includes('graph')) return <Database className="w-3.5 h-3.5 text-blue-400" />;
    if (lower.includes('file')) return <FolderGit2 className="w-3.5 h-3.5 text-indigo-400" />;
    return <Wrench className="w-3.5 h-3.5 text-cyan-400" />;
  };

  const getToolLabel = (name: string) => {
    switch (name) {
      case 'web_search': return 'Recherche Web Intelligente';
      case 'calculator': return 'Moteur de Calcul & Précision';
      case 'reminder_scheduler': return 'Planification & Rappel Android';
      case 'vision_analyzer': return 'Analyse Multimodale & Vision';
      case 'android_intent': return 'Contrôle & Intent Android';
      case 'knowledge_graph': return 'Mémoire & Base de Connaissances';
      case 'shell_execution': return 'Exécution Système Sécurisée';
      case 'file_system': return 'Système de Fichiers';
      default: return name;
    }
  };

  return (
    <div 
      className="my-1.5 rounded-xl border border-slate-700/60 bg-slate-900/80 overflow-hidden text-xs transition-all shadow-sm"
      id={`tool-call-${toolCall.id}`}
    >
      <div 
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-slate-800/60 transition-colors select-none"
      >
        <div className="flex items-center gap-2">
          {getToolIcon(toolCall.tool)}
          <span className="font-semibold text-slate-200">{getToolLabel(toolCall.tool)}</span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700/50">
            {toolCall.tool}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {toolCall.latency !== undefined && (
            <span className="text-[10px] text-slate-400 font-mono">
              {toolCall.latency}ms
            </span>
          )}

          {isRunning && (
            <span className="flex items-center gap-1 text-cyan-400 font-medium">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>En cours...</span>
            </span>
          )}
          {isSuccess && (
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3 h-3" />
              <span>Exécuté</span>
            </span>
          )}
          {isError && (
            <span className="flex items-center gap-1 text-rose-400 font-medium">
              <AlertCircle className="w-3 h-3" />
              <span>Erreur</span>
            </span>
          )}

          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-800/80 bg-slate-950/60 space-y-2">
          {toolCall.arguments && (
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Paramètres d'entrée
              </span>
              <pre className="font-mono text-[11px] p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 overflow-x-auto">
                {toolCall.arguments}
              </pre>
            </div>
          )}

          {toolCall.result && (
            <div>
              <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider block mb-1">
                Résultat obtenu
              </span>
              <pre className="font-mono text-[11px] p-2 rounded-lg bg-slate-900 border border-slate-800 text-emerald-300 overflow-x-auto max-h-48">
                {typeof toolCall.result === 'object' 
                  ? JSON.stringify(toolCall.result, null, 2) 
                  : String(toolCall.result)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
