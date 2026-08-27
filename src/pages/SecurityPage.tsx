import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Lock,
  Unlock,
  AlertTriangle,
  Flame,
  Power,
  EyeOff,
  Eye,
  Key,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  Download,
  Fingerprint,
  Cpu,
  FileCode,
  Smartphone,
  Info,
  Check,
  Ban,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

interface SecurityStatus {
  privateModeActive: boolean;
  emergencyStopActive: boolean;
  emergencyStopTimestamp?: number;
  emergencyStopReason?: string;
  killswitches?: {
    screenAccessDisabled: boolean;
    microphoneDisabled: boolean;
    automationDisabled: boolean;
    communicationAgentDisabled: boolean;
  };
  totalAuditLogs: number;
  pendingConfirmationsCount: number;
  activePermissionsCount: number;
  revokedPermissionsCount: number;
  disabledAgents: string[];
  apkSecurityCompliance: {
    noEmbeddedApiKeys: boolean;
    runtimeKeyIsolation: boolean;
    secureStorageType: string;
    antiTamperEnforced: boolean;
  };
  policyVersion: string;
}

interface AgentAssignment {
  agentId: string;
  grantedPermissions: string[];
  revokedPermissions: string[];
  isAgentDisabled: boolean;
  lastUpdated: string;
}

interface ConfirmationRequest {
  token: string;
  actionId: string;
  actionName: string;
  level: number;
  agentId: string;
  description: string;
  riskDetails: string;
  payloadSummary: Record<string, any>;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  requiresBiometrics: boolean;
}

interface AuditLog {
  id: string;
  timestamp: number;
  isoDate: string;
  level: number;
  levelName: string;
  agentId: string;
  actionName: string;
  category: string;
  target?: string;
  status: 'approved' | 'denied' | 'executed' | 'blocked' | 'emergency_stopped' | 'failed';
  justification: string;
  redactedPayload?: Record<string, any>;
  confirmationTokenUsed?: string;
  integrityHash: string;
}

export function SecurityPage() {
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [assignments, setAssignments] = useState<AgentAssignment[]>([]);
  const [permissionDefs, setPermissionDefs] = useState<Record<string, any>>({});
  const [pendingConfirmations, setPendingConfirmations] = useState<ConfirmationRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search
  const [logFilterLevel, setLogFilterLevel] = useState<string>('all');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');

  // Interactive Classifier Tester
  const [testActionQuery, setTestActionQuery] = useState('Payer une facture de 45€');
  const [testClassification, setTestClassification] = useState<any>(null);
  const [classifying, setClassifying] = useState(false);

  const fetchSecurityData = async () => {
    try {
      setLoading(true);
      const [statusRes, permsRes, confRes, logsRes] = await Promise.all([
        fetch('/api/security/status').then((r) => r.json()),
        fetch('/api/security/permissions').then((r) => r.json()),
        fetch('/api/security/confirmations/pending').then((r) => r.json()),
        fetch('/api/security/audit-logs?limit=50').then((r) => r.json()),
      ]);

      if (statusRes.success) setStatus(statusRes.status);
      if (permsRes.success) {
        setAssignments(permsRes.assignments || []);
        setPermissionDefs(permsRes.permissionDefinitions || {});
      }
      if (confRes.success) setPendingConfirmations(confRes.pending || []);
      if (logsRes.success) setAuditLogs(logsRes.logs || []);
    } catch (e) {
      console.error('Error fetching security data', e);
      toast.error('Impossible de charger les données de sécurité');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
    const interval = setInterval(fetchSecurityData, 8000);
    return () => clearInterval(interval);
  }, []);

  // Emergency Stop Toggle
  const handleToggleEmergencyStop = async () => {
    try {
      if (status?.emergencyStopActive) {
        const res = await fetch('/api/security/emergency-stop/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authorizedBy: 'Utilisateur UI' }),
        }).then((r) => r.json());
        if (res.success) {
          toast.success('Arrêt d\'urgence désactivé. Reprise des opérations.');
          fetchSecurityData();
        }
      } else {
        const res = await fetch('/api/security/emergency-stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Arrêt d\'urgence manuel déclenché depuis la console' }),
        }).then((r) => r.json());
        if (res.success) {
          toast.error('🚨 ARRÊT D\'URGENCE ENCLENCHÉ ! Toutes les actions sont suspendues.');
          fetchSecurityData();
        }
      }
    } catch (e) {
      toast.error('Erreur lors du changement d\'état de l\'arrêt d\'urgence');
    }
  };

  // Private Mode Toggle
  const handleTogglePrivateMode = async () => {
    try {
      const res = await fetch('/api/security/private-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !status?.privateModeActive }),
      }).then((r) => r.json());
      if (res.success) {
        toast.info(res.message);
        fetchSecurityData();
      }
    } catch (e) {
      toast.error('Erreur lors du basculement du mode privé');
    }
  };

  // Agent Enable/Disable Toggle
  const handleToggleAgent = async (agentId: string, currentlyDisabled: boolean) => {
    try {
      const res = await fetch(`/api/security/agents/${agentId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled: !currentlyDisabled }),
      }).then((r) => r.json());
      if (res.success) {
        toast.success(`Agent ${agentId} ${!currentlyDisabled ? 'désactivé' : 'réactivé'}`);
        fetchSecurityData();
      }
    } catch (e) {
      toast.error('Erreur lors du changement d\'état de l\'agent');
    }
  };

  // Grant or Revoke Permission
  const handleTogglePermission = async (agentId: string, permKey: string, isGranted: boolean) => {
    try {
      const endpoint = isGranted ? '/api/security/permissions/revoke' : '/api/security/permissions/grant';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, permission: permKey }),
      }).then((r) => r.json());
      if (res.success) {
        toast.success(`Permission ${permKey} ${isGranted ? 'révoquée' : 'accordée'}`);
        fetchSecurityData();
      }
    } catch (e) {
      toast.error('Erreur lors de la modification des permissions');
    }
  };

  // Feature Killswitch Toggle
  const handleToggleKillswitch = async (switchKey: 'screen' | 'microphone' | 'automation' | 'communication') => {
    try {
      const endpoint = `/api/security/killswitches/${switchKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).then((r) => r.json());

      if (res.success) {
        toast.info(res.message || 'Commutateur de sécurité mis à jour.');
        fetchSecurityData();
      } else {
        toast.error(res.error || 'Erreur lors de la mise à jour');
      }
    } catch (e) {
      toast.error('Erreur réseau lors de la bascule du commutateur');
    }
  };

  // Revoke All for an Agent
  const handleRevokeAll = async (agentId: string) => {
    try {
      const res = await fetch('/api/security/permissions/revoke-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      }).then((r) => r.json());
      if (res.success) {
        toast.warning(`Toutes les permissions de ${agentId} ont été révoquées.`);
        fetchSecurityData();
      }
    } catch (e) {
      toast.error('Erreur lors de la révocation globale');
    }
  };

  // Confirmation Approve / Reject
  const handleApproveConfirmation = async (token: string) => {
    try {
      const res = await fetch('/api/security/confirmations/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, notes: 'Approuvé manuellement' }),
      }).then((r) => r.json());
      if (res.success) {
        toast.success('Action sensible autorisée avec succès');
        fetchSecurityData();
      }
    } catch (e) {
      toast.error('Erreur lors de la validation');
    }
  };

  const handleRejectConfirmation = async (token: string) => {
    try {
      const res = await fetch('/api/security/confirmations/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, reason: 'Refusé par l\'utilisateur' }),
      }).then((r) => r.json());
      if (res.success) {
        toast.info('Action rejetée et bloquée');
        fetchSecurityData();
      }
    } catch (e) {
      toast.error('Erreur lors du rejet');
    }
  };

  // Test Classifier
  const handleTestClassification = async () => {
    if (!testActionQuery.trim()) return;
    try {
      setClassifying(true);
      const res = await fetch('/api/security/classify-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionName: testActionQuery }),
      }).then((r) => r.json());
      if (res.success) {
        setTestClassification(res.classification);
      }
    } catch (e) {
      toast.error('Erreur lors du test de classification');
    } finally {
      setClassifying(false);
    }
  };

  // Clear Audit Logs
  const handleClearAuditLogs = async () => {
    if (!window.confirm('Voulez-vous vraiment réinitialiser le journal d\'audit local ?')) return;
    try {
      const res = await fetch('/api/security/audit-logs', { method: 'DELETE' }).then((r) => r.json());
      if (res.success) {
        toast.success(res.message);
        fetchSecurityData();
      }
    } catch (e) {
      toast.error('Erreur lors de la réinitialisation');
    }
  };

  // Export Audit Logs
  const handleExportAuditLogs = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(auditLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `jarvis-security-audit-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success('Journal d\'audit exporté avec succès.');
  };

  const getLevelBadgeClass = (level: number) => {
    switch (level) {
      case 0:
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      case 1:
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 2:
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 3:
        return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
      case 4:
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  const filteredLogs = auditLogs.filter((log) => {
    if (logFilterLevel !== 'all' && log.level !== parseInt(logFilterLevel, 10)) {
      return false;
    }
    if (logSearchQuery.trim()) {
      const q = logSearchQuery.toLowerCase();
      return (
        log.actionName.toLowerCase().includes(q) ||
        log.justification.toLowerCase().includes(q) ||
        log.agentId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Shield className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2 font-mono">
                JARVIS Security Agent & Governance
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-sans font-medium">
                  PHASE 13
                </span>
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Classification des actions (LEVEL 0 à 4), isolation zéro-fuite de clés dans l'APK, gestion des permissions et arrêt d'urgence.
              </p>
            </div>
          </div>
        </div>

        {/* TOP QUICK ACTIONS */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={fetchSecurityData}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>

          {/* EMERGENCY STOP MAIN BUTTON */}
          <button
            onClick={handleToggleEmergencyStop}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all shadow-lg cursor-pointer ${
              status?.emergencyStopActive
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/30 animate-bounce'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/30'
            }`}
          >
            <Power className="w-4 h-4" />
            {status?.emergencyStopActive ? 'DÉSACTIVER ARRÊT D\'URGENCE' : 'ARRÊT D\'URGENCE GLOBAL'}
          </button>
        </div>
      </div>

      {/* EMERGENCY STOP ACTIVE BANNER */}
      {status?.emergencyStopActive && (
        <div className="p-4 rounded-xl bg-rose-950/60 border-2 border-rose-600 text-rose-200 flex items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <Flame className="w-7 h-7 text-rose-400 animate-pulse" />
            <div>
              <div className="font-bold text-base text-rose-100 flex items-center gap-2 font-mono">
                🚨 ARRÊT D'URGENCE GLOBAL EN COURS D'EXÉCUTION
              </div>
              <p className="text-xs text-rose-300 mt-0.5">
                Toutes les actions LEVEL 1 à LEVEL 4 sont immédiatement bloquées. Seules les requêtes d'information pure (LEVEL 0) sont acceptées.
                {status.emergencyStopReason && ` Motif : "${status.emergencyStopReason}"`}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleEmergencyStop}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white shrink-0 shadow"
          >
            Reprendre les Opérations
          </button>
        </div>
      )}

      {/* SECURITY HUD 4 STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Private Mode */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Mode Privé</span>
            <div className={`p-2 rounded-lg ${status?.privateModeActive ? 'bg-cyan-500/10 text-cyan-400' : 'bg-slate-800 text-slate-500'}`}>
              {status?.privateModeActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-lg font-bold text-slate-100 font-mono">
              {status?.privateModeActive ? 'ACTIF' : 'INACTIF'}
            </span>
            <button
              onClick={handleTogglePrivateMode}
              className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                status?.privateModeActive
                  ? 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {status?.privateModeActive ? 'Désactiver' : 'Activer'}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            {status?.privateModeActive ? 'Télémétrie coupée, requêtes 100% locales' : 'Connectivité standard'}
          </p>
        </div>

        {/* Card 2: Critical Gating */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Actions Critiques (Level 4)</span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-lg font-bold text-rose-400 font-mono">VERROUILLÉES</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            0% exécution automatique • Jeton ou biométrie obligatoire
          </p>
        </div>

        {/* Card 3: APK Anti-Leak Verification */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Sécurité APK & Clés</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-lg font-bold text-emerald-400 font-mono">0 CLÉ DANS L'APK</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Stockage Android Keystore & variables sécurisées isolées
          </p>
        </div>

        {/* Card 4: Audit & Pending Confirmations */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Journal d'Audit Local</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Fingerprint className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-lg font-bold text-slate-100 font-mono">
              {status?.totalAuditLogs || 0} entrées
            </span>
            {pendingConfirmations.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30">
                {pendingConfirmations.length} en attente
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Empreinte SHA-256 anti-altération active
          </p>
        </div>
      </div>

      {/* KILLSWITCHES PANEL (PHASE 8 HARDENING) */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 font-mono flex items-center gap-2">
                Commutateurs de Coupure Rapide (Killswitches)
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-sans">
                  Isolation Immédiate
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Désactivez instantanément un sous-système sans désinstaller ni altérer le code ou les capacités du noyau JARVIS.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Switch 1: Screen Access */}
          <div className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
            status?.killswitches?.screenAccessDisabled
              ? 'bg-rose-950/20 border-rose-600/50'
              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">Accès à l'Écran</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
                status?.killswitches?.screenAccessDisabled
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}>
                {status?.killswitches?.screenAccessDisabled ? 'DÉSACTIVÉ' : 'OPÉRATIONNEL'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Capture d'écran, OCR & analyse de contexte visuel en direct.
            </p>
            <button
              onClick={() => handleToggleKillswitch('screen')}
              className={`w-full py-2 px-3 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                status?.killswitches?.screenAccessDisabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow'
                  : 'bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 border border-slate-700 hover:border-rose-700/50'
              }`}
            >
              {status?.killswitches?.screenAccessDisabled ? 'Réactiver l\'Écran' : 'Désactiver l\'Écran'}
            </button>
          </div>

          {/* Switch 2: Microphone */}
          <div className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
            status?.killswitches?.microphoneDisabled
              ? 'bg-rose-950/20 border-rose-600/50'
              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">Microphone & Voix</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
                status?.killswitches?.microphoneDisabled
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}>
                {status?.killswitches?.microphoneDisabled ? 'DÉSACTIVÉ' : 'OPÉRATIONNEL'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Flux audio, capture microphone et reconnaissance continue.
            </p>
            <button
              onClick={() => handleToggleKillswitch('microphone')}
              className={`w-full py-2 px-3 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                status?.killswitches?.microphoneDisabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow'
                  : 'bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 border border-slate-700 hover:border-rose-700/50'
              }`}
            >
              {status?.killswitches?.microphoneDisabled ? 'Réactiver le Micro' : 'Désactiver le Micro'}
            </button>
          </div>

          {/* Switch 3: Automation */}
          <div className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
            status?.killswitches?.automationDisabled
              ? 'bg-rose-950/20 border-rose-600/50'
              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">Automatisation</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
                status?.killswitches?.automationDisabled
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}>
                {status?.killswitches?.automationDisabled ? 'DÉSACTIVÉ' : 'OPÉRATIONNEL'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Routines automatiques, déclencheurs d'arrière-plan & cron.
            </p>
            <button
              onClick={() => handleToggleKillswitch('automation')}
              className={`w-full py-2 px-3 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                status?.killswitches?.automationDisabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow'
                  : 'bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 border border-slate-700 hover:border-rose-700/50'
              }`}
            >
              {status?.killswitches?.automationDisabled ? 'Réactiver Routines' : 'Désactiver Routines'}
            </button>
          </div>

          {/* Switch 4: Communication Agent */}
          <div className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
            status?.killswitches?.communicationAgentDisabled
              ? 'bg-rose-950/20 border-rose-600/50'
              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">Agent Communication</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
                status?.killswitches?.communicationAgentDisabled
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}>
                {status?.killswitches?.communicationAgentDisabled ? 'DÉSACTIVÉ' : 'OPÉRATIONNEL'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Appels téléphoniques directs, SMS et messagerie sortante.
            </p>
            <button
              onClick={() => handleToggleKillswitch('communication')}
              className={`w-full py-2 px-3 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                status?.killswitches?.communicationAgentDisabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow'
                  : 'bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 border border-slate-700 hover:border-rose-700/50'
              }`}
            >
              {status?.killswitches?.communicationAgentDisabled ? 'Réactiver Comm' : 'Désactiver Comm'}
            </button>
          </div>
        </div>
      </div>

      {/* PENDING CONFIRMATIONS (IF ANY) */}
      {pendingConfirmations.length > 0 && (
        <div className="p-5 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold text-amber-200 text-sm">
              Confirmations de Sécurité en Attente ({pendingConfirmations.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingConfirmations.map((conf) => (
              <div
                key={conf.token}
                className="p-3.5 rounded-lg bg-slate-900/90 border border-amber-500/30 flex flex-col justify-between space-y-2"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 font-mono">{conf.actionName}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-mono ${getLevelBadgeClass(conf.level)}`}>
                      {conf.level === 4 ? 'LEVEL 4 CRITICAL' : 'LEVEL 3 SENSITIVE'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">{conf.description}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Agent : <code className="text-cyan-300">{conf.agentId}</code> • Jeton : <code className="text-slate-400">{conf.token}</code>
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => handleRejectConfirmation(conf.token)}
                    className="px-3 py-1.5 text-xs font-medium rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-700/40"
                  >
                    Rejeter
                  </button>
                  <button
                    onClick={() => handleApproveConfirmation(conf.token)}
                    className="px-3 py-1.5 text-xs font-bold rounded bg-emerald-600 hover:bg-emerald-500 text-white shadow"
                  >
                    Valider & Exécuter
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5-LEVEL ACTION CLASSIFICATION & INTERACTIVE TESTER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Reference Matrix (7 cols) */}
        <div className="lg:col-span-7 p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-bold text-slate-100 font-mono">
                Échelle des 5 Niveaux de Sécurité JARVIS
              </h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">Policy v{status?.policyVersion || '1.3.0'}</span>
          </div>

          <div className="space-y-2.5">
            {/* Level 0 */}
            <div className="p-3 rounded-lg bg-slate-950/60 border border-cyan-500/20 flex items-start gap-3">
              <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shrink-0">
                LEVEL 0
              </span>
              <div className="text-xs">
                <div className="font-semibold text-slate-200">Information (Exécution Automatique Directe)</div>
                <div className="text-slate-400 mt-0.5">Exemples : Lire la météo, donner l'heure, diagnostics, aide.</div>
              </div>
            </div>

            {/* Level 1 */}
            <div className="p-3 rounded-lg bg-slate-950/60 border border-emerald-500/20 flex items-start gap-3">
              <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                LEVEL 1
              </span>
              <div className="text-xs">
                <div className="font-semibold text-slate-200">Safe (Exécution sans risque)</div>
                <div className="text-slate-400 mt-0.5">Exemples : Ouvrir une application, lire les notifications, changer de thème.</div>
              </div>
            </div>

            {/* Level 2 */}
            <div className="p-3 rounded-lg bg-slate-950/60 border border-amber-500/20 flex items-start gap-3">
              <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 shrink-0">
                LEVEL 2
              </span>
              <div className="text-xs">
                <div className="font-semibold text-slate-200">Important (Journalisation d'audit locale)</div>
                <div className="text-slate-400 mt-0.5">Exemples : Envoyer un message/SMS, créer un événement, régler une alarme.</div>
              </div>
            </div>

            {/* Level 3 */}
            <div className="p-3 rounded-lg bg-slate-950/60 border border-orange-500/20 flex items-start gap-3">
              <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-orange-500/10 text-orange-400 border border-orange-500/30 shrink-0">
                LEVEL 3
              </span>
              <div className="text-xs">
                <div className="font-semibold text-slate-200">Sensitive (Jeton de confirmation requis)</div>
                <div className="text-slate-400 mt-0.5">Exemples : Modifier un fichier, supprimer des notes, basculer réglages OS.</div>
              </div>
            </div>

            {/* Level 4 */}
            <div className="p-3 rounded-lg bg-slate-950/60 border border-rose-500/30 flex items-start gap-3 bg-rose-950/10">
              <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 shrink-0 animate-pulse">
                LEVEL 4
              </span>
              <div className="text-xs">
                <div className="font-semibold text-rose-200">Critical (Interdiction Formelle d'Exécution Auto)</div>
                <div className="text-slate-400 mt-0.5">Exemples : Paiements, virements, formatage, wipe data, mot de passe.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Classifier Tester (5 cols) */}
        <div className="lg:col-span-5 p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-bold text-slate-100 font-mono">
                Testeur de Classification d'Action
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Saisissez une action ou commande en langage naturel pour inspecter sa classification en temps réel.
            </p>

            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testActionQuery}
                  onChange={(e) => setTestActionQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTestClassification()}
                  placeholder="ex: modifier le fichier config.json"
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
                <button
                  onClick={handleTestClassification}
                  disabled={classifying}
                  className="px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  {classifying ? '...' : 'Évaluer'}
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-400">
                <span>Suggestions :</span>
                <button onClick={() => setTestActionQuery('Lire la météo')} className="underline hover:text-cyan-400">Météo (L0)</button>
                •
                <button onClick={() => setTestActionQuery('Ouvrir YouTube')} className="underline hover:text-emerald-400">Ouvrir app (L1)</button>
                •
                <button onClick={() => setTestActionQuery('Envoyer un SMS à Paul')} className="underline hover:text-amber-400">SMS (L2)</button>
                •
                <button onClick={() => setTestActionQuery('Supprimer le fichier secret')} className="underline hover:text-orange-400">Fichier (L3)</button>
                •
                <button onClick={() => setTestActionQuery('Payer 100€ par virement')} className="underline hover:text-rose-400">Paiement (L4)</button>
              </div>
            </div>
          </div>

          {testClassification && (
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-700 space-y-2 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">Résultat de la Politique :</span>
                <span className={`text-xs px-2 py-0.5 rounded font-mono font-bold border ${getLevelBadgeClass(testClassification.level)}`}>
                  {testClassification.levelName}
                </span>
              </div>
              <p className="text-xs text-slate-300">{testClassification.description}</p>
              <div className="text-[11px] text-slate-400 border-t border-slate-800 pt-1.5 flex justify-between">
                <span>Validation explicite : {testClassification.requiresExplicitConfirmation ? '⚠️ Oui' : '🟢 Non'}</span>
                <span>Permissions : {testClassification.requiredPermissions?.join(', ') || 'Aucune'}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AGENTS PERMISSIONS & GOVERNANCE MATRIX */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-slate-100 font-mono">
              Gouvernance des Agents & Matrice des Permissions
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            {assignments.length} agents répertoriés • {status?.disabledAgents?.length || 0} désactivé(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono">
                <th className="py-2.5 px-3">Agent</th>
                <th className="py-2.5 px-3">Statut</th>
                <th className="py-2.5 px-3">Permissions Actives</th>
                <th className="py-2.5 px-3">Permissions Révoquées</th>
                <th className="py-2.5 px-3 text-right">Actions de Sécurité</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {assignments.map((agent) => (
                <tr key={agent.agentId} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-3 font-mono font-semibold text-slate-200">
                    {agent.agentId}
                  </td>
                  <td className="py-3 px-3">
                    {agent.isAgentDisabled ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                        DÉSACTIVÉ
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        ACTIF
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap gap-1 max-w-md">
                      {agent.grantedPermissions.map((p) => (
                        <button
                          key={p}
                          onClick={() => handleTogglePermission(agent.agentId, p, true)}
                          title="Cliquer pour révoquer cette permission"
                          className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/40 hover:bg-rose-950/60 text-emerald-300 hover:text-rose-300 border border-emerald-700/40 hover:border-rose-700/40 transition-colors font-mono cursor-pointer"
                        >
                          ✓ {p}
                        </button>
                      ))}
                      {agent.grantedPermissions.length === 0 && (
                        <span className="text-slate-500 italic">Aucune</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {agent.revokedPermissions.map((p) => (
                        <button
                          key={p}
                          onClick={() => handleTogglePermission(agent.agentId, p, false)}
                          title="Cliquer pour restaurer cette permission"
                          className="px-1.5 py-0.5 rounded text-[10px] bg-rose-950/30 hover:bg-emerald-950/50 text-rose-400 hover:text-emerald-300 border border-rose-800/40 hover:border-emerald-700/40 transition-colors font-mono cursor-pointer"
                        >
                          ✕ {p}
                        </button>
                      ))}
                      {agent.revokedPermissions.length === 0 && (
                        <span className="text-slate-600 italic">0 révoquée</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                    <button
                      onClick={() => handleRevokeAll(agent.agentId)}
                      className="px-2 py-1 text-[11px] font-medium rounded bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 border border-slate-700 transition-colors"
                      title="Révoquer tous les droits"
                    >
                      Révoquer Tout
                    </button>
                    <button
                      onClick={() => handleToggleAgent(agent.agentId, agent.isAgentDisabled)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded border transition-colors ${
                        agent.isAgentDisabled
                          ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700 hover:bg-emerald-800/60'
                          : 'bg-rose-900/40 text-rose-300 border-rose-700 hover:bg-rose-800/60'
                      }`}
                    >
                      {agent.isAgentDisabled ? 'Activer Agent' : 'Désactiver'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECURE LOCAL AUDIT TRAIL */}
      <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-bold text-slate-100 font-mono">
                Journal d'Audit Local Sécurisé
              </h2>
              <p className="text-xs text-slate-400">
                Historique chiffré et masqué en temps réel. Clés secrètes et mots de passe purgés avant journalisation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportAuditLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Exporter JSON
            </button>
            <button
              onClick={handleClearAuditLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-950/40 hover:bg-rose-900 text-rose-300 border border-rose-800/40 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Purger
            </button>
          </div>
        </div>

        {/* LOG FILTERS */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={logSearchQuery}
              onChange={(e) => setLogSearchQuery(e.target.value)}
              placeholder="Filtrer par action, agent ou justification..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          <select
            value={logFilterLevel}
            onChange={(e) => setLogFilterLevel(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="all">Tous les Niveaux</option>
            <option value="0">LEVEL 0 (Information)</option>
            <option value="1">LEVEL 1 (Safe)</option>
            <option value="2">LEVEL 2 (Important)</option>
            <option value="3">LEVEL 3 (Sensitive)</option>
            <option value="4">LEVEL 4 (Critical)</option>
          </select>
        </div>

        {/* LOG ENTRIES LIST */}
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Aucune entrée d'audit ne correspond à vos critères de recherche.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:border-slate-700 transition-colors"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${getLevelBadgeClass(log.level)}`}>
                      L{log.level}
                    </span>
                    <span className="font-mono font-semibold text-slate-200">{log.actionName}</span>
                    <span className="text-slate-500">•</span>
                    <span className="font-mono text-cyan-400">{log.agentId}</span>
                    <span className="text-slate-500">•</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                        log.status === 'approved' || log.status === 'executed'
                          ? 'text-emerald-400'
                          : log.status === 'emergency_stopped' || log.status === 'blocked'
                          ? 'text-rose-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">{log.justification}</p>
                </div>

                <div className="text-right shrink-0 flex sm:flex-col items-center sm:items-end justify-between gap-1 text-[10px] text-slate-500 font-mono">
                  <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span className="text-slate-600" title={`Signature: ${log.integrityHash}`}>
                    {log.integrityHash.substring(0, 12)}...
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
