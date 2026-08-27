import { X, ShieldCheck } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function OptInModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-md w-full p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <ShieldCheck className="w-5 h-5" />
            <span>Confidentialité & Télémétrie</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          OpenJarvis s'engage pour le respect total de votre vie privée. Toutes les requêtes sont traitées en local ou chiffrées de bout en bout. Aucune donnée personnelle n'est envoyée à des tiers.
        </p>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors"
        >
          Compris
        </button>
      </div>
    </div>
  );
}
