import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  BrainCircuit, 
  ArrowRight, 
  Check, 
  X, 
  Play, 
  Plus, 
  Trash2, 
  Layers, 
  Activity, 
  Terminal, 
  Volume2,
  Cpu,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { 
  fetchHabitPatterns, 
  approveHabitSuggestion, 
  dismissHabitSuggestion, 
  fetchLearnedShortcuts, 
  saveLearnedShortcut, 
  deleteLearnedShortcut,
  executeVoiceAction 
} from '../lib/api';
import type { HabitPattern, LearnedShortcut } from '../types';

export const LearnedShortcutsPage: React.FC = () => {
  const [patterns, setPatterns] = useState<HabitPattern[]>([]);
  const [shortcuts, setShortcuts] = useState<LearnedShortcut[]>([]);
  const [loading, setLoading] = useState(true);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // New shortcut modal
  const [showModal, setShowModal] = useState(false);
  const [modalName, setModalName] = useState('');
  const [modalTrigger, setModalTrigger] = useState('');
  const [modalDesc, setModalDesc] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchHabitPatterns();
      if (res && res.patterns) {
        setPatterns(res.patterns);
      }
      if (res && res.shortcuts) {
        setShortcuts(res.shortcuts);
      }
    } catch (e) {
      console.warn('Failed to load habit patterns:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (pattern: HabitPattern) => {
    try {
      const res = await approveHabitSuggestion(pattern.id);
      setNotification(res.message || `Raccourci "${pattern.suggestedShortcutName}" créé avec succès !`);
      setTimeout(() => setNotification(null), 5000);
      await loadData();
    } catch (e: any) {
      setNotification(`Erreur : ${e?.message}`);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const handleDismiss = async (patternId: string) => {
    try {
      await dismissHabitSuggestion(patternId);
      setPatterns((prev) => prev.map((p) => p.id === patternId ? { ...p, status: 'dismissed' } : p));
    } catch (e: any) {
      console.warn('Dismiss error:', e);
    }
  };

  const handleExecuteShortcut = async (sc: LearnedShortcut) => {
    setExecutingId(sc.id);
    try {
      const res = await executeVoiceAction(sc.trigger);
      setNotification(res.message || `Séquence "${sc.name}" exécutée avec succès !`);
      setTimeout(() => setNotification(null), 5000);
      await loadData();
    } catch (e: any) {
      setNotification(`Erreur lors de l'exécution : ${e?.message}`);
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setExecutingId(null);
    }
  };

  const handleDeleteShortcut = async (id: string) => {
    try {
      await deleteLearnedShortcut(id);
      setShortcuts((prev) => prev.filter((s) => s.id !== id));
      setNotification('Raccourci supprimé.');
      setTimeout(() => setNotification(null), 3000);
    } catch (e: any) {
      console.warn('Delete error:', e);
    }
  };

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalName || !modalTrigger) return;

    try {
      const newSc = {
        name: modalName,
        trigger: modalTrigger,
        aliases: [modalName.toLowerCase(), modalTrigger.toLowerCase()],
        description: modalDesc || `Raccourci personnalisé déclenché par "${modalTrigger}"`,
        actions: [
          { type: 'open_app', label: 'Lancer l\'application principale', params: { app: modalName } },
          { type: 'android_setting', label: 'Mode Focus', params: { setting: 'dnd', value: true } },
        ],
      };
      await saveLearnedShortcut(newSc);
      setShowModal(false);
      setModalName('');
      setModalTrigger('');
      setModalDesc('');
      setNotification(`Raccourci "${modalName}" créé avec succès !`);
      setTimeout(() => setNotification(null), 4000);
      await loadData();
    } catch (err: any) {
      alert(`Erreur: ${err?.message}`);
    }
  };

  const suggestedPatterns = patterns.filter((p) => p.status === 'suggested');

  return (
    <div id="learned-shortcuts-page" className="flex flex-col flex-1 h-full overflow-y-auto bg-slate-950 text-slate-100 p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-violet-600 to-indigo-700 rounded-xl text-white shadow-lg shadow-violet-500/20">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                Apprentissage des Raccourcis & Habitudes
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 font-medium">
                  IA Prédictive
                </span>
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                JARVIS analyse vos commandes répétées et vous propose automatiquement de créer des raccourcis ultra-rapides.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-new-shortcut"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-md shadow-violet-600/20"
          >
            <Plus className="w-4 h-4" />
            Nouveau Raccourci
          </button>
        </div>
      </div>

      {/* Notification banner */}
      {notification && (
        <div className="mt-4 p-4 rounded-xl bg-violet-950/80 border border-violet-600/50 text-violet-200 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-violet-400 animate-pulse shrink-0" />
            <span className="text-sm font-medium">{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Section 1: Detected Habit Proposals (Prompt condition: "Tu fais souvent cette action. Veux-tu créer le raccourci...") */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">
              Habitudes Détectées & Suggestions en Attente
            </h2>
            <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {suggestedPatterns.length} suggestion{suggestedPatterns.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {suggestedPatterns.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 text-sm">
            <BrainCircuit className="w-8 h-8 mx-auto text-slate-600 mb-2" />
            Aucune nouvelle suggestion en attente. JARVIS surveille vos commandes vocales régulières en arrière-plan.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {suggestedPatterns.map((pat) => (
              <div
                key={pat.id}
                id={`habit-card-${pat.id}`}
                className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900 to-violet-950/40 border border-violet-500/40 shadow-xl shadow-violet-950/20 flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                        Répété {pat.count} fois
                      </span>
                      <span className="text-xs text-slate-400">
                        Détection automatique
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-white mt-2">
                      « {pat.normalizedCommand} »
                    </h3>
                  </div>

                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                </div>

                {/* The JARVIS proactive speech proposal quote */}
                <div className="mt-3 p-3.5 rounded-xl bg-violet-950/50 border border-violet-700/40 text-violet-200 text-xs sm:text-sm italic">
                  💬 <span className="font-semibold text-white not-italic">JARVIS propose :</span> « Tu fais souvent cette action. Veux-tu créer le raccourci <strong className="text-violet-300 not-italic">"{pat.suggestedShortcutName}"</strong> ? »
                </div>

                {/* Séquence d'actions incluses */}
                <div className="mt-3">
                  <span className="text-xs text-slate-400 font-medium block mb-1.5">Actions qui seront liées au raccourci :</span>
                  <div className="space-y-1.5">
                    {pat.actions.map((act, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-slate-300 bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-750">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{act.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                  <button
                    onClick={() => handleDismiss(pat.id)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    Ignorer cette fois
                  </button>

                  <button
                    id={`btn-approve-${pat.id}`}
                    onClick={() => handleApprove(pat)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md shadow-emerald-600/20"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Créer le raccourci "{pat.suggestedShortcutName}"
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Active Learned Shortcuts */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">
              Raccourcis Enregistrés & Prêts à l'Emploi
            </h2>
            <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {shortcuts.length} actif{shortcuts.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shortcuts.map((sc) => (
            <div
              key={sc.id}
              id={`shortcut-card-${sc.id}`}
              className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-600/20 text-violet-300 border border-violet-500/30">
                      {sc.name}
                    </span>
                    <h3 className="text-base font-bold text-white mt-2">
                      « {sc.trigger} »
                    </h3>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDeleteShortcut(sc.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                  {sc.description}
                </p>

                {/* Aliases */}
                {sc.aliases && sc.aliases.length > 1 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {sc.aliases.map((al, idx) => (
                      <span key={idx} className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                        {al}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions bundle */}
                <div className="mt-3.5 space-y-1.5">
                  {sc.actions.map((act, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950/60 px-2.5 py-1.5 rounded-lg border border-slate-850">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                      <span className="truncate">{act.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Exécuté {sc.frequency} fois
                </span>

                <button
                  id={`btn-test-${sc.id}`}
                  onClick={() => handleExecuteShortcut(sc)}
                  disabled={executingId === sc.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600 text-violet-300 hover:text-white rounded-xl text-xs font-semibold transition-all border border-violet-500/30"
                >
                  <Play className={`w-3.5 h-3.5 ${executingId === sc.id ? 'animate-spin' : ''}`} />
                  {executingId === sc.id ? 'Exécution...' : 'Tester le raccourci'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal for manual shortcut */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Nouveau Raccourci Vocal</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustom} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Nom du Raccourci (Ex: MODE DEV)</label>
                <input
                  type="text"
                  required
                  placeholder="MODE DEV"
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Déclencheur Vocal (Ex: active le mode dev)</label>
                <input
                  type="text"
                  required
                  placeholder="active le mode dev"
                  value={modalTrigger}
                  onChange={(e) => setModalTrigger(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Ce que fait ce raccourci..."
                  value={modalDesc}
                  onChange={(e) => setModalDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-colors shadow-md shadow-violet-600/30"
                >
                  Créer le Raccourci
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
