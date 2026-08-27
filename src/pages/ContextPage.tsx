import React, { useState, useEffect, useCallback } from 'react';
import {
  Compass,
  Battery,
  BatteryCharging,
  Wifi,
  WifiOff,
  MapPin,
  Clock,
  Smartphone,
  Bell,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Play,
  Volume2,
  ShieldCheck,
  Send,
  Zap,
  Globe,
  Radio,
  SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';

interface ContextFreshness {
  cached: boolean;
  cacheAgeMs: number;
  batteryOptimized: boolean;
  ttlMs: number;
  generatedAt: number;
}

interface ContextSnapshot {
  id: string;
  timestamp: number;
  isoDate: string;
  freshness: ContextFreshness;
  time: {
    timeFormatted: string;
    dateFormatted: string;
    dayOfWeek: string;
    periodOfDay: string;
    isWeekend: boolean;
    timezone: string;
  };
  device: {
    batteryLevel: number;
    isCharging: boolean;
    powerSaveMode: boolean;
    temperatureC?: number;
    network: {
      type: string;
      ssid?: string;
      isMetered: boolean;
      isOnline: boolean;
      signalStrengthPct: number;
    };
    screen: {
      isScreenOn: boolean;
      brightnessPct: number;
      orientation: string;
    };
    audio: {
      ringerMode: string;
      mediaVolumePct: number;
      bluetoothAudioConnected: boolean;
    };
  };
  location: {
    permissionGranted: boolean;
    latitude?: number;
    longitude?: number;
    accuracyMeters?: number;
    city?: string;
    locality?: string;
    country?: string;
    source: string;
  };
  activeApp: {
    permissionGranted: boolean;
    packageName?: string;
    appName?: string;
    category?: string;
    foregroundDurationSec?: number;
  };
  notifications: {
    permissionGranted: boolean;
    unreadCount: number;
    urgentCount: number;
    recentNotifications: Array<{
      id: string;
      appName: string;
      title: string;
      snippet: string;
      isUrgent?: boolean;
    }>;
  };
  agenda: {
    todayEventsCount: number;
    todayEvents: Array<{
      id: string;
      title: string;
      time: string;
      location?: string;
      calendarName: string;
    }>;
    pendingTasksCount: number;
    urgentTasksCount: number;
    topTasks: Array<{
      id: string;
      title: string;
      priority: string;
      dueTime?: string;
      category: string;
    }>;
    holisticDailyBriefing: string;
  };
  routines: {
    activeRoutineName?: string;
    availableRoutinesCount: number;
  };
  summary: string;
  spokenSummary: string;
  systemPromptFragment: string;
}

interface ContextProviderItem {
  source: string;
  name: string;
  description: string;
  requiredPermission?: string;
  isEnabled: boolean;
  hasPermission: boolean;
}

export function ContextPage() {
  const [snapshot, setSnapshot] = useState<ContextSnapshot | null>(null);
  const [providers, setProviders] = useState<ContextProviderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'simulation' | 'playground' | 'providers'>('overview');

  // Interactive query testing playground
  const [testQuery, setTestQuery] = useState("Qu'est-ce que j'ai aujourd'hui ?");
  const [synthesisResult, setSynthesisResult] = useState<any>(null);
  const [synthesizing, setSynthesizing] = useState(false);

  // Simulation form states
  const [simBattery, setSimBattery] = useState(84);
  const [simCharging, setSimCharging] = useState(false);
  const [simNetworkType, setSimNetworkType] = useState('wifi');
  const [simSsid, setSimSsid] = useState('JARVIS-Home-5G');
  const [simCity, setSimCity] = useState('Paris');
  const [simApp, setSimApp] = useState('com.whatsapp');
  const [simAppName, setSimAppName] = useState('WhatsApp');
  const [simNotifTitle, setSimNotifTitle] = useState('Message Urgent');
  const [simNotifSnippet, setSimNotifSnippet] = useState('Validation urgente du projet');
  const [simNotifUrgent, setSimNotifUrgent] = useState(false);

  const fetchContextData = useCallback(async (force: boolean = false) => {
    try {
      setLoading(true);
      const [snapRes, provRes] = await Promise.all([
        fetch(`/api/context/snapshot${force ? '?force=true' : ''}`),
        fetch('/api/context/providers'),
      ]);

      if (snapRes.ok) {
        const data = await snapRes.json();
        if (data.success && data.snapshot) {
          setSnapshot(data.snapshot);
          setSimBattery(data.snapshot.device.batteryLevel);
          setSimCharging(data.snapshot.device.isCharging);
          setSimNetworkType(data.snapshot.device.network.type);
          if (data.snapshot.location.city) setSimCity(data.snapshot.location.city);
        }
      }

      if (provRes.ok) {
        const provData = await provRes.json();
        if (provData.success) {
          setProviders(provData.providers || []);
        }
      }
    } catch (e) {
      console.error('Failed to fetch context state', e);
      toast.error('Erreur lors de la récupération du contexte');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContextData();
    const interval = setInterval(() => fetchContextData(false), 15000);
    return () => clearInterval(interval);
  }, [fetchContextData]);

  const handleToggleProvider = async (source: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/context/providers/${source}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentStatus }),
      });
      if (res.ok) {
        toast.success(`Fournisseur ${source} ${!currentStatus ? 'activé' : 'désactivé'}`);
        fetchContextData(true);
      }
    } catch (e) {
      toast.error('Erreur de mise à jour');
    }
  };

  const handleApplyDeviceSim = async () => {
    try {
      const res = await fetch('/api/context/device/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batteryLevel: simBattery,
          isCharging: simCharging,
          network: {
            type: simNetworkType,
            ssid: simNetworkType === 'wifi' ? simSsid : undefined,
            isMetered: simNetworkType.startsWith('cellular'),
            isOnline: simNetworkType !== 'offline',
            signalStrengthPct: simNetworkType === 'offline' ? 0 : 88,
          },
        }),
      });
      if (res.ok) {
        toast.success('Simulation matérielle appliquée');
        fetchContextData(true);
      }
    } catch (e) {
      toast.error('Erreur de simulation');
    }
  };

  const handleApplyLocationSim = async () => {
    try {
      const res = await fetch('/api/context/location/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: simCity,
          locality: `${simCity} Centre`,
          country: 'France',
          source: 'simulated',
        }),
      });
      if (res.ok) {
        toast.success(`Position simulée : ${simCity}`);
        fetchContextData(true);
      }
    } catch (e) {
      toast.error('Erreur de simulation');
    }
  };

  const handleApplyAppSim = async () => {
    try {
      const res = await fetch('/api/context/app/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageName: simApp,
          appName: simAppName,
          category: 'communication',
        }),
      });
      if (res.ok) {
        toast.success(`Application simulée : ${simAppName}`);
        fetchContextData(true);
      }
    } catch (e) {
      toast.error('Erreur de simulation');
    }
  };

  const handleInjectNotification = async () => {
    try {
      const res = await fetch('/api/context/notifications/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appName: 'Android Notif',
          packageName: 'com.android.system',
          title: simNotifTitle,
          snippet: simNotifSnippet,
          isUrgent: simNotifUrgent,
        }),
      });
      if (res.ok) {
        toast.success('Notification injectée dans le contexte');
        fetchContextData(true);
      }
    } catch (e) {
      toast.error('Erreur lors de l\'injection');
    }
  };

  const handleTestSynthesis = async (queryToRun?: string) => {
    const q = queryToRun || testQuery;
    try {
      setSynthesizing(true);
      const res = await fetch('/api/context/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      if (res.ok) {
        const data = await res.json();
        setSynthesisResult(data.result);
      }
    } catch (e) {
      toast.error('Erreur lors de la synthèse contextuelle');
    } finally {
      setSynthesizing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] overflow-y-auto">
      {/* Header Bar */}
      <div className="p-6 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Context Awareness Engine</h1>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Conscience contextuelle active (Heure, Batterie, Réseau, Localisation, Appli, Agenda)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchContextData(true)}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm font-medium transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser Snapshot
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50 px-6 gap-2">
        {[
          { id: 'overview', label: 'Vue Globale', icon: Layers },
          { id: 'playground', label: 'Testeur d’Intentions', icon: Sparkles },
          { id: 'simulation', label: 'Simulateur Matériel & Capteurs', icon: Sliders },
          { id: 'providers', label: 'Fournisseurs & Permissions', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                isActive
                  ? 'border-blue-500 text-blue-500 bg-blue-500/5'
                  : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="p-6 space-y-6 max-w-7xl w-full mx-auto">
        {activeTab === 'overview' && snapshot && (
          <div className="space-y-6">
            {/* Freshness Banner */}
            <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${snapshot.freshness.cached ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`} />
                <span className="text-sm font-medium">
                  {snapshot.freshness.cached ? `Données en cache (${Math.round(snapshot.freshness.cacheAgeMs / 1000)}s)` : 'Snapshot temps réel frais'}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                  TTL: {snapshot.freshness.ttlMs / 1000}s
                </span>
                {snapshot.freshness.batteryOptimized && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    Mode Économie de Batterie Actif (Throttling)
                  </span>
                )}
              </div>
              <span className="text-xs text-[var(--color-text-secondary)] font-mono">
                ID: {snapshot.id}
              </span>
            </div>

            {/* Core Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Time & Date */}
              <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Horloge & Date</span>
                  <Clock className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{snapshot.time.timeFormatted}</div>
                  <div className="text-sm text-[var(--color-text-secondary)]">{snapshot.time.dateFormatted}</div>
                </div>
                <div className="text-xs px-2 py-1 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] w-fit">
                  Période : {snapshot.time.periodOfDay} ({snapshot.time.timezone})
                </div>
              </div>

              {/* Card 2: Device & Battery */}
              <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Batterie & Énergie</span>
                  {snapshot.device.isCharging ? (
                    <BatteryCharging className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Battery className="w-4 h-4 text-blue-500" />
                  )}
                </div>
                <div>
                  <div className="text-2xl font-bold flex items-center gap-2">
                    {snapshot.device.batteryLevel}%
                    {snapshot.device.isCharging && <span className="text-xs font-normal text-emerald-500">En charge</span>}
                  </div>
                  <div className="text-sm text-[var(--color-text-secondary)]">
                    {snapshot.device.powerSaveMode ? 'Mode éco actif' : 'Alimentation standard'}
                  </div>
                </div>
                <div className="w-full bg-[var(--color-bg-tertiary)] rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full ${snapshot.device.batteryLevel > 20 ? 'bg-blue-500' : 'bg-red-500'}`}
                    style={{ width: `${snapshot.device.batteryLevel}%` }}
                  />
                </div>
              </div>

              {/* Card 3: Network & Connectivity */}
              <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Connectivité</span>
                  {snapshot.device.network.isOnline ? (
                    <Wifi className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-red-500" />
                  )}
                </div>
                <div>
                  <div className="text-2xl font-bold uppercase">{snapshot.device.network.type}</div>
                  <div className="text-sm text-[var(--color-text-secondary)]">
                    {snapshot.device.network.ssid || (snapshot.device.network.isOnline ? 'Connecté' : 'Hors ligne')}
                  </div>
                </div>
                <div className="text-xs text-[var(--color-text-secondary)]">
                  Signal : {snapshot.device.network.signalStrengthPct}% {snapshot.device.network.isMetered ? '• Forfait mesuré' : ''}
                </div>
              </div>

              {/* Card 4: Location */}
              <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Position</span>
                  <MapPin className="w-4 h-4 text-purple-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {snapshot.location.permissionGranted ? (snapshot.location.city || 'Paris') : 'Masquée'}
                  </div>
                  <div className="text-sm text-[var(--color-text-secondary)]">
                    {snapshot.location.permissionGranted ? (snapshot.location.country || 'France') : 'Permission requise'}
                  </div>
                </div>
                <div className="text-xs px-2 py-1 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] w-fit">
                  {snapshot.location.permissionGranted ? `Source: ${snapshot.location.source}` : 'FINE_LOCATION refusée'}
                </div>
              </div>
            </div>

            {/* Secondary Details (Active App, Notifications, Agenda) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Active Android App */}
              <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-blue-500" />
                    Application en Premier Plan
                  </h3>
                </div>
                {snapshot.activeApp.permissionGranted ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1 border-b border-[var(--color-border)]/50">
                      <span className="text-[var(--color-text-secondary)]">Nom :</span>
                      <span className="font-medium">{snapshot.activeApp.appName || 'JARVIS Hub'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[var(--color-border)]/50">
                      <span className="text-[var(--color-text-secondary)]">Package :</span>
                      <span className="font-mono text-xs">{snapshot.activeApp.packageName || 'com.openjarvis'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[var(--color-border)]/50">
                      <span className="text-[var(--color-text-secondary)]">Durée au premier plan :</span>
                      <span>{snapshot.activeApp.foregroundDurationSec || 12}s</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Permission APPLICATION_LAUNCH ou accessibilité non accordée.
                  </p>
                )}
              </div>

              {/* Notifications */}
              <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-500" />
                    Notifications Récentes ({snapshot.notifications.unreadCount})
                  </h3>
                </div>
                <div className="space-y-2">
                  {snapshot.notifications.recentNotifications.length === 0 ? (
                    <p className="text-xs text-[var(--color-text-secondary)] italic">Aucune notification en attente.</p>
                  ) : (
                    snapshot.notifications.recentNotifications.map((n) => (
                      <div key={n.id} className="p-2.5 rounded-lg bg-[var(--color-bg-tertiary)] text-xs space-y-1">
                        <div className="flex justify-between font-semibold">
                          <span>{n.appName} — {n.title}</span>
                          {n.isUrgent && <span className="text-red-500 font-bold">URGENT</span>}
                        </div>
                        <p className="text-[var(--color-text-secondary)] line-clamp-1">{n.snippet}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Today's Agenda Brief */}
              <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-500" />
                    Programme & Tâches
                  </h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-[var(--color-border)]/50">
                    <span className="text-[var(--color-text-secondary)]">Événements aujourd'hui :</span>
                    <span className="font-medium">{snapshot.agenda.todayEventsCount}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--color-border)]/50">
                    <span className="text-[var(--color-text-secondary)]">Tâches en attente :</span>
                    <span className="font-medium">{snapshot.agenda.pendingTasksCount}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--color-border)]/50">
                    <span className="text-[var(--color-text-secondary)]">Tâches urgentes :</span>
                    <span className="text-amber-500 font-medium">{snapshot.agenda.urgentTasksCount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Spoken Summary & Prompt Injection Preview */}
            <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2 text-sm">
                  <Volume2 className="w-4 h-4 text-blue-500" />
                  Synthèse Vocale JARVIS
                </h3>
              </div>
              <p className="text-sm p-3 rounded-lg bg-[var(--color-bg-tertiary)] italic">
                "{snapshot.spokenSummary}"
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Intent Synthesis Playground */}
        {activeTab === 'playground' && (
          <div className="space-y-6">
            <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] space-y-4">
              <h2 className="text-lg font-bold">Banc d'Essai des Requêtes Contextuelles</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Testez la résolution directe des questions contextuelles avec les données réelles et vérifiées du moteur (Zéro hallucination).
              </p>

              {/* Preset Quick Chips */}
              <div className="flex flex-wrap gap-2">
                {[
                  "Qu'est-ce que j'ai aujourd'hui ?",
                  "Quelle est la météo ?",
                  "Niveau de batterie ?",
                  "Suis-je en wifi ?",
                  "Quelle heure est-il ?",
                  "Application active ?",
                ].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      setTestQuery(preset);
                      handleTestSynthesis(preset);
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] transition-colors cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Custom Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  placeholder="Tapez une question contextuelle..."
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => handleTestSynthesis()}
                  disabled={synthesizing || !testQuery.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  Analyser
                </button>
              </div>

              {/* Synthesis Output */}
              {synthesisResult && (
                <div className="mt-6 p-5 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)] space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                        Intention : {synthesisResult.intent}
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        Confiance : {Math.round(synthesisResult.confidence * 100)}%
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]">
                        Agent suggéré : {synthesisResult.suggestedAgentId}
                      </span>
                    </div>
                  </div>

                  {synthesisResult.reply && (
                    <div className="prose prose-sm dark:prose-invert max-w-none p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                      <div className="whitespace-pre-wrap">{synthesisResult.reply}</div>
                    </div>
                  )}

                  {synthesisResult.enrichedQuery && (
                    <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs text-purple-400">
                      <strong>Requête Enrichie (Grounding) :</strong> {synthesisResult.enrichedQuery}
                    </div>
                  )}

                  {synthesisResult.spokenSummary && (
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] italic">
                      <Volume2 className="w-3.5 h-3.5 text-blue-500" />
                      Vocal : "{synthesisResult.spokenSummary}"
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Hardware & Sensor Simulators */}
        {activeTab === 'simulation' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Simulator 1: Battery & Network */}
            <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] space-y-4">
              <h3 className="font-bold flex items-center gap-2">
                <Battery className="w-4 h-4 text-blue-500" />
                Simulation Batterie & Réseau
              </h3>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Niveau de Batterie</span>
                    <span className="font-bold">{simBattery}%</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={simBattery}
                    onChange={(e) => setSimBattery(Number(e.target.value))}
                    className="w-full cursor-pointer accent-blue-500"
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span>En charge rapide</span>
                  <input
                    type="checkbox"
                    checked={simCharging}
                    onChange={(e) => setSimCharging(e.target.checked)}
                    className="rounded accent-blue-500 w-4 h-4 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-xs text-[var(--color-text-secondary)] block mb-1">Type de Réseau</label>
                  <select
                    value={simNetworkType}
                    onChange={(e) => setSimNetworkType(e.target.value)}
                    className="w-full p-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-xs"
                  >
                    <option value="wifi">Wi-Fi (Haut débit)</option>
                    <option value="cellular_5g">Cellulaire 5G</option>
                    <option value="cellular_4g">Cellulaire 4G</option>
                    <option value="offline">Hors ligne (Déconnecté)</option>
                  </select>
                </div>

                {simNetworkType === 'wifi' && (
                  <div>
                    <label className="text-xs text-[var(--color-text-secondary)] block mb-1">Nom du SSID</label>
                    <input
                      type="text"
                      value={simSsid}
                      onChange={(e) => setSimSsid(e.target.value)}
                      className="w-full p-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-xs"
                    />
                  </div>
                )}

                <button
                  onClick={handleApplyDeviceSim}
                  className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors cursor-pointer"
                >
                  Appliquer la Simulation Matérielle
                </button>
              </div>
            </div>

            {/* Simulator 2: Location & App */}
            <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] space-y-4">
              <h3 className="font-bold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-purple-500" />
                Simulation Localisation & Application
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[var(--color-text-secondary)] block mb-1">Ville Actuelle</label>
                  <input
                    type="text"
                    value={simCity}
                    onChange={(e) => setSimCity(e.target.value)}
                    className="w-full p-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-xs"
                  />
                </div>
                <button
                  onClick={handleApplyLocationSim}
                  className="w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs transition-colors cursor-pointer"
                >
                  Mettre à Jour la Ville
                </button>

                <div className="pt-2 border-t border-[var(--color-border)]">
                  <label className="text-xs text-[var(--color-text-secondary)] block mb-1">Application en Premier Plan</label>
                  <select
                    value={simApp}
                    onChange={(e) => {
                      setSimApp(e.target.value);
                      const opt = e.target.options[e.target.selectedIndex];
                      setSimAppName(opt.text);
                    }}
                    className="w-full p-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-xs mb-2"
                  >
                    <option value="com.whatsapp">WhatsApp</option>
                    <option value="com.google.android.apps.maps">Google Maps</option>
                    <option value="com.google.android.youtube">YouTube</option>
                    <option value="com.spotify.music">Spotify</option>
                    <option value="com.openjarvis.assistant">JARVIS Control Hub</option>
                  </select>
                  <button
                    onClick={handleApplyAppSim}
                    className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors cursor-pointer"
                  >
                    Définir App Premier Plan
                  </button>
                </div>
              </div>
            </div>

            {/* Simulator 3: Push Notification Injector */}
            <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] space-y-4 md:col-span-2">
              <h3 className="font-bold flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500" />
                Injecter une Notification Simulée
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Titre de la notification"
                  value={simNotifTitle}
                  onChange={(e) => setSimNotifTitle(e.target.value)}
                  className="p-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-xs"
                />
                <input
                  type="text"
                  placeholder="Contenu / Message"
                  value={simNotifSnippet}
                  onChange={(e) => setSimNotifSnippet(e.target.value)}
                  className="p-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-xs"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simNotifUrgent}
                    onChange={(e) => setSimNotifUrgent(e.target.checked)}
                    className="rounded accent-amber-500 w-4 h-4 cursor-pointer"
                  />
                  Marquer comme urgente
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      await fetch('/api/context/notifications/simulate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ clear: true }),
                      });
                      toast.info('Notifications effacées');
                      fetchContextData(true);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] text-xs transition-colors cursor-pointer"
                  >
                    Effacer Tout
                  </button>
                  <button
                    onClick={handleInjectNotification}
                    className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs transition-colors cursor-pointer"
                  >
                    Injecter Notification
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Providers & Permissions */}
        {activeTab === 'providers' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <h2 className="text-sm font-bold">Gouvernance des Fournisseurs de Contexte</h2>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                Activez ou désactivez les capteurs individuels. La désactivation purge immédiatement le cache et coupe toute collecte.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {providers.map((p) => (
                <div
                  key={p.source}
                  className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex items-start justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{p.name}</span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]">
                        {p.source}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)]">{p.description}</p>
                    {p.requiredPermission && (
                      <div className="flex items-center gap-1.5 text-[11px] pt-1">
                        <span className="text-[var(--color-text-secondary)]">Permission requise :</span>
                        <span className={`font-mono ${p.hasPermission ? 'text-emerald-500 font-medium' : 'text-amber-500 font-medium'}`}>
                          {p.requiredPermission} ({p.hasPermission ? 'Accordée' : 'Non accordée'})
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleToggleProvider(p.source, p.isEnabled)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      p.isEnabled
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20'
                        : 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20'
                    }`}
                  >
                    {p.isEnabled ? 'Activé' : 'Désactivé'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
