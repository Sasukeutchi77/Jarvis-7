import { useState, useEffect } from 'react';
import {
  Home,
  Lightbulb,
  Thermometer,
  Zap,
  Lock,
  Unlock,
  Wind,
  Blinds,
  Volume2,
  Power,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Radio,
  Cpu,
  Sparkles,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { SmartHomeDevice, SmartRoom } from '../types';

export function SmartHomePage() {
  const [devices, setDevices] = useState<SmartHomeDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'devices' | 'rooms' | 'integrations'>('devices');
  const [lastActionStatus, setLastActionStatus] = useState<string>('');

  const rooms: Array<{ id: string; name: string; icon: string }> = [
    { id: 'all', name: 'Toutes les pièces', icon: 'Layers' },
    { id: 'Salon', name: 'Salon', icon: 'Home' },
    { id: 'Bureau', name: 'Bureau', icon: 'Cpu' },
    { id: 'Chambre', name: 'Chambre', icon: 'Moon' },
    { id: 'Entrée', name: 'Entrée', icon: 'Lock' },
    { id: 'Cuisine', name: 'Cuisine', icon: 'Flame' },
  ];

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/smart-home/devices');
      const data = await res.json();
      if (data.devices) {
        setDevices(data.devices);
      }
    } catch (e) {
      toast.error('Erreur lors du chargement des appareils domotiques');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleDeviceToggle = async (device: SmartHomeDevice) => {
    const newState = !device.state;
    // Optimistic UI update
    setDevices((prev) =>
      prev.map((d) => (d.id === device.id ? { ...d, state: newState } : d))
    );

    try {
      const res = await fetch('/api/smart-home/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: device.id, state: newState }),
      });
      const data = await res.json();
      if (data.success) {
        const msg = `${device.name} : ${newState ? 'Allumé' : 'Éteint'}`;
        setLastActionStatus(msg);
        toast.success(msg);
      }
    } catch {
      toast.error('Échec de la commande domotique');
      fetchDevices();
    }
  };

  const handleValueChange = async (device: SmartHomeDevice, newValue: number) => {
    setDevices((prev) =>
      prev.map((d) => (d.id === device.id ? { ...d, value: newValue } : d))
    );

    try {
      await fetch('/api/smart-home/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: device.id, value: newValue }),
      });
    } catch {
      toast.error('Erreur de réglage');
    }
  };

  const handleQuickAction = async (action: 'all_lights_off' | 'all_lights_on' | 'room_off' | 'room_on', room?: string) => {
    try {
      const res = await fetch('/api/smart-home/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, room }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Action exécutée');
        fetchDevices();
      }
    } catch {
      toast.error('Échec de l\'action globale');
    }
  };

  const filteredDevices =
    selectedRoom === 'all'
      ? devices
      : devices.filter((d) => d.room.toLowerCase() === selectedRoom.toLowerCase());

  const activeCount = devices.filter((d) => d.state).length;
  const onlineCount = devices.filter((d) => d.isOnline).length;
  const thermostatDevice = devices.find((d) => d.type === 'thermostat');

  const getDeviceIcon = (type: SmartHomeDevice['type'], state: boolean) => {
    switch (type) {
      case 'light':
        return <Lightbulb className={`w-5 h-5 ${state ? 'text-amber-400 fill-amber-400/20' : 'text-slate-400'}`} />;
      case 'thermostat':
        return <Thermometer className={`w-5 h-5 ${state ? 'text-rose-400' : 'text-slate-400'}`} />;
      case 'plug':
        return <Zap className={`w-5 h-5 ${state ? 'text-cyan-400' : 'text-slate-400'}`} />;
      case 'lock':
        return state ? <Lock className="w-5 h-5 text-emerald-400" /> : <Unlock className="w-5 h-5 text-amber-400" />;
      case 'ac':
        return <Wind className={`w-5 h-5 ${state ? 'text-sky-400' : 'text-slate-400'}`} />;
      case 'curtains':
        return <Blinds className={`w-5 h-5 ${state ? 'text-indigo-400' : 'text-slate-400'}`} />;
      case 'speaker':
        return <Volume2 className={`w-5 h-5 ${state ? 'text-violet-400' : 'text-slate-400'}`} />;
      default:
        return <Cpu className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div id="smart-home-page" className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/40 border border-cyan-500/30 shadow-lg shadow-cyan-950/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              STARK DOMOTICS CORE
            </span>
            <span className="text-xs text-slate-400 font-mono">Matter / Zigbee / Hue Bridge</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
            Contrôle Domotique & Équipements
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Gestion unifiée de vos éclairages, thermostats, serrures et prises intelligentes. Contrôlable directement par la voix de JARVIS.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-refresh-smart-home"
            onClick={fetchDevices}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <button
            id="btn-all-lights-off"
            onClick={() => handleQuickAction('all_lights_off')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition-all shadow-sm"
          >
            <Power className="w-3.5 h-3.5" />
            Éteindre toutes les lumières
          </button>
          <button
            id="btn-all-lights-on"
            onClick={() => handleQuickAction('all_lights_on')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Tout allumer
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Appareils Actifs</span>
            <Zap className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {activeCount} <span className="text-xs text-slate-500 font-sans">/ {devices.length}</span>
          </div>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Connectés & synchronisés
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Thermostat Central</span>
            <Thermometer className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {thermostatDevice?.value || 21}°C
          </div>
          <div className="text-[11px] text-cyan-400">Régulation automatique active</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Sécurité & Accès</span>
            <Lock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">Verrouillé</div>
          <div className="text-[11px] text-slate-400">Serrure entrée sécurisée</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Protocoles Actifs</span>
            <Radio className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-indigo-300 font-mono">Matter / Hue</div>
          <div className="text-[11px] text-slate-400">Latence moyenne &lt; 15ms</div>
        </div>
      </div>

      {/* Room Tabs Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {rooms.map((r) => {
          const isSelected = selectedRoom === r.id;
          const count =
            r.id === 'all'
              ? devices.length
              : devices.filter((d) => d.room.toLowerCase() === r.id.toLowerCase()).length;
          return (
            <button
              key={r.id}
              id={`room-tab-${r.id}`}
              onClick={() => setSelectedRoom(r.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                isSelected
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                  : 'bg-slate-900/40 hover:bg-slate-800 text-slate-400 border-slate-800'
              }`}
            >
              <span>{r.name}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                  isSelected ? 'bg-cyan-500/30 text-cyan-200' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Grid of Devices */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDevices.map((device) => {
          const isLight = device.type === 'light';
          const isThermostat = device.type === 'thermostat';

          return (
            <div
              key={device.id}
              id={`device-card-${device.id}`}
              className={`relative p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-4 ${
                device.state
                  ? 'bg-gradient-to-b from-slate-900/90 to-slate-900/70 border-cyan-500/40 shadow-md shadow-cyan-950/20'
                  : 'bg-slate-900/40 border-slate-800/80 opacity-80'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2.5 rounded-xl border ${
                      device.state
                        ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 shadow-inner'
                        : 'bg-slate-800/80 border-slate-700 text-slate-500'
                    }`}
                  >
                    {getDeviceIcon(device.type, device.state)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm tracking-tight">{device.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-slate-400 font-medium">{device.room}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {device.protocol}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Main Toggle Switch */}
                <button
                  id={`btn-toggle-${device.id}`}
                  onClick={() => handleDeviceToggle(device)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    device.state ? 'bg-cyan-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      device.state ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Slider for Dimmable Lights or Temperature */}
              {isLight && device.state && (
                <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Sliders className="w-3 h-3 text-cyan-400" /> Intensité lumineuse
                    </span>
                    <span className="font-mono text-cyan-300 font-semibold">{device.value ?? 80}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={device.value ?? 80}
                    onChange={(e) => handleValueChange(device, parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>
              )}

              {isThermostat && (
                <div className="space-y-2 pt-2 border-t border-slate-800/60">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">Consigne désirée</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleValueChange(device, (device.value || 20) - 1)}
                        className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center border border-slate-700"
                      >
                        -
                      </button>
                      <span className="text-base font-bold font-mono text-rose-300">
                        {device.value || 21}°C
                      </span>
                      <button
                        onClick={() => handleValueChange(device, (device.value || 20) + 1)}
                        className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center border border-slate-700"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Card Footer Status */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/40">
                <span className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${device.isOnline ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  {device.isOnline ? 'En ligne' : 'Déconnecté'}
                </span>
                <span className="font-mono text-slate-400">{device.state ? 'ACTIF' : 'VEILLE'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Voice Assistant Example Commands */}
      <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          Commandes vocales supportées par JARVIS
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 text-slate-300">
            <span className="text-cyan-400 font-mono font-semibold">"Jarvis, allume le salon"</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Allume l'éclairage de la pièce spécifiée</p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 text-slate-300">
            <span className="text-cyan-400 font-mono font-semibold">"Éteins toutes les lumières"</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Extinction globale instantanée</p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 text-slate-300">
            <span className="text-cyan-400 font-mono font-semibold">"Mets le thermostat à 22 degrés"</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Règle la température ambiante</p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 text-slate-300">
            <span className="text-cyan-400 font-mono font-semibold">"Verrouille la porte d'entrée"</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Sécurise les serrures connectées</p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 text-slate-300">
            <span className="text-cyan-400 font-mono font-semibold">"Active le mode sommeil"</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Éteint tout et verrouille la maison</p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 text-slate-300">
            <span className="text-cyan-400 font-mono font-semibold">"Mode travail"</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Éclairage bureau à 100% et Lo-Fi</p>
          </div>
        </div>
      </div>
    </div>
  );
}
