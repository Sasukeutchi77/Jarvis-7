import { AlertTriangle, ShieldAlert, Check, X, Trash2 } from 'lucide-react';
import { AndroidActionConfirmation } from '../../types';
import { AndroidBridge } from '../../lib/android-bridge';

interface Props {
  confirmation: AndroidActionConfirmation | null;
  onConfirm: (confirmation: AndroidActionConfirmation) => void;
  onCancel: () => void;
}

export function SecurityConfirmationModal({ confirmation, onConfirm, onCancel }: Props) {
  if (!confirmation) return null;

  const getSeverityBadge = () => {
    switch (confirmation.severity) {
      case 'critical':
        return {
          bg: 'bg-rose-500/20 border-rose-500/40 text-rose-300',
          label: 'Action Critique',
        };
      case 'high':
        return {
          bg: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
          label: 'Action Sensible',
        };
      default:
        return {
          bg: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300',
          label: 'Confirmation Requise',
        };
    }
  };

  const badge = getSeverityBadge();

  const handleConfirm = () => {
    AndroidBridge.vibrate('warning');
    onConfirm(confirmation);
  };

  const handleCancel = () => {
    AndroidBridge.vibrate('light');
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl shadow-rose-950/20 space-y-5"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badge.bg}`}>
                {badge.label}
              </span>
              <span className="text-xs text-slate-500">Sécurité Android</span>
            </div>
            <h3 className="text-base font-semibold text-slate-100">{confirmation.title}</h3>
          </div>
        </div>

        {/* Prompt & Target Description */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
          <p className="text-sm font-medium text-slate-200">{confirmation.prompt}</p>
          <div className="text-xs text-slate-400 font-mono bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex items-center gap-2">
            <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate">{confirmation.targetDescription}</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
            Par mesure de protection sur votre appareil, JARVIS n'exécute aucune suppression ou action destructrice sans votre accord explicite.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700/80 text-slate-300 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <X className="w-4 h-4" />
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Check className="w-4 h-4" />
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}
