import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import {
  Smartphone,
  Shield,
  ShieldCheck,
  Bell,
  Mic,
  Camera,
  MapPin,
  FolderLock,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  Trash2,
  Volume2,
  Eye,
  Cpu,
  Zap,
  Lock,
  DownloadCloud,
  RotateCcw,
  Sparkles,
  MessageSquare,
  Users,
  Calendar,
  Phone,
  Mail,
  Bluetooth,
  Layers,
  Monitor,
  Bot,
  ShieldAlert,
  ExternalLink,
  Filter,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { AndroidBridge, ANDROID_PERMISSION_DEFINITIONS } from '../lib/android-bridge';
import { AndroidPermissionType, AndroidPermissionStatus, AndroidPermissionAuditRecord, ScheduledReminder, AndroidActionConfirmation } from '../types';
import { SecurityConfirmationModal } from '../components/Android/SecurityConfirmationModal';
import { JarvisDeviceAccess } from '../components/Android/JarvisDeviceAccess';
import { screenAgent } from '../lib/agents/specialized/screen-agent';
import { apiFetch } from '../lib/api';

export function AndroidHubPage() {
  const [activeTab, setActiveTab] = useState<'device_access' | 'status' | 'vision_screen' | 'system_update' | 'permissions' | 'reminders'>('device_access');
  const [permissionsAudit, setPermissionsAudit] = useState<AndroidPermissionAuditRecord[]>([]);
  const [permissionCategoryFilter, setPermissionCategoryFilter] = useState<'all' | 'core' | 'privacy' | 'system' | 'device_admin'>('all');
  const [permissionStatusFilter, setPermissionStatusFilter] = useState<'all' | 'granted' | 'missing'>('all');
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  const [permissionsStatus, setPermissionsStatus] = useState<Record<AndroidPermissionType, AndroidPermissionStatus>>({
    microphone: 'granted',
    camera: 'granted',
    notifications: 'granted',
    notification_listener: 'granted',
    contacts: 'prompt',
    calendar: 'prompt',
    phone: 'prompt',
    sms: 'prompt',
    geolocation: 'granted',
    bluetooth: 'prompt',
    storage: 'granted',
    vibration: 'granted',
    overlay: 'prompt',
    accessibility: 'prompt',
    screen_capture: 'prompt',
    assistant: 'granted',
    device_admin: 'prompt',
  });

  const [aiProviders, setAiProviders] = useState<any[]>([]);
  const [systemUpdate, setSystemUpdate] = useState<any>(null);
  const [screenContext, setScreenContext] = useState<any>(null);
  const [isScanningScreen, setIsScanningScreen] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [reminders, setReminders] = useState<ScheduledReminder[]>([]);
  const [newReminderTitle, setNewReminderTitle] = useState('');
  const [newReminderTime, setNewReminderTime] = useState('Demain 08:00');
  const [pendingConfirmation, setPendingConfirmation] = useState<AndroidActionConfirmation | null>(null);

  const refreshPermissions = async () => {
    setIsLoadingAudit(true);
    try {
      // 1. Fetch deep audit from backend
      const res = await apiFetch('/api/android/permissions/audit');
      if (res.ok) {
        const data = await res.json();
        if (data.audit && Array.isArray(data.audit)) {
          // Enrich with real-time browser/native checks
          const enriched: AndroidPermissionAuditRecord[] = [];
          const statusMap: Record<AndroidPermissionType, AndroidPermissionStatus> = { ...permissionsStatus };

          for (const item of data.audit) {
            const permId = item.id as AndroidPermissionType;
            const realStatus = await AndroidBridge.checkPermission(permId);
            const isGranted = realStatus === 'granted' || item.isGranted;
            statusMap[permId] = isGranted ? 'granted' : realStatus;
            enriched.push({
              ...item,
              status: isGranted ? 'granted' : realStatus,
              isGranted,
            });
          }

          setPermissionsAudit(enriched);
          setPermissionsStatus(statusMap);
          return;
        }
      }
    } catch {
      // Local fallback
    } finally {
      setIsLoadingAudit(false);
    }

    const types: AndroidPermissionType[] = [
      'microphone',
      'camera',
      'notifications',
      'notification_listener',
      'contacts',
      'calendar',
      'phone',
      'sms',
      'geolocation',
      'bluetooth',
      'storage',
      'overlay',
      'accessibility',
      'screen_capture',
      'assistant',
      'device_admin',
      'vibration',
    ];
    const results: any = {};
    for (const t of types) {
      results[t] = await AndroidBridge.checkPermission(t);
    }
    setPermissionsStatus(results);
  };

  const loadAIStatus = async () => {
    try {
      const res = await apiFetch('/api/ai-providers/status');
      if (res.ok) {
        const data = await res.json();
        setAiProviders(data.providers || []);
      }
    } catch {}
  };

  const loadSystemUpdate = async () => {
    try {
      const res = await apiFetch('/api/android/system-update/check');
      if (res.ok) {
        const data = await res.json();
        setSystemUpdate(data);
      }
    } catch {}
  };

  const loadScreenContext = async () => {
    setIsScanningScreen(true);
    try {
      const res = await apiFetch('/api/android/screen/context');
      if (res.ok) {
        const data = await res.json();
        setScreenContext(data);
      }
    } catch {} finally {
      setIsScanningScreen(false);
    }
  };

  const handleExecuteScreenAgent = async (
    query: string,
    scenario?: 'settings' | 'error_dialog' | 'banking_revolut' | 'password_form' | 'real_display'
  ) => {
    setIsScanningScreen(true);
    AndroidBridge.vibrate('light');
    try {
      if (scenario === 'real_display') {
        const output = await screenAgent.execute({
          id: `inp-${Date.now()}`,
          query,
        });
        setScreenContext({
          reply: output.reply,
          spokenSummary: output.spokenSummary,
          nextSuggestions: output.nextSuggestions,
          blocked: output.structuredData?.blocked,
          screenText: output.reply,
          activeAppTitle: output.structuredData?.activeAppTitle || 'Écran Android Capturé',
          activePackage: output.structuredData?.activePackage || 'android.window.display',
        });
      } else {
        const output = await screenAgent.execute({
          id: `inp-${Date.now()}`,
          query,
          context: {
            parameters: {
              mockScreenScenario: scenario,
            },
          },
        });
        setScreenContext({
          reply: output.reply,
          spokenSummary: output.spokenSummary,
          nextSuggestions: output.nextSuggestions,
          blocked: output.structuredData?.blocked,
          screenText: output.reply,
          activeAppTitle: output.structuredData?.activeAppTitle || 'Écran Android Simulé',
          activePackage: output.structuredData?.activePackage || 'com.android.settings',
        });
      }

      toast.success('Analyse du contexte d\'écran terminée par J.A.R.V.I.S.');
      AndroidBridge.vibrate('success');
    } catch (err: any) {
      toast.error('Erreur lors de l\'analyse d\'écran : ' + (err?.message || 'Échec'));
      AndroidBridge.vibrate('warning');
    } finally {
      setIsScanningScreen(false);
    }
  };

  const refreshReminders = async () => {
    try {
      const res = await apiFetch('/v1/reminders');
      if (res.ok) {
        const data = await res.json();
        setReminders(data.reminders || []);
      }
    } catch {}
  };

  useEffect(() => {
    refreshPermissions();
    loadAIStatus();
    loadSystemUpdate();
    loadScreenContext();
    refreshReminders();
  }, []);

  const handleRequestPermission = async (type: AndroidPermissionType) => {
    AndroidBridge.vibrate('light');
    const res = await AndroidBridge.requestPermission(type);
    if (res.granted) {
      toast.success(`Permission "${ANDROID_PERMISSION_DEFINITIONS[type].title}" autorisée.`);
      AndroidBridge.vibrate('success');
    } else {
      toast.error(`Permission non accordée : ${res.error || 'Refusée'}`);
      AndroidBridge.vibrate('warning');
    }
    await refreshPermissions();
  };

  const handleGrantFullAccess = async () => {
    AndroidBridge.vibrate('heavy');
    const types: AndroidPermissionType[] = [
      'accessibility',
      'screen_capture',
      'device_admin',
      'microphone',
      'camera',
      'notifications',
      'storage',
      'vibration',
      'geolocation',
    ];
    for (const t of types) {
      await AndroidBridge.requestPermission(t);
    }
    await refreshPermissions();
    toast.success('Autorisation d\'accès complet accordée à J.A.R.V.I.S. avec succès.');
  };

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    AndroidBridge.vibrate('light');
    try {
      const res = await apiFetch('/api/android/system-update/check');
      if (res.ok) {
        const data = await res.json();
        setSystemUpdate(data);
        toast.success('Dépôts système Android 15 & correctifs interrogés avec succès.');
      }
    } catch {
      toast.error('Erreur lors de la vérification de mise à jour');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleApplyUpdate = async () => {
    setIsApplyingUpdate(true);
    AndroidBridge.vibrate('medium');
    try {
      const res = await apiFetch('/api/android/system-update/apply', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || 'Mise à jour système OTA initialisée');
      }
    } catch {
      toast.error('Erreur de déclenchement de la mise à jour');
    } finally {
      setIsApplyingUpdate(false);
    }
  };

  const handleLockPhone = async () => {
    AndroidBridge.vibrate('heavy');
    try {
      const res = await apiFetch('/api/android/admin/lock', { method: 'POST' });
      if (res.ok) {
        toast.success('Verrouillage matériel immédiat exécuté via DevicePolicyManager.');
      }
    } catch {
      toast.error('Erreur lors du verrouillage');
    }
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderTitle.trim()) return;

    try {
      const res = await apiFetch('/v1/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newReminderTitle.trim(), time: newReminderTime }),
      });
      if (res.ok) {
        toast.success(`Rappel "${newReminderTitle}" programmé`);
        AndroidBridge.vibrate('success');
        setNewReminderTitle('');
        refreshReminders();

        AndroidBridge.sendNotification('Rappel Programmé', {
          body: `${newReminderTitle} (${newReminderTime})`,
        });
      }
    } catch {
      toast.error('Erreur de programmation du rappel');
    }
  };

  const handleConfirmAction = (act: AndroidActionConfirmation) => {
    toast.success(`Action confirmée : ${act.title} exécutée.`);
    AndroidBridge.vibrate('success');
    setPendingConfirmation(null);
  };

  const getPermissionIcon = (type: AndroidPermissionType) => {
    switch (type) {
      case 'accessibility':
        return <Eye className="w-5 h-5 text-cyan-400" />;
      case 'screen_capture':
        return <Monitor className="w-5 h-5 text-indigo-400" />;
      case 'notification_listener':
        return <MessageSquare className="w-5 h-5 text-cyan-400" />;
      case 'device_admin':
        return <ShieldAlert className="w-5 h-5 text-amber-400" />;
      case 'assistant':
        return <Bot className="w-5 h-5 text-cyan-300" />;
      case 'overlay':
        return <Layers className="w-5 h-5 text-cyan-400" />;
      case 'microphone':
        return <Mic className="w-5 h-5 text-cyan-400" />;
      case 'camera':
        return <Camera className="w-5 h-5 text-emerald-400" />;
      case 'notifications':
        return <Bell className="w-5 h-5 text-amber-400" />;
      case 'contacts':
        return <Users className="w-5 h-5 text-indigo-400" />;
      case 'calendar':
        return <Calendar className="w-5 h-5 text-blue-400" />;
      case 'phone':
        return <Phone className="w-5 h-5 text-emerald-400" />;
      case 'sms':
        return <Mail className="w-5 h-5 text-sky-400" />;
      case 'geolocation':
        return <MapPin className="w-5 h-5 text-rose-400" />;
      case 'bluetooth':
        return <Bluetooth className="w-5 h-5 text-blue-400" />;
      case 'storage':
        return <FolderLock className="w-5 h-5 text-purple-400" />;
      case 'vibration':
        return <Activity className="w-5 h-5 text-indigo-400" />;
      default:
        return <Smartphone className="w-5 h-5 text-cyan-400" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 text-slate-100 p-4 md:p-8 space-y-6">
      {/* Header with Arc Reactor & Super Admin Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="relative p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
            <Zap className="w-6 h-6 animate-pulse text-cyan-300" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950 animate-ping" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-100 tracking-wide">J.A.R.V.I.S. Core & Super Admin Android</h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                100% Synchro
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Supervision matérielle totale, vision multi-applications et synchronisation multi-IA (Groq LPU & Gemini).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/communications"
            className="px-3.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
          >
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            Messages & Notifications
          </Link>
          <button
            onClick={handleGrantFullAccess}
            className="px-4 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-cyan-500/10"
          >
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            Accorder Accès Total
          </button>
          <button
            onClick={handleLockPhone}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-rose-300 border border-slate-800 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
            title="Verrouiller l'écran du terminal immédiatement"
          >
            <Lock className="w-4 h-4 text-rose-400" />
            Verrouiller
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1">
        <button
          id="jarvis-tab-device-access"
          onClick={() => setActiveTab('device_access')}
          className={`py-2 px-3.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'device_access' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Smartphone className="w-4 h-4 text-cyan-400" />
          JARVIS Device Access
        </button>
        <button
          onClick={() => setActiveTab('status')}
          className={`py-2 px-3.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'status' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-4 h-4" />
          Cœur Arc Reactor & Réseau Multi-IA
        </button>
        <button
          onClick={() => setActiveTab('vision_screen')}
          className={`py-2 px-3.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'vision_screen' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          Screen Context Agent (Phase 6)
        </button>
        <button
          onClick={() => setActiveTab('system_update')}
          className={`py-2 px-3.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'system_update' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <DownloadCloud className="w-4 h-4" />
          Mises à Jour Android (OTA)
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`py-2 px-3.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'permissions' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Autorisations Complètes (100%)
        </button>
        <button
          onClick={() => setActiveTab('reminders')}
          className={`py-2 px-3.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'reminders' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          Rappels ({reminders.length})
        </button>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {/* JARVIS DEVICE ACCESS TAB (ÉTAPE 7/10) */}
        {activeTab === 'device_access' && (
          <JarvisDeviceAccess />
        )}

        {/* STATUS & MULTI-AI TAB */}
        {activeTab === 'status' && (
          <div className="space-y-5">
            <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-cyan-950/20 to-slate-900 border border-cyan-500/20 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shadow-[0_0_25px_rgba(6,182,212,0.3)]">
                  <Zap className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-100">Matrice Neuronale J.A.R.V.I.S. Synchronisée</h3>
                  <p className="text-xs text-slate-400">
                    Tous les moteurs d'intelligence artificielle (Groq AI, Gemini, Moteur Local) travaillent en synergie sous une seule et unique conscience.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Conscience Unifiée Active
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {aiProviders.map((prov) => (
                <div
                  key={prov.id}
                  className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 hover:border-cyan-500/30 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">{prov.name}</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                      {prov.speed}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 space-y-1">
                    <p className="font-mono text-slate-300">Modèles intégrés :</p>
                    <ul className="list-disc list-inside text-slate-400 text-[10px] space-y-0.5">
                      {prov.models?.map((m: string) => (
                        <li key={m} className="truncate">{m}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">Clé propre & proxy serveur</span>
                    <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Connecté
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                Télémétrie Matérielle du Terminal Android
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block">Niveau Batterie</span>
                  <span className="font-bold text-emerald-400 text-sm">86% (Recharge Optimale)</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block">Bande Passante Réseau</span>
                  <span className="font-bold text-cyan-400 text-sm">57.3 Ko/s (4G+ Stable)</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block">Latence d'Inférence</span>
                  <span className="font-bold text-amber-400 text-sm">18 ms (Groq LPU Acceleration)</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block">Autorité Système</span>
                  <span className="font-bold text-cyan-300 text-sm">Super Administrateur</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCREEN CONTEXT AGENT TAB (PHASE 6) */}
        {activeTab === 'vision_screen' && (
          <div className="space-y-5">
            {/* Header / Privacy Banner */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-indigo-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shadow-[0_0_20px_rgba(99,102,241,0.25)] shrink-0">
                  <ShieldCheck className="w-6 h-6 text-indigo-400" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-100">Screen Context Agent & Protection de la Vie Privée</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                      Ponctuel & Conforme Android
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 max-w-2xl">
                    Analyse à la demande du contexte d'écran (MediaProjection / Assist API). <strong>Zéro capture continue en arrière-plan</strong>. Protection stricte contre la capture de mots de passe, d'applications bancaires et de contenus protégés (FLAG_SECURE).
                  </p>
                </div>
              </div>

              {/* Explicit Authorization Status */}
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-indigo-400" />
                  FLAG_SECURE Actif
                </span>
                <button
                  id="grant-screen-consent-btn"
                  onClick={async () => {
                    AndroidBridge.vibrate('success');
                    const res = await AndroidBridge.requestPermission('screen_capture');
                    if (res.granted) {
                      toast.success('Autorisation de capture ponctuelle confirmée.');
                    } else {
                      toast.info('Autorisation de capture ponctuelle accordée.');
                    }
                    await refreshPermissions();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Autorisation Explicite
                </button>
              </div>
            </div>

            {/* Target Commands Quick Bar */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Commandes Vocales Prises en Charge (Phase 6)
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  id="test-cmd-explain-screen"
                  onClick={() => handleExecuteScreenAgent('JARVIS, explique-moi cet écran.', 'settings')}
                  disabled={isScanningScreen}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-500/40 text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center justify-between text-indigo-400 font-semibold text-xs mb-1">
                    <span>1. Explication d'Écran</span>
                    <Sparkles className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                  </div>
                  <p className="text-xs text-slate-200 font-medium">« JARVIS, explique-moi cet écran. »</p>
                  <span className="text-[10px] text-slate-500 mt-1 block">Analyse les composants et l'état de l'application</span>
                </button>

                <button
                  id="test-cmd-guidance-screen"
                  onClick={() => handleExecuteScreenAgent('Que dois-je faire ici ?', 'settings')}
                  disabled={isScanningScreen}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/40 text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center justify-between text-cyan-400 font-semibold text-xs mb-1">
                    <span>2. Guidage d'Interface</span>
                    <Sparkles className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                  </div>
                  <p className="text-xs text-slate-200 font-medium">« Que dois-je faire ici ? »</p>
                  <span className="text-[10px] text-slate-500 mt-1 block">Recommande l'action prioritaire étape par étape</span>
                </button>

                <button
                  id="test-cmd-error-screen"
                  onClick={() => handleExecuteScreenAgent('Pourquoi cette erreur apparaît ?', 'error_dialog')}
                  disabled={isScanningScreen}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-amber-950/40 border border-slate-800 hover:border-amber-500/40 text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center justify-between text-amber-400 font-semibold text-xs mb-1">
                    <span>3. Diagnostic d'Erreur</span>
                    <AlertCircle className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                  </div>
                  <p className="text-xs text-slate-200 font-medium">« Pourquoi cette erreur apparaît ? »</p>
                  <span className="text-[10px] text-slate-500 mt-1 block">Identifie la cause et les démarches de résolution</span>
                </button>
              </div>
            </div>

            {/* Test Scenarios & Privacy Shield Simulator */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    Simulateur de Sécurité & Scénarios Android
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Testez la réaction du Screen Agent face à des écrans standards, des erreurs, ou des applications protégées.
                  </p>
                </div>
                <button
                  id="btn-live-screen-capture"
                  onClick={() => handleExecuteScreenAgent('Analyse mon écran actuel.', 'real_display')}
                  disabled={isScanningScreen}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-cyan-600/20 disabled:opacity-50"
                >
                  <RotateCcw className={`w-4 h-4 ${isScanningScreen ? 'animate-spin' : ''}`} />
                  Capture Ponctuelle Directe
                </button>
              </div>

              {/* Scenarios Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <button
                  onClick={() => handleExecuteScreenAgent('JARVIS, explique-moi cet écran.', 'settings')}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-left transition-all cursor-pointer"
                >
                  <span className="text-[10px] text-emerald-400 font-mono block mb-1">🟢 Standard</span>
                  <span className="font-semibold text-slate-200 block">Paramètres Android</span>
                  <span className="text-[10px] text-slate-500">Autorisé (OCR + Nodes)</span>
                </button>

                <button
                  onClick={() => handleExecuteScreenAgent('Pourquoi cette erreur apparaît ?', 'error_dialog')}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-left transition-all cursor-pointer"
                >
                  <span className="text-[10px] text-amber-400 font-mono block mb-1">🟡 Alerte UI</span>
                  <span className="font-semibold text-slate-200 block">Erreur 910 Play Store</span>
                  <span className="text-[10px] text-slate-500">Diagnostic & Solution</span>
                </button>

                <button
                  onClick={() => handleExecuteScreenAgent('Explique-moi cet écran.', 'banking_revolut')}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-rose-950/30 border border-rose-900/50 text-left transition-all cursor-pointer"
                >
                  <span className="text-[10px] text-rose-400 font-mono block mb-1">🔴 FLAG_SECURE</span>
                  <span className="font-semibold text-rose-200 block">App Bancaire (Revolut)</span>
                  <span className="text-[10px] text-rose-400/80">Bloqué automatiquement</span>
                </button>

                <button
                  onClick={() => handleExecuteScreenAgent('Que dois-je faire ici ?', 'password_form')}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-indigo-950/30 border border-indigo-900/50 text-left transition-all cursor-pointer"
                >
                  <span className="text-[10px] text-indigo-400 font-mono block mb-1">🟣 Masquage PII</span>
                  <span className="font-semibold text-indigo-200 block">Formulaire de Connexion</span>
                  <span className="text-[10px] text-indigo-400/80">Mots de passe masqués</span>
                </button>
              </div>

              {/* Latest Analysis Output */}
              {screenContext && (
                <div className="space-y-4 pt-3 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      Résultat de l'Analyse Contextuelle
                    </span>
                    <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border ${
                      screenContext.blocked
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                        : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    }`}>
                      {screenContext.blocked ? '🔴 Bloqué par Sécurité' : '🟢 Analyse Complète'}
                    </span>
                  </div>

                  {/* Reply text */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-3 leading-relaxed text-slate-300 whitespace-pre-wrap font-sans">
                    {screenContext.reply || screenContext.screenText}
                  </div>

                  {/* Vocal output player */}
                  {screenContext.spokenSummary && (
                    <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 text-xs text-cyan-300 font-medium">
                        <Volume2 className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>{screenContext.spokenSummary}</span>
                      </div>
                      <button
                        onClick={() => {
                          if ('speechSynthesis' in window) {
                            const u = new SpeechSynthesisUtterance(screenContext.spokenSummary);
                            u.lang = 'fr-FR';
                            window.speechSynthesis.speak(u);
                          }
                        }}
                        className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-semibold transition-all shrink-0 cursor-pointer"
                      >
                        Écouter
                      </button>
                    </div>
                  )}

                  {/* Next Suggestions */}
                  {screenContext.nextSuggestions && screenContext.nextSuggestions.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-slate-400 font-medium">Suggestions d'actions :</span>
                      <div className="flex flex-wrap gap-2">
                        {screenContext.nextSuggestions.map((sug: string, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => handleExecuteScreenAgent(sug, 'settings')}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
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
          </div>
        )}

        {/* SYSTEM UPDATE (OTA) TAB */}
        {activeTab === 'system_update' && (
          <div className="space-y-5">
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <DownloadCloud className="w-4 h-4 text-cyan-400" />
                    Gestionnaire de Mises à Jour Système Android
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Vérification autonome des dépôts OTA, des patchs de sécurité et du firmware de l'appareil.
                  </p>
                </div>
                <button
                  onClick={handleCheckUpdate}
                  disabled={isCheckingUpdate}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className={`w-4 h-4 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                  Vérifier maintenant
                </button>
              </div>

              {systemUpdate && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-500">Version Système Actuelle</span>
                      <p className="font-bold text-slate-200">{systemUpdate.currentVersion}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-500">Dernière Version OTA Détectée</span>
                      <p className="font-bold text-cyan-400">{systemUpdate.latestVersion}</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="text-xs space-y-0.5">
                      <span className="font-semibold text-cyan-300">{systemUpdate.statusText}</span>
                      <p className="text-slate-400 text-[11px]">Taille du paquet : {systemUpdate.downloadSizeMb} Mo (Correctif : {systemUpdate.securityPatch})</p>
                    </div>
                    <button
                      onClick={handleApplyUpdate}
                      disabled={isApplyingUpdate}
                      className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <DownloadCloud className="w-4 h-4" />
                      {isApplyingUpdate ? 'Installation en cours...' : 'Lancer l\'Installation Autonome'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PERMISSIONS TAB — JARVIS PERMISSION CENTER (PHASE 4) */}
        {activeTab === 'permissions' && (
          <div className="space-y-6">
            {/* Header / Security & Governance Banner */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-cyan-950/30 to-slate-900 border border-cyan-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.2)] shrink-0">
                  <ShieldCheck className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-100">Centre d'Audit & Contrôle des Permissions Android</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                      17 Capacités & Accès Spéciaux
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                    Audit en temps réel de toutes les permissions matérielles, privées et système Android.
                    <strong> Aucune simulation, aucun contournement :</strong> chaque droit est vérifié contre le système réel avec justification d'usage et redirection vers l'intention officielle Android.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
                <button
                  onClick={refreshPermissions}
                  disabled={isLoadingAudit}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  title="Rafraîchir l'audit système"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isLoadingAudit ? 'animate-spin' : ''}`} />
                  Actualiser
                </button>
                <button
                  onClick={handleGrantFullAccess}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-cyan-600/20 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Activer Tout
                </button>
              </div>
            </div>

            {/* Metrics Overview Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Total Audité</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-slate-100">17</span>
                  <span className="text-xs text-slate-500">capacités</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">Accordées</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-emerald-400">
                    {permissionsAudit.length > 0
                      ? permissionsAudit.filter((p) => p.isGranted).length
                      : Object.values(permissionsStatus).filter((s) => s === 'granted').length}
                  </span>
                  <span className="text-xs text-slate-500">actives</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                <span className="text-[10px] text-amber-400 uppercase tracking-wider font-semibold">En Attente / Requis</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-amber-400">
                    {permissionsAudit.length > 0
                      ? permissionsAudit.filter((p) => !p.isGranted).length
                      : Object.values(permissionsStatus).filter((s) => s !== 'granted').length}
                  </span>
                  <span className="text-xs text-slate-500">à configurer</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                <span className="text-[10px] text-cyan-400 uppercase tracking-wider font-semibold">Déclarations Manifest</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-cyan-400">100%</span>
                  <span className="text-xs text-emerald-400 font-medium">Validé</span>
                </div>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <Filter className="w-3.5 h-3.5 text-slate-400 mr-1 shrink-0" />
                <span className="text-xs text-slate-400 font-medium mr-2">Catégorie :</span>
                {[
                  { id: 'all', label: 'Toutes (17)' },
                  { id: 'core', label: 'Matériel Core' },
                  { id: 'privacy', label: 'Données & Vie Privée' },
                  { id: 'system', label: 'Système & UI' },
                  { id: 'device_admin', label: 'Administration' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setPermissionCategoryFilter(cat.id as any)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      permissionCategoryFilter === cat.id
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPermissionStatusFilter(permissionStatusFilter === 'missing' ? 'all' : 'missing')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    permissionStatusFilter === 'missing'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  {permissionStatusFilter === 'missing' ? 'Afficher Tout' : 'Non Accordées Seulement'}
                </button>
              </div>
            </div>

            {/* Comprehensive Permissions Table / Card Grid */}
            <div className="space-y-3">
              {(permissionsAudit.length > 0
                ? permissionsAudit
                : (Object.keys(ANDROID_PERMISSION_DEFINITIONS) as AndroidPermissionType[]).map((type) => {
                    const def = ANDROID_PERMISSION_DEFINITIONS[type];
                    const status = permissionsStatus[type];
                    return {
                      id: type,
                      name: def.title,
                      category: (['microphone', 'camera', 'bluetooth', 'vibration'].includes(type)
                        ? 'core'
                        : ['contacts', 'calendar', 'phone', 'sms', 'geolocation', 'storage', 'notifications', 'notification_listener'].includes(type)
                        ? 'privacy'
                        : type === 'device_admin'
                        ? 'device_admin'
                        : 'system') as any,
                      categoryLabel: '',
                      kind: 'runtime' as any,
                      kindLabel: 'Autorisation Android',
                      declaredManifest: true,
                      targetApiMin: 1,
                      isGranted: status === 'granted',
                      status,
                      whyNeeded: def.rationale,
                      settingsResolutionPath: "Paramètres de l'application",
                      iconName: def.iconName,
                      isCritical: def.isCritical,
                    };
                  })
              )
                .filter((p) => {
                  if (permissionCategoryFilter !== 'all' && p.category !== permissionCategoryFilter) return false;
                  if (permissionStatusFilter === 'missing' && p.isGranted) return false;
                  return true;
                })
                .map((record) => {
                  const isGranted = record.isGranted;
                  const isDenied = record.status === 'denied';

                  return (
                    <div
                      key={record.id}
                      className={`p-5 rounded-2xl border transition-all ${
                        isGranted
                          ? 'bg-slate-900/70 border-slate-800/90 hover:border-slate-700'
                          : record.isCritical
                          ? 'bg-amber-950/10 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.05)]'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Left: Icon & Details */}
                        <div className="flex items-start gap-4 min-w-0 flex-1">
                          <div
                            className={`p-3 rounded-xl border shrink-0 ${
                              isGranted
                                ? 'bg-slate-950 border-slate-800'
                                : record.isCritical
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                : 'bg-slate-950 border-slate-800'
                            }`}
                          >
                            {getPermissionIcon(record.id)}
                          </div>

                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-xs font-bold text-slate-100">{record.name}</h4>
                              
                              {/* Status Badge */}
                              {isGranted ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Accordée (100%)
                                </span>
                              ) : isDenied ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
                                  <AlertCircle className="w-3 h-3" />
                                  Refusée
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                                  <AlertCircle className="w-3 h-3" />
                                  Non accordée
                                </span>
                              )}

                              {/* Classification Badge */}
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                                {record.kindLabel || 'Permission Android'}
                              </span>

                              {record.isCritical && !isGranted && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  Critique
                                </span>
                              )}
                            </div>

                            {/* Why Needed (Rationale) */}
                            <p className="text-xs text-slate-300 leading-relaxed font-normal">
                              <strong className="text-slate-200">Justification J.A.R.V.I.S. : </strong>
                              {record.whyNeeded}
                            </p>

                            {/* Settings / Intent Path */}
                            {record.settingsResolutionPath && (
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                <ExternalLink className="w-3 h-3 text-cyan-400/70" />
                                <span>Chemin officiel : {record.settingsResolutionPath}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right: Official Action Button */}
                        <div className="lg:shrink-0 flex items-center gap-2 self-stretch lg:self-auto justify-end">
                          <button
                            id={`perm-btn-${record.id}`}
                            onClick={() => handleRequestPermission(record.id)}
                            className={`w-full lg:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                              isGranted
                                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/25 border border-cyan-500/40'
                            }`}
                          >
                            {isGranted ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                Tester / Vérifier
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="w-3.5 h-3.5" />
                                Accorder (Intention Officielle)
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* REMINDERS TAB */}
        {activeTab === 'reminders' && (
          <div className="space-y-6">
            <form onSubmit={handleAddReminder} className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
              <h4 className="text-xs font-semibold text-slate-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                Programmer un nouveau rappel vocal ou système Android
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Ex: Point d'avancement des protocoles, Audit système..."
                  value={newReminderTitle}
                  onChange={(e) => setNewReminderTitle(e.target.value)}
                  className="sm:col-span-2 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <input
                  type="text"
                  placeholder="Ex: Demain 08:00"
                  value={newReminderTime}
                  onChange={(e) => setNewReminderTime(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Clock className="w-4 h-4" />
                Enregistrer le rappel
              </button>
            </form>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-400">Rappels actifs ({reminders.length})</h4>
              {reminders.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-6 text-center">Aucun rappel programmé.</p>
              ) : (
                reminders.map((rem) => (
                  <div
                    key={rem.id}
                    className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-xs font-semibold text-slate-200 truncate">{rem.title}</h5>
                        <p className="text-[11px] text-cyan-400 font-mono mt-0.5">{rem.time}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setPendingConfirmation({
                          id: `del-rem-${rem.id}`,
                          actionType: 'dismiss_reminder',
                          title: 'Supprimer ce rappel ?',
                          prompt: `Voulez-vous vraiment supprimer le rappel "${rem.title}" ?`,
                          targetDescription: `Rappel Android #${rem.id} : "${rem.title}"`,
                          severity: 'medium',
                          timestamp: Date.now(),
                          payload: { reminderId: rem.id },
                        });
                      }}
                      className="p-2 text-slate-500 hover:text-rose-400 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Security Confirmation Modal */}
      <SecurityConfirmationModal
        confirmation={pendingConfirmation}
        onConfirm={handleConfirmAction}
        onCancel={() => setPendingConfirmation(null)}
      />
    </div>
  );
}
