import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Search, MessageSquare, Eye, BarChart3, Brain, Database, Bot, Settings, X, Home, Zap, Globe, Smartphone, Sparkles, Compass, ShieldCheck } from 'lucide-react';
import { useAppStore } from '../lib/store';

export function CommandPalette() {
  const [query, setQuery] = useState('');
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const navigate = useNavigate();

  const commands = [
    { title: 'Chat avec JARVIS', path: '/', icon: MessageSquare },
    { title: 'Audit & Optimisation Globale (Phase 15)', path: '/audit', icon: ShieldCheck },
    { title: 'Messages & Notifications Android', path: '/communications', icon: MessageSquare },
    { title: 'Automatisations Déclencheurs IF → THEN', path: '/automations', icon: Zap },
    { title: 'Conscience Contextuelle & Capteurs (Context Engine)', path: '/context', icon: Compass },
    { title: 'JARVIS Proactif & Anticipation', path: '/proactive', icon: Compass },
    { title: 'Android Hub & Capteurs', path: '/android', icon: Smartphone },
    { title: 'Contrôle Domotique & Équipements', path: '/smart-home', icon: Home },
    { title: 'Automatisations & Routines Intelligentes', path: '/routines', icon: Zap },
    { title: 'Vision Studio & Caméra', path: '/vision', icon: Eye },
    { title: 'Recherche Web & Grounding Direct', path: '/search', icon: Globe },
    { title: 'Tableau de Bord Télémesure', path: '/dashboard', icon: BarChart3 },
    { title: 'Mémoire Personnelle & Knowledge Graph', path: '/memory', icon: Brain },
    { title: 'Connecteurs & Sources de données', path: '/data-sources', icon: Database },
    { title: 'Agents & Outils Connectés', path: '/agents', icon: Bot },
    { title: 'Paramètres & Audio', path: '/settings', icon: Settings },
  ];

  const filtered = commands.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCommandPaletteOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setCommandPaletteOpen]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-24 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center px-4 border-b border-slate-800">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une commande ou une page..."
            className="w-full px-3 py-3 bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <button
            onClick={() => setCommandPaletteOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-2 space-y-1 max-h-72 overflow-y-auto">
          {filtered.map((cmd) => {
            const Icon = cmd.icon;
            return (
              <div
                key={cmd.path}
                onClick={() => {
                  navigate(cmd.path);
                  setCommandPaletteOpen(false);
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 text-xs text-slate-200 cursor-pointer transition-colors"
              >
                <Icon className="w-4 h-4 text-cyan-400" />
                <span>{cmd.title}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
