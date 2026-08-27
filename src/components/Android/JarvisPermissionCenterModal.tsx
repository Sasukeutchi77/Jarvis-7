import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Zap,
  Mic,
  Camera,
  Bell,
  MessageSquare,
  Users,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Bluetooth,
  FolderLock,
  Layers,
  Eye,
  Monitor,
  Bot,
  Activity,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  RefreshCw,
  Info,
  Check,
  Smartphone,
  Cpu,
  Power,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { AndroidBridge } from '../../lib/android-bridge';
import { AndroidPermissionType, AndroidPermissionStatus, AndroidPermissionAuditRecord } from '../../types';
import { apiFetch } from '../../lib/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function JarvisPermissionCenterModal({ isOpen, onClose }: Props) {
  const [auditList, setAuditList] = useState<AndroidPermissionAuditRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'critical' | 'granted' | 'missing'>('all');
  const [lastScanTime, setLastScanTime] = useState<number>(Date.now());

  const fetchAuditData = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/android/permissions/audit');
      if (res.ok) {
        const data = await res.json();
        setAuditList(data.audit || []);
      } else {
        // Fallback local check
        await refreshLocalPermissions();
      }
    } catch {
      await refreshLocalPermissions();
    } finally {
      setIsLoading(false);
    }
  };

  const refreshLocalPermissions = async () => {
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

    const fallbackAudit: AndroidPermissionAuditRecord[] = [];

    for (const t of types) {
      const status = await AndroidBridge.checkPermission(t);
      fallbackAudit.push({
        id: t,
        name: getPermissionTitle(t),
        category: getCategory(t),
        categoryLabel: getCategoryLabel(t),
        kind: getKind(t),
        kindLabel: getKindLabel(t),
        declaredManifest: true,
        targetApiMin: 1,
        isGranted: status === 'granted',
        status,
        whyNeeded: getWhyNeeded(t),
        officialIntentAction: getOfficialIntent(t),
        settingsResolutionPath: getResolutionPath(t),
        iconName: getIconName(t),
        isCritical: isPermissionCritical(t),
      });
    }

    setAuditList(fallbackAudit);
  };

  const handleScanDevice = async () => {
    setIsScanning(true);
    AndroidBridge.vibrate('medium');
    toast.info("Scan diagnostic complet de l'appareil en cours...");

    await fetchAuditData();
    setLastScanTime(Date.now());
    setIsScanning(false);
    AndroidBridge.vibrate('success');
    toast.success("Scan de l'appareil terminé.");
  };

  useEffect(() => {
    if (isOpen) {
      fetchAuditData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleActivate = async (item: AndroidPermissionAuditRecord) => {
    AndroidBridge.vibrate('light');
    toast.info(`Ouverture de la procédure officielle pour : ${item.name}`);

    const res = await AndroidBridge.requestPermission(item.id);
    if (res.granted) {
      toast.success(`Autorisation accordée pour "${item.name}".`);
      AndroidBridge.vibrate('success');
    } else {
      toast.warning(`Autorisation en attente de configuration utilisateur dans les paramètres Android.`);
    }

    // Refresh after return
    await fetchAuditData();
  };

  const grantedCount = auditList.filter((p) => p.status === 'granted').length;
  const criticalCount = auditList.filter((p) => p.isCritical).length;
  const criticalGrantedCount = auditList.filter((p) => p.isCritical && p.status === 'granted').length;
  const isFullyReady = criticalGrantedCount === criticalCount;

  const filteredList = auditList.filter((item) => {
    if (selectedFilter === 'critical') return item.isCritical;
    if (selectedFilter === 'granted') return item.status === 'granted';
    if (selectedFilter === 'missing') return item.status !== 'granted';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-cyan-500/30 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)]">
              <ShieldCheck className="w-6 h-6 text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">JARVIS Permission & Capability Center</h2>
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Android Deep Core
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Audit en temps réel des privilèges système et mécanismes d'activation officiels.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Readiness & Diagnostics Banner */}
        <div className="p-5 border-b border-slate-800/80 bg-slate-950/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3.5 rounded-2xl border flex items-center justify-center ${
              isFullyReady
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}>
              {isFullyReady ? <CheckCircle2 className="w-7 h-7" /> : <AlertCircle className="w-7 h-7" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold tracking-wide uppercase font-mono ${
                  isFullyReady ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {isFullyReady ? 'JARVIS READY — CONTRÔLE TOTAL ACTIF' : 'JARVIS PARTIALLY READY'}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ({grantedCount}/{auditList.length} permissions accordées)
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {isFullyReady
                  ? "Tous les privilèges critiques et services système sont opérationnels."
                  : `${criticalCount - criticalGrantedCount} autorisation(s) critique(s) manquante(s) pour exploiter le potentiel complet d'Android.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
            <button
              onClick={handleScanDevice}
              disabled={isScanning}
              className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/20 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scan en cours...' : 'SCAN DEVICE'}</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-800/60 bg-slate-900/50 text-xs overflow-x-auto">
          <span className="text-slate-400 font-medium mr-1 text-[11px]">Filtrer par :</span>
          {[
            { id: 'all', label: `Toutes (${auditList.length})` },
            { id: 'critical', label: `Critiques (${criticalCount})` },
            { id: 'missing', label: `Manquantes (${auditList.length - grantedCount})` },
            { id: 'granted', label: `Accordées (${grantedCount})` },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedFilter(f.id as any)}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                selectedFilter === f.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Permissions List */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1 divide-y divide-slate-800/40">
          {filteredList.map((item) => {
            const isGranted = item.status === 'granted';
            return (
              <div
                key={item.id}
                className="pt-3 first:pt-0 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-3.5 rounded-2xl hover:bg-slate-800/30 transition-colors border border-transparent hover:border-slate-800"
              >
                <div className="flex items-start gap-3.5 max-w-2xl">
                  <div className={`p-2.5 rounded-xl border mt-0.5 shrink-0 ${
                    isGranted
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  }`}>
                    {renderIcon(item.id)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-100">{item.name}</h4>
                      {item.isCritical && (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.2 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          Critique
                        </span>
                      )}
                      <span className="text-[10px] px-2 py-0.2 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                        {item.kindLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{item.whyNeeded}</p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      Chemin système : {item.settingsResolutionPath}
                    </p>
                  </div>
                </div>

                {/* Status Badge & Action Button */}
                <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto justify-end">
                  <span className={`text-[11px] font-mono font-semibold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                    isGranted
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}>
                    {isGranted ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    <span>{isGranted ? 'Accordé' : 'Non accordé'}</span>
                  </span>

                  {!isGranted && (
                    <button
                      onClick={() => handleActivate(item)}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-cyan-500/20 active:scale-95 cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Activer</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex flex-col md:flex-row items-center justify-between text-xs text-slate-400 gap-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Aucune permission simulée : tous les statuts reflètent les contrôles réels de l'OS Android.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function renderIcon(id: AndroidPermissionType) {
  switch (id) {
    case 'microphone':
      return <Mic className="w-4 h-4" />;
    case 'camera':
      return <Camera className="w-4 h-4" />;
    case 'notifications':
      return <Bell className="w-4 h-4" />;
    case 'notification_listener':
      return <MessageSquare className="w-4 h-4" />;
    case 'contacts':
      return <Users className="w-4 h-4" />;
    case 'calendar':
      return <Calendar className="w-4 h-4" />;
    case 'phone':
      return <Phone className="w-4 h-4" />;
    case 'sms':
      return <Mail className="w-4 h-4" />;
    case 'geolocation':
      return <MapPin className="w-4 h-4" />;
    case 'bluetooth':
      return <Bluetooth className="w-4 h-4" />;
    case 'storage':
      return <FolderLock className="w-4 h-4" />;
    case 'overlay':
      return <Layers className="w-4 h-4" />;
    case 'accessibility':
      return <Eye className="w-4 h-4" />;
    case 'screen_capture':
      return <Monitor className="w-4 h-4" />;
    case 'assistant':
      return <Bot className="w-4 h-4" />;
    case 'device_admin':
      return <ShieldAlert className="w-4 h-4" />;
    case 'vibration':
      return <Activity className="w-4 h-4" />;
    default:
      return <Smartphone className="w-4 h-4" />;
  }
}

function getPermissionTitle(id: AndroidPermissionType): string {
  const map: Record<AndroidPermissionType, string> = {
    microphone: 'Microphone & Écoute Vocale',
    camera: 'Caméra & Analyse Multimodale',
    notifications: 'Notifications Système (POST_NOTIFICATIONS)',
    notification_listener: 'Écoute des Notifications (NotificationListener)',
    contacts: 'Contacts & Carnet d\'Adresses',
    calendar: 'Calendrier & Agenda',
    phone: 'Téléphone & Appels Vocaux',
    sms: 'SMS & Messagerie Directe',
    geolocation: 'Localisation GPS Précise',
    bluetooth: 'Bluetooth & Objets Connectés',
    storage: 'Stockage & Fichiers Multimédia',
    overlay: 'Affichage Flottant (SYSTEM_ALERT_WINDOW)',
    accessibility: 'Service d\'Accessibilité & Navigation UI',
    screen_capture: 'Capture d\'Écran Ponctuelle (MediaProjection)',
    assistant: 'Assistant Vocal par Défaut (Assist Role)',
    device_admin: 'Super Administrateur de l\'Appareil',
    vibration: 'Retour Haptique & Vibrations',
  };
  return map[id] || id;
}

function getCategory(id: AndroidPermissionType): 'core' | 'privacy' | 'system' | 'device_admin' {
  if (['microphone', 'camera', 'bluetooth', 'vibration'].includes(id)) return 'core';
  if (['notifications', 'notification_listener', 'contacts', 'calendar', 'phone', 'sms', 'geolocation', 'storage'].includes(id)) return 'privacy';
  if (id === 'device_admin') return 'device_admin';
  return 'system';
}

function getCategoryLabel(id: AndroidPermissionType): string {
  const cat = getCategory(id);
  if (cat === 'core') return 'Matériel & Audio Core';
  if (cat === 'privacy') return 'Données Personnelles & Communications';
  if (cat === 'device_admin') return 'Supervision & Sécurité Matérielle';
  return 'Accès Spécial Système';
}

function getKind(id: AndroidPermissionType): 'runtime' | 'special_access' | 'service_binding' | 'device_admin_policy' {
  if (['accessibility', 'notification_listener'].includes(id)) return 'service_binding';
  if (['overlay', 'screen_capture', 'assistant'].includes(id)) return 'special_access';
  if (id === 'device_admin') return 'device_admin_policy';
  return 'runtime';
}

function getKindLabel(id: AndroidPermissionType): string {
  const k = getKind(id);
  if (k === 'runtime') return 'Permission Runtime';
  if (k === 'service_binding') return 'Service Lié Déclaré';
  if (k === 'special_access') return 'Accès Spécial Paramètres';
  return 'Politique Administrateur';
}

function getWhyNeeded(id: AndroidPermissionType): string {
  const map: Record<AndroidPermissionType, string> = {
    microphone: "Écoute des commandes vocales 'Hey Jarvis', dictée continue et transcription audio en temps réel.",
    camera: "Analyse OCR de documents, vision par ordinateur et détection d'objets ou d'écrans.",
    notifications: "Alertes de rappels programmés et notifications de fin de tâches autonomes.",
    notification_listener: "Détection des messages WhatsApp, SMS, Telegram et préparation de réponses rapides.",
    contacts: "Recherche instantanée de correspondants pour les appels vocaux et l'envoi de messages.",
    calendar: "Synchronisation de l'agenda, détection des conflits d'horaires et planification vocale.",
    phone: "Lancement direct d'appels téléphoniques après confirmation utilisateur explicite.",
    sms: "Envoi et lecture de SMS directement depuis JARVIS.",
    geolocation: "Météo locale certifiée, calculs d'itinéraires et recherche de points d'intérêt à proximité.",
    bluetooth: "Détection et contrôle des équipements audio, montres et périphériques Bluetooth.",
    storage: "Lecture et indexation des documents et images sélectionnés pour la base de connaissances.",
    overlay: "Affichage de la bulle interactive JARVIS par-dessus les autres applications.",
    accessibility: "Compréhension contextuelle de l'application active et navigation assistée légale.",
    screen_capture: "Capture visuelle ponctuelle après consentement explicite pour l'analyse multimodale.",
    assistant: "Déclenchement direct par le bouton Home ou d'alimentation de l'appareil Android.",
    device_admin: "Verrouillage de sécurité, contrôle des mises à jour OTA et politiques matérielles.",
    vibration: "Retour haptique physique lors de la prise en compte des commandes vocales.",
  };
  return map[id] || '';
}

function getOfficialIntent(id: AndroidPermissionType): string | null {
  const map: Partial<Record<AndroidPermissionType, string>> = {
    notifications: 'android.settings.APP_NOTIFICATION_SETTINGS',
    notification_listener: 'android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS',
    bluetooth: 'android.settings.BLUETOOTH_SETTINGS',
    overlay: 'android.settings.action.MANAGE_OVERLAY_PERMISSION',
    accessibility: 'android.settings.ACCESSIBILITY_SETTINGS',
    assistant: 'android.settings.VOICE_INPUT_SETTINGS',
    device_admin: 'android.app.action.ADD_DEVICE_ADMIN',
  };
  return map[id] || null;
}

function getResolutionPath(id: AndroidPermissionType): string {
  const map: Record<AndroidPermissionType, string> = {
    microphone: "Demande runtime ActivityCompat.requestPermissions / Paramètres > Applications",
    camera: "Demande runtime ActivityCompat.requestPermissions / Paramètres > Applications",
    notifications: "Paramètres > Applications > J.A.R.V.I.S. > Notifications",
    notification_listener: "Paramètres > Sécurité et confidentialité > Accès spécial > Accès aux notifications",
    contacts: "Demande runtime ActivityCompat.requestPermissions",
    calendar: "Demande runtime ActivityCompat.requestPermissions",
    phone: "Demande runtime ActivityCompat.requestPermissions",
    sms: "Demande runtime ActivityCompat.requestPermissions",
    geolocation: "Demande runtime ActivityCompat.requestPermissions",
    bluetooth: "Paramètres > Bluetooth & Appareils connectés",
    storage: "Demande runtime PhotoPicker / READ_MEDIA_*",
    overlay: "Paramètres > Applications > Accès spécial > Afficher sur d'autres applications",
    accessibility: "Paramètres > Accessibilité > J.A.R.V.I.S. Core Accessibility Service",
    screen_capture: "MediaProjectionManager.createScreenCaptureIntent()",
    assistant: "Paramètres > Applications par défaut > Application d'assistance numérique",
    device_admin: "Paramètres > Sécurité et confidentialité > Administrateurs de l'appareil",
    vibration: "Accordée automatiquement par Android",
  };
  return map[id] || '';
}

function isPermissionCritical(id: AndroidPermissionType): boolean {
  return [
    'microphone',
    'camera',
    'notification_listener',
    'accessibility',
    'screen_capture',
    'assistant',
    'device_admin',
    'contacts',
    'phone',
    'sms',
    'overlay',
  ].includes(id);
}

function getIconName(id: AndroidPermissionType): string {
  return id;
}
