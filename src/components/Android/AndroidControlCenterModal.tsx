import { useState, useEffect } from 'react';
import {
  Smartphone,
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
  X,
  Eye,
  Lock,
  DownloadCloud,
  Zap,
  MessageSquare,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { AndroidBridge, ANDROID_PERMISSION_DEFINITIONS } from '../../lib/android-bridge';
import { AndroidPermissionType, AndroidPermissionStatus, ScheduledReminder } from '../../types';
import { apiFetch } from '../../lib/api';
import { ConversationManager } from '../../lib/communication/conversation-manager';
import { IncomingMessage, CommunicationSource } from '../../lib/communication/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenConfirmation?: (action: any) => void;
}

export function AndroidControlCenterModal({ isOpen, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'super_admin' | 'communications' | 'permissions' | 'reminders'>('super_admin');
  const [commMessages, setCommMessages] = useState<IncomingMessage[]>([]);
  const [selectedSource, setSelectedSource] = useState<CommunicationSource | 'all'>('all');
  const [privateMode, setPrivateMode] = useState(false);
  const [permissionsStatus, setPermissionsStatus] = useState<Partial<Record<AndroidPermissionType, AndroidPermissionStatus>>>({
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
    accessibility: 'granted',
    screen_capture: 'granted',
    assistant: 'granted',
    device_admin: 'granted',
  });

  const [reminders, setReminders] = useState<ScheduledReminder[]>([]);
  const [newReminderTitle, setNewReminderTitle] = useState('');
  const [newReminderTime, setNewReminderTime] = useState('Demain 08:00');

  const refreshPermissions = async () => {
    const types: AndroidPermissionType[] = [
      'accessibility',
      'notification_listener',
      'screen_capture',
      'device_admin',
      'microphone',
      'camera',
      'notifications',
      'geolocation',
      'storage',
      'vibration',
    ];
    const results: any = {};
    for (const t of types) {
      results[t] = await AndroidBridge.checkPermission(t);
    }
    setPermissionsStatus(results);
  };

  const refreshReminders = async () => {
    try {
      const res = await fetch('/v1/reminders');
      if (res.ok) {
        const data = await res.json();
        setReminders(data.reminders || []);
      }
    } catch {}
  };

  const refreshCommunications = () => {
    const list = ConversationManager.getInstance().getAllMessages(
      selectedSource === 'all' ? undefined : { source: selectedSource }
    );
    setCommMessages(list);
  };

  useEffect(() => {
    if (isOpen) {
      refreshPermissions();
      refreshReminders();
      refreshCommunications();
    }
  }, [isOpen, selectedSource]);

  if (!isOpen) return null;

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
    toast.success('Accès complet accordé à J.A.R.V.I.S.');
  };

  const handleLockPhone = async () => {
    AndroidBridge.vibrate('heavy');
    try {
      const res = await apiFetch('/api/android/admin/lock', { method: 'POST' });
      if (res.ok) {
        toast.success('Verrouillage matériel immédiat exécuté.');
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
      }
    } catch {
      toast.error('Erreur de programmation du rappel');
    }
  };

  const getPermissionIcon = (type: AndroidPermissionType) => {
    switch (type) {
      case 'accessibility':
      case 'screen_capture':
        return <Eye className="w-4 h-4 text-cyan-400" />;
      case 'device_admin':
        return <ShieldCheck className="w-4 h-4 text-amber-400" />;
      case 'microphone':
        return <Mic className="w-4 h-4 text-cyan-400" />;
      case 'camera':
        return <Camera className="w-4 h-4 text-emerald-400" />;
      case 'notifications':
        return <Bell className="w-4 h-4 text-amber-400" />;
      case 'geolocation':
        return <MapPin className="w-4 h-4 text-rose-400" />;
      case 'storage':
        return <FolderLock className="w-4 h-4 text-purple-400" />;
      case 'vibration':
        return <Activity className="w-4 h-4 text-indigo-400" />;
      default:
        return <Smartphone className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <Zap className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-100 text-sm">Centre de Commande Android J.A.R.V.I.S.</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Total Control
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Supervision système, autorisations et synchronisation multi-IA.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 px-5 pt-3 gap-2 overflow-x-auto bg-slate-950/40">
          <button
            onClick={() => setActiveTab('super_admin')}
            className={`py-2 px-3.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'super_admin' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Superviseur Matériel
          </button>
          <button
            onClick={() => setActiveTab('communications')}
            className={`py-2 px-3.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'communications' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Communications ({commMessages.filter((m) => !m.isRead).length})
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`py-2 px-3.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'permissions' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            Autorisations Totales (100%)
          </button>
          <button
            onClick={() => setActiveTab('reminders')}
            className={`py-2 px-3.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'reminders' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Rappels ({reminders.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'super_admin' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-cyan-950/20 to-slate-950 border border-cyan-500/20 flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-100">Autorité Matérielle Active</h4>
                  <p className="text-[11px] text-slate-400">J.A.R.V.I.S. dispose du plein pouvoir administrateur.</p>
                </div>
                <button
                  onClick={handleGrantFullAccess}
                  className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Accès Total
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleLockPhone}
                  className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-rose-500/40 text-left transition-all space-y-2 cursor-pointer group"
                >
                  <Lock className="w-5 h-5 text-rose-400 group-hover:scale-110 transition-transform" />
                  <div>
                    <h5 className="text-xs font-bold text-slate-100">Verrouillage Immédiat</h5>
                    <p className="text-[10px] text-slate-400 mt-0.5">DevicePolicyManager Lock</p>
                  </div>
                </button>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-2">
                  <DownloadCloud className="w-5 h-5 text-cyan-400" />
                  <div>
                    <h5 className="text-xs font-bold text-slate-100">Mises à Jour OTA</h5>
                    <p className="text-[10px] text-slate-400 mt-0.5">Firmware Android 15 à jour</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'communications' && (
            <div className="space-y-3">
              {/* Toolbar */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
                  {(['all', 'whatsapp', 'sms', 'telegram', 'messenger', 'signal'] as (CommunicationSource | 'all')[]).map((src) => (
                    <button
                      key={src}
                      onClick={() => setSelectedSource(src)}
                      className={`px-2.5 py-1 rounded-lg font-semibold capitalize transition-all cursor-pointer ${
                        selectedSource === src
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {src === 'all' ? 'Toutes' : src}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setPrivateMode(!privateMode)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                    privateMode
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ShieldAlert className="w-3 h-3" />
                  Mode Privé {privateMode ? 'Actif' : 'Inactif'}
                </button>
              </div>

              {/* Messages list */}
              <div className="space-y-2 max-h-[45vh] overflow-y-auto">
                {commMessages.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Aucun message détecté pour ce filtre.
                  </div>
                ) : (
                  commMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        msg.category === 'urgent'
                          ? 'bg-rose-950/20 border-rose-500/30'
                          : msg.category === 'to_reply'
                          ? 'bg-amber-950/20 border-amber-500/30'
                          : 'bg-slate-950 border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                            {msg.appName}
                          </span>
                          <span className="text-xs font-bold text-slate-100">
                            {privateMode ? 'Expéditeur masqué' : msg.sender}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed mb-2.5">
                        {privateMode ? '•••••••••••••••••••••••••••• (Mode Privé Actif)' : msg.content}
                      </p>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          msg.category === 'urgent'
                            ? 'bg-rose-500/20 text-rose-300'
                            : msg.category === 'to_reply'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {msg.category === 'urgent' ? '🔴 Urgent' : msg.category === 'to_reply' ? '🟡 À répondre' : 'ℹ️ Information'}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              ConversationManager.getInstance().markAsRead(msg.id);
                              refreshCommunications();
                              toast.success('Message marqué comme lu.');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Marquer lu
                          </button>
                          <button
                            onClick={() => {
                              AndroidBridge.openApp(msg.source === 'sms' ? 'messages' : msg.source);
                              toast.info(`Ouverture de ${msg.appName}...`);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            Ouvrir app
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="space-y-2.5">
              {(Object.keys(ANDROID_PERMISSION_DEFINITIONS) as AndroidPermissionType[]).map((type) => {
                const def = ANDROID_PERMISSION_DEFINITIONS[type];
                const isGranted = permissionsStatus[type] === 'granted';

                return (
                  <div
                    key={type}
                    className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
                        {getPermissionIcon(type)}
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-xs font-semibold text-slate-200">{def.title}</h5>
                        <p className="text-[10px] text-slate-400 truncate">{def.rationale}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRequestPermission(type)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer ${
                        isGranted
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                      }`}
                    >
                      {isGranted ? 'Accordée' : 'Accorder'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'reminders' && (
            <div className="space-y-4">
              <form onSubmit={handleAddReminder} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Titre du rappel..."
                    value={newReminderTitle}
                    onChange={(e) => setNewReminderTitle(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <input
                    type="text"
                    placeholder="Heure..."
                    value={newReminderTime}
                    onChange={(e) => setNewReminderTime(e.target.value)}
                    className="w-28 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Ajouter
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                {reminders.map((r) => (
                  <div key={r.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">{r.title}</span>
                    <span className="text-cyan-400 font-mono text-[11px]">{r.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
