import React, { useState, useEffect } from 'react';
import { 
  CalendarClock, 
  Clock, 
  RotateCw, 
  Play, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Volume2, 
  X, 
  Sparkles,
  Server,
  FolderGit2,
  Calendar,
  Check
} from 'lucide-react';
import { 
  fetchScheduledTasks, 
  createScheduledTask, 
  updateScheduledTask, 
  deleteScheduledTask, 
  runScheduledTaskNow,
  executeVoiceAction 
} from '../lib/api';
import type { ScheduledTask } from '../types';

export const ScheduledTasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'delayed' | 'recurring'>('all');
  const [notification, setNotification] = useState<{ title: string; desc: string } | null>(null);

  // Modal create
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [taskType, setTaskType] = useState<'delayed_once' | 'recurring_weekly' | 'recurring_daily'>('delayed_once');
  const [delayMinutes, setDelayMinutes] = useState(120);
  const [actionType, setActionType] = useState<'reminder' | 'project_audit' | 'system_report'>('reminder');
  const [rawVoicePrompt, setRawVoicePrompt] = useState('');

  const loadTasks = async () => {
    try {
      setLoading(true);
      const res = await fetchScheduledTasks();
      if (res && res.tasks) {
        setTasks(res.tasks);
      }
    } catch (e) {
      console.warn('Failed to load tasks:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleRunNow = async (task: ScheduledTask) => {
    setRunningId(task.id);
    try {
      const res = await runScheduledTaskNow(task.id);
      setNotification({
        title: `Tâche exécutée : ${task.title}`,
        desc: res.reportSummary || res.spokenOutput || 'Exécution réussie.',
      });
      await loadTasks();
    } catch (e: any) {
      setNotification({
        title: 'Erreur d\'exécution',
        desc: e?.message || 'Impossible d\'exécuter la tâche.',
      });
    } finally {
      setRunningId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteScheduledTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setNotification({ title: 'Tâche supprimée', desc: 'La planification a été annulée.' });
    } catch (e: any) {
      console.warn('Delete error:', e);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    try {
      const res = await createScheduledTask({
        title,
        rawVoicePrompt: rawVoicePrompt || title,
        taskType,
        delayMinutes: taskType === 'delayed_once' ? Number(delayMinutes) : undefined,
        recurrence: taskType === 'recurring_weekly' ? { daysOfWeek: [0], timeOfDay: '18:00' } : undefined,
        actionType,
        actionPayload: { target: title },
      });

      setShowModal(false);
      setTitle('');
      setRawVoicePrompt('');
      setNotification({
        title: 'Tâche programmée avec succès',
        desc: res.spokenConfirmation || 'La tâche a été enregistrée dans le superviseur.',
      });
      await loadTasks();
    } catch (e: any) {
      alert(`Erreur: ${e?.message}`);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (activeTab === 'delayed') return t.taskType === 'delayed_once';
    if (activeTab === 'recurring') return t.taskType.startsWith('recurring');
    return true;
  });

  return (
    <div id="scheduled-tasks-page" className="flex flex-col flex-1 h-full overflow-y-auto bg-slate-950 text-slate-100 p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-600 to-blue-700 rounded-xl text-white shadow-lg shadow-cyan-500/20">
              <CalendarClock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                Tâches Différées & Superviseur de Suivi
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-medium">
                  Assistant Proactif
                </span>
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                JARVIS ne se contente pas de répondre : il exécute des tâches différées dans le temps et surveille vos projets de façon récurrente.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-new-task"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-cyan-600/20"
          >
            <Plus className="w-4 h-4" />
            Programmer une Tâche
          </button>
        </div>
      </div>

      {/* Notification banner */}
      {notification && (
        <div className="mt-4 p-4 rounded-xl bg-cyan-950/80 border border-cyan-500/50 text-cyan-100 flex items-start justify-between shadow-lg">
          <div>
            <div className="flex items-center gap-2 font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              {notification.title}
            </div>
            <p className="text-xs text-cyan-200/90 mt-1">{notification.desc}</p>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Voice Prompt Showcase */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-cyan-500/30 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">Tâche Différée Instantanée</span>
            <p className="text-sm font-medium text-white mt-1">« Dans deux heures, rappelle-moi de vérifier le serveur. »</p>
            <p className="text-xs text-slate-400 mt-1">JARVIS programme le compte à rebours, vérifie l'état et vous notifie oralement.</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-blue-500/30 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 shrink-0">
            <RotateCw className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Supervision Récurrente & Audit</span>
            <p className="text-sm font-medium text-white mt-1">« Tous les dimanches, vérifie mon projet et donne-moi un rapport. »</p>
            <p className="text-xs text-slate-400 mt-1">Audits automatiques de code, intégrité des builds et synthèse vocale envoyée.</p>
          </div>
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="mt-8 flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
            activeTab === 'all'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Toutes ({tasks.length})
        </button>
        <button
          onClick={() => setActiveTab('delayed')}
          className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
            activeTab === 'delayed'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Différées ({tasks.filter((t) => t.taskType === 'delayed_once').length})
        </button>
        <button
          onClick={() => setActiveTab('recurring')}
          className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
            activeTab === 'recurring'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Récurrentes / Superviseur ({tasks.filter((t) => t.taskType.startsWith('recurring')).length})
        </button>
      </div>

      {/* Tasks List */}
      <div className="mt-6 space-y-4">
        {filteredTasks.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-900/50 border border-slate-800 text-slate-400 text-sm">
            Aucune tâche trouvée dans cette catégorie.
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isDelayed = task.taskType === 'delayed_once';
            return (
              <div
                key={task.id}
                id={`task-card-${task.id}`}
                className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-2xl shrink-0 ${
                    isDelayed 
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' 
                      : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                  }`}>
                    {isDelayed ? <Clock className="w-6 h-6" /> : <FolderGit2 className="w-6 h-6" />}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                        isDelayed
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                          : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                      }`}>
                        {isDelayed ? 'Différée (One-shot)' : 'Récurrente (Superviseur)'}
                      </span>

                      {task.recurrence && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                          Dimanche à 18:00
                        </span>
                      )}

                      {task.delayMinutes && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                          Dans {task.delayMinutes} minutes
                        </span>
                      )}

                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        task.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : task.status === 'recurring'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {task.status === 'completed' ? 'Complétée' : task.status === 'recurring' ? 'En surveillance' : 'En attente'}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white mt-1.5">
                      {task.title}
                    </h3>

                    {task.rawVoicePrompt && (
                      <p className="text-xs text-slate-400 italic mt-0.5">
                        « {task.rawVoicePrompt} »
                      </p>
                    )}

                    {task.lastReportSummary && (
                      <div className="mt-2.5 p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
                        <FileText className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-slate-200">Dernier rapport délivré : </span>
                          <span>{task.lastReportSummary}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  <button
                    id={`btn-run-${task.id}`}
                    onClick={() => handleRunNow(task)}
                    disabled={runningId === task.id}
                    className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md shadow-cyan-600/20"
                  >
                    <Play className={`w-4 h-4 ${runningId === task.id ? 'animate-spin' : ''}`} />
                    {runningId === task.id ? 'Exécution...' : 'Exécuter & Rapport'}
                  </button>

                  <button
                    onClick={() => handleDelete(task.id)}
                    className="p-2 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors"
                    title="Supprimer la tâche"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Programmer une Tâche Différée</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Titre de la tâche</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Vérification du serveur de production"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Type de planification</label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="delayed_once">Tâche différée (Dans X minutes/heures)</option>
                  <option value="recurring_weekly">Récurrent hebdomadaire (Tous les dimanches)</option>
                  <option value="recurring_daily">Récurrent quotidien (Tous les jours à 08h00)</option>
                </select>
              </div>

              {taskType === 'delayed_once' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Délai avant exécution (en minutes)</label>
                  <input
                    type="number"
                    min="1"
                    value={delayMinutes}
                    onChange={(e) => setDelayMinutes(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">Exemple: 120 pour 2 heures</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Action & Rapport attendu</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="reminder">Rappel standard vocal & notification</option>
                  <option value="project_audit">Audit complet de projet & Rapport de code</option>
                  <option value="system_report">Supervision télémétrie & Rapport système</option>
                </select>
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
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-semibold transition-colors shadow-md shadow-cyan-600/30"
                >
                  Valider la Tâche
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
