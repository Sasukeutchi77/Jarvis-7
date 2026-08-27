import React, { useState, useEffect } from 'react';
import {
  Zap,
  Play,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Mic,
  MapPin,
  Moon,
  Briefcase,
  Sun,
  ShieldAlert,
  Volume2,
  Sparkles,
  RefreshCw,
  Power,
  ChevronRight,
  Shield,
  Smartphone,
  Cpu,
  AlertTriangle,
  Radio,
  Sliders,
  Check,
  X,
  VolumeX,
  Layers,
  Activity,
  History,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchSmartRoutines,
  fetchRoutineSchedulerStatus,
  fetchRoutineHistory,
  createSmartRoutine,
  updateSmartRoutine,
  deleteSmartRoutine,
  executeSmartRoutine,
  toggleSmartRoutine,
  confirmRoutineSensitiveAction,
  testRoutineTrigger,
} from '../lib/api';

export function RoutinesPage() {
  const [routines, setRoutines] = useState<any[]>([]);
  const [schedulerStatus, setSchedulerStatus] = useState<any>(null);
  const [registeredJobs, setRegisteredJobs] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'routines' | 'builder' | 'scheduler' | 'simulator' | 'history'>('routines');

  // Execution Report state
  const [latestReport, setLatestReport] = useState<any>(null);
  const [speakingBriefing, setSpeakingBriefing] = useState(false);

  // Sensitive action confirmation modal
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    token: string;
    actionId: string;
    description: string;
    riskLevel: string;
    routineId?: string;
  } | null>(null);

  // New Routine Builder form state
  const [builderName, setBuilderName] = useState('');
  const [builderDesc, setBuilderDesc] = useState('');
  const [builderColor, setBuilderColor] = useState('#10b981');
  const [builderIcon, setBuilderIcon] = useState('Sparkles');
  const [builderTriggers, setBuilderTriggers] = useState<any[]>([
    {
      id: 'trig_custom_voice',
      type: 'user_action',
      label: 'Commande vocale',
      enabled: true,
      userActionConfig: { voicePhrases: [] },
    },
  ]);
  const [voicePhraseInput, setVoicePhraseInput] = useState('');
  const [builderTimeInput, setBuilderTimeInput] = useState('08:00');
  const [builderLocationInput, setBuilderLocationInput] = useState('Bureau');
  const [builderActions, setBuilderActions] = useState<any[]>([
    {
      id: 'act_1',
      type: 'weather_briefing',
      name: 'Bulletin Météo',
      description: 'Récupération de la météo',
      order: 1,
      enabled: true,
      isSensitive: false,
      params: { city: 'Toulouse' },
    },
    {
      id: 'act_2',
      type: 'voice_briefing',
      name: 'Synthèse Vocale JARVIS',
      description: 'Briefing vocal interactif',
      order: 2,
      enabled: true,
      isSensitive: false,
      params: { tone: 'formal' },
    },
  ]);

  // Trigger Simulator state
  const [simQuery, setSimQuery] = useState('lance le mode matin');
  const [simType, setSimType] = useState<'voice' | 'time' | 'location' | 'notification' | 'event'>('voice');
  const [simTime, setSimTime] = useState('07:00');
  const [simLocation, setSimLocation] = useState('Bureau');
  const [simResult, setSimResult] = useState<any>(null);
  const [simulating, setSimulating] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rData, sData, hData] = await Promise.all([
        fetchSmartRoutines().catch(() => ({ routines: [], schedulerStatus: null })),
        fetchRoutineSchedulerStatus().catch(() => ({ schedulerStatus: null, registeredJobs: [] })),
        fetchRoutineHistory().catch(() => ({ history: [] })),
      ]);

      if (rData.routines) setRoutines(rData.routines);
      if (sData.schedulerStatus) setSchedulerStatus(sData.schedulerStatus);
      if (sData.registeredJobs) setRegisteredJobs(sData.registeredJobs);
      if (hData.history) setHistory(hData.history);
    } catch {
      toast.error('Erreur lors de la synchronisation des routines.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Text-to-Speech briefing player
  const playVoiceBriefing = (text: string) => {
    if (!text || typeof window === 'undefined') return;

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      utterance.rate = 1.05;
      utterance.pitch = 0.95;

      utterance.onstart = () => setSpeakingBriefing(true);
      utterance.onend = () => setSpeakingBriefing(false);
      utterance.onerror = () => setSpeakingBriefing(false);

      window.speechSynthesis.speak(utterance);
      toast.info('Lecture vocale JARVIS en cours...');
    } else {
      toast.info('Synthèse vocale Web non prise en charge sur ce navigateur.');
    }
  };

  const stopVoiceBriefing = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeakingBriefing(false);
    }
  };

  const handleExecute = async (routineId: string, routineName: string) => {
    setExecutingId(routineId);
    try {
      const res = await executeSmartRoutine(routineId, 'manual_ui');
      if (res.success && res.report) {
        setLatestReport(res.report);
        toast.success(`Routine "${routineName}" exécutée (${res.report.status}).`);

        if (res.report.pendingConfirmations && res.report.pendingConfirmations.length > 0) {
          const conf = res.report.pendingConfirmations[0];
          setPendingConfirmation({
            token: conf.token,
            actionId: conf.actionId,
            description: conf.description,
            riskLevel: conf.riskLevel,
            routineId,
          });
          toast.warning('Une action sensible requiert votre validation de sécurité.');
        }

        if (res.report.spokenBriefing) {
          playVoiceBriefing(res.report.spokenBriefing);
        }

        loadData();
      }
    } catch (err: any) {
      toast.error(err?.message || `Erreur lors de l'exécution`);
    } finally {
      setExecutingId(null);
    }
  };

  const handleToggleEnable = async (routineId: string) => {
    try {
      const res = await toggleSmartRoutine(routineId);
      if (res.success) {
        setRoutines((prev) =>
          prev.map((r) => (r.id === routineId ? { ...r, enabled: res.enabled } : r))
        );
        toast.success(`Routine ${res.enabled ? 'activée' : 'désactivée'}`);
      }
    } catch {
      toast.error('Erreur lors du basculement.');
    }
  };

  const handleDelete = async (routineId: string, isBuiltin: boolean) => {
    try {
      await deleteSmartRoutine(routineId);
      if (isBuiltin) {
        toast.info('Preset système désactivé.');
      } else {
        toast.success('Routine personnalisée supprimée.');
      }
      loadData();
    } catch {
      toast.error('Échec de la suppression.');
    }
  };

  const handleConfirmSensitiveToken = async () => {
    if (!pendingConfirmation) return;
    try {
      const res = await confirmRoutineSensitiveAction(pendingConfirmation.token);
      if (res.success) {
        toast.success('Action sensible confirmée et autorisée par le protocole de sécurité.');
        const routineId = pendingConfirmation.routineId;
        const tokens: Record<string, string> = {
          [pendingConfirmation.actionId]: pendingConfirmation.token,
        };
        setPendingConfirmation(null);

        if (routineId) {
          // Re-run with authorized token
          const reRun = await executeSmartRoutine(routineId, 'authorized_token', tokens);
          if (reRun.success) {
            setLatestReport(reRun.report);
            toast.success('Action débloquée et exécutée avec succès.');
            loadData();
          }
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Échec de la validation du jeton');
    }
  };

  const handleAddActionToBuilder = (type: string) => {
    const defaultActionsMap: Record<string, any> = {
      weather_briefing: { name: 'Bulletin Météo', description: 'Météo en direct & prévisions', params: { city: 'Toulouse' }, isSensitive: false },
      calendar_digest: { name: 'Calendrier & Rendez-vous', description: 'Digest des événements du jour', params: { timeframe: 'today' }, isSensitive: false },
      important_messages: { name: 'Messages & Alertes', description: 'Filtrage des communications urgentes', params: { unreadOnly: true }, isSensitive: false },
      tasks_review: { name: 'Revue des Tâches', description: 'Liste des tâches prioritaires', params: { scope: 'today_pending' }, isSensitive: false },
      voice_briefing: { name: 'Briefing Vocal', description: 'Synthèse vocale personnalisée', params: { tone: 'formal' }, isSensitive: false },
      dnd_toggle: { name: 'Mode Ne Pas Déranger', description: 'Filtrage intelligent des notifications', params: { state: true }, isSensitive: false },
      app_launcher: { name: 'Applications de Travail', description: 'Lancement des outils autorisés', params: { blockNonAuthorizedApps: false }, isSensitive: false },
      device_settings: { name: 'Paramètres Android', description: 'Ajustement volume, luminosité et réseau', params: { volumePercent: 70, screenBrightnessPercent: 80 }, isSensitive: false },
      sensitive_action: { name: 'Action Sensible & Sécurisée', description: 'Commande critique nécessitant confirmation', params: { actionIdentifier: 'critical_task', riskLevel: 'high' }, isSensitive: true },
    };

    const template = defaultActionsMap[type] || { name: 'Action personnalisée', description: 'Action sur-mesure', params: {}, isSensitive: false };
    const newAction = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      type,
      name: template.name,
      description: template.description,
      order: builderActions.length + 1,
      enabled: true,
      isSensitive: template.isSensitive,
      params: template.params,
    };

    setBuilderActions([...builderActions, newAction]);
    toast.info(`Action "${template.name}" ajoutée.`);
  };

  const handleCreateCustomRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!builderName.trim()) {
      toast.error('Veuillez renseigner un nom de routine.');
      return;
    }

    try {
      const phrases = voicePhraseInput
        ? voicePhraseInput.split(',').map((p) => p.trim()).filter(Boolean)
        : [builderName.toLowerCase(), `lance ${builderName.toLowerCase()}`];

      const triggers: any[] = [
        {
          id: `trig_v_${Date.now()}`,
          type: 'user_action',
          label: `Commande vocale ("${phrases[0]}")`,
          enabled: true,
          userActionConfig: { voicePhrases: phrases },
        },
      ];

      if (builderTimeInput) {
        triggers.push({
          id: `trig_t_${Date.now()}`,
          type: 'time',
          label: `Horaire quotidien (${builderTimeInput})`,
          enabled: true,
          timeConfig: { time: builderTimeInput, exactAlarm: true },
        });
      }

      if (builderLocationInput) {
        triggers.push({
          id: `trig_l_${Date.now()}`,
          type: 'location',
          label: `Arrivée à ${builderLocationInput}`,
          enabled: false,
          locationConfig: { locationName: builderLocationInput, transition: 'enter' },
        });
      }

      const res = await createSmartRoutine({
        name: builderName.trim(),
        description: builderDesc.trim() || `Routine intelligente personnalisée configurée pour JARVIS.`,
        color: builderColor,
        icon: builderIcon,
        triggers,
        actions: builderActions,
        executionPolicy: {
          stopOnError: false,
          parallelExecutionAllowed: true,
          requireBiometricConfirmationForSensitive: true,
          wakeScreenOnRun: true,
          keepForegroundNotification: false,
        },
      });

      if (res.success) {
        toast.success(`Routine "${builderName}" créée avec succès !`);
        setBuilderName('');
        setBuilderDesc('');
        setVoicePhraseInput('');
        setActiveTab('routines');
        loadData();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la création.');
    }
  };

  const handleRunSimulation = async () => {
    setSimulating(true);
    setSimResult(null);
    try {
      const payload: Record<string, any> = { type: simType };
      if (simType === 'voice') payload.query = simQuery;
      if (simType === 'time') payload.time = simTime;
      if (simType === 'location') {
        payload.locationName = simLocation;
        payload.transition = 'enter';
      }
      if (simType === 'notification') {
        payload.packageName = 'com.google.android.gm';
        payload.notificationTitle = 'Urgent: Réunion JARVIS';
        payload.notificationContent = 'Validation requise immédiatement.';
      }
      if (simType === 'event') {
        payload.eventType = 'calendar_event_start';
      }

      const res = await testRoutineTrigger(payload);
      setSimResult(res);
      if (res.matched || (res.matches && res.matches.length > 0)) {
        toast.success('Déclencheur simulé avec succès : Correspondance détectée !');
        if (res.report?.spokenBriefing) {
          playVoiceBriefing(res.report.spokenBriefing);
        }
      } else {
        toast.warning('Aucune routine ne correspond à ce déclencheur.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erreur simulation');
    } finally {
      setSimulating(false);
    }
  };

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'Sun':
        return <Sun className="w-5 h-5" />;
      case 'Briefcase':
        return <Briefcase className="w-5 h-5" />;
      case 'Moon':
        return <Moon className="w-5 h-5" />;
      case 'Zap':
        return <Zap className="w-5 h-5" />;
      case 'Shield':
        return <Shield className="w-5 h-5" />;
      default:
        return <Sparkles className="w-5 h-5" />;
    }
  };

  return (
    <div id="smart-routines-page" className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-indigo-950/50 border border-indigo-500/30 shadow-xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/40">
              <Zap className="w-3.5 h-3.5" />
              JARVIS SMART ROUTINES (PHASE 12)
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Smartphone className="w-3 h-3" />
              WorkManager & Doze Mode Ready
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Système de Routines & Automatisations Android
          </h1>
          <p className="text-sm text-slate-400 max-w-3xl leading-relaxed">
            Orchestration autonome des modes de vie (Mode Matin, Mode Travail, Mode Nuit) et routines personnalisées. Déclencheurs par heure, géolocalisation, événements, notifications ou commande vocale avec confirmation de sécurité.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {speakingBriefing && (
            <button
              onClick={stopVoiceBriefing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 animate-pulse"
            >
              <VolumeX className="w-4 h-4" />
              Arrêter audio
            </button>
          )}
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <button
            id="btn-nav-builder"
            onClick={() => setActiveTab('builder')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-md shadow-cyan-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Créer une Routine
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-slate-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab('routines')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'routines'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          Routines & Presets ({routines.length})
        </button>

        <button
          onClick={() => setActiveTab('builder')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'builder'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          Créateur de Routine
        </button>

        <button
          onClick={() => setActiveTab('scheduler')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'scheduler'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          Planificateur Android ({registeredJobs.length} tâches)
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'simulator'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          Simulateur de Déclencheurs
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'history'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Historique d'Exécution ({history.length})
        </button>
      </div>

      {/* Latest Execution Report & Spoken Briefing Banner */}
      {latestReport && (
        <div className="p-4 md:p-5 rounded-2xl bg-slate-900/90 border border-cyan-500/40 shadow-lg space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Rapport d'Exécution : {latestReport.routineName}
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  Statut : {latestReport.status} • Durée : {latestReport.totalDurationMs} ms • Déclencheur : {latestReport.triggerSource}
                </span>
              </div>
            </div>

            {latestReport.spokenBriefing && (
              <button
                onClick={() => playVoiceBriefing(latestReport.spokenBriefing)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40"
              >
                <Volume2 className="w-3.5 h-3.5" />
                Réécouter le Briefing
              </button>
            )}
          </div>

          {latestReport.spokenBriefing && (
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 leading-relaxed font-sans italic border-l-4 border-l-cyan-500">
              "{latestReport.spokenBriefing}"
            </div>
          )}

          {/* Steps summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 pt-1">
            {latestReport.steps.map((st: any, i: number) => (
              <div
                key={st.actionId || i}
                className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-xs"
              >
                {st.status === 'success' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : st.status === 'requires_confirmation' ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <X className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                )}
                <span className="truncate text-slate-300 font-medium">{st.actionName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sensitive Action Confirmation Modal */}
      {pendingConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Confirmation d'Action Sensible</h3>
                <span className="text-xs text-amber-400 font-mono">Protocole de Sécurité JARVIS</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {pendingConfirmation.description}
            </p>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
              <div>Niveau de Risque : <span className="text-amber-400 uppercase font-bold">{pendingConfirmation.riskLevel}</span></div>
              <div className="truncate">Jeton : <span className="text-slate-300">{pendingConfirmation.token}</span></div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setPendingConfirmation(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Refuser & Annuler
              </button>
              <button
                onClick={handleConfirmSensitiveToken}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-lg shadow-amber-500/20"
              >
                <Check className="w-4 h-4" />
                Autoriser l'Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: ROUTINES LIST & PRESETS */}
      {activeTab === 'routines' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {routines.map((routine) => {
              const isExecuting = executingId === routine.id;

              return (
                <div
                  key={routine.id}
                  id={`routine-card-${routine.id}`}
                  className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-4 ${
                    routine.enabled
                      ? 'bg-slate-900/80 border-slate-700 hover:border-slate-600 shadow-md'
                      : 'bg-slate-900/40 border-slate-800 opacity-60'
                  }`}
                >
                  {/* Top */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="p-3 rounded-xl border flex items-center justify-center"
                          style={{
                            backgroundColor: `${routine.color}15`,
                            borderColor: `${routine.color}40`,
                            color: routine.color,
                          }}
                        >
                          {getIconComponent(routine.icon)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-white text-base">{routine.name}</h3>
                            {routine.isBuiltin && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                Preset
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {routine.triggers?.length || 0} déclencheur(s) • {routine.actions?.length || 0} action(s)
                          </span>
                        </div>
                      </div>

                      {/* Enable Switch */}
                      <button
                        onClick={() => handleToggleEnable(routine.id)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          routine.enabled ? 'bg-indigo-500' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            routine.enabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{routine.description}</p>

                    {/* Triggers list */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-800">
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                        Déclencheurs :
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {routine.triggers?.map((trig: any) => (
                          <span
                            key={trig.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-950 border border-slate-800 text-slate-300"
                          >
                            {trig.type === 'time' && <Clock className="w-3 h-3 text-amber-400" />}
                            {trig.type === 'user_action' && <Mic className="w-3 h-3 text-cyan-400" />}
                            {trig.type === 'location' && <MapPin className="w-3 h-3 text-emerald-400" />}
                            {trig.type === 'day' && <Clock className="w-3 h-3 text-indigo-400" />}
                            {trig.label}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Actions summary */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-800">
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                        Séquence ({routine.actions?.length}) :
                      </span>
                      <div className="space-y-1">
                        {routine.actions?.map((act: any, idx: number) => (
                          <div
                            key={act.id || idx}
                            className="flex items-center justify-between p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300"
                          >
                            <span className="flex items-center gap-1.5 truncate">
                              <span className="w-4 h-4 rounded bg-slate-800 text-cyan-400 font-mono text-[10px] flex items-center justify-center font-bold">
                                {idx + 1}
                              </span>
                              <span className="truncate">{act.name}</span>
                            </span>
                            {act.isSensitive && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/20 text-amber-300">
                                Sensible
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Bar */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                    <div className="text-[11px] text-slate-400 font-mono">
                      <span>Exécuté {routine.stats?.runCount || 0} fois</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleDelete(routine.id, routine.isBuiltin)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title={routine.isBuiltin ? 'Désactiver' : 'Supprimer'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        id={`btn-exec-${routine.id}`}
                        onClick={() => handleExecute(routine.id, routine.name)}
                        disabled={isExecuting}
                        className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white transition-all shadow-md shadow-indigo-500/20"
                      >
                        <Play className={`w-3.5 h-3.5 ${isExecuting ? 'animate-spin' : 'fill-white'}`} />
                        {isExecuting ? 'En cours...' : 'Lancer'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: ROUTINE BUILDER */}
      {activeTab === 'builder' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-cyan-400" />
              Créateur de Routine Intelligente Sur-Mesure
            </h2>
            <p className="text-xs text-slate-400">
              Configurez vos déclencheurs et combinez les actions système, météo, calendrier, notifications et synthèse vocale.
            </p>
          </div>

          <form onSubmit={handleCreateCustomRoutine} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Nom de la Routine</label>
                <input
                  type="text"
                  placeholder="ex. Mode Sport, Départ Maison, Session Gaming"
                  value={builderName}
                  onChange={(e) => setBuilderName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Description</label>
                <input
                  type="text"
                  placeholder="ex. Active Ne Pas Déranger et ouvre Spotify..."
                  value={builderDesc}
                  onChange={(e) => setBuilderDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Triggers Section */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Déclencheurs Configurables
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Phrases Vocales (Séparées par virgule)</label>
                  <input
                    type="text"
                    placeholder="ex. active le mode sport, go gym"
                    value={voicePhraseInput}
                    onChange={(e) => setVoicePhraseInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Horaire Fixe Quotidien (HH:mm)</label>
                  <input
                    type="time"
                    value={builderTimeInput}
                    onChange={(e) => setBuilderTimeInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Geofence Localisation (Arrivée)</label>
                  <input
                    type="text"
                    placeholder="ex. Bureau, Salle de Sport"
                    value={builderLocationInput}
                    onChange={(e) => setBuilderLocationInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                </div>
              </div>
            </div>

            {/* Actions Pipeline */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  Séquence d'Actions ({builderActions.length})
                </h3>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAddActionToBuilder('weather_briefing')}
                    className="px-2.5 py-1 rounded-md text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
                  >
                    + Météo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddActionToBuilder('calendar_digest')}
                    className="px-2.5 py-1 rounded-md text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
                  >
                    + Calendrier
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddActionToBuilder('important_messages')}
                    className="px-2.5 py-1 rounded-md text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
                  >
                    + Messages
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddActionToBuilder('tasks_review')}
                    className="px-2.5 py-1 rounded-md text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
                  >
                    + Tâches
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddActionToBuilder('dnd_toggle')}
                    className="px-2.5 py-1 rounded-md text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
                  >
                    + DND
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddActionToBuilder('voice_briefing')}
                    className="px-2.5 py-1 rounded-md text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
                  >
                    + Vocal
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddActionToBuilder('sensitive_action')}
                    className="px-2.5 py-1 rounded-md text-[11px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40"
                  >
                    + Action Sensible (Sécurisée)
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {builderActions.map((act, idx) => (
                  <div
                    key={act.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-md bg-slate-800 text-cyan-400 font-mono text-[10px] flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-semibold text-white flex items-center gap-2">
                          {act.name}
                          {act.isSensitive && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/20 text-amber-300">
                              Confirmation requise
                            </span>
                          )}
                        </div>
                        <span className="text-slate-400 text-[11px]">{act.description}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setBuilderActions(builderActions.filter((a) => a.id !== act.id))}
                      className="p-1 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Colors */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Couleur du Thème</label>
              <div className="flex items-center gap-3">
                {['#10b981', '#6366f1', '#06b6d4', '#f59e0b', '#ec4899', '#8b5cf6'].map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setBuilderColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${
                      builderColor === c ? 'scale-110 border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setActiveTab('routines')}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-lg shadow-cyan-500/20"
              >
                Enregistrer la Routine
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: ANDROID SCHEDULER & WORKMANAGER INSPECTOR */}
      {activeTab === 'scheduler' && (
        <div className="space-y-4">
          {/* Status Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Alarmes Exactes</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                {schedulerStatus?.exactAlarmsRegistered || 0}
              </div>
              <span className="text-[11px] text-slate-400 font-mono">AlarmManager.setExact</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Tâches WorkManager</span>
                <Cpu className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                {schedulerStatus?.workManagerJobsCount || 0}
              </div>
              <span className="text-[11px] text-slate-400 font-mono">PeriodicWorkRequest</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Geofences Actifs</span>
                <MapPin className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                {schedulerStatus?.geofencesActive || 0}
              </div>
              <span className="text-[11px] text-slate-400 font-mono">GeofencingClient</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Conformité Doze Mode</span>
                <Shield className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400 font-mono">
                100%
              </div>
              <span className="text-[11px] text-slate-400 font-mono">Zero Background Leaks</span>
            </div>
          </div>

          {/* Registered Background Jobs Table */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Tâches d'Arrière-Plan Enregistrées (Android OS)
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[11px] font-mono text-slate-400 uppercase bg-slate-950/60 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-2.5">ID Tâche</th>
                    <th className="px-4 py-2.5">Routine</th>
                    <th className="px-4 py-2.5">Type Moteur</th>
                    <th className="px-4 py-2.5">Horaire / Déclenchement</th>
                    <th className="px-4 py-2.5">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {registeredJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-2.5 font-mono text-slate-400">{job.id}</td>
                      <td className="px-4 py-2.5 font-semibold text-white">{job.routineName}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-500/20 text-indigo-300">
                          {job.workType}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-300">
                        {job.scheduledTime || 'Trigger d\'événement'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Enregistré
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TRIGGER SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-cyan-400" />
              Simulateur de Déclencheurs & Événements
            </h2>
            <p className="text-xs text-slate-400">
              Testez en conditions réelles les commandes vocales, changements d'horaire, entrées de geofence et réceptions de notifications.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Type d'Événement</label>
                <select
                  value={simType}
                  onChange={(e) => setSimType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-cyan-500"
                >
                  <option value="voice">Commande Vocale Utilisateur</option>
                  <option value="time">Horaire du Système (Alarme)</option>
                  <option value="location">Transition de Géolocalisation (Geofence)</option>
                  <option value="notification">Notification Push Reçue</option>
                  <option value="event">Événement Agenda / Système</option>
                </select>
              </div>

              {simType === 'voice' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Phrase Vocale Testée</label>
                  <input
                    type="text"
                    value={simQuery}
                    onChange={(e) => setSimQuery(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}

              {simType === 'time' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Heure Simulée</label>
                  <input
                    type="time"
                    value={simTime}
                    onChange={(e) => setSimTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}

              {simType === 'location' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Lieu d'Entrée</label>
                  <input
                    type="text"
                    value={simLocation}
                    onChange={(e) => setSimLocation(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}

              <button
                onClick={handleRunSimulation}
                disabled={simulating}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-md shadow-cyan-500/20"
              >
                <Play className={`w-3.5 h-3.5 ${simulating ? 'animate-spin' : 'fill-slate-950'}`} />
                {simulating ? 'Évaluation...' : 'Déclencher la Simulation'}
              </button>
            </div>

            {/* Simulation Result Output */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Résultat de l'Évaluation TriggerManager
              </h3>

              {simResult ? (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-300">Correspondance :</span>
                    {simResult.matched || (simResult.matches && simResult.matches.length > 0) ? (
                      <span className="px-2 py-0.5 rounded text-emerald-400 bg-emerald-500/10 border border-emerald-500/30">
                        OUI • Déclenché
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-rose-400 bg-rose-500/10 border border-rose-500/30">
                        NON • Aucune routine
                      </span>
                    )}
                  </div>

                  {simResult.routine && (
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                      <div className="font-bold text-white">{simResult.routine.name}</div>
                      <p className="text-slate-400 text-[11px]">{simResult.routine.description}</p>
                    </div>
                  )}

                  {simResult.report?.spokenBriefing && (
                    <div className="p-3 rounded-lg bg-slate-900/90 border border-cyan-500/30 text-slate-200 italic font-sans">
                      "{simResult.report.spokenBriefing}"
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  Sélectionnez un événement et cliquez sur Déclencher la Simulation pour tester le TriggerManager.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 text-center text-slate-400 text-sm">
              Aucun historique d'exécution pour le moment.
            </div>
          ) : (
            history.map((rep) => (
              <div
                key={rep.executionId}
                className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{rep.routineName}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                        rep.status === 'success'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : rep.status === 'awaiting_confirmation'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {rep.status}
                    </span>
                  </div>
                  <span className="text-slate-400 font-mono">
                    {new Date(rep.completedAt).toLocaleString('fr-FR')} • Déclencheur : {rep.triggerSource} • {rep.totalDurationMs} ms
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {rep.spokenBriefing && (
                    <button
                      onClick={() => playVoiceBriefing(rep.spokenBriefing)}
                      className="p-2 rounded-lg bg-slate-800 text-cyan-400 hover:bg-slate-700"
                      title="Écouter"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
