import { useState, useEffect } from 'react';
import {
  Bot,
  Play,
  Sparkles,
  Wrench,
  Clock,
  CheckCircle2,
  Activity,
  Search,
  Calculator,
  Eye,
  Smartphone,
  Database,
  Terminal,
  Layers,
  ArrowRight,
  Shield,
  MessageSquare,
  Mic,
  Calendar,
  Music,
  PhoneCall,
  GitFork,
  Cpu,
  AlertTriangle,
  RefreshCw,
  Zap,
  Server,
  Lock,
  Compass,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  UserCheck,
  Users,
  PhoneForwarded,
  CheckSquare,
  Bell,
  FileText,
  AlarmClock,
  Plus,
  Trash2,
  CalendarCheck,
  Check,
  Pin,
  Tag,
  BookOpen,
} from 'lucide-react';
import {
  fetchSupervisorAgents,
  evaluateSupervisorRoute,
  executeSupervisorRequest,
  fetchSupervisorStats,
  fetchSupervisorLogs,
  fetchAssistantOverview,
  fetchAssistantSync,
  setAssistantSync,
  fetchAssistantTasks,
  createAssistantTask,
  toggleAssistantTask,
  deleteAssistantTask,
  fetchAssistantReminders,
  createAssistantReminder,
  deleteAssistantReminder,
  fetchAssistantEvents,
  createAssistantEvent,
  deleteAssistantEvent,
  fetchAssistantAlarms,
  setAssistantAlarm,
  toggleAssistantAlarm,
  deleteAssistantAlarm,
  fetchAssistantNotes,
  createAssistantNote,
  deleteAssistantNote,
} from '../lib/api';
import { toast } from 'sonner';

export function AgentsPage() {
  const [activeTab, setActiveTab] = useState<'supervisor' | 'agents' | 'assistant' | 'phone' | 'coding' | 'fallback' | 'logs'>('supervisor');
  const [agents, setAgents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Personal Assistant State (Phase 11)
  const [assistantOverview, setAssistantOverview] = useState<any>(null);
  const [assistantSync, setAssistantSyncState] = useState<any>(null);
  const [assistantTasks, setAssistantTasks] = useState<any[]>([]);
  const [assistantReminders, setAssistantReminders] = useState<any[]>([]);
  const [assistantEvents, setAssistantEvents] = useState<any[]>([]);
  const [assistantAlarms, setAssistantAlarms] = useState<any[]>([]);
  const [assistantNotes, setAssistantNotes] = useState<any[]>([]);
  const [assistantSubTab, setAssistantSubTab] = useState<'overview' | 'tasks' | 'reminders' | 'calendar' | 'notes' | 'sync'>('overview');
  const [assistantQuery, setAssistantQuery] = useState('');
  const [assistantExecuting, setAssistantExecuting] = useState(false);
  const [assistantOutput, setAssistantOutput] = useState<any>(null);

  // Assistant Quick Create Forms
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'urgent' | 'high' | 'medium' | 'low'>('medium');
  const [newTaskCategory, setNewTaskCategory] = useState('Général');

  const [newReminderTitle, setNewReminderTitle] = useState('');
  const [newReminderExpr, setNewReminderExpr] = useState('demain à 8h');

  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventStartHour, setNewEventStartHour] = useState('14:00');
  const [newEventLocation, setNewEventLocation] = useState('');

  const [newAlarmHour, setNewAlarmHour] = useState(7);
  const [newAlarmMinute, setNewAlarmMinute] = useState(0);
  const [newAlarmLabel, setNewAlarmLabel] = useState('Réveil Matin');

  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteTag, setNewNoteTag] = useState('Idée');
  const [noteSearchQuery, setNoteSearchQuery] = useState('');

  // Phone & Telephony Agent State (Phase 10)
  const [phoneStatus, setPhoneStatus] = useState<any>(null);
  const [phoneContacts, setPhoneContacts] = useState<any[]>([]);
  const [phoneCallLogs, setPhoneCallLogs] = useState<any[]>([]);
  const [phoneQuery, setPhoneQuery] = useState('');
  const [phoneExecuting, setPhoneExecuting] = useState(false);
  const [phoneOutput, setPhoneOutput] = useState<any>(null);
  const [pendingCallConfirmation, setPendingCallConfirmation] = useState<any>(null);
  const [phoneDisambiguation, setPhoneDisambiguation] = useState<any[] | null>(null);

  // GitHub & Coding Agent State (Phase 9)
  const [githubStatus, setGithubStatus] = useState<any>(null);
  const [codingRepo, setCodingRepo] = useState('Sasukeutchi77/Jarvis-3');
  const [codingQuery, setCodingQuery] = useState('');
  const [codingExecuting, setCodingExecuting] = useState(false);
  const [codingOutput, setCodingOutput] = useState<any>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<any>(null);

  // Live Supervisor Interactive Tester State
  const [testQuery, setTestQuery] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [routePlan, setRoutePlan] = useState<any>(null);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [selectedAgentDetail, setSelectedAgentDetail] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [
        agentsRes,
        statsRes,
        logsRes,
        ghRes,
        phoneRes,
        contactsRes,
        callLogsRes,
        overviewRes,
        syncRes,
        tasksRes,
        remindersRes,
        eventsRes,
        alarmsRes,
        notesRes,
      ] = await Promise.all([
        fetchSupervisorAgents().catch(() => ({ success: true, count: 0, agents: [] })),
        fetchSupervisorStats().catch(() => ({ success: true, stats: null })),
        fetchSupervisorLogs().catch(() => ({ success: true, count: 0, logs: [] })),
        fetch('/api/github/status').then((r) => r.json()).catch(() => null),
        fetch('/api/phone/status').then((r) => r.json()).catch(() => null),
        fetch('/api/phone/contacts').then((r) => r.json()).catch(() => null),
        fetch('/api/phone/call-logs').then((r) => r.json()).catch(() => null),
        fetchAssistantOverview().catch(() => null),
        fetchAssistantSync().catch(() => null),
        fetchAssistantTasks().catch(() => ({ success: true, count: 0, tasks: [] })),
        fetchAssistantReminders().catch(() => ({ success: true, count: 0, reminders: [] })),
        fetchAssistantEvents().catch(() => ({ success: true, count: 0, events: [] })),
        fetchAssistantAlarms().catch(() => ({ success: true, count: 0, alarms: [] })),
        fetchAssistantNotes().catch(() => ({ success: true, count: 0, notes: [] })),
      ]);

      if (agentsRes.agents) {
        setAgents(agentsRes.agents);
        if (!selectedAgentDetail && agentsRes.agents.length > 0) {
          setSelectedAgentDetail(agentsRes.agents[0]);
        }
      }
      if (statsRes.stats) setStats(statsRes.stats);
      if (logsRes.logs) setLogs(logsRes.logs);
      if (ghRes) setGithubStatus(ghRes);
      if (phoneRes) setPhoneStatus(phoneRes);
      if (contactsRes?.contacts) setPhoneContacts(contactsRes.contacts);
      if (callLogsRes?.logs) setPhoneCallLogs(callLogsRes.logs);

      // Assistant Data (Phase 11)
      if (overviewRes?.overview) setAssistantOverview(overviewRes.overview);
      if (syncRes?.syncStatus) setAssistantSyncState(syncRes.syncStatus);
      if (tasksRes?.tasks) setAssistantTasks(tasksRes.tasks);
      if (remindersRes?.reminders) setAssistantReminders(remindersRes.reminders);
      if (eventsRes?.events) setAssistantEvents(eventsRes.events);
      if (alarmsRes?.alarms) setAssistantAlarms(alarmsRes.alarms);
      if (notesRes?.notes) setAssistantNotes(notesRes.notes);
    } catch (e) {
      console.warn('Failed to load supervisor data', e);
    } finally {
      setLoading(false);
    }
  };

  // Personal Assistant Handlers (Phase 11)
  const handleRunAssistantAgent = async (queryToRun: string) => {
    if (!queryToRun.trim()) return;
    setAssistantExecuting(true);
    setAssistantOutput(null);
    try {
      const res = await executeSupervisorRequest({ query: queryToRun });
      if (res.success && res.output) {
        setAssistantOutput(res.output);
        toast.success(res.output.spokenSummary || 'Requête Assistant exécutée.');
        loadData();
      }
    } catch (e: any) {
      toast.error('Erreur Assistant Agent : ' + e.message);
    } finally {
      setAssistantExecuting(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) {
      toast.error('Le titre de la tâche est obligatoire.');
      return;
    }
    try {
      const res = await createAssistantTask({
        title: newTaskTitle.trim(),
        priority: newTaskPriority,
        category: newTaskCategory,
      });
      if (res.success) {
        toast.success(`Tâche ajoutée : "${newTaskTitle}"`);
        setNewTaskTitle('');
        loadData();
      }
    } catch (e: any) {
      toast.error('Erreur création tâche : ' + e.message);
    }
  };

  const handleToggleTask = async (taskId: string) => {
    try {
      const res = await toggleAssistantTask(taskId);
      if (res.success) {
        toast.success(res.task.completed ? 'Tâche marquée comme terminée !' : 'Tâche réouverte.');
        loadData();
      }
    } catch (e: any) {
      toast.error('Erreur bascule tâche : ' + e.message);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const res = await deleteAssistantTask(taskId);
      if (res.success) {
        toast.success('Tâche supprimée avec succès.');
        loadData();
      }
    } catch (e: any) {
      toast.error('Erreur suppression tâche : ' + e.message);
    }
  };

  const handleCreateReminder = async () => {
    if (!newReminderTitle.trim()) {
      toast.error('Le libellé du rappel est obligatoire.');
      return;
    }
    try {
      const res = await createAssistantReminder({
        title: newReminderTitle.trim(),
        timeExpression: newReminderExpr.trim(),
      });
      if (res.success) {
        toast.success(`Rappel programmé pour : "${res.reminder.formattedTime}"`);
        setNewReminderTitle('');
        loadData();
      }
    } catch (e: any) {
      toast.error('Erreur création rappel : ' + e.message);
    }
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      const res = await deleteAssistantReminder(id);
      if (res.success) {
        toast.success('Rappel supprimé.');
        loadData();
      }
    } catch (e: any) {
      toast.error('Erreur suppression rappel : ' + e.message);
    }
  };

  const handleCreateEvent = async () => {
    if (!newEventTitle.trim()) {
      toast.error('Le titre de l’événement est obligatoire.');
      return;
    }
    try {
      const today = new Date();
      const [h, m] = newEventStartHour.split(':').map(Number);
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h || 14, m || 0, 0).getTime();
      const end = start + 3600000;
      const res = await createAssistantEvent({
        title: newEventTitle.trim(),
        startTime: start,
        endTime: end,
        location: newEventLocation.trim() || undefined,
        calendarName: 'Agenda Principal',
      });
      if (res.success) {
        toast.success(`Rendez-vous programmé : "${newEventTitle}"`);
        setNewEventTitle('');
        setNewEventLocation('');
        loadData();
      }
    } catch (e: any) {
      toast.error('Erreur création événement : ' + e.message);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      const res = await deleteAssistantEvent(id);
      if (res.success) {
        toast.success('Événement retiré du calendrier.');
        loadData();
      }
    } catch (e: any) {
      toast.error('Erreur suppression événement : ' + e.message);
    }
  };

  const handleSetAlarm = async () => {
    try {
      const res = await setAssistantAlarm({
        hour: Number(newAlarmHour),
        minute: Number(newAlarmMinute),
        label: newAlarmLabel.trim() || 'Alarme JARVIS',
        vibrate: true,
      });
      if (res.success) {
        toast.success(`Alarme Android fixée à ${String(newAlarmHour).padStart(2, '0')}:${String(newAlarmMinute).padStart(2, '0')}`);
        loadData();
      }
    } catch (e: any) {
      toast.error('Erreur fixation alarme : ' + e.message);
    }
  };

  const handleToggleAlarm = async (alarmId: string) => {
    try {
      const res = await toggleAssistantAlarm(alarmId);
      if (res.success) {
        toast.success(res.alarm.enabled ? 'Alarme activée.' : 'Alarme désactivée.');
        loadData();
      }
    } catch (e: any) {
      toast.error('Erreur bascule alarme : ' + e.message);
    }
  };

  const handleDeleteAlarm = async (id: string) => {
    try {
      const res = await deleteAssistantAlarm(id);
      if (res.success) {
        toast.success('Alarme supprimée.');
        loadData();
      }
    } catch (e: any) {
      toast.error('Erreur suppression alarme : ' + e.message);
    }
  };

  const handleCreateNote = async () => {
    if (!newNoteContent.trim()) {
      toast.error('Le contenu de la note est obligatoire.');
      return;
    }
    try {
      const res = await createAssistantNote({
        title: newNoteTitle.trim() || undefined,
        content: newNoteContent.trim(),
        tags: newNoteTag.trim() ? [newNoteTag.trim()] : ['Général'],
        pinned: false,
      });
      if (res.success) {
        toast.success('Note enregistrée dans le carnet.');
        setNewNoteTitle('');
        setNewNoteContent('');
        loadData();
      }
    } catch (e: any) {
      toast.error('Erreur création note : ' + e.message);
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      const res = await deleteAssistantNote(id);
      if (res.success) {
        toast.success('Note supprimée.');
        loadData();
      }
    } catch (e: any) {
      toast.error('Erreur suppression note : ' + e.message);
    }
  };

  const handleToggleSyncMode = async (mode: string) => {
    try {
      const res = await setAssistantSync(mode, mode === 'cloud_oauth_sync' ? 'utilisateur@gmail.com' : undefined);
      if (res.success) {
        toast.success(`Mode de synchronisation : ${res.syncStatus.mode}`);
        loadData();
      }
    } catch (e: any) {
      toast.error('Erreur synchronisation : ' + e.message);
    }
  };

  const handleTogglePhonePermission = async (permission: string, currentState: string) => {
    const newState = currentState === 'granted' ? 'denied' : 'granted';
    try {
      const res = await fetch('/api/phone/permissions/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission, state: newState }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Permission ${newState === 'granted' ? 'accordée' : 'refusée'}`);
        loadData();
      }
    } catch (e: any) {
      toast.error('Erreur de permission : ' + e.message);
    }
  };

  const handleRunPhoneAgent = async (queryToRun: string, confirmationToken?: string) => {
    if (!queryToRun.trim()) return;
    setPhoneExecuting(true);
    setPhoneOutput(null);
    setPendingCallConfirmation(null);
    setPhoneDisambiguation(null);
    try {
      const res = await executeSupervisorRequest({
        query: queryToRun,
        context: confirmationToken ? { confirmationToken } : undefined,
      });
      if (res.success && res.output) {
        setPhoneOutput(res.output);
        if (res.output.structuredData?.requiresConfirmation) {
          setPendingCallConfirmation(res.output.structuredData.confirmationRequest);
          toast.warning('Autorisation requise pour lancer l’appel.');
        } else if (res.output.structuredData?.disambiguationRequired) {
          setPhoneDisambiguation(res.output.structuredData.candidates || []);
          toast.info('Plusieurs correspondants trouvés.');
        } else if (res.output.structuredData?.permissionDenied) {
          toast.error('Permission Android requise.');
        } else {
          toast.success(res.output.spokenSummary || 'Action Phone Agent exécutée.');
        }
        loadData();
      }
    } catch (e: any) {
      toast.error('Erreur Phone Agent : ' + e.message);
    } finally {
      setPhoneExecuting(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEvaluateRoute = async (queryToTest?: string) => {
    const q = queryToTest || testQuery;
    if (!q.trim()) return;
    setEvaluating(true);
    setRoutePlan(null);
    try {
      const res = await evaluateSupervisorRoute({ query: q });
      if (res.success && res.routePlan) {
        setRoutePlan(res.routePlan);
      }
    } catch (e: any) {
      toast.error('Erreur lors du routage sémantique : ' + e.message);
    } finally {
      setEvaluating(false);
    }
  };

  const handleExecuteSupervisor = async (queryToTest?: string) => {
    const q = queryToTest || testQuery;
    if (!q.trim()) return;
    setExecuting(true);
    setExecutionResult(null);
    try {
      const res = await executeSupervisorRequest({ query: q });
      if (res.success && res.output) {
        setExecutionResult(res.output);
        toast.success(`Délégué à ${res.output.agentName}`);
        loadData();
      }
    } catch (e: any) {
      toast.error('Erreur lors de l’exécution du superviseur : ' + e.message);
    } finally {
      setExecuting(false);
    }
  };

  const handleRunCodingAgent = async (queryToRun: string, confirmationToken?: string) => {
    if (!queryToRun.trim()) return;
    setCodingExecuting(true);
    setCodingOutput(null);
    setPendingConfirmation(null);
    try {
      const res = await executeSupervisorRequest({
        query: queryToRun,
        context: confirmationToken ? { confirmationToken } : undefined,
      });
      if (res.success && res.output) {
        setCodingOutput(res.output);
        if (res.output.structuredData?.requiresConfirmation) {
          setPendingConfirmation(res.output.structuredData.confirmationRequest);
          toast.warning('Autorisation requise pour compléter cette action.');
        } else {
          toast.success(res.output.spokenSummary || 'Action Coding Agent exécutée avec succès.');
        }
      }
    } catch (e: any) {
      toast.error('Erreur Coding Agent : ' + e.message);
    } finally {
      setCodingExecuting(false);
    }
  };

  const quickPrompts = [
    { label: 'Question Générale', query: 'Explique-moi la théorie de la relativité simplement.' },
    { label: 'Recherche Web', query: 'Cherche sur le web les dernières actualités technologiques de la semaine.' },
    { label: 'Message WhatsApp', query: 'Lis mes derniers messages reçus et résume les urgences.' },
    { label: 'Action Android', query: 'Allume la lampe torche et fais vibrer le smartphone.' },
    { label: 'Code & Débogage', query: 'Écris une fonction TypeScript avec gestion d’erreurs robuste.' },
    { label: 'Vision / Image', query: 'Analyse la photo et lis le texte du document scanné.' },
    { label: 'Appel Téléphonique', query: 'Appelle Alexandre sur son numéro mobile.' },
    { label: 'Agenda & Rappel', query: 'Rappelle-moi de finaliser le rapport demain à 09h00.' },
    { label: 'Musique / Multimédia', query: 'Mets de la musique relaxante sur Spotify.' },
    { label: 'Mode Matin / Routine', query: 'Lance le mode matin et donne-moi le briefing vocal.' },
    { label: 'Mode Travail / DND', query: 'Active le mode travail et filtre les notifications.' },
    { label: 'Mode Nuit / Résumé', query: 'Passe en mode nuit et prépare mes alarmes pour demain.' },
    { label: 'Sécurité & Audit', query: 'Lance un audit complet de la sécurité et des clés du système.' },
    { label: 'Mémoire & Préférences', query: 'Souviens-toi que je préfère les réponses courtes et structurées.' },
    { label: 'Synthèse Vocale', query: 'Change de voix pour adopter le profil vocal classique.' },
  ];

  const getAgentIcon = (id: string) => {
    switch (id) {
      case 'voice':
        return <Mic className="w-4 h-4 text-rose-400" />;
      case 'vision':
        return <Eye className="w-4 h-4 text-purple-400" />;
      case 'android':
        return <Smartphone className="w-4 h-4 text-emerald-400" />;
      case 'communication':
        return <MessageSquare className="w-4 h-4 text-cyan-400" />;
      case 'research':
        return <Search className="w-4 h-4 text-amber-400" />;
      case 'coding':
        return <Terminal className="w-4 h-4 text-yellow-400" />;
      case 'phone':
        return <PhoneCall className="w-4 h-4 text-green-400" />;
      case 'task':
        return <CheckSquare className="w-4 h-4 text-emerald-400" />;
      case 'reminder':
        return <Bell className="w-4 h-4 text-amber-400" />;
      case 'calendar':
        return <Calendar className="w-4 h-4 text-indigo-400" />;
      case 'notes':
        return <FileText className="w-4 h-4 text-rose-400" />;
      case 'routine':
        return <Zap className="w-4 h-4 text-amber-400" />;
      case 'media':
        return <Music className="w-4 h-4 text-fuchsia-400" />;
      case 'security':
        return <Shield className="w-4 h-4 text-red-400" />;
      case 'memory':
        return <Database className="w-4 h-4 text-blue-400" />;
      default:
        return <Bot className="w-4 h-4 text-slate-300" />;
    }
  };

  const getPermissionBadge = (level: string) => {
    switch (level) {
      case 'admin':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/30">ADMIN</span>;
      case 'sensitive':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">SENSIBLE</span>;
      case 'user':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">UTILISATEUR</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">PUBLIC</span>;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-950 text-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase">
                JARVIS Core Phase 1
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                12 Agents Opérationnels
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
              <GitFork className="w-6 h-6 text-purple-400" />
              Architecture Core & Superviseur Multi-Agents
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Architecture centrale modulaire d'OpenJarvis : <strong className="text-slate-200">JARVIS → Supervisor Agent → AI Router → 12 Agents Spécialisés → Tools / Android APIs</strong> avec routage sémantique et cascade de repli (fallback multi-fournisseurs).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 transition-all flex items-center gap-2 text-xs cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 text-purple-400 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800/80 gap-2">
          <button
            onClick={() => setActiveTab('supervisor')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 transition-all border-b-2 cursor-pointer ${
              activeTab === 'supervisor'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-4 h-4" />
            Routeur & Superviseur Intelligent
          </button>
          <button
            onClick={() => setActiveTab('agents')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 transition-all border-b-2 cursor-pointer ${
              activeTab === 'agents'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            Agents ({agents.length})
          </button>
          <button
            onClick={() => setActiveTab('assistant')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 transition-all border-b-2 cursor-pointer ${
              activeTab === 'assistant'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            Personal Assistant (Phase 11)
          </button>
          <button
            onClick={() => setActiveTab('phone')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 transition-all border-b-2 cursor-pointer ${
              activeTab === 'phone'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Phone className="w-4 h-4" />
            Phone Agent (Phase 10)
          </button>
          <button
            onClick={() => setActiveTab('coding')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 transition-all border-b-2 cursor-pointer ${
              activeTab === 'coding'
                ? 'border-yellow-500 text-yellow-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            Coding & GitHub Agent (Phase 9)
          </button>
          <button
            onClick={() => setActiveTab('fallback')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 transition-all border-b-2 cursor-pointer ${
              activeTab === 'fallback'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-4 h-4" />
            Cascade de Repli (Multi-Fournisseurs)
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 transition-all border-b-2 cursor-pointer ${
              activeTab === 'logs'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            Audit Sécurisé (Zéro Fuite)
          </button>
        </div>

        {/* TAB 1: SUPERVISOR & ROUTER TESTER */}
        {activeTab === 'supervisor' && (
          <div className="space-y-6">
            {/* Architectural Pipeline Infographic */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/20 via-slate-900/80 to-slate-900/80 border border-purple-500/20">
              <h2 className="text-xs font-bold uppercase tracking-wider text-purple-300 mb-3 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-400" />
                Schéma du Flux d'Orchestration Central
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Entrée Vocale / Texte</span>
                  <p className="text-xs font-semibold text-slate-100 mt-1">Requête Utilisateur</p>
                </div>
                <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-bold text-purple-300 uppercase">Étape 1</span>
                  <p className="text-xs font-semibold text-purple-200 mt-1">Supervisor Agent</p>
                  <span className="text-[9px] text-purple-400 mt-0.5">Classification & Intention</span>
                </div>
                <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-bold text-cyan-300 uppercase">Étape 2</span>
                  <p className="text-xs font-semibold text-cyan-200 mt-1">AI Provider Router</p>
                  <span className="text-[9px] text-cyan-400 mt-0.5">Groq / Gemini / Claude</span>
                </div>
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-bold text-amber-300 uppercase">Étape 3</span>
                  <p className="text-xs font-semibold text-amber-200 mt-1">Specialized Agent</p>
                  <span className="text-[9px] text-amber-400 mt-0.5">1 parmi 12 agents</span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-bold text-emerald-300 uppercase">Étape 4</span>
                  <p className="text-xs font-semibold text-emerald-200 mt-1">Outils & Android APIs</p>
                  <span className="text-[9px] text-emerald-400 mt-0.5">Exécution Native Sécurisée</span>
                </div>
              </div>
            </div>

            {/* Interactive Query Box & Prompts */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    Simulateur de Routage Sémantique & Exécution
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Saisissez une commande ou choisissez un exemple pour observer en direct la décision du superviseur.
                  </p>
                </div>
              </div>

              {/* Quick Prompt Chips */}
              <div className="flex flex-wrap gap-1.5">
                {quickPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setTestQuery(p.query);
                      handleEvaluateRoute(p.query);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-purple-950/40 text-slate-300 hover:text-purple-300 border border-slate-800 hover:border-purple-500/30 text-[11px] transition-all cursor-pointer text-left"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Input field */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEvaluateRoute();
                  }}
                  placeholder="Ex: Lis mes messages WhatsApp et résume les urgences..."
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={() => handleEvaluateRoute()}
                  disabled={evaluating || !testQuery.trim()}
                  className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Compass className={`w-4 h-4 text-purple-400 ${evaluating ? 'animate-spin' : ''}`} />
                  Routage Seul
                </button>
                <button
                  onClick={() => handleExecuteSupervisor()}
                  disabled={executing || !testQuery.trim()}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Play className={`w-4 h-4 ${executing ? 'animate-spin' : ''}`} />
                  Exécuter via Superviseur
                </button>
              </div>

              {/* Route Plan Evaluation Card */}
              {routePlan && (
                <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                        {getAgentIcon(routePlan.primaryAgent)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-100 uppercase font-mono">
                            Agent Ciblé : {routePlan.primaryAgent}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Confiance : {(routePlan.confidence * 100).toFixed(0)}%
                          </span>
                          {routePlan.isMultiStep && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Multi-Étapes ({routePlan.executionPlan?.length} étapes)
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-purple-300 mt-0.5">
                          {routePlan.reasoning}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Candidates score table */}
                  <div className="pt-2 border-t border-purple-500/20">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Scores des candidats (12 Agents) :
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-2">
                      {routePlan.candidates.map((c: any) => (
                        <div
                          key={c.agentId}
                          className={`p-2 rounded-lg border text-[11px] flex items-center justify-between ${
                            c.agentId === routePlan.primaryAgent
                              ? 'bg-purple-500/20 border-purple-500/40 text-purple-200 font-bold'
                              : 'bg-slate-950 border-slate-800/80 text-slate-400'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 capitalize">
                            {getAgentIcon(c.agentId)}
                            {c.agentId}
                          </span>
                          <span className="font-mono text-[10px]">{(c.score * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Execution Result Box */}
              {executionResult && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 mt-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-slate-100">
                        Résultat d'Exécution : {executionResult.agentName}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
                      <span>Fournisseur : <strong className="text-cyan-400">{executionResult.telemetry?.providerUsed}</strong></span>
                      <span>Latence : <strong className="text-purple-400">{executionResult.telemetry?.executionTimeMs}ms</strong></span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed bg-slate-900/50 p-3 rounded-lg border border-slate-800/60 font-sans">
                    {executionResult.reply}
                  </div>

                  {executionResult.spokenSummary && (
                    <div className="p-2.5 rounded-lg bg-purple-950/20 border border-purple-500/20 text-xs text-purple-300 flex items-center gap-2">
                      <Mic className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <span><strong>Synthèse Vocale :</strong> "{executionResult.spokenSummary}"</span>
                    </div>
                  )}

                  {executionResult.actionsExecuted && executionResult.actionsExecuted.length > 0 && (
                    <div className="pt-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Actions & Outils Exécutés :
                      </span>
                      <div className="space-y-1.5 mt-1.5">
                        {executionResult.actionsExecuted.map((act: any, idx: number) => (
                          <div key={idx} className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-[11px] font-mono">
                            <span className="text-cyan-300 flex items-center gap-2">
                              <Wrench className="w-3 h-3 text-cyan-400" />
                              {act.tool} ({JSON.stringify(act.arguments)})
                            </span>
                            <span className="text-emerald-400">{act.latencyMs}ms ✓</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ALL 12 SPECIALIZED AGENTS */}
        {activeTab === 'agents' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Agent Grid List */}
            <div className="lg:col-span-2 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {agents.map((ag) => {
                  const isSelected = selectedAgentDetail?.id === ag.id;
                  return (
                    <div
                      key={ag.id}
                      onClick={() => setSelectedAgentDetail(ag)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-purple-950/20 border-purple-500/40 shadow-sm'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                            {getAgentIcon(ag.id)}
                          </div>
                          <div>
                            <h3 className="font-semibold text-xs text-slate-100">{ag.name}</h3>
                            <span className="text-[10px] text-purple-300 font-mono">
                              ID: {ag.id}
                            </span>
                          </div>
                        </div>
                        {getPermissionBadge(ag.permissionLevel)}
                      </div>

                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {ag.description}
                      </p>

                      <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>{ag.capabilities?.length || 0} Capacités</span>
                        <span className="text-cyan-400">{ag.allowedTools?.length || 0} Outils</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Selected Agent Deep Inspection */}
            <div className="space-y-4">
              {selectedAgentDetail ? (
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 sticky top-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                        {getAgentIcon(selectedAgentDetail.id)}
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-slate-100">{selectedAgentDetail.name}</h2>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Niveau de sécurité : {selectedAgentDetail.permissionLevel}
                        </span>
                      </div>
                    </div>
                    {getPermissionBadge(selectedAgentDetail.permissionLevel)}
                  </div>

                  <div>
                    <h3 className="text-[11px] font-bold text-slate-300 uppercase mb-1">Description du Rôle</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {selectedAgentDetail.description}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-[11px] font-bold text-slate-300 uppercase mb-2">
                      Capacités Déclarées ({selectedAgentDetail.capabilities?.length || 0})
                    </h3>
                    <div className="space-y-2">
                      {selectedAgentDetail.capabilities?.map((cap: any) => (
                        <div key={cap.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px]">
                          <div className="font-semibold text-slate-200">{cap.name}</div>
                          <p className="text-slate-400 text-[10px] mt-0.5">{cap.description}</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {cap.tags?.map((t: string) => (
                              <span key={t} className="px-1.5 py-0.5 rounded bg-slate-900 text-[9px] text-purple-300 font-mono">
                                #{t}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[11px] font-bold text-slate-300 uppercase mb-2">
                      Outils Autorisés ({selectedAgentDetail.allowedTools?.length || 0})
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedAgentDetail.allowedTools?.map((tool: string) => (
                        <span key={tool} className="px-2 py-1 rounded-lg bg-cyan-950/40 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono flex items-center gap-1">
                          <Wrench className="w-3 h-3 text-cyan-400" />
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Sélectionnez un agent pour inspecter ses capacités et outils.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: PERSONAL ASSISTANT (Phase 11) */}
        {activeTab === 'assistant' && (
          <div className="space-y-6">
            {/* Header / Assistant Status */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950/30 via-slate-900/80 to-slate-900/80 border border-indigo-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    JARVIS Personal Assistant (Phase 11)
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    ASSISTANT PERSONNEL ACTIF
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Suite intelligente d'organisation personnelle : gestion des tâches, rappels sémantiques, calendrier Android / OAuth, alarmes réveil et carnet de notes instantané.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-300 bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-[11px]">
                  Stockage : <strong className="text-emerald-400">Local Android (Actif)</strong> | OAuth : <strong className="text-indigo-400">{assistantSync?.mode === 'cloud_oauth_sync' ? 'Google Workspace Sync' : 'Optionnel'}</strong>
                </span>
              </div>
            </div>

            {/* Quick Natural Language Command Bar (Phase 11 Required Commands) */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  Commandes Vocales & Textuelles Prédéfinies
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Testez les 5 commandes de référence requises par la spécification Phase 11 avec exécution sémantique immédiate.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <button
                  onClick={() => {
                    const q = 'Rappelle-moi demain à 8h.';
                    setAssistantQuery(q);
                    handleRunAssistantAgent(q);
                  }}
                  disabled={assistantExecuting}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-indigo-950/40 text-slate-200 hover:text-indigo-300 border border-slate-800 hover:border-indigo-500/40 text-xs font-semibold text-left transition-all flex flex-col gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span className="font-bold text-amber-400 flex items-center gap-1">
                    <Bell className="w-3.5 h-3.5" /> 1. Rappel demain à 8h
                  </span>
                  <span className="text-[10px] text-slate-400">"Rappelle-moi demain à 8h."</span>
                </button>

                <button
                  onClick={() => {
                    const q = "Qu'est-ce que j'ai aujourd'hui ?";
                    setAssistantQuery(q);
                    handleRunAssistantAgent(q);
                  }}
                  disabled={assistantExecuting}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-indigo-950/40 text-slate-200 hover:text-indigo-300 border border-slate-800 hover:border-indigo-500/40 text-xs font-semibold text-left transition-all flex flex-col gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span className="font-bold text-indigo-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> 2. Briefing du jour
                  </span>
                  <span className="text-[10px] text-slate-400">"Qu'est-ce que j'ai aujourd'hui ?"</span>
                </button>

                <button
                  onClick={() => {
                    const q = 'Ajoute une tâche préparer la démo JARVIS.';
                    setAssistantQuery(q);
                    handleRunAssistantAgent(q);
                  }}
                  disabled={assistantExecuting}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-indigo-950/40 text-slate-200 hover:text-indigo-300 border border-slate-800 hover:border-indigo-500/40 text-xs font-semibold text-left transition-all flex flex-col gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <CheckSquare className="w-3.5 h-3.5" /> 3. Ajoute une tâche
                  </span>
                  <span className="text-[10px] text-slate-400">"Ajoute une tâche..."</span>
                </button>

                <button
                  onClick={() => {
                    const q = 'Supprime cette tâche préparer la démo JARVIS';
                    setAssistantQuery(q);
                    handleRunAssistantAgent(q);
                  }}
                  disabled={assistantExecuting}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-indigo-950/40 text-slate-200 hover:text-indigo-300 border border-slate-800 hover:border-indigo-500/40 text-xs font-semibold text-left transition-all flex flex-col gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span className="font-bold text-rose-400 flex items-center gap-1">
                    <Trash2 className="w-3.5 h-3.5" /> 4. Supprime tâche
                  </span>
                  <span className="text-[10px] text-slate-400">"Supprime cette tâche."</span>
                </button>

                <button
                  onClick={() => {
                    const q = 'Quels sont mes rendez-vous ?';
                    setAssistantQuery(q);
                    handleRunAssistantAgent(q);
                  }}
                  disabled={assistantExecuting}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-indigo-950/40 text-slate-200 hover:text-indigo-300 border border-slate-800 hover:border-indigo-500/40 text-xs font-semibold text-left transition-all flex flex-col gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span className="font-bold text-cyan-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> 5. Mes rendez-vous
                  </span>
                  <span className="text-[10px] text-slate-400">"Quels sont mes rendez-vous ?"</span>
                </button>
              </div>

              {/* Custom Query Input */}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={assistantQuery}
                  onChange={(e) => setAssistantQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRunAssistantAgent(assistantQuery);
                  }}
                  placeholder="Ex: Réveille-moi demain à 7h15, Note que le code du portail est 4892..."
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => handleRunAssistantAgent(assistantQuery)}
                  disabled={assistantExecuting || !assistantQuery.trim()}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <CalendarCheck className={`w-4 h-4 ${assistantExecuting ? 'animate-spin' : ''}`} />
                  Exécuter Assistant
                </button>
              </div>
            </div>

            {/* Output Display Card */}
            {assistantOutput && (
              <div className="p-6 rounded-2xl bg-slate-900/80 border border-indigo-500/30 space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                    <div>
                      <h3 className="text-sm font-bold text-white">{assistantOutput.agentName}</h3>
                      <p className="text-[11px] text-slate-400">{assistantOutput.spokenSummary}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {assistantOutput.telemetry?.providerUsed} ({assistantOutput.telemetry?.executionTimeMs}ms)
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                  {assistantOutput.reply}
                </div>

                {assistantOutput.nextSuggestions && assistantOutput.nextSuggestions.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Suggestions suivantes :</span>
                    <div className="flex flex-wrap gap-2">
                      {assistantOutput.nextSuggestions.map((sug: string, i: number) => (
                        <button
                          key={i}
                          onClick={() => {
                            setAssistantQuery(sug);
                            handleRunAssistantAgent(sug);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-indigo-950/40 text-slate-300 hover:text-indigo-300 border border-slate-800 hover:border-indigo-500/30 text-xs transition-all cursor-pointer text-left"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Assistant Sub-Navigation Tabs */}
            <div className="flex border-b border-slate-800 gap-2">
              <button
                onClick={() => setAssistantSubTab('overview')}
                className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition-all border-b-2 cursor-pointer ${
                  assistantSubTab === 'overview'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Vue Synthèse & Briefing
              </button>
              <button
                onClick={() => setAssistantSubTab('tasks')}
                className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition-all border-b-2 cursor-pointer ${
                  assistantSubTab === 'tasks'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                Tâches ({assistantTasks.length})
              </button>
              <button
                onClick={() => setAssistantSubTab('reminders')}
                className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition-all border-b-2 cursor-pointer ${
                  assistantSubTab === 'reminders'
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                Rappels & Alarmes ({assistantReminders.length + assistantAlarms.length})
              </button>
              <button
                onClick={() => setAssistantSubTab('calendar')}
                className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition-all border-b-2 cursor-pointer ${
                  assistantSubTab === 'calendar'
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Calendrier & RDV ({assistantEvents.length})
              </button>
              <button
                onClick={() => setAssistantSubTab('notes')}
                className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition-all border-b-2 cursor-pointer ${
                  assistantSubTab === 'notes'
                    ? 'border-rose-500 text-rose-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Carnet de Notes ({assistantNotes.length})
              </button>
              <button
                onClick={() => setAssistantSubTab('sync')}
                className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition-all border-b-2 cursor-pointer ${
                  assistantSubTab === 'sync'
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Synchronisation
              </button>
            </div>

            {/* SUB-VIEW 1: OVERVIEW & BRIEFING */}
            {assistantSubTab === 'overview' && (
              <div className="space-y-4">
                {/* 4 Stats Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-indigo-500/20">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase">Événements Aujourd'hui</span>
                    <p className="text-2xl font-bold text-white mt-1">{assistantEvents.length}</p>
                    <span className="text-[10px] text-slate-400">Rendez-vous programmés</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-emerald-500/20">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase">Tâches en Cours</span>
                    <p className="text-2xl font-bold text-white mt-1">
                      {assistantTasks.filter((t) => !t.completed).length}
                    </p>
                    <span className="text-[10px] text-slate-400">Sur {assistantTasks.length} tâches</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-amber-500/20">
                    <span className="text-[10px] font-bold text-amber-400 uppercase">Rappels Actifs</span>
                    <p className="text-2xl font-bold text-white mt-1">{assistantReminders.length}</p>
                    <span className="text-[10px] text-slate-400">Alertes programmées</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-cyan-500/20">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase">Alarmes Réveil</span>
                    <p className="text-2xl font-bold text-white mt-1">
                      {assistantAlarms.filter((a) => a.enabled).length}
                    </p>
                    <span className="text-[10px] text-slate-400">Actives sur Android</span>
                  </div>
                </div>

                {/* Spoken Briefing Banner */}
                {assistantOverview?.briefingQuote && (
                  <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-indigo-200">Synthèse Vocale JARVIS</h4>
                      <p className="text-xs text-slate-200 mt-1 italic leading-relaxed">
                        "{assistantOverview.briefingQuote}"
                      </p>
                    </div>
                  </div>
                )}

                {/* Agenda Timeline & Tasks Preview */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Today Schedule */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-cyan-400" />
                      Programme du Jour
                    </h4>
                    <div className="space-y-2">
                      {assistantEvents.length === 0 ? (
                        <p className="text-xs text-slate-500 py-4 text-center">Aucun rendez-vous aujourd'hui.</p>
                      ) : (
                        assistantEvents.map((evt) => (
                          <div key={evt.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs">
                            <div>
                              <p className="font-semibold text-white">{evt.title}</p>
                              <p className="text-[10px] text-slate-400">
                                {new Date(evt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(evt.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {evt.location && ` • ${evt.location}`}
                              </p>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[9px] bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
                              {evt.calendarName}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Urgent Tasks */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                      Tâches Prioritaires
                    </h4>
                    <div className="space-y-2">
                      {assistantTasks.filter((t) => !t.completed).length === 0 ? (
                        <p className="text-xs text-slate-500 py-4 text-center">Toutes les tâches sont terminées !</p>
                      ) : (
                        assistantTasks
                          .filter((t) => !t.completed)
                          .slice(0, 4)
                          .map((task) => (
                            <div key={task.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleToggleTask(task.id)}
                                  className="w-4 h-4 rounded border border-slate-600 hover:border-emerald-400 flex items-center justify-center cursor-pointer"
                                />
                                <div>
                                  <p className="font-semibold text-white">{task.title}</p>
                                  <p className="text-[10px] text-slate-400">{task.category}</p>
                                </div>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                  task.priority === 'urgent'
                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                    : task.priority === 'high'
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {task.priority}
                              </span>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-VIEW 2: TASKS (TaskAgent) */}
            {assistantSubTab === 'tasks' && (
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                      Gestionnaire de Tâches (TaskAgent)
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Créez, complétez ou supprimez des tâches par commande vocale ou manuellement.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-emerald-400">
                    {assistantTasks.filter((t) => t.completed).length} / {assistantTasks.length} terminées
                  </span>
                </div>

                {/* Add Task Form */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col md:flex-row items-center gap-2">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateTask();
                    }}
                    placeholder="Nouvelle tâche (ex: Revoir l'architecture Phase 11)..."
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-full"
                  />
                  <select
                    value={newTaskPriority}
                    onChange={(e: any) => setNewTaskPriority(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">Haute</option>
                    <option value="medium">Moyenne</option>
                    <option value="low">Basse</option>
                  </select>
                  <input
                    type="text"
                    value={newTaskCategory}
                    onChange={(e) => setNewTaskCategory(e.target.value)}
                    placeholder="Catégorie (ex: Travail)"
                    className="w-32 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                  <button
                    onClick={handleCreateTask}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter Tâche
                  </button>
                </div>

                {/* Tasks List */}
                <div className="space-y-2">
                  {assistantTasks.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs">
                      Aucune tâche enregistrée. Dites "Ajoute une tâche..." pour commencer !
                    </div>
                  ) : (
                    assistantTasks.map((task) => (
                      <div
                        key={task.id}
                        className={`p-3 rounded-xl bg-slate-950 border transition-all flex items-center justify-between gap-3 text-xs ${
                          task.completed
                            ? 'border-slate-800/40 opacity-60'
                            : 'border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleToggleTask(task.id)}
                            className={`w-5 h-5 rounded-md border flex items-center justify-center cursor-pointer transition-all ${
                              task.completed
                                ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                                : 'border-slate-600 hover:border-emerald-400'
                            }`}
                          >
                            {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </button>
                          <div>
                            <p className={`font-semibold ${task.completed ? 'line-through text-slate-400' : 'text-slate-100'}`}>
                              {task.title}
                            </p>
                            <span className="text-[10px] text-slate-500">{task.category}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              task.priority === 'urgent'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : task.priority === 'high'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : task.priority === 'medium'
                                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {task.priority}
                          </span>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-all cursor-pointer"
                            title="Supprimer cette tâche"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* SUB-VIEW 3: REMINDERS & ALARMS (ReminderAgent) */}
            {assistantSubTab === 'reminders' && (
              <div className="space-y-6">
                {/* Reminders Section */}
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                        <Bell className="w-4 h-4 text-amber-400" />
                        Rappels Intelligents (ReminderAgent)
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Dites "Rappelle-moi demain à 8h." ou "Rappelle-moi dans 15 minutes d'appeler Jean".
                      </p>
                    </div>
                    <span className="text-xs font-mono text-amber-400">{assistantReminders.length} programmés</span>
                  </div>

                  {/* Add Reminder Form */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col md:flex-row items-center gap-2">
                    <input
                      type="text"
                      value={newReminderTitle}
                      onChange={(e) => setNewReminderTitle(e.target.value)}
                      placeholder="Libellé du rappel..."
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 w-full"
                    />
                    <input
                      type="text"
                      value={newReminderExpr}
                      onChange={(e) => setNewReminderExpr(e.target.value)}
                      placeholder="Échéance (ex: demain à 8h, dans 30 min)..."
                      className="w-48 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      onClick={handleCreateReminder}
                      className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      Programmer
                    </button>
                  </div>

                  {/* Reminders List */}
                  <div className="space-y-2">
                    {assistantReminders.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-xs">
                        Aucun rappel actif. Dites "Rappelle-moi demain à 8h." pour tester !
                      </div>
                    ) : (
                      assistantReminders.map((rem) => (
                        <div key={rem.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-3">
                            <Bell className="w-4 h-4 text-amber-400" />
                            <div>
                              <p className="font-semibold text-slate-100">{rem.title}</p>
                              <p className="text-[10px] text-amber-400/90 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3" />
                                {rem.formattedTime}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteReminder(rem.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Android Alarms Section */}
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                        <AlarmClock className="w-4 h-4 text-cyan-400" />
                        Alarmes & Réveils Android (Intent.ACTION_SET_ALARM)
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Synchronisation directe avec le gestionnaire d'alarmes natif d'Android.
                      </p>
                    </div>
                  </div>

                  {/* Add Alarm Form */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col md:flex-row items-center gap-2">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={newAlarmHour}
                        onChange={(e) => setNewAlarmHour(Number(e.target.value))}
                        className="w-16 px-2 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 text-center"
                      />
                      <span className="font-bold">:</span>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={newAlarmMinute}
                        onChange={(e) => setNewAlarmMinute(Number(e.target.value))}
                        className="w-16 px-2 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 text-center"
                      />
                    </div>
                    <input
                      type="text"
                      value={newAlarmLabel}
                      onChange={(e) => setNewAlarmLabel(e.target.value)}
                      placeholder="Libellé de l'alarme..."
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-full"
                    />
                    <button
                      onClick={handleSetAlarm}
                      className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      Régler Alarme
                    </button>
                  </div>

                  {/* Alarms List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {assistantAlarms.map((alarm) => (
                      <div key={alarm.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                        <div>
                          <p className="text-lg font-mono font-bold text-white">
                            {String(alarm.hour).padStart(2, '0')}:{String(alarm.minute).padStart(2, '0')}
                          </p>
                          <p className="text-[11px] text-slate-400">{alarm.label}</p>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleToggleAlarm(alarm.id)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-all ${
                              alarm.enabled
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {alarm.enabled ? 'ACTIVE' : 'DÉSACTIVÉE'}
                          </button>
                          <button
                            onClick={() => handleDeleteAlarm(alarm.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SUB-VIEW 4: CALENDAR & EVENTS (CalendarAgent) */}
            {assistantSubTab === 'calendar' && (
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-indigo-400" />
                      Agenda & Rendez-vous (CalendarAgent)
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Intégré avec Android CalendarContract et support OAuth pour synchronisation externe.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-indigo-400">{assistantEvents.length} événements</span>
                </div>

                {/* Add Event Form */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col md:flex-row items-center gap-2">
                  <input
                    type="text"
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                    placeholder="Titre du rendez-vous..."
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-full"
                  />
                  <input
                    type="time"
                    value={newEventStartHour}
                    onChange={(e) => setNewEventStartHour(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={newEventLocation}
                    onChange={(e) => setNewEventLocation(e.target.value)}
                    placeholder="Lieu / Lien..."
                    className="w-36 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                  <button
                    onClick={handleCreateEvent}
                    className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter
                  </button>
                </div>

                {/* Events List */}
                <div className="space-y-3">
                  {assistantEvents.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs">
                      Aucun rendez-vous au calendrier. Dites "Quels sont mes rendez-vous ?" pour interroger JARVIS.
                    </div>
                  ) : (
                    assistantEvents.map((evt) => (
                      <div key={evt.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{evt.title}</span>
                            <span className="px-2 py-0.5 rounded text-[9px] bg-indigo-950/60 text-indigo-300 border border-indigo-500/30">
                              {evt.calendarName}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 flex items-center gap-3">
                            <span>
                              🕒 {new Date(evt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(evt.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {evt.location && <span>📍 {evt.location}</span>}
                          </p>
                          {evt.attendees && evt.attendees.length > 0 && (
                            <p className="text-[10px] text-slate-500">
                              Participants : {evt.attendees.join(', ')}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDeleteEvent(evt.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* SUB-VIEW 5: NOTES (NotesAgent) */}
            {assistantSubTab === 'notes' && (
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-rose-400" />
                      Carnet de Notes (NotesAgent)
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Prise de notes rapide et recherche sémantique par mots-clés.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={noteSearchQuery}
                      onChange={(e) => setNoteSearchQuery(e.target.value)}
                      placeholder="Filtrer les notes..."
                      className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500"
                    />
                  </div>
                </div>

                {/* Add Note Form */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newNoteTitle}
                      onChange={(e) => setNewNoteTitle(e.target.value)}
                      placeholder="Titre de la note (optionnel)..."
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={newNoteTag}
                      onChange={(e) => setNewNoteTag(e.target.value)}
                      placeholder="Tag (ex: Idée, Projet)"
                      className="w-36 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                    />
                  </div>
                  <textarea
                    rows={2}
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder="Contenu de la note..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none resize-none"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleCreateNote}
                      className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      Enregistrer Note
                    </button>
                  </div>
                </div>

                {/* Notes Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {assistantNotes
                    .filter((n) =>
                      noteSearchQuery
                        ? n.content.toLowerCase().includes(noteSearchQuery.toLowerCase()) ||
                          n.title?.toLowerCase().includes(noteSearchQuery.toLowerCase()) ||
                          n.tags.some((t: string) => t.toLowerCase().includes(noteSearchQuery.toLowerCase()))
                        : true
                    )
                    .map((note) => (
                      <div key={note.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-100 text-xs">
                              {note.title || 'Note sans titre'}
                            </span>
                            {note.pinned && <Pin className="w-3.5 h-3.5 text-amber-400" />}
                          </div>
                          <p className="text-xs text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">
                            {note.content}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                          <div className="flex flex-wrap gap-1">
                            {note.tags.map((tag: string) => (
                              <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] bg-slate-900 text-slate-400 border border-slate-800">
                                #{tag}
                              </span>
                            ))}
                          </div>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* SUB-VIEW 6: SYNC & OAUTH */}
            {assistantSubTab === 'sync' && (
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-purple-400" />
                    Politique de Synchronisation & OAuth (Non-Intrusif)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    JARVIS applique strictement la directive : "Ne jamais inventer une intégration Google. Synchronisation facultative."
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase">Mode Local Android (Par Défaut)</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">ACTIF</span>
                    </div>
                    <h4 className="text-sm font-bold text-white">Stockage Embarqué & Zero-Cloud Obligatoire</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Vos tâches, rappels, alarmes et notes sont enregistrés localement sur l'appareil. Fonctionne sans connexion Internet et sans compte Google obligatoire.
                    </p>
                    <button
                      onClick={() => handleToggleSyncMode('local_first')}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold cursor-pointer"
                    >
                      Conserver le mode Local First
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase">Passerelle Google Workspace OAuth</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">FACULTATIF</span>
                    </div>
                    <h4 className="text-sm font-bold text-white">Synchronisation Google Tasks / Calendar</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Si vous souhaitez synchroniser votre agenda avec Google Workspace, vous pouvez associer votre compte via le protocole standard OAuth.
                    </p>
                    <button
                      onClick={() => handleToggleSyncMode('cloud_oauth_sync')}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-xs font-semibold cursor-pointer"
                    >
                      Activer la synchronisation Google OAuth
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: PHONE AGENT (Phase 10) */}
        {activeTab === 'phone' && (
          <div className="space-y-6">
            {/* Header / Telephony Status */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/20 via-slate-900/80 to-slate-900/80 border border-emerald-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Phone className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    JARVIS Phone & Calling Agent (Phase 10)
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    TÉLÉPHONIE ANDROID ACTIVE
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Agent vocal et tactile de téléphonie : appels sortants, analyse du journal d'appels, identification des appelants et résolution des contacts sans jamais contourner les permissions Android.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-300 bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-[11px]">
                  Réseau : <strong className="text-emerald-400">{phoneStatus?.capabilities?.simCarrier || 'Orange / Free 5G'}</strong> | Composeur : <strong className="text-cyan-400">Google Dialer</strong>
                </span>
              </div>
            </div>

            {/* Android Telephony Permission Matrix & Zero-Bypass Gate */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  Permissions Android Réelles & Respect du Système
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  Bascule automatique sur <strong className="text-cyan-400">Intent.ACTION_DIAL</strong> si CALL_PHONE est refusée
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {phoneStatus?.permissions?.map((perm: any) => {
                  const isGranted = perm.state === 'granted';
                  return (
                    <div
                      key={perm.permission}
                      className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2 ${
                        isGranted
                          ? 'bg-slate-950/90 border-emerald-500/30'
                          : 'bg-red-950/20 border-red-500/30'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-200">{perm.name}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isGranted ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                          }`}>
                            {isGranted ? 'ACCORDÉE' : 'REFUSÉE'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                          {perm.description}
                        </p>
                      </div>

                      <button
                        onClick={() => handleTogglePhonePermission(perm.permission, perm.state)}
                        className={`w-full py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                          isGranted
                            ? 'bg-slate-800 hover:bg-red-950/50 text-slate-300 hover:text-red-300 border border-slate-700 hover:border-red-500/40'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold'
                        }`}
                      >
                        {isGranted ? 'Simuler Révocation' : 'Accorder la Permission'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Core Phase 10 Command Test Suite */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  Commandes Vocales & Tactiles Dédiées (Phase 10)
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Test des 4 fonctions clés & cas limites
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  onClick={() => {
                    const q = 'Appelle Sarah.';
                    setPhoneQuery(q);
                    handleRunPhoneAgent(q);
                  }}
                  disabled={phoneExecuting}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-emerald-950/40 text-slate-200 hover:text-emerald-300 border border-slate-800 hover:border-emerald-500/40 text-xs font-semibold text-left transition-all flex flex-col gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> 1. "Appelle Sarah."
                  </span>
                  <span className="text-[10px] text-slate-400">Homonymes & choix multiple</span>
                </button>

                <button
                  onClick={() => {
                    const q = 'Appelle le dernier appel manqué.';
                    setPhoneQuery(q);
                    handleRunPhoneAgent(q);
                  }}
                  disabled={phoneExecuting}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-emerald-950/40 text-slate-200 hover:text-emerald-300 border border-slate-800 hover:border-emerald-500/40 text-xs font-semibold text-left transition-all flex flex-col gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <PhoneMissed className="w-3.5 h-3.5" /> 2. "Appel manqué"
                  </span>
                  <span className="text-[10px] text-slate-400">Rappeler le dernier manqué</span>
                </button>

                <button
                  onClick={() => {
                    const q = "Qui m'a appelé ?";
                    setPhoneQuery(q);
                    handleRunPhoneAgent(q);
                  }}
                  disabled={phoneExecuting}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-emerald-950/40 text-slate-200 hover:text-emerald-300 border border-slate-800 hover:border-emerald-500/40 text-xs font-semibold text-left transition-all flex flex-col gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> 3. "Qui m'a appelé ?"
                  </span>
                  <span className="text-[10px] text-slate-400">Synthèse appelants sur 48h</span>
                </button>

                <button
                  onClick={() => {
                    const q = 'Montre mes appels récents.';
                    setPhoneQuery(q);
                    handleRunPhoneAgent(q);
                  }}
                  disabled={phoneExecuting}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-emerald-950/40 text-slate-200 hover:text-emerald-300 border border-slate-800 hover:border-emerald-500/40 text-xs font-semibold text-left transition-all flex flex-col gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> 4. "Appels récents"
                  </span>
                  <span className="text-[10px] text-slate-400">Historique CallLog.Calls</span>
                </button>

                <button
                  onClick={() => {
                    const q = 'Appelle Toto';
                    setPhoneQuery(q);
                    handleRunPhoneAgent(q);
                  }}
                  disabled={phoneExecuting}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-amber-950/40 text-slate-200 hover:text-amber-300 border border-slate-800 hover:border-amber-500/40 text-xs font-semibold text-left transition-all flex flex-col gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span className="font-bold text-amber-400">5. Contact Inexistant</span>
                  <span className="text-[10px] text-slate-400">Gestion de l'erreur & conseils</span>
                </button>

                <button
                  onClick={() => {
                    const q = 'Appelle 12';
                    setPhoneQuery(q);
                    handleRunPhoneAgent(q);
                  }}
                  disabled={phoneExecuting}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-amber-950/40 text-slate-200 hover:text-amber-300 border border-slate-800 hover:border-amber-500/40 text-xs font-semibold text-left transition-all flex flex-col gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span className="font-bold text-amber-400">6. Numéro Invalide</span>
                  <span className="text-[10px] text-slate-400">Rejet format trop court (&lt;4)</span>
                </button>

                <button
                  onClick={() => {
                    const q = 'Appelle Sarah Connor';
                    setPhoneQuery(q);
                    handleRunPhoneAgent(q);
                  }}
                  disabled={phoneExecuting}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-emerald-950/40 text-slate-200 hover:text-emerald-300 border border-slate-800 hover:border-emerald-500/40 text-xs font-semibold text-left transition-all flex flex-col gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span className="font-bold text-emerald-400">7. Appelle Sarah Connor</span>
                  <span className="text-[10px] text-slate-400">Ciblage précis avec confirmation</span>
                </button>

                <button
                  onClick={() => {
                    const q = 'Appelle Maman';
                    setPhoneQuery(q);
                    handleRunPhoneAgent(q);
                  }}
                  disabled={phoneExecuting}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-emerald-950/40 text-slate-200 hover:text-emerald-300 border border-slate-800 hover:border-emerald-500/40 text-xs font-semibold text-left transition-all flex flex-col gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span className="font-bold text-emerald-400">8. Appelle Maman</span>
                  <span className="text-[10px] text-slate-400">Contact favori étoilé</span>
                </button>
              </div>

              {/* Custom Vocal / Text Command Input */}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={phoneQuery}
                  onChange={(e) => setPhoneQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRunPhoneAgent(phoneQuery);
                  }}
                  placeholder="Ex: Appelle Sarah, Qui m'a appelé ?, Appelle le dernier appel manqué..."
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={() => handleRunPhoneAgent(phoneQuery)}
                  disabled={phoneExecuting || !phoneQuery.trim()}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Phone className={`w-4 h-4 ${phoneExecuting ? 'animate-spin' : ''}`} />
                  Exécuter Phone Agent
                </button>
              </div>
            </div>

            {/* Disambiguation Modal / Selector when multiple matching contacts are found */}
            {phoneDisambiguation && phoneDisambiguation.length > 0 && (
              <div className="p-5 rounded-2xl bg-slate-900 border border-cyan-500/50 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-cyan-400">
                  <Users className="w-5 h-5" />
                  <h4 className="text-sm font-bold">Désambiguïsation Requise : Plusieurs Correspondants Trouvés</h4>
                </div>
                <p className="text-xs text-slate-300">
                  Plusieurs contacts ou lignes correspondent à votre demande. Veuillez sélectionner le destinataire exact :
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {phoneDisambiguation.map((cand: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => {
                        const directQuery = `Appelle ${cand.contact.displayName}`;
                        handleRunPhoneAgent(directQuery);
                      }}
                      className="p-3 rounded-xl bg-slate-950 hover:bg-cyan-950/40 text-left border border-slate-800 hover:border-cyan-500/50 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        {cand.contact.photoUri ? (
                          <img
                            src={cand.contact.photoUri}
                            alt={cand.contact.displayName}
                            className="w-9 h-9 rounded-full object-cover border border-slate-700"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-xs border border-slate-700">
                            {cand.contact.givenName[0]}
                          </div>
                        )}
                        <div>
                          <div className="text-xs font-bold text-slate-100 group-hover:text-cyan-300">
                            {cand.contact.displayName}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {cand.number.type === 'mobile' ? 'Mobile' : cand.number.type === 'work' ? 'Bureau' : 'Domicile'} : {cand.number.number}
                          </div>
                          {cand.contact.company && (
                            <div className="text-[10px] text-slate-500">{cand.contact.company}</div>
                          )}
                        </div>
                      </div>
                      <Phone className="w-4 h-4 text-slate-600 group-hover:text-cyan-400" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Privileged Call Confirmation Gate */}
            {pendingCallConfirmation && (
              <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/60 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-emerald-400">
                  <PhoneForwarded className="w-5 h-5" />
                  <h4 className="text-sm font-bold">Confirmation Requise Avant Déclenchement de l'Appel</h4>
                </div>
                <p className="text-xs text-slate-200">
                  JARVIS est prêt à émettre l'appel téléphonique natif vers votre correspondant.
                </p>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 space-y-1.5">
                  <div>Correspondant : <strong className="text-emerald-400 font-bold">{pendingCallConfirmation.targetName}</strong></div>
                  <div>Numéro composé : <strong className="text-cyan-300">{pendingCallConfirmation.phoneNumber}</strong></div>
                  <div>Action Android : <strong className="text-yellow-400">{pendingCallConfirmation.intentAction}</strong></div>
                  <div>Jeton de sécurité : <strong className="text-slate-400">{pendingCallConfirmation.id}</strong></div>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => {
                      handleRunPhoneAgent(phoneQuery, pendingCallConfirmation.id);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Phone className="w-4 h-4" />
                    Confirmer et Lancer l'Appel
                  </button>
                  <button
                    onClick={() => setPendingCallConfirmation(null)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-all cursor-pointer"
                  >
                    Annuler l'appel
                  </button>
                </div>
              </div>
            )}

            {/* Output Display Card */}
            {phoneOutput && (
              <div className="p-6 rounded-2xl bg-slate-900/80 border border-emerald-500/30 space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h3 className="text-sm font-bold text-white">{phoneOutput.agentName}</h3>
                      <p className="text-[11px] text-slate-400">{phoneOutput.spokenSummary}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {phoneOutput.telemetry?.providerUsed} ({phoneOutput.telemetry?.executionTimeMs}ms)
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                  {phoneOutput.reply}
                </div>

                {phoneOutput.nextSuggestions && phoneOutput.nextSuggestions.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Suggestions suivantes :</span>
                    <div className="flex flex-wrap gap-2">
                      {phoneOutput.nextSuggestions.map((sug: string, i: number) => (
                        <button
                          key={i}
                          onClick={() => {
                            setPhoneQuery(sug);
                            handleRunPhoneAgent(sug);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-emerald-950/40 text-slate-300 hover:text-emerald-300 border border-slate-800 hover:border-emerald-500/30 text-xs transition-all cursor-pointer text-left"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Split View: Live Contacts Store vs Live Android CallLog */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              {/* Contacts Directory */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    Répertoire Contacts Android (ContactsContract)
                  </h3>
                  <span className="text-xs font-mono text-slate-400">{phoneContacts.length} contacts</span>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {phoneContacts.map((c: any) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        {c.photoUri ? (
                          <img
                            src={c.photoUri}
                            alt={c.displayName}
                            className="w-8 h-8 rounded-full object-cover border border-slate-700"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-xs border border-slate-700">
                            {c.givenName[0]}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-200 flex items-center gap-1.5">
                            {c.displayName}
                            {c.isStarred && <span className="text-yellow-400 text-[10px]">★ Favori</span>}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {c.numbers?.map((n: any) => `${n.number} (${n.type})`).join(' • ')}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          const q = `Appelle ${c.displayName}`;
                          setPhoneQuery(q);
                          handleRunPhoneAgent(q);
                        }}
                        className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Appeler
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Call Log (CallLog.Calls) */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    Journal d'Appels Récent (CallLog.Calls)
                  </h3>
                  <span className="text-xs font-mono text-slate-400">{phoneCallLogs.length} entrées</span>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {phoneCallLogs.map((log: any) => {
                    const isMissed = log.type === 'missed';
                    const isOutgoing = log.type === 'outgoing';
                    return (
                      <div
                        key={log.id}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            isMissed
                              ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                              : isOutgoing
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {isMissed ? (
                              <PhoneMissed className="w-4 h-4" />
                            ) : isOutgoing ? (
                              <PhoneOutgoing className="w-4 h-4" />
                            ) : (
                              <PhoneIncoming className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-200">
                              {log.cachedName}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {log.formattedNumber} • {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            const q = `Appelle ${log.cachedName || log.formattedNumber}`;
                            setPhoneQuery(q);
                            handleRunPhoneAgent(q);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-950/40 text-slate-300 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/30 text-xs font-semibold transition-all cursor-pointer"
                        >
                          Rappeler
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: CODING & GITHUB AGENT (Phase 9) */}
        {activeTab === 'coding' && (
          <div className="space-y-6">
            {/* Header / Connection Status */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-yellow-950/20 via-slate-900/80 to-slate-900/80 border border-yellow-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-yellow-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    JARVIS Coding & GitHub Agent (Phase 9)
                  </h2>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    githubStatus?.configured
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}>
                    {githubStatus?.configured ? 'GITHUB TOKEN ACTIF' : 'MODE PUBLIC SÉCURISÉ'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Ingénieur logiciel autonome : analyse de dépôts, lecture de fichiers, recherche d’erreurs, dépendances, issues et patchs.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-slate-300 bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-[11px]">Zéro Fuite : GITHUB_TOKEN conservé strictement côté serveur</span>
              </div>
            </div>

            {/* Permission Rules System Grid */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Lock className="w-4 h-4 text-yellow-400" />
                Système de Permissions & Matrice de Sécurité GitHub
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950/90 border border-emerald-500/30 flex items-center justify-between">
                  <span className="text-slate-300">Analyse de Dépôt / Fichiers</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Lecture Autorisée</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/90 border border-emerald-500/30 flex items-center justify-between">
                  <span className="text-slate-300">Analyse Dépendances & Issues</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Lecture Autorisée</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/90 border border-emerald-500/30 flex items-center justify-between">
                  <span className="text-slate-300">Explication & Recherche de Bugs</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Lecture Autorisée</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/90 border border-amber-500/30 flex items-center justify-between">
                  <span className="text-slate-300">Modification de Fichier</span>
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">Confirmation Requise</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/90 border border-amber-500/30 flex items-center justify-between">
                  <span className="text-slate-300">Création d'Issue GitHub</span>
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">Confirmation Requise</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/90 border border-red-500/30 flex items-center justify-between">
                  <span className="text-slate-300">Commit / Push / Suppression</span>
                  <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">Confirmation Requise</span>
                </div>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Commandes Dédiées Phase 9
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono">Dépôt cible :</span>
                  <input
                    type="text"
                    value={codingRepo}
                    onChange={(e) => setCodingRepo(e.target.value)}
                    placeholder="owner/repo"
                    className="px-2.5 py-1 text-xs bg-slate-950 border border-slate-700 rounded-lg text-yellow-300 font-mono focus:outline-none focus:border-yellow-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => {
                    const q = `Analyse le dépôt ${codingRepo}`;
                    setCodingQuery(q);
                    handleRunCodingAgent(q);
                  }}
                  disabled={codingExecuting}
                  className="p-2.5 rounded-xl bg-slate-950 hover:bg-yellow-950/40 text-slate-200 hover:text-yellow-300 border border-slate-800 hover:border-yellow-500/40 text-xs font-semibold text-left transition-all flex flex-col gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span className="font-bold text-yellow-400">1. Analyser Dépôt</span>
                  <span className="text-[10px] text-slate-400">Structure, étoiles & commits</span>
                </button>

                <button
                  onClick={() => {
                    const q = `Lis le fichier package.json de ${codingRepo}`;
                    setCodingQuery(q);
                    handleRunCodingAgent(q);
                  }}
                  disabled={codingExecuting}
                  className="p-2.5 rounded-xl bg-slate-950 hover:bg-yellow-950/40 text-slate-200 hover:text-yellow-300 border border-slate-800 hover:border-yellow-500/40 text-xs font-semibold text-left transition-all flex flex-col gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span className="font-bold text-yellow-400">2. Lire Fichier</span>
                  <span className="text-[10px] text-slate-400">Code brut ou dossier</span>
                </button>

                <button
                  onClick={() => {
                    const q = `Recherche des erreurs et vulnérabilités dans le code de ${codingRepo}`;
                    setCodingQuery(q);
                    handleRunCodingAgent(q);
                  }}
                  disabled={codingExecuting}
                  className="p-2.5 rounded-xl bg-slate-950 hover:bg-yellow-950/40 text-slate-200 hover:text-yellow-300 border border-slate-800 hover:border-yellow-500/40 text-xs font-semibold text-left transition-all flex flex-col gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span className="font-bold text-yellow-400">3. Trouver Erreurs</span>
                  <span className="text-[10px] text-slate-400">Bugs, fuites & sécurité</span>
                </button>

                <button
                  onClick={() => {
                    const q = `Explique le code du système de routage et calcule la complexité algorithmique pour ${codingRepo}`;
                    setCodingQuery(q);
                    handleRunCodingAgent(q);
                  }}
                  disabled={codingExecuting}
                  className="p-2.5 rounded-xl bg-slate-950 hover:bg-yellow-950/40 text-slate-200 hover:text-yellow-300 border border-slate-800 hover:border-yellow-500/40 text-xs font-semibold text-left transition-all flex flex-col gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span className="font-bold text-yellow-400">4. Expliquer Code</span>
                  <span className="text-[10px] text-slate-400">Architecture & Big-O</span>
                </button>

                <button
                  onClick={() => {
                    const q = `Analyse les dépendances de ${codingRepo}`;
                    setCodingQuery(q);
                    handleRunCodingAgent(q);
                  }}
                  disabled={codingExecuting}
                  className="p-2.5 rounded-xl bg-slate-950 hover:bg-yellow-950/40 text-slate-200 hover:text-yellow-300 border border-slate-800 hover:border-yellow-500/40 text-xs font-semibold text-left transition-all flex flex-col gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span className="font-bold text-yellow-400">5. Dépendances</span>
                  <span className="text-[10px] text-slate-400">Audit npm & gradle</span>
                </button>

                <button
                  onClick={() => {
                    const q = `Analyse les issues ouvertes de ${codingRepo}`;
                    setCodingQuery(q);
                    handleRunCodingAgent(q);
                  }}
                  disabled={codingExecuting}
                  className="p-2.5 rounded-xl bg-slate-950 hover:bg-yellow-950/40 text-slate-200 hover:text-yellow-300 border border-slate-800 hover:border-yellow-500/40 text-xs font-semibold text-left transition-all flex flex-col gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span className="font-bold text-yellow-400">6. Analyser Issues</span>
                  <span className="text-[10px] text-slate-400">Tickets & sévérité</span>
                </button>

                <button
                  onClick={() => {
                    const q = `Prépare une correction et un patch pour la gestion des timeouts de ${codingRepo}`;
                    setCodingQuery(q);
                    handleRunCodingAgent(q);
                  }}
                  disabled={codingExecuting}
                  className="p-2.5 rounded-xl bg-slate-950 hover:bg-yellow-950/40 text-slate-200 hover:text-yellow-300 border border-slate-800 hover:border-yellow-500/40 text-xs font-semibold text-left transition-all flex flex-col gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span className="font-bold text-yellow-400">7. Préparer Fix</span>
                  <span className="text-[10px] text-slate-400">Génération de patch</span>
                </button>

                <button
                  onClick={() => {
                    const q = `Crée une issue pour signaler un problème d'optimisation sur ${codingRepo}`;
                    setCodingQuery(q);
                    handleRunCodingAgent(q);
                  }}
                  disabled={codingExecuting}
                  className="p-2.5 rounded-xl bg-slate-950 hover:bg-amber-950/40 text-slate-200 hover:text-amber-300 border border-amber-500/30 hover:border-amber-500/60 text-xs font-semibold text-left transition-all flex flex-col gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span className="font-bold text-amber-400">8. Créer Issue</span>
                  <span className="text-[10px] text-amber-400/80">🔒 Confirmation requise</span>
                </button>
              </div>

              {/* Custom Query Input */}
              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={codingQuery}
                  onChange={(e) => setCodingQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRunCodingAgent(codingQuery);
                  }}
                  placeholder="Ex: Analyse les dépendances de Sasukeutchi77/Jarvis-3 et vérifie la sécurité..."
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-yellow-500"
                />
                <button
                  onClick={() => handleRunCodingAgent(codingQuery)}
                  disabled={codingExecuting || !codingQuery.trim()}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-yellow-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Terminal className={`w-4 h-4 ${codingExecuting ? 'animate-spin' : ''}`} />
                  Exécuter Coding Agent
                </button>
              </div>
            </div>

            {/* Privileged Action Confirmation Modal / Banner */}
            {pendingConfirmation && (
              <div className="p-5 rounded-2xl bg-amber-950/30 border border-amber-500/50 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                  <h4 className="text-sm font-bold">Demande d'Autorisation Explicite Requise</h4>
                </div>
                <p className="text-xs text-slate-200">
                  {pendingConfirmation.summary}
                </p>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400 space-y-1">
                  <div>Opération : <strong className="text-amber-400">{pendingConfirmation.operation}</strong></div>
                  <div>Dépôt cible : <strong className="text-slate-200">{pendingConfirmation.owner}/{pendingConfirmation.repo}</strong></div>
                  <div>Token de sécurité : <strong className="text-cyan-400">{pendingConfirmation.id}</strong></div>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => {
                      handleRunCodingAgent(codingQuery, pendingConfirmation.id);
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all cursor-pointer"
                  >
                    Confirmer et Publier sur GitHub
                  </button>
                  <button
                    onClick={() => setPendingConfirmation(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-all cursor-pointer"
                  >
                    Annuler l'opération
                  </button>
                </div>
              </div>
            )}

            {/* Results Output */}
            {codingOutput && (
              <div className="p-6 rounded-2xl bg-slate-900/80 border border-yellow-500/30 space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h3 className="text-sm font-bold text-white">{codingOutput.agentName}</h3>
                      <p className="text-[11px] text-slate-400">{codingOutput.spokenSummary}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {codingOutput.telemetry?.providerUsed} ({codingOutput.telemetry?.executionTimeMs}ms)
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">
                  {codingOutput.reply}
                </div>

                {codingOutput.nextSuggestions && codingOutput.nextSuggestions.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Suggestions suivantes :</span>
                    <div className="flex flex-wrap gap-2">
                      {codingOutput.nextSuggestions.map((sug: string, i: number) => (
                        <button
                          key={i}
                          onClick={() => {
                            setCodingQuery(sug);
                            handleRunCodingAgent(sug);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-yellow-950/40 text-slate-300 hover:text-yellow-300 border border-slate-800 hover:border-yellow-500/30 text-xs transition-all cursor-pointer text-left"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MULTI-PROVIDER FALLBACK SYSTEM */}
        {activeTab === 'fallback' && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
              <h2 className="text-sm font-semibold text-slate-100 mb-2 flex items-center gap-2">
                <Server className="w-4 h-4 text-cyan-400" />
                Matrice de Résilience & Cascade de Repli Automatique
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Si un fournisseur IA rencontre un quota épuisé (429), une surcharge (503) ou une indisponibilité réseau, le routeur bascule automatiquement vers le fournisseur suivant sans interruption de service pour l'utilisateur.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Fournisseur 1 (Principal)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">ACTIF</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-100">Groq / OpenRouter</h3>
                  <p className="text-[11px] text-slate-400">
                    Inférence LPU ultra-rapide (~500 tokens/sec) pour les réponses instantanées et l'agent conversationnel.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-purple-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Fournisseur 2 (Secondaire)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">ACTIF</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-100">Google Gemini (2.5 Flash / Pro)</h3>
                  <p className="text-[11px] text-slate-400">
                    Raisonnement multimodal, analyse d'images & OCR (Vision Agent), et contexte long (1M+ tokens).
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Fournisseur 3 (Repli Ultime)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">ACTIF</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-100">Anthropic Claude & Moteur Local</h3>
                  <p className="text-[11px] text-slate-400">
                    Raisonnement architectural profond (Coding Agent) ou repli déterministe autonome embarqué sans connexion.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SECURE AUDIT LOGS */}
        {activeTab === 'logs' && (
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  Journaux d'Exécution Sécurisés du Superviseur
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Toutes les requêtes sont journalisées avec masquage automatique des secrets (clés API) et respect strict de la vie privée.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400">{logs.length} entrées récentes</span>
            </div>

            <div className="space-y-2">
              {logs.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Aucun journal technique enregistré pour le moment.
                </div>
              ) : (
                logs.map((log, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs font-mono"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${log.success ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      <span className="text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      <span className="text-purple-300 font-bold uppercase">[{log.primaryAgent}]</span>
                      <span className="text-slate-300 font-sans">
                        Confiance: {(log.routedConfidence * 100).toFixed(0)}%
                        {log.multiStep && ' (Multi-Étapes)'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-slate-400">
                      <span>Moteur: <strong className="text-cyan-400">{log.providerUsed}</strong></span>
                      <span>Latence: <strong className="text-purple-400">{log.totalLatencyMs}ms</strong></span>
                      <span className={`font-bold ${log.success ? 'text-emerald-400' : 'text-red-400'}`}>
                        {log.success ? 'SUCCÈS' : 'ÉCHEC'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
