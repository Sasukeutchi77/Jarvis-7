import React from 'react';
import {
  Globe,
  Camera,
  Smartphone,
  Brain,
  Calculator,
  Bot,
  Sparkles,
  Settings,
  Radio,
} from 'lucide-react';

interface JarvisToolsDockProps {
  onSelectToolPrompt: (prompt: string) => void;
  onOpenVision: () => void;
  onOpenAndroid: () => void;
  onOpenMemory: () => void;
  onOpenVoice: () => void;
  onOpenSettings: () => void;
  deepResearch: boolean;
  onToggleDeepResearch: () => void;
  className?: string;
}

export const JarvisToolsDock: React.FC<JarvisToolsDockProps> = ({
  onSelectToolPrompt,
  onOpenVision,
  onOpenAndroid,
  onOpenMemory,
  onOpenVoice,
  onOpenSettings,
  deepResearch,
  onToggleDeepResearch,
  className = '',
}) => {
  const tools = [
    {
      id: 'search',
      label: 'Recherche Web',
      icon: Globe,
      color: 'text-cyan-400',
      bgColor: 'hover:bg-cyan-500/10 hover:border-cyan-500/40',
      action: () => onSelectToolPrompt('Recherche les dernières actualités technologiques.'),
    },
    {
      id: 'vision',
      label: 'Vision & Caméra',
      icon: Camera,
      color: 'text-indigo-400',
      bgColor: 'hover:bg-indigo-500/10 hover:border-indigo-500/40',
      action: onOpenVision,
    },
    {
      id: 'android',
      label: 'Hub Android',
      icon: Smartphone,
      color: 'text-emerald-400',
      bgColor: 'hover:bg-emerald-500/10 hover:border-emerald-500/40',
      action: onOpenAndroid,
    },
    {
      id: 'calc',
      label: 'Calcul & Math',
      icon: Calculator,
      color: 'text-amber-400',
      bgColor: 'hover:bg-amber-500/10 hover:border-amber-500/40',
      action: () => onSelectToolPrompt('Calcule précisément : 15% de réduction sur 125 000 FCFA avec TVA 18%'),
    },
    {
      id: 'memory',
      label: 'Mémoire FTS5',
      icon: Brain,
      color: 'text-purple-400',
      bgColor: 'hover:bg-purple-500/10 hover:border-purple-500/40',
      action: onOpenMemory,
    },
  ];

  return (
    <div
      className={`flex items-center justify-center gap-1.5 p-1.5 rounded-2xl bg-slate-900/80 border border-cyan-500/20 backdrop-blur-xl shadow-xl select-none ${className}`}
    >
      {tools.map((tool) => {
        const Icon = tool.icon;
        return (
          <button
            key={tool.id}
            type="button"
            onClick={tool.action}
            className={`p-2 sm:px-3 sm:py-2 rounded-xl border border-transparent transition-all flex items-center gap-1.5 text-xs text-slate-300 active:scale-95 cursor-pointer ${tool.bgColor}`}
            title={tool.label}
          >
            <Icon className={`w-4 h-4 ${tool.color}`} />
            <span className="hidden md:inline font-medium">{tool.label}</span>
          </button>
        );
      })}

      {/* Deep Research Agent Toggle */}
      <button
        type="button"
        onClick={onToggleDeepResearch}
        className={`p-2 sm:px-3 sm:py-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs active:scale-95 cursor-pointer ${
          deepResearch
            ? 'bg-purple-600/30 text-purple-200 border-purple-500/60 shadow-md shadow-purple-500/20 font-semibold'
            : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200'
        }`}
        title="Mode Deep Research & Décomposition d'Agents"
      >
        <Sparkles className="w-4 h-4 text-purple-400" />
        <span className="hidden md:inline">Deep Research</span>
      </button>

      <div className="w-[1px] h-5 bg-slate-800 mx-0.5" />

      {/* Voice HUD Quick Action */}
      <button
        type="button"
        onClick={onOpenVoice}
        className="p-2 sm:px-3 sm:py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 transition-all flex items-center gap-1.5 text-xs active:scale-95 cursor-pointer font-medium"
        title="Ouvrir le centre vocal complet"
      >
        <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
        <span className="hidden sm:inline">Voice HUD</span>
      </button>

      {/* Settings */}
      <button
        type="button"
        onClick={onOpenSettings}
        className="p-2 rounded-xl border border-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all active:scale-95 cursor-pointer"
        title="Paramètres HUD"
      >
        <Settings className="w-4 h-4" />
      </button>
    </div>
  );
};
