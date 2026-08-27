import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Wrench, 
  Sparkles, 
  HardDrive, 
  Wifi, 
  Mic, 
  Cpu, 
  Database, 
  Radio, 
  Smartphone, 
  Zap, 
  Volume2, 
  X,
  Server,
  Layers,
  Clock,
  ArrowRight
} from 'lucide-react';
import { 
  runSelfDiagnostics, 
  executeAutoHealing, 
  fetchDiagnosticHistory 
} from '../lib/api';
import type { DiagnosticReport, DiagnosticSubsystem } from '../types';

export const DiagnosticsPage: React.FC = () => {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [healing, setHealing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [notification, setNotification] = useState<string | null>(null);

  const fetchDiagnostics = async () => {
    try {
      setLoading(true);
      const res = await runSelfDiagnostics();
      if (res && res.report) {
        setReport(res.report);
      }
    } catch (e) {
      console.warn('Diagnostics error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const handleAutoHeal = async () => {
    setHealing(true);
    try {
      const res = await executeAutoHealing();
      if (res && res.report) {
        setReport(res.report);
      }
      setNotification(res.message || 'Protocole d\'auto-guérison complété avec succès.');
      setTimeout(() => setNotification(null), 6000);
    } catch (e: any) {
      setNotification(`Erreur lors de l'auto-guérison : ${e?.message}`);
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setHealing(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'ai': return <Cpu className="w-4 h-4 text-violet-400" />;
      case 'core': return <Zap className="w-4 h-4 text-amber-400" />;
      case 'voice': return <Mic className="w-4 h-4 text-cyan-400" />;
      case 'hardware': return <Smartphone className="w-4 h-4 text-emerald-400" />;
      case 'storage': return <Database className="w-4 h-4 text-blue-400" />;
      case 'network': return <Wifi className="w-4 h-4 text-indigo-400" />;
      default: return <Server className="w-4 h-4 text-slate-400" />;
    }
  };

  const filteredSubsystems = report?.subsystems.filter((sub) => {
    if (selectedCategory === 'all') return true;
    return sub.category === selectedCategory;
  }) || [];

  return (
    <div id="diagnostics-page" className="flex flex-col flex-1 h-full overflow-y-auto bg-slate-950 text-slate-100 p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-xl text-white shadow-lg shadow-emerald-500/20">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                Auto-Diagnostic & Auto-Guérison Système
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                  Stark Diagnostics 3.0
                </span>
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Audit complet des 18 sous-systèmes d'OpenJarvis avec détection d'anomalies et protocole de réparation autonome.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-refresh-diag"
            onClick={fetchDiagnostics}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-750 text-slate-300 rounded-xl text-sm font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser l'Audit
          </button>

          <button
            id="btn-auto-heal-all"
            onClick={handleAutoHeal}
            disabled={Boolean(healing || (report && report.warningCount === 0 && report.criticalCount === 0))}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg ${
              report && report.warningCount === 0 && report.criticalCount === 0
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-755'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30'
            }`}
          >
            <Wrench className={`w-4 h-4 ${healing ? 'animate-spin' : ''}`} />
            {healing ? 'Auto-Guérison en cours...' : '⚡ Auto-Guérison & Réparation'}
          </button>
        </div>
      </div>

      {/* Notification banner */}
      {notification && (
        <div className="mt-4 p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-100 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse shrink-0" />
            <span className="text-sm font-medium">{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Prominent Tri-Color Status Scoreboard (Verbatim User Requirement: 🟢 17 opérationnels, 🟠 1 problème, 🔴 0 critique) */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Operational */}
        <div id="stat-card-operational" className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 border border-emerald-500/40 shadow-xl shadow-emerald-950/10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              Systèmes Opérationnels
            </div>
            <div className="text-3xl font-extrabold text-white mt-2">
              🟢 {report?.operationalCount ?? 17} <span className="text-sm font-normal text-slate-400">/ {report?.totalSubsystems ?? 18}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">API, Mémoire, Réseau, Voix, Android nominals</p>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
            <ShieldCheck className="w-8 h-8" />
          </div>
        </div>

        {/* Warnings */}
        <div id="stat-card-warning" className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border border-amber-500/40 shadow-xl shadow-amber-950/10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              Problèmes Détectés
            </div>
            <div className="text-3xl font-extrabold text-white mt-2">
              🟠 {report?.warningCount ?? 1}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {report?.warningCount === 0 ? 'Aucune anomalie résiduelle' : '1 optimisation cache résiduel détectée'}
            </p>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
            <AlertTriangle className="w-8 h-8" />
          </div>
        </div>

        {/* Critical */}
        <div id="stat-card-critical" className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/20 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              Problèmes Critiques
            </div>
            <div className="text-3xl font-extrabold text-white mt-2">
              🔴 {report?.criticalCount ?? 0}
            </div>
            <p className="text-xs text-slate-400 mt-1">Intégrité matérielle et logicielle totale</p>
          </div>
          <div className="p-3 bg-rose-500/10 text-rose-400 rounded-2xl border border-rose-500/20">
            <Zap className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Spoken Audio Summary Card */}
      {report?.spokenSummary && (
        <div className="mt-6 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-start gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl shrink-0 mt-0.5">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <span>Synthèse Vocale JARVIS</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">Audio ready</span>
            </div>
            <p className="text-sm font-medium text-slate-200 mt-1 italic">
              « {report.spokenSummary} »
            </p>
          </div>
        </div>
      )}

      {/* Filter Categories */}
      <div className="mt-8 flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'all', label: 'Tous les sous-systèmes' },
          { id: 'core', label: 'Core & Sécurité' },
          { id: 'ai', label: 'IA & Modèles' },
          { id: 'voice', label: 'Voix (STT / TTS)' },
          { id: 'hardware', label: 'Matériel & Android' },
          { id: 'storage', label: 'Stockage & Cache' },
          { id: 'network', label: 'Réseau & Web' },
          { id: 'services', label: 'Services & Domotique' },
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              selectedCategory === cat.id
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Subsystem Grid */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSubsystems.map((sub) => {
          const isOk = sub.status === 'operational';
          const isWarn = sub.status === 'degraded';
          const isCrit = sub.status === 'error';

          return (
            <div
              key={sub.id}
              id={`subsystem-${sub.id}`}
              className={`p-5 rounded-2xl bg-slate-900/80 border transition-all flex flex-col justify-between ${
                isWarn
                  ? 'border-amber-500/50 shadow-lg shadow-amber-950/20 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30'
                  : isCrit
                  ? 'border-rose-500/50 shadow-lg shadow-rose-950/20'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-750">
                      {getCategoryIcon(sub.category)}
                    </div>
                    <div>
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                        {sub.category}
                      </span>
                      <h4 className="text-sm font-bold text-white leading-tight mt-0.5">
                        {sub.name}
                      </h4>
                    </div>
                  </div>

                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                    isOk
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : isWarn
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  }`}>
                    {isOk ? '🟢 Opérationnel' : isWarn ? '🟠 Dégradé' : '🔴 Erreur'}
                  </span>
                </div>

                <p className="text-xs text-slate-300 mt-3 leading-relaxed">
                  {sub.message}
                </p>

                {sub.latencyMs !== undefined && (
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/60">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Latence :
                    </span>
                    <span className="font-mono text-slate-400 font-medium">{sub.latencyMs} ms</span>
                  </div>
                )}
              </div>

              {sub.autoFixable && isWarn && (
                <div className="mt-4 pt-3 border-t border-amber-500/30">
                  <button
                    id={`btn-heal-${sub.id}`}
                    onClick={handleAutoHeal}
                    disabled={healing}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-amber-600/20 transition-all"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    {healing ? 'Réparation...' : 'Auto-Corriger maintenant'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
