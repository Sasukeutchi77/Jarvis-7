import { useState, useEffect } from 'react';
import {
  Sparkles,
  Play,
  Plus,
  Trash2,
  CheckCircle2,
  Mic,
  MoonStar,
  Car,
  Film,
  Gamepad2,
  Bluetooth,
  Battery,
  Music,
  Sun,
  Volume2,
  Radio,
  Sliders,
  Check,
  RefreshCw,
  Power,
  ChevronRight,
  Headphones,
  Tag,
  Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';
import { VoiceKeywordMacro } from '../types';
import { useJarvisVoice } from '../hooks/useJarvisVoice';

export function VoiceMacrosPage() {
  const [macros, setMacros] = useState<VoiceKeywordMacro[]>([]);
  const [loading, setLoading] = useState(true);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'custom'>('all');

  const { speak, isListening, startListening, stopListening } = useJarvisVoice();

  // Create form state
  const [newName, setNewName] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [newAliases, setNewAliases] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState('#8b5cf6');
  const [newIcon, setNewIcon] = useState('MoonStar');

  const [actions, setActions] = useState<Array<{ type: string; label: string; params: any }>>([
    { type: 'battery_saver', label: "Activer l'économie d'énergie", params: { state: true } },
    { type: 'bluetooth', label: 'Activer le Bluetooth', params: { state: true } },
    { type: 'connect_device', label: 'Connecter casque sans-fil', params: { deviceName: 'Casque Bluetooth Audio' } },
    { type: 'open_app', label: 'Ouvrir Spotify', params: { app: 'Spotify' } },
    { type: 'spotify_play', label: 'Lancer playlist Focus', params: { query: 'Deep Focus Chill' } },
  ]);

  const fetchMacros = async () => {
    try {
      setLoading(true);
      const res = await fetch('/v1/keyword-macros');
      const data = await res.json();
      if (data.macros) {
        setMacros(data.macros);
      }
    } catch {
      toast.error('Erreur lors du chargement des macros de mots-clés');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMacros();
  }, []);

  const handleExecute = async (macro: VoiceKeywordMacro) => {
    try {
      setExecutingId(macro.id);
      const res = await fetch(`/v1/keyword-macros/${macro.id}/execute`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(`Macro "${macro.name}" exécutée (${data.executedSteps.length} actions)`);
        if (data.spokenMessage) {
          speak(data.spokenMessage);
        }
      }
    } catch {
      toast.error("Échec de l'exécution de la macro vocale");
    } finally {
      setExecutingId(null);
    }
  };

  const handleToggle = async (macro: VoiceKeywordMacro) => {
    const updated = !macro.isEnabled;
    try {
      await fetch(`/v1/keyword-macros/${macro.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: updated }),
      });
      setMacros((prev) =>
        prev.map((m) => (m.id === macro.id ? { ...m, isEnabled: updated } : m))
      );
      toast.info(`Macro "${macro.name}" ${updated ? 'activée' : 'désactivée'}`);
    } catch {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await fetch(`/v1/keyword-macros/${id}`, { method: 'DELETE' });
      setMacros((prev) => prev.filter((m) => m.id !== id));
      toast.success(`Macro "${name}" supprimée`);
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newKeyword.trim()) {
      toast.error('Veuillez renseigner un nom et un mot-clé principal');
      return;
    }

    const parsedAliases = newAliases
      .split(',')
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean);

    try {
      const res = await fetch('/v1/keyword-macros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          keyword: newKeyword.toLowerCase().trim(),
          aliases: parsedAliases,
          description: newDesc,
          color: newColor,
          icon: newIcon,
          actions,
        }),
      });
      const data = await res.json();
      if (data.id) {
        setMacros((prev) => [data, ...prev]);
        toast.success(`Mot-clé "${newName}" enregistré avec succès !`);
        setShowCreateModal(false);
        setNewName('');
        setNewKeyword('');
        setNewAliases('');
        setNewDesc('');
      }
    } catch {
      toast.error("Erreur lors de la création de la macro d'actions");
    }
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'MoonStar':
        return <MoonStar className="w-5 h-5" />;
      case 'Car':
        return <Car className="w-5 h-5" />;
      case 'Film':
        return <Film className="w-5 h-5" />;
      case 'Gamepad2':
        return <Gamepad2 className="w-5 h-5" />;
      case 'Bluetooth':
        return <Bluetooth className="w-5 h-5" />;
      default:
        return <Sparkles className="w-5 h-5" />;
    }
  };

  const getActionBadgeIcon = (type: string) => {
    switch (type) {
      case 'battery_saver':
        return <Battery className="w-3.5 h-3.5 text-amber-400" />;
      case 'bluetooth':
      case 'connect_device':
        return <Bluetooth className="w-3.5 h-3.5 text-blue-400" />;
      case 'open_app':
        return <Smartphone className="w-3.5 h-3.5 text-emerald-400" />;
      case 'spotify_play':
        return <Music className="w-3.5 h-3.5 text-green-400" />;
      case 'screen_brightness':
        return <Sun className="w-3.5 h-3.5 text-yellow-400" />;
      case 'volume':
        return <Volume2 className="w-3.5 h-3.5 text-cyan-400" />;
      case 'smart_home':
        return <Sliders className="w-3.5 h-3.5 text-indigo-400" />;
      default:
        return <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const filteredMacros = macros.filter((m) => {
    if (activeFilter === 'active') return m.isEnabled;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 text-slate-100 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-tr from-purple-500/20 to-indigo-500/20 border border-purple-500/30 rounded-xl text-purple-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Mots-Clés Vocaux & Multi-Tâches
            </h1>
          </div>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Déclenchez une chaîne complexe de tâches simultanées en prononçant une seule expression clé.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => (isListening ? stopListening() : startListening())}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              isListening
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 animate-pulse'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>{isListening ? 'Écoute active...' : 'Tester au micro'}</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-900/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Mot-Clé</span>
          </button>
        </div>
      </div>

      {/* Hero Showcase card */}
      <div className="mt-6 p-4 md:p-5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900 border border-purple-800/30">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-400">
              <Radio className="w-4 h-4 animate-pulse" />
              <span>Exemple d'orchestration vocale</span>
            </div>
            <p className="text-sm font-medium text-slate-200">
              Dites simplement : <span className="text-purple-300 font-mono font-bold bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30">« JARVIS, active le mode nuit blanche »</span>
            </p>
            <p className="text-xs text-slate-400">
              JARVIS active le mode économie, allume le Bluetooth, connecte votre casque Sony, ouvre Spotify et lance votre playlist d'étude.
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] px-2 py-1 bg-slate-900/80 border border-slate-700 rounded-lg text-slate-300 flex items-center gap-1">
              <Battery className="w-3 h-3 text-amber-400" /> Économie
            </span>
            <span className="text-[10px] px-2 py-1 bg-slate-900/80 border border-slate-700 rounded-lg text-slate-300 flex items-center gap-1">
              <Bluetooth className="w-3 h-3 text-blue-400" /> Casque Sony
            </span>
            <span className="text-[10px] px-2 py-1 bg-slate-900/80 border border-slate-700 rounded-lg text-slate-300 flex items-center gap-1">
              <Music className="w-3 h-3 text-green-400" /> Spotify Focus
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mt-6">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeFilter === 'all'
              ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50'
              : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          Tous les mots-clés ({macros.length})
        </button>
        <button
          onClick={() => setActiveFilter('active')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeFilter === 'active'
              ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50'
              : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          Actifs ({macros.filter((m) => m.isEnabled).length})
        </button>
      </div>

      {/* Grid of Macros */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        {loading ? (
          <div className="col-span-full py-12 flex items-center justify-center text-slate-500 gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-purple-500" />
            <span>Chargement des configurations de mots-clés...</span>
          </div>
        ) : filteredMacros.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500">
            Aucun mot-clé trouvé.
          </div>
        ) : (
          filteredMacros.map((macro) => (
            <div
              key={macro.id}
              className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                macro.isEnabled
                  ? 'bg-slate-900/80 border-slate-800 hover:border-purple-500/40 shadow-lg shadow-black/40'
                  : 'bg-slate-900/30 border-slate-800/40 opacity-60'
              }`}
            >
              <div>
                {/* Card Top */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="p-2.5 rounded-xl text-white shadow-sm flex items-center justify-center"
                      style={{ backgroundColor: `${macro.color}25`, borderColor: `${macro.color}50`, borderWidth: 1 }}
                    >
                      <span style={{ color: macro.color }}>{getIcon(macro.icon || 'Sparkles')}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-slate-100">{macro.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Tag className="w-3 h-3 text-purple-400" />
                        <span className="text-xs font-mono font-semibold text-purple-300">
                          « {macro.keyword} »
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(macro)}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        macro.isEnabled
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                      title={macro.isEnabled ? 'Désactiver' : 'Activer'}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(macro.id, macro.name)}
                      className="p-1.5 rounded-lg border border-transparent hover:border-rose-500/30 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                  {macro.description}
                </p>

                {/* Aliases */}
                {macro.aliases && macro.aliases.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                    <span className="text-[10px] text-slate-500 font-mono">Variantes :</span>
                    {macro.aliases.map((alias, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700/60 text-slate-400 font-mono"
                      >
                        {alias}
                      </span>
                    ))}
                  </div>
                )}

                {/* Action Sequence */}
                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Séquence de {macro.actions?.length || 0} actions chaînées</span>
                    <span className="text-[10px] text-purple-400 font-mono font-normal">Exécution simultanée</span>
                  </div>
                  <div className="space-y-1.5">
                    {macro.actions?.map((act, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800/80"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {getActionBadgeIcon(act.type)}
                          <span className="truncate text-slate-200">{act.label}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0">Étape {i + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Trigger Button */}
              <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-mono">
                  {macro.lastExecutedAt
                    ? `Dernière exécution : ${new Date(macro.lastExecutedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                    : 'Prêt pour déclenchement'}
                </span>

                <button
                  onClick={() => handleExecute(macro)}
                  disabled={executingId === macro.id}
                  className="flex items-center gap-2 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 ${executingId === macro.id ? 'animate-spin' : ''}`} />
                  <span>{executingId === macro.id ? 'En cours...' : 'Déclencher la Macro'}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal create macro */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              Créer un Mot-Clé Multi-Tâches
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Configurez une phrase clé personnalisée et associez-y plusieurs actions à exécuter en rafale.
            </p>

            <form onSubmit={handleCreate} className="space-y-4 mt-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nom du Mode ou de la Macro
                </label>
                <input
                  type="text"
                  placeholder="Ex: Mode Nuit Blanche, Mode Départ Bureau"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Mot-Clé Vocal Principal
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: mode nuit blanche"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Couleur Thème
                  </label>
                  <div className="flex items-center gap-2">
                    {['#8b5cf6', '#06b6d4', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'].map((c) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setNewColor(c)}
                        className={`w-6 h-6 rounded-full border transition-transform ${
                          newColor === c ? 'scale-125 border-white' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Variantes / Synonymes (séparés par des virgules)
                </label>
                <input
                  type="text"
                  placeholder="Ex: nuit blanche, active la nuit blanche, lance le mode nuit blanche"
                  value={newAliases}
                  onChange={(e) => setNewAliases(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Coupe les distractions, bascule en économie d'énergie et met Spotify."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Actions List in Modal */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Actions à exécuter simultanément ({actions.length})
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {actions.map((act, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {getActionBadgeIcon(act.type)}
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
                        { type: 'volume', label: 'Ajuster volume à 70%', params: { level: 70 } },
                      ])
                    }
                    className="text-[11px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
                  >
                    + Volume
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActions((prev) => [
                        ...prev,
                        { type: 'screen_brightness', label: 'Luminosité à 25%', params: { level: 25 } },
                      ])
                    }
                    className="text-[11px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
                  >
                    + Luminosité
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActions((prev) => [
                        ...prev,
                        { type: 'tts_speak', label: 'Message vocal JARVIS', params: { text: 'Protocole activé avec succès.' } },
                      ])
                    }
                    className="text-[11px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
                  >
                    + Annonce Vocale
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
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-900/30 cursor-pointer"
                >
                  Sauvegarder le Mot-Clé
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
