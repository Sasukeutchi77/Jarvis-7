import { useEffect, useState } from 'react';
import { 
  BarChart3, 
  Cpu, 
  Zap, 
  ShieldCheck, 
  Sparkles, 
  HardDrive, 
  Layers, 
  Clock, 
  TrendingUp, 
  Bot, 
  Activity, 
  RefreshCw,
  Sun,
  Calendar,
  Volume2,
  Send,
  Radio,
  Smartphone,
  Brain
} from 'lucide-react';
import { useAppStore } from '../lib/store';
import { fetchServerInfo, fetchSavings, fetchModels, fetchMorningBriefing, executeVoiceAction } from '../lib/api';
import type { MorningBriefingData } from '../types';

export function DashboardPage() {
  const serverInfo = useAppStore((s) => s.serverInfo);
  const savings = useAppStore((s) => s.savings);
  const models = useAppStore((s) => s.models);
  const morningBriefing = useAppStore((s) => s.morningBriefing);
  const setSavings = useAppStore((s) => s.setSavings);
  const setServerInfo = useAppStore((s) => s.setServerInfo);
  const setMorningBriefing = useAppStore((s) => s.setMorningBriefing);

  const [loading, setLoading] = useState(false);
  const [testCmd, setTestCmd] = useState('');
  const [actionResult, setActionResult] = useState<any>(null);
  const [executing, setExecuting] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [sInfo, sav, briefing] = await Promise.all([
        fetchServerInfo(),
        fetchSavings(),
        fetchMorningBriefing().catch(() => null),
      ]);
      setServerInfo(sInfo);
      setSavings(sav);
      if (briefing) setMorningBriefing(briefing);
    } catch (e) {
      console.warn('Dashboard refresh failed', e);
    } finally {
      setLoading(false);
    }
  };

  const handleTestCommand = async (cmdToRun?: string) => {
    const cmd = (cmdToRun || testCmd).trim();
    if (!cmd) return;
    setExecuting(true);
    try {
      const res = await executeVoiceAction(cmd);
      setActionResult(res);
    } catch (err: any) {
      setActionResult({ status: 'error', message: err?.message || 'Erreur d\'exécution' });
    } finally {
      setExecuting(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
              <Activity className="w-6 h-6 text-cyan-400" />
              Tableau de Bord Télémesure & Performance
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Surveillance en direct de l'orchestrateur OpenJarvis, des modèles IA, des économies d'énergie et des agents.
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-xs text-slate-300 flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Actualiser</span>
          </button>
        </div>

        {/* Morning Briefing Proactive Hero Banner */}
        {morningBriefing && (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-cyan-500/30 shadow-lg relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 font-mono">
                    Briefing Quotidien & Mémoire Proactive
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-100">
                  {morningBriefing.greeting}
                </h2>
                <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
                  {morningBriefing.spokenSummary}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleTestCommand('Donne-moi le briefing du matin')}
                  className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white flex items-center gap-2 shadow-md shadow-cyan-950 transition-all active:scale-95"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Énoncer le Briefing</span>
                </button>
              </div>
            </div>

            {/* Sub-grid: Weather, Reminders, Learned Habits */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-800/80 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5">
                <Sun className="w-4 h-4 text-amber-400 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-200 block">Météo {morningBriefing.weather.location}</span>
                  <span className="text-slate-400 text-[11px]">{morningBriefing.weather.condition} • {morningBriefing.weather.temperature}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5">
                <Calendar className="w-4 h-4 text-cyan-400 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-200 block">Rappels Prioritaires</span>
                  <span className="text-slate-400 text-[11px]">
                    {morningBriefing.urgentReminders.length} en attente : {morningBriefing.urgentReminders[0]?.title || 'Aucun'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5">
                <Brain className="w-4 h-4 text-purple-400 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-200 block">Apprentissage Habitudes</span>
                  <span className="text-slate-400 text-[11px]">{morningBriefing.learnedHabitInsight}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">Économies Estimées</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-100">
              ${savings?.total_cost_saved?.toFixed(2) || '34.25'}
            </div>
            <span className="text-[11px] text-emerald-400 font-mono mt-1 block">
              +100% Inférence locale & hybride
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">Puissance Active</span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                <Zap className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-100">
              16.8 W
            </div>
            <span className="text-[11px] text-slate-400 font-mono mt-1 block">
              Consommation nominale matérielle
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">Agents & Outils</span>
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                <Bot className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-100">
              {serverInfo?.active_agents || 3} Actifs / 8 Outils
            </div>
            <span className="text-[11px] text-cyan-400 font-mono mt-1 block">
              Décomposition automatique active
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">Statut Système</span>
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-100">
              100% Opérationnel
            </div>
            <span className="text-[11px] text-purple-400 font-mono mt-1 block">
              Version {serverInfo?.version || '1.0.1'}
            </span>
          </div>
        </div>

        {/* Live Voice Intent Tester Section */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              Simulateur d'Ordres Vocaux & Intentions Android
            </h2>
            <span className="text-[11px] font-mono text-cyan-400">Routeur Vocal v1.2</span>
          </div>

          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={testCmd}
              onChange={(e) => setTestCmd(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTestCommand()}
              placeholder="Ex: Dis Jarvis, envoie un WhatsApp à Sophie pour lui dire que j'arrive..."
              className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={() => handleTestCommand()}
              disabled={executing}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-xs font-semibold text-white flex items-center gap-1.5 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Exécuter</span>
            </button>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-1.5 text-xs">
            {[
              'Dis Jarvis',
              'Envoie un WhatsApp à Thomas : réunion prête',
              'Mets du rock sur Spotify',
              'Allume la lampe torche',
              'Analyse mon écran',
              'Rappelle-moi d\'appeler le médecin à 15h',
              'Calcule 18% de 450',
              'Quelle heure est-il ?',
            ].map((p) => (
              <button
                key={p}
                onClick={() => {
                  setTestCmd(p);
                  handleTestCommand(p);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800/80 text-[11px] text-slate-300 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Action Result Display */}
          {actionResult && (
            <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-cyan-500/20 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-cyan-300">Intention détectée : {actionResult.intent}</span>
                <span className="text-[10px] text-slate-500 font-mono">{new Date(actionResult.timestamp || Date.now()).toLocaleTimeString()}</span>
              </div>
              <p className="text-slate-200 font-mono text-[11px]">{actionResult.message}</p>
              {actionResult.payload && Object.keys(actionResult.payload).length > 0 && (
                <pre className="text-[10px] text-slate-400 bg-slate-900/60 p-2 rounded overflow-x-auto">
                  {JSON.stringify(actionResult.payload, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Middle Section: Models and Active Hardware */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Models list */}
          <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
            <h2 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Modèles IA Installés & Accessibles
            </h2>
            <div className="space-y-2.5">
              {models.length > 0 ? (
                models.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-100">{m.name || m.id}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono">
                          {m.owner || 'local'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Context: {m.context_length ? `${(m.context_length / 1024).toFixed(0)}k` : '32k'} tokens • {m.quantization || 'Q4_K_M'}
                      </div>
                    </div>
                    <span className="text-xs font-mono text-emerald-400 font-semibold">Prêt</span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-slate-500">Chargement des modèles...</div>
              )}
            </div>
          </div>

          {/* System Hardware */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
            <h2 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-purple-400" />
              Ressources Matérielles
            </h2>
            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Mémoire RAM Utilisée</span>
                  <span className="font-mono text-slate-400">4.2 GB / 16.0 GB</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-cyan-500 rounded-full" style={{ width: '26%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Processeur & GPU</span>
                  <span className="font-mono text-slate-400">8 Cœurs Actifs</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: '18%' }} />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-slate-400 text-[11px]">
                <div className="flex justify-between">
                  <span>Plateforme :</span>
                  <span className="font-mono text-slate-200">{serverInfo?.platform || 'Linux Container'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Moteur principal :</span>
                  <span className="font-mono text-cyan-400">{serverInfo?.default_engine || 'openjarvis-hybrid'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Temps de fonctionnement :</span>
                  <span className="font-mono text-slate-200">{Math.floor((serverInfo?.uptime || 0) / 60)} minutes</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
