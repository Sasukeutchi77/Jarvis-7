import React, { useState } from 'react';
import { 
  Phone, 
  PhoneCall, 
  Delete, 
  User, 
  Bell, 
  Volume2, 
  CheckCheck, 
  X, 
  Sun, 
  CloudRain, 
  Wind, 
  Droplets,
  Calendar,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

/* ----------------------------------------------------
   1. Phone Dialer Modal
---------------------------------------------------- */
interface PhoneDialerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaceCall?: (phoneNumber: string) => void;
}

export const PhoneDialerModal: React.FC<PhoneDialerModalProps> = ({
  isOpen,
  onClose,
  onPlaceCall,
}) => {
  const [number, setNumber] = useState('');

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (number.length < 16) {
      setNumber((prev) => prev + digit);
    }
  };

  const handleDelete = () => {
    setNumber((prev) => prev.slice(0, -1));
  };

  const handleCall = () => {
    if (!number) {
      toast.error('Veuillez composer un numéro');
      return;
    }
    toast.success(`Appel en cours vers ${number}...`);
    window.open(`tel:${number}`, '_self');
    if (onPlaceCall) onPlaceCall(number);
    onClose();
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-sm p-5 rounded-2xl bg-slate-900 border border-cyan-500/40 shadow-2xl relative text-slate-100 hud-corner-bracket">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <Phone className="w-5 h-5 text-cyan-400" />
          <h3 className="font-mono font-bold text-sm tracking-wider uppercase text-cyan-300">
            NUMÉROTEUR ANDROID
          </h3>
        </div>

        {/* Display Screen */}
        <div className="w-full h-12 px-3 rounded-xl bg-slate-950 border border-cyan-500/30 flex items-center justify-between font-mono text-lg text-cyan-300 tracking-widest mb-4">
          <span className="truncate">{number || 'Composer...'}</span>
          {number && (
            <button
              onClick={handleDelete}
              className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
            >
              <Delete className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Keypad Grid */}
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          {digits.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleDigit(d)}
              className="py-3 rounded-xl bg-slate-950/80 hover:bg-cyan-950/60 border border-slate-800 hover:border-cyan-500/40 text-base font-mono font-bold text-slate-200 hover:text-cyan-300 transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              {d}
            </button>
          ))}
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={handleCall}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition-all active:scale-95 cursor-pointer"
        >
          <PhoneCall className="w-4 h-4" />
          <span>LANCER L'APPEL</span>
        </button>
      </div>
    </div>
  );
};

/* ----------------------------------------------------
   2. Notifications Reader Modal
---------------------------------------------------- */
interface NotificationItem {
  id: string;
  app: string;
  sender: string;
  message: string;
  time: string;
}

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReadVocal?: (text: string) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  onReadVocal,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: '1',
      app: 'WhatsApp',
      sender: 'Marc Durant',
      message: 'On se retrouve au bureau à 14h30 pour la réunion technique ?',
      time: 'Il y a 5 min',
    },
    {
      id: '2',
      app: 'Google Agenda',
      sender: 'Rappel Événement',
      message: 'Revue de projet OpenJarvis dans 45 minutes.',
      time: 'Il y a 20 min',
    },
    {
      id: '3',
      app: 'Système Android',
      sender: 'Sécurité Téléphone',
      message: 'Sauvegarde automatique des données réussie.',
      time: 'Il y a 1 heure',
    },
  ]);

  if (!isOpen) return null;

  const handleReadAll = () => {
    const summary = notifications
      .map((n) => `De ${n.sender} sur ${n.app}: ${n.message}`)
      .join('. ');
    toast.success('Lecture vocale des notifications...');
    if (onReadVocal) {
      onReadVocal(`Voici vos dernières notifications : ${summary}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-md p-5 rounded-2xl bg-slate-900 border border-cyan-500/40 shadow-2xl relative text-slate-100 hud-corner-bracket max-h-[85vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400 animate-pulse" />
            <h3 className="font-mono font-bold text-sm tracking-wider uppercase text-cyan-300">
              NOTIFICATIONS ANDROID
            </h3>
          </div>
          <button
            onClick={handleReadAll}
            className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-all shadow cursor-pointer active:scale-95"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Lire tout</span>
          </button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 hover:border-cyan-500/30 transition-all space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-400">
                  {n.app}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">{n.time}</span>
              </div>
              <div className="font-semibold text-xs text-slate-200">{n.sender}</div>
              <p className="text-xs text-slate-400 leading-relaxed">{n.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ----------------------------------------------------
   3. Detailed Weather Modal
---------------------------------------------------- */
interface WeatherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WeatherModal: React.FC<WeatherModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-sm p-5 rounded-2xl bg-slate-900 border border-cyan-500/40 shadow-2xl relative text-slate-100 hud-corner-bracket">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <Sun className="w-5 h-5 text-yellow-400 animate-spin-slow" />
          <h3 className="font-mono font-bold text-sm tracking-wider uppercase text-cyan-300">
            MÉTÉO & SATELLITE
          </h3>
        </div>

        {/* Current Weather Card */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/40 border border-cyan-500/30 mb-3 text-center">
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider block mb-1">
            LOCALISATION ACTUELLE
          </span>
          <div className="text-3xl font-black font-mono text-white mb-1">28°C</div>
          <div className="text-xs text-slate-300">Ciel dégagé • Ensoleillé</div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <Droplets className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
            <span className="text-[10px] text-slate-400 block">Humidité</span>
            <span className="font-bold text-slate-200">62%</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <Wind className="w-4 h-4 text-sky-400 mx-auto mb-1" />
            <span className="text-[10px] text-slate-400 block">Vent</span>
            <span className="font-bold text-slate-200">14 km/h</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <Sun className="w-4 h-4 text-amber-400 mx-auto mb-1" />
            <span className="text-[10px] text-slate-400 block">Indice UV</span>
            <span className="font-bold text-slate-200">Modéré (4)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
