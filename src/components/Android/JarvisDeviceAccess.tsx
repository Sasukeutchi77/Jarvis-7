import { useState, useEffect, useCallback } from 'react';
import {
  Smartphone,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Mic,
  Camera,
  Users,
  Phone,
  MessageSquare,
  Calendar,
  MapPin,
  Bell,
  Eye,
  Layers,
  Monitor,
  Bot,
  Bluetooth,
  Zap,
  FolderLock,
  RefreshCw,
  Sliders,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Info,
  Sparkles,
  Search,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AndroidCapabilityKey,
  AndroidCapabilityInfo,
  AndroidCapabilityState,
  AndroidDeviceCapabilitiesReport,
} from '../../types';
import { androidControlEngine } from '../../lib/android/android-control-engine';
import { jarvisPermissionManager } from '../../lib/android/jarvis-permission-manager';

interface JarvisDeviceAccessProps {
  onClose?: () => void;
  isModal?: boolean;
}

export function JarvisDeviceAccess({ onClose, isModal = false }: JarvisDeviceAccessProps) {
  const [report, setReport] = useState<AndroidDeviceCapabilitiesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'hardware' | 'privacy' | 'system_service' | 'communication' | 'storage_network'>('all');
  const [stateFilter, setStateFilter] = useState<'all' | AndroidCapabilityState>('all');
  const [configuringKey, setConfiguringKey] = useState<AndroidCapabilityKey | null>(null);
  const [selectedCapability, setSelectedCapability] = useState<AndroidCapabilityInfo | null>(null);

  const loadCapabilities = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const res = await androidControlEngine.checkAllCapabilities(force);
      setReport(res);
    } catch {
      toast.error('Erreur lors du diagnostic des capacités Android.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCapabilities(true);

    const unsubscribe = androidControlEngine.subscribe((updatedReport) => {
      setReport(updatedReport);
    });

    return () => unsubscribe();
  }, [loadCapabilities]);

  const handleConfigure = async (cap: AndroidCapabilityInfo) => {
    setConfiguringKey(cap.id);
    try {
      const res = await androidControlEngine.configureCapability(cap.id);
      if (res.success) {
        toast.success(res.message || `Paramètre Android ouvert pour ${cap.name}`);
      } else {
        toast.error(res.message || `Impossible d'ouvrir le réglage Android.`);
      }
      // Re-vérifier l'état après tentative
      setTimeout(() => {
        loadCapabilities(true);
      }, 1000);
    } catch {
      toast.error(`Erreur de configuration pour ${cap.name}`);
    } finally {
      setConfiguringKey(null);
    }
  };

  const getCapabilityIcon = (iconName: string) => {
    switch (iconName) {
      case 'Mic': return <Mic className="w-5 h-5" />;
      case 'Camera': return <Camera className="w-5 h-5" />;
      case 'Users': return <Users className="w-5 h-5" />;
      case 'Phone': return <Phone className="w-5 h-5" />;
      case 'MessageSquare': return <MessageSquare className="w-5 h-5" />;
      case 'Calendar': return <Calendar className="w-5 h-5" />;
      case 'MapPin': return <MapPin className="w-5 h-5" />;
      case 'Bell': return <Bell className="w-5 h-5" />;
      case 'Eye': return <Eye className="w-5 h-5" />;
      case 'Layers': return <Layers className="w-5 h-5" />;
      case 'Monitor': return <Monitor className="w-5 h-5" />;
      case 'Bot': return <Bot className="w-5 h-5" />;
      case 'Bluetooth': return <Bluetooth className="w-5 h-5" />;
      case 'Zap': return <Zap className="w-5 h-5" />;
      case 'FolderLock': return <FolderLock className="w-5 h-5" />;
      default: return <Shield className="w-5 h-5" />;
    }
  };

  const renderStateBadge = (state: AndroidCapabilityState) => {
    switch (state) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            ACTIVE
          </span>
        );
      case 'INACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            INACTIVE
          </span>
        );
      case 'REQUIRES_PERMISSION':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            REQUIRES_PERMISSION
          </span>
        );
      case 'REQUIRES_SPECIAL_ACCESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.15)]">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            REQUIRES_SPECIAL_ACCESS
          </span>
        );
      case 'UNAVAILABLE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
            <span className="w-2 h-2 rounded-full bg-zinc-500" />
            UNAVAILABLE
          </span>
        );
    }
  };

  const capabilitiesList = report ? Object.values(report.capabilities) : [];

  const filteredCapabilities = capabilitiesList.filter((cap) => {
    const matchesSearch =
      cap.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cap.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cap.technicalDetails.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || cap.category === categoryFilter;
    const matchesState = stateFilter === 'all' || cap.state === stateFilter;

    return matchesSearch && matchesCategory && matchesState;
  });

  return (
    <div className={`flex flex-col h-full ${isModal ? 'bg-zinc-950 text-white p-6 max-h-[90vh] overflow-y-auto' : 'space-y-6'}`}>
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                JARVIS DEVICE ACCESS
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  Android Control Center
                </span>
              </h1>
              <p className="text-xs md:text-sm text-zinc-400 mt-0.5">
                Vérification réelle en temps réel des 16 capacités système et passerelles d&apos;accès Android
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="jarvis-btn-recheck-all"
            onClick={() => loadCapabilities(true)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-semibold rounded-lg text-xs md:text-sm transition-all shadow-[0_0_15px_rgba(6,182,212,0.25)] active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>RÉÉVALUER TOUT</span>
          </button>
          {isModal && onClose && (
            <button
              id="jarvis-btn-close-device-access"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs md:text-sm font-medium transition cursor-pointer"
            >
              Fermer
            </button>
          )}
        </div>
      </div>

      {/* System Telemetry Bar */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl">
            <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">Système d&apos;Exploitation</div>
            <div className="text-sm font-bold text-cyan-400 mt-1 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4" />
              <span>{report.osVersion}</span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">API Level {report.sdkInt}</div>
          </div>

          <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl">
            <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">Terminal Détecté</div>
            <div className="text-sm font-bold text-zinc-200 mt-1 truncate">{report.deviceModel}</div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              {report.isAndroid ? 'Android Natif / WebView' : 'Navigateur Web JARVIS'}
            </div>
          </div>

          <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl">
            <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">État Batterie</div>
            <div className="text-sm font-bold text-zinc-200 mt-1 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>{report.battery.level}% {report.battery.charging ? '(En charge)' : ''}</span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">Alimentation continue</div>
          </div>

          <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl">
            <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">Connectivité Réseau</div>
            <div className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="truncate">{report.network.type}</span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">Profil {report.network.effectiveType || '4g'}</div>
          </div>

          <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl col-span-2 md:col-span-1">
            <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">Bilan de Sécurité</div>
            <div className="text-sm font-bold text-white mt-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>{report.activeCount} / {report.totalCapabilities} Actives</span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              {report.requiresPermissionCount + report.requiresSpecialAccessCount} en attente de réglage
            </div>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/80">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            id="jarvis-search-capabilities"
            type="text"
            placeholder="Rechercher une capacité (Microphone, Overlay, Notifications, Stockage, etc.)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs md:text-sm text-white placeholder-zinc-400 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <select
            id="jarvis-select-category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs md:text-sm text-zinc-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">Toutes catégories</option>
            <option value="hardware">Matériel & Capteurs</option>
            <option value="system_service">Services Système</option>
            <option value="privacy">Données Privées</option>
            <option value="communication">Communication</option>
            <option value="storage_network">Stockage & Réseau</option>
          </select>

          <select
            id="jarvis-select-state-filter"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value as any)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs md:text-sm text-zinc-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">Tous les statuts</option>
            <option value="ACTIVE">ACTIVE (Opérationnelle)</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="REQUIRES_PERMISSION">REQUIRES_PERMISSION</option>
            <option value="REQUIRES_SPECIAL_ACCESS">REQUIRES_SPECIAL_ACCESS</option>
            <option value="UNAVAILABLE">UNAVAILABLE</option>
          </select>
        </div>
      </div>

      {/* Main Capabilities List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <span>Capacité Système ({filteredCapabilities.length})</span>
          <span>Statut & Action</span>
        </div>

        {filteredCapabilities.length === 0 ? (
          <div className="text-center py-12 border border-zinc-800 rounded-xl bg-zinc-900/30">
            <Info className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-zinc-300">Aucune capacité ne correspond à vos filtres.</p>
            <p className="text-xs text-zinc-400 mt-1">Modifiez vos critères de recherche ou réinitialisez les filtres.</p>
          </div>
        ) : (
          filteredCapabilities.map((cap) => {
            const isConfiguring = configuringKey === cap.id;
            return (
              <div
                key={cap.id}
                id={`jarvis-capability-card-${cap.id}`}
                className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-zinc-900/70 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl transition-all gap-4 group"
              >
                <div className="flex items-start gap-3.5 flex-1">
                  <div className={`p-2.5 rounded-xl border transition-colors ${
                    cap.state === 'ACTIVE'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : cap.state === 'REQUIRES_SPECIAL_ACCESS'
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        : cap.state === 'REQUIRES_PERMISSION'
                          ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                  }`}>
                    {getCapabilityIcon(cap.iconName)}
                  </div>

                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm md:text-base font-bold text-white tracking-wide">
                        {cap.name}
                      </span>
                      {cap.isSpecialAccess && (
                        <span className="text-[10px] px-2 py-0.5 bg-rose-500/15 border border-rose-500/30 text-rose-300 font-medium rounded-full">
                          Accès Spécial Système
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                      {cap.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-zinc-400">
                      <span>• {cap.technicalDetails}</span>
                      <span>• {cap.modernApiNotes}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-3.5 border-t md:border-t-0 pt-3 md:pt-0 border-zinc-800">
                  <div>
                    {renderStateBadge(cap.state)}
                  </div>

                  <button
                    id={`jarvis-btn-configure-${cap.id}`}
                    onClick={() => handleConfigure(cap)}
                    disabled={isConfiguring}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 text-zinc-200 hover:text-white rounded-lg text-xs font-semibold transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    {isConfiguring ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                    )}
                    <span>[CONFIGURER]</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Security Notice Footer */}
      <div className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl flex items-start gap-3 text-xs text-zinc-400">
        <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-zinc-300">Architecture de Sécurité & Respect Strict des Permissions</div>
          <p>
            JARVIS vérifie dynamiquement l&apos;état matériel et logiciel de chaque API Android sans jamais utiliser de variables fictives. Toute commande nécessitant un accès non accordé refusera l&apos;exécution et vous guidera vers l&apos;écran officiel des paramètres Android correspondants.
          </p>
        </div>
      </div>
    </div>
  );
}
