import { useState, useEffect } from 'react';
import {
  BellRing,
  Sparkles,
  Play,
  Check,
  X,
  Volume2,
  Calendar,
  Battery,
  CloudRain,
  MapPin,
  Clock,
  Car,
  Lightbulb,
  AlertTriangle,
  RefreshCw,
  Compass,
  ArrowRight,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { ProactiveAlert } from '../types';
import { useJarvisVoice } from '../hooks/useJarvisVoice';

export function ProactivePage() {
  const [alerts, setAlerts] = useState<ProactiveAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [executingId, setExecutingId] = useState<string | null>(null);

  const { speak } = useJarvisVoice();

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/v1/proactive/alerts');
      const data = await res.json();
      if (data.alerts) {
        setAlerts(data.alerts);
      }
    } catch {
      toast.error('Erreur lors du chargement des alertes proactives');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleDismiss = async (id: string) => {
    try {
      await fetch(`/v1/proactive/alerts/${id}/dismiss`, { method: 'POST' });
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, dismissed: true } : a)));
      toast.info('Suggestion archivée');
    } catch {
      toast.error("Erreur lors de l'archivage de l'alerte");
    }
  };

  const handleExecute = async (alert: ProactiveAlert) => {
    try {
      setExecutingId(alert.id);
      const res = await fetch(`/v1/proactive/alerts/${alert.id}/execute`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(`Action "${alert.title}" déclenchée avec succès !`);
        if (data.spokenMessage) {
          speak(data.spokenMessage);
        }
        fetchAlerts();
      }
    } catch {
      toast.error("Échec de l'exécution de l'action proactive");
    } finally {
      setExecutingId(null);
    }
  };

  const handleGenerateAISuggestion = async () => {
    try {
      setGenerating(true);
      const res = await fetch('/v1/proactive/generate-suggestion', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.alert) {
        setAlerts((prev) => [data.alert, ...prev]);
        toast.success(`Nouvelle recommandation proactive formulée par JARVIS !`);
        speak(data.alert.message);
      }
    } catch {
      toast.error('Erreur lors de la formulation de la suggestion IA');
    } finally {
      setGenerating(false);
    }
  };

  const getAlertIcon = (type: string, iconName?: string) => {
    switch (type) {
      case 'calendar_traffic':
        return <Car className="w-5 h-5 text-indigo-400" />;
      case 'battery':
        return <Battery className="w-5 h-5 text-rose-400" />;
      case 'weather':
        return <CloudRain className="w-5 h-5 text-cyan-400" />;
      case 'health':
        return <Lightbulb className="w-5 h-5 text-amber-400" />;
      default:
        return <Sparkles className="w-5 h-5 text-purple-400" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return (
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Urgent
          </span>
        );
      case 'medium':
        return (
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
            Important
          </span>
        );
      default:
        return (
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            Suggestion
          </span>
        );
    }
  };

  const activeAlerts = alerts.filter((a) => !a.dismissed && !a.isDismissed);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 text-slate-100 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Eye className="w-6 h-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              JARVIS Proactif & Anticipation Temporelle
            </h1>
          </div>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            JARVIS prend les devants sans attendre votre ordre en analysant votre emploi du temps, vos trajets et votre système.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateAISuggestion}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-900/30 transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            <span>{generating ? 'Analyse en cours...' : 'Générer Suggestion IA'}</span>
          </button>
        </div>
      </div>

      {/* Proactive Showcase banner */}
      <div className="mt-6 p-4 md:p-5 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-900 border border-indigo-800/30">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400">
              <Compass className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Moteur d'Anticipation Contextuelle</span>
            </div>
            <p className="text-sm font-medium text-slate-200">
              « Vous avez un rendez-vous dans 30 minutes. Le trafic est dense vers Paris : vous devriez partir maintenant. »
            </p>
            <p className="text-xs text-slate-400">
              Intégration directe de la cartographie de guidage GPS, du niveau de batterie et des rappels sans sollicitation préalable.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1.5 bg-indigo-950/80 border border-indigo-700/60 rounded-xl text-indigo-300 font-mono flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-400" /> {activeAlerts.length} suggestions actives
            </span>
          </div>
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="space-y-4 mt-6">
        {loading ? (
          <div className="py-12 flex items-center justify-center text-slate-500 gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
            <span>Chargement des anticipations en temps réel...</span>
          </div>
        ) : activeAlerts.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            Aucune alerte proactive en attente. Tout est calme, Monsieur.
          </div>
        ) : (
          activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-5 rounded-2xl border transition-all duration-200 ${
                alert.priority === 'urgent'
                  ? 'bg-rose-950/20 border-rose-800/40 hover:border-rose-500/50'
                  : 'bg-slate-900/80 border-slate-800 hover:border-indigo-500/40 shadow-lg shadow-black/40'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
                    {getAlertIcon(alert.type || alert.category || 'general', alert.icon)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm text-slate-100">{alert.title}</h3>
                      {getPriorityBadge(alert.priority)}
                    </div>
                    <p className="text-xs text-slate-300 mt-1.5 leading-relaxed font-sans">
                      {alert.message}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 font-mono">
                      <span>{new Date(alert.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>•</span>
                      <span className="capitalize">{(alert.type || alert.category || 'Recommandation').replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    onClick={() => speak(alert.message)}
                    className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors"
                    title="Écouter à haute voix"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>

                  {alert.actionLabel && (
                    <button
                      onClick={() => handleExecute(alert)}
                      disabled={executingId === alert.id}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Play className={`w-3.5 h-3.5 ${executingId === alert.id ? 'animate-spin' : ''}`} />
                      <span>{alert.actionLabel}</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleDismiss(alert.id)}
                    className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-800/40 transition-colors"
                    title="Ignorer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
