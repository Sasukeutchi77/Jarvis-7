import { Rocket, Sparkles, Bot, Wrench, Shield, CheckCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router';
import appIcon from '../assets/images/openjarvis_app_icon_1787449013809.jpg';

export function GetStartedPage() {
  const navigate = useNavigate();

  const steps = [
    {
      title: '1. Interaction Vocale & Textuelle',
      desc: 'Discutez avec JARVIS via la barre de prompt, la dictée vocale instantanée ou le mot-clé d\'activation "Hey Jarvis".',
      icon: Sparkles,
      color: 'text-cyan-400',
    },
    {
      title: '2. Sélection Automatique d\'Outils',
      desc: 'JARVIS détecte automatiquement vos intentions : calculs complexes, recherche web en direct, planification de rappels Android et vision de photos.',
      icon: Wrench,
      color: 'text-amber-400',
    },
    {
      title: '3. Décomposition Multi-Agents',
      desc: 'Pour les requêtes complexes (comme comparer 3 téléphones), JARVIS élabore un plan en 5 étapes structuré et coordonne les outils.',
      icon: Bot,
      color: 'text-purple-400',
    },
    {
      title: '4. Confidentialité & Mémoire Locale',
      desc: 'Vos documents et souvenirs sont indexés localement dans le stockage SQLite/Vectoriel sans fuite vers des tiers.',
      icon: Shield,
      color: 'text-emerald-400',
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-3 py-6">
          <div className="relative inline-block mx-auto mb-2">
            <img
              src={appIcon}
              alt="OpenJarvis App Icon"
              referrerPolicy="no-referrer"
              className="w-20 h-20 rounded-2xl border-2 border-cyan-400/50 shadow-lg shadow-cyan-500/25 object-cover"
            />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-950 flex items-center justify-center">
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">
            Bienvenue sur OpenJarvis Android
          </h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
            Votre assistant personnel local augmenté par des agents autonomes et un écosystème d'outils interconnectés.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2.5"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <Icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <h3 className="font-semibold text-sm text-slate-100">{s.title}</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed pl-1">
                  {s.desc}
                </p>
              </div>
            );
          })}
        </div>

        <div className="text-center pt-4">
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
          >
            <span>Démarrer une discussion avec JARVIS</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
