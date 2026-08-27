import { useState, useEffect } from 'react';
import {
  Zap,
  Play,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Battery,
  MapPin,
  Moon,
  Volume2,
  Sun,
  Music,
  Power,
  RefreshCw,
  ArrowRight,
  Sliders,
  Sparkles,
  Smartphone,
  Shield,
  Wifi,
  BellRing,
  HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { AutomationRule } from '../types';
import { useJarvisVoice } from '../hooks/useJarvisVoice';

export function AutomationsPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [simulating, setSimulating] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'time' | 'battery' | 'location'>('all');

  const { speak } = useJarvisVoice();

  // Create form state
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCondType, setNewCondType] = useState<'time' | 'battery' | 'location' | 'state'>('time');
  const [newCondOperator, setNewCondOperator] = useState<string>('eq');
  const [newCondValue, setNewCondValue] = useState<string>('20:00');
  const [newColor, setNewColor] = useState('#06b6d4');

  const [actions, setActions] = useState<Array<{ type: string; label: string; params: any }>>([
    { type: 'sound_mode', label: 'Activer le mode silencieux', params: { mode: 'silent' } },
    { type: 'open_app', label: 'Ouvrir Spotify', params: { app: 'Spotify' } },
    { type: 'spotify_play', label: 'Lancer playlist Chill Soirée', params: { query: 'Chill Night' } },
    { type: 'screen_brightness', label: 'Diminuer la luminosité à 20%', params: { level: 20 } },
  ]);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await fetch('/v1/automations');
      const data = await res.json();
      if (data.rules) {
        setRules(data.rules);
      }
    } catch {
      toast.error('Erreur lors du chargement des règles IF-THEN');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleEvaluate = async (rule: AutomationRule) => {
    try {
      setExecutingId(rule.id);
      const res = await fetch(`/v1/automations/${rule.id}/evaluate`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(`Règle "${rule.name}" déclenchée avec succès !`);
        if (data.spokenMessage) {
          speak(data.spokenMessage);
        }
      }
    } catch {
      toast.error("Échec de l'évaluation de la règle");
    } finally {
      setExecutingId(null);
    }
  };

  const handleSimulateTrigger = async (eventType: string, eventValue: any) => {
    try {
      setSimulating(eventType);
      const res = await fetch('/v1/automations/simulate-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType, eventValue }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          `Événement simulé (${eventType}) : ${data.triggeredCount} règle(s) déclenchée(s)`
        );
        fetchRules();
      }
    } catch {
      toast.error("Erreur lors de la simulation de l'événement");
    } finally {
      setSimulating(null);
    }
  };

  const handleToggle = async (rule: AutomationRule) => {
    const updated = !rule.isEnabled;
    try {
      await fetch(`/v1/automations/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: updated }),
      });
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, isEnabled: updated } : r))
      );
      toast.info(`Règle "${rule.name}" ${updated ? 'activée' : 'mise en veille'}`);
    } catch {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await fetch(`/v1/automations/${id}`, { method: 'DELETE' });
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast.success(`Règle "${name}" supprimée`);
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error('Veuillez renseigner un titre pour la règle');
      return;
    }

    try {
      const res = await fetch('/v1/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          description: newDesc,
          color: newColor,
          condition: {
            type: newCondType,
            operator: newCondOperator,
            value: newCondValue,
          },
          actions,
        }),
      });
      const data = await res.json();
      if (data.id) {
        setRules((prev) => [data, ...prev]);
        toast.success(`Automatisation "${newName}" créée avec succès !`);
        setShowCreateModal(false);
        setNewName('');
        setNewDesc('');
      }
    } catch {
      toast.error("Erreur lors de la création de l'automatisation");
    }
  };

  const getConditionBadge = (cond?: AutomationRule['condition']) => {
    if (!cond) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-cyan-300 font-mono bg-cyan-950/40 border border-cyan-800/40 px-2 py-1 rounded-lg">
          <Zap className="w-3.5 h-3.5" />
          <span>Condition personnalisée</span>
        </div>
      );
    }
    switch (cond.type) {
      case 'time':
        return (
          <div className="flex items-center gap-1.5 text-xs text-amber-300 font-mono bg-amber-950/40 border border-amber-800/40 px-2 py-1 rounded-lg">
            <Clock className="w-3.5 h-3.5" />
            <span>SI Heure {cond.operator === 'eq' ? '==' : cond.operator} {String(cond.value)}</span>
          </div>
        );
      case 'battery':
        return (
          <div className="flex items-center gap-1.5 text-xs text-rose-300 font-mono bg-rose-950/40 border border-rose-800/40 px-2 py-1 rounded-lg">
            <Battery className="w-3.5 h-3.5" />
            <span>SI Batterie {cond.operator === 'lt' ? '<' : cond.operator === 'gt' ? '>' : '=='} {String(cond.value)}%</span>
          </div>
        );
      case 'location':
        return (
          <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-mono bg-emerald-950/40 border border-emerald-800/40 px-2 py-1 rounded-lg">
            <MapPin className="w-3.5 h-3.5" />
            <span>SI Position == "{String(cond.value)}"</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 text-xs text-cyan-300 font-mono bg-cyan-950/40 border border-cyan-800/40 px-2 py-1 rounded-lg">
            <Zap className="w-3.5 h-3.5" />
            <span>SI Événement == {String(cond.value)}</span>
          </div>
        );
    }
  };

  const filteredRules = rules.filter((r) => {
    const cond = r.condition || r.trigger;
    if (activeFilter === 'time') return cond?.type === 'time';
    if (activeFilter === 'battery') return cond?.type === 'battery';
    if (activeFilter === 'location') return cond?.type === 'location';
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 text-slate-100 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-xl text-cyan-400">
              <Zap className="w-6 h-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Automatisations & Déclencheurs IF → THEN
            </h1>
          </div>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Programmez des comportements intelligents basés sur des conditions temporelles, système ou géolocalisées.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-900/30 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvelle Règle IF → THEN</span>
        </button>
      </div>

      {/* Simulator Sandbox */}
      <div className="mt-6 p-4 md:p-5 rounded-2xl bg-gradient-to-r from-cyan-950/30 via-slate-900 to-slate-900 border border-cyan-800/30">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
              <Sparkles className="w-4 h-4" />
              <span>Simulateur d'Événements en Temps Réel</span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Déclenchez instantanément un événement pour vérifier la réactivité du moteur d'automatisation.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleSimulateTrigger('time', '20:00')}
              disabled={simulating === 'time'}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-700/50 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Simuler 20h00</span>
            </button>
            <button
              onClick={() => handleSimulateTrigger('battery', 18)}
              disabled={simulating === 'battery'}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-rose-300 border border-rose-700/50 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Battery className="w-3.5 h-3.5" />
              <span>Batterie &lt; 20%</span>
            </button>
            <button
              onClick={() => handleSimulateTrigger('location', 'Domicile')}
              disabled={simulating === 'location'}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-700/50 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Arrivée Domicile</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mt-6">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeFilter === 'all'
              ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/50'
              : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          Toutes les règles ({rules.length})
        </button>
        <button
          onClick={() => setActiveFilter('time')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeFilter === 'time'
              ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/50'
              : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          Horaires / Heures
        </button>
        <button
          onClick={() => setActiveFilter('battery')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeFilter === 'battery'
              ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/50'
              : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          Batterie & Énergie
        </button>
        <button
          onClick={() => setActiveFilter('location')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeFilter === 'location'
              ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/50'
              : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          Géolocalisation
        </button>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        {loading ? (
          <div className="col-span-full py-12 flex items-center justify-center text-slate-500 gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-cyan-500" />
            <span>Chargement des règles d'automatisation...</span>
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500">
            Aucune règle trouvée pour ce filtre.
          </div>
        ) : (
          filteredRules.map((rule) => (
            <div
              key={rule.id}
              className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                rule.isEnabled
                  ? 'bg-slate-900/80 border-slate-800 hover:border-cyan-500/40 shadow-lg shadow-black/40'
                  : 'bg-slate-900/30 border-slate-800/40 opacity-60'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-sm text-slate-100">{rule.name}</h3>
                    <p className="text-xs text-slate-400 mt-1">{rule.description}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(rule)}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        rule.isEnabled
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                      title={rule.isEnabled ? 'Désactiver' : 'Activer'}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id, rule.name)}
                      className="p-1.5 rounded-lg border border-transparent hover:border-rose-500/30 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* IF Logic Container */}
                <div className="mt-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
                      1. Déclencheur (IF)
                    </span>
                    {getConditionBadge(rule.condition || rule.trigger)}
                  </div>
                </div>

                {/* THEN Logic Container */}
                <div className="mt-2.5 p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider mb-2">
                    2. Actions à déclencher (THEN)
                  </div>
                  <div className="space-y-1.5">
                    {rule.actions?.map((act, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300"
                      >
                        <ArrowRight className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span className="truncate">{act.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom footer */}
              <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-mono">
                  {rule.lastTriggeredAt
                    ? `Dernier déclenchement : ${new Date(rule.lastTriggeredAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                    : 'En attente de condition'}
                </span>

                <button
                  onClick={() => handleEvaluate(rule)}
                  disabled={executingId === rule.id}
                  className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 ${executingId === rule.id ? 'animate-spin' : ''}`} />
                  <span>{executingId === rule.id ? 'Test en cours...' : 'Exécuter les Actions'}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              Créer une Règle IF → THEN
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Spécifiez la condition logique et les actions à déclencher automatiquement.
            </p>

            <form onSubmit={handleCreate} className="space-y-4 mt-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nom de la règle
                </label>
                <input
                  type="text"
                  placeholder="Ex: Soirée Détente 20h00, Protection Batterie Faible"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Quand il est 20h00, passe en mode silencieux, lance Spotify et baisse la luminosité."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Condition Builder */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider block">
                  Condition Déclencheur (IF)
                </span>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Type de capteur</label>
                    <select
                      value={newCondType}
                      onChange={(e) => setNewCondType(e.target.value as any)}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200"
                    >
                      <option value="time">Heure (Horloge)</option>
                      <option value="battery">Niveau Batterie</option>
                      <option value="location">Position GPS</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Opérateur</label>
                    <select
                      value={newCondOperator}
                      onChange={(e) => setNewCondOperator(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200"
                    >
                      <option value="eq">Égal à (==)</option>
                      <option value="lt">Inférieur à (&lt;)</option>
                      <option value="gt">Supérieur à (&gt;)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Valeur cible</label>
                    <input
                      type="text"
                      value={newCondValue}
                      onChange={(e) => setNewCondValue(e.target.value)}
                      placeholder="20:00 ou 20 ou Domicile"
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* Actions Builder */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Actions THEN ({actions.length})
                </label>
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {actions.map((act, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{act.label}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActions((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() =>
                      setActions((prev) => [
                        ...prev,
                        { type: 'notify', label: "Alerter l'utilisateur à l'écran", params: { title: 'Alerte Système' } },
                      ])
                    }
                    className="text-[11px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
                  >
                    + Notification
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActions((prev) => [
                        ...prev,
                        { type: 'battery_saver', label: "Activer économie d'énergie", params: { state: true } },
                      ])
                    }
                    className="text-[11px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
                  >
                    + Économie Batterie
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-900/30 cursor-pointer"
                >
                  Créer l'Automatisation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
