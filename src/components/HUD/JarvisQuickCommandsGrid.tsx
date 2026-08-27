import React from 'react';
import {
  Bot,
  MessageSquare,
  Bell,
  Phone,
  Sun,
  Globe,
  Zap,
  Brain,
  Settings,
  ArrowUpRight,
} from 'lucide-react';

export interface QuickCommandItem {
  id: string;
  title: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  borderColor: string;
  glowColor: string;
  badge?: string;
  action: () => void;
}

interface JarvisQuickCommandsGridProps {
  onOpenAssistant: () => void;
  onOpenMessages: () => void;
  onOpenNotifications: () => void;
  onOpenPhone: () => void;
  onOpenWeather: () => void;
  onOpenSearch: () => void;
  onOpenAutomations: () => void;
  onOpenMemory: () => void;
  onOpenSettings: () => void;
  notificationCount?: number;
  className?: string;
}

export const JarvisQuickCommandsGrid: React.FC<JarvisQuickCommandsGridProps> = ({
  onOpenAssistant,
  onOpenMessages,
  onOpenNotifications,
  onOpenPhone,
  onOpenWeather,
  onOpenSearch,
  onOpenAutomations,
  onOpenMemory,
  onOpenSettings,
  notificationCount = 2,
  className = '',
}) => {
  const commands: QuickCommandItem[] = [
    {
      id: 'assistant',
      title: 'Assistant',
      sub: 'Session Vocale & IA',
      icon: Bot,
      accentColor: 'text-cyan-400',
      borderColor: 'hover:border-cyan-400 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]',
      glowColor: 'bg-cyan-500/10',
      badge: 'LIVE',
      action: onOpenAssistant,
    },
    {
      id: 'messages',
      title: 'Messages',
      sub: 'SMS & WhatsApp',
      icon: MessageSquare,
      accentColor: 'text-emerald-400',
      borderColor: 'hover:border-emerald-400 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]',
      glowColor: 'bg-emerald-500/10',
      action: onOpenMessages,
    },
    {
      id: 'notifications',
      title: 'Notifications',
      sub: 'Intercepteur Android',
      icon: Bell,
      accentColor: 'text-amber-400',
      borderColor: 'hover:border-amber-400 group-hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]',
      glowColor: 'bg-amber-500/10',
      badge: notificationCount > 0 ? `${notificationCount} new` : undefined,
      action: onOpenNotifications,
    },
    {
      id: 'phone',
      title: 'Téléphone',
      sub: 'Appels & Clavier',
      icon: Phone,
      accentColor: 'text-blue-400',
      borderColor: 'hover:border-blue-400 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]',
      glowColor: 'bg-blue-500/10',
      action: onOpenPhone,
    },
    {
      id: 'weather',
      title: 'Météo',
      sub: '28°C • Ensoleillé',
      icon: Sun,
      accentColor: 'text-yellow-400',
      borderColor: 'hover:border-yellow-400 group-hover:shadow-[0_0_20px_rgba(234,179,8,0.3)]',
      glowColor: 'bg-yellow-500/10',
      action: onOpenWeather,
    },
    {
      id: 'search',
      title: 'Recherche',
      sub: 'Web & Deep Scan',
      icon: Globe,
      accentColor: 'text-sky-400',
      borderColor: 'hover:border-sky-400 group-hover:shadow-[0_0_20px_rgba(56,189,248,0.3)]',
      glowColor: 'bg-sky-500/10',
      action: onOpenSearch,
    },
    {
      id: 'automations',
      title: 'Automatisations',
      sub: 'Routines & Déclencheurs',
      icon: Zap,
      accentColor: 'text-orange-400',
      borderColor: 'hover:border-orange-400 group-hover:shadow-[0_0_20px_rgba(249,115,22,0.3)]',
      glowColor: 'bg-orange-500/10',
      action: onOpenAutomations,
    },
    {
      id: 'memory',
      title: 'Mémoire',
      sub: 'FTS5 & Habitudes',
      icon: Brain,
      accentColor: 'text-purple-400',
      borderColor: 'hover:border-purple-400 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]',
      glowColor: 'bg-purple-500/10',
      action: onOpenMemory,
    },
    {
      id: 'settings',
      title: 'Paramètres',
      sub: 'Système & Sécurité',
      icon: Settings,
      accentColor: 'text-slate-300',
      borderColor: 'hover:border-slate-400 group-hover:shadow-[0_0_20px_rgba(148,163,184,0.2)]',
      glowColor: 'bg-slate-500/10',
      action: onOpenSettings,
    },
  ];

  return (
    <div className={`w-full select-none ${className}`}>
      <div className="flex items-center justify-between px-1 mb-2.5">
        <span className="text-[11px] font-mono uppercase font-semibold text-slate-300 tracking-wider flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          COMMANDES RAPIDES & AGENTS J.A.R.V.I.S.
        </span>
        <span className="text-[10px] font-mono text-cyan-400/80">9 MODULES PRÊTS</span>
      </div>

      {/* Grid of 9 Cards tailored for Android Mobile 3x3 or Desktop */}
      <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-3 gap-2 sm:gap-2.5">
        {commands.map((cmd) => {
          const Icon = cmd.icon;
          return (
            <button
              key={cmd.id}
              type="button"
              onClick={cmd.action}
              className={`group relative p-2.5 sm:p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 text-left transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-pointer active:scale-95 ${cmd.borderColor}`}
            >
              {/* Subtle dynamic glow */}
              <div
                className={`absolute -inset-1 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity blur-md pointer-events-none ${cmd.glowColor}`}
              />

              {/* Card Header: Icon + Badge */}
              <div className="flex items-center justify-between w-full mb-2">
                <div className={`p-1.5 rounded-lg bg-slate-900 border border-slate-800 ${cmd.accentColor} group-hover:scale-110 transition-transform`}>
                  <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
                {cmd.badge ? (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    {cmd.badge}
                  </span>
                ) : (
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                )}
              </div>

              {/* Card Titles */}
              <div className="w-full">
                <span className="text-xs sm:text-sm font-bold text-slate-200 group-hover:text-white block truncate">
                  {cmd.title}
                </span>
                <span className="text-[10px] font-mono text-slate-400 group-hover:text-slate-300 block truncate">
                  {cmd.sub}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
