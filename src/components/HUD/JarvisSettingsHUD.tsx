import React from 'react';
import {
  Settings,
  X,
  Cpu,
  Volume2,
  BatteryCharging,
  Zap,
  Globe,
  Sliders,
  Sparkles,
  Radio,
} from 'lucide-react';
import { useAppStore } from '../../lib/store';

interface JarvisSettingsHUDProps {
  isOpen: boolean;
  onClose: () => void;
  ecoMode: boolean;
  onToggleEcoMode: (eco: boolean) => void;
  onOpenWakeWordTester?: () => void;
}

export const JarvisSettingsHUD: React.FC<JarvisSettingsHUDProps> = ({
  isOpen,
  onClose,
  ecoMode,
  onToggleEcoMode,
  onOpenWakeWordTester,
}) => {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const models = useAppStore((s) => s.models);
  const selectedModel = useAppStore((s) => s.selectedModel);
  const setSelectedModel = useAppStore((s) => s.setSelectedModel);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-cyan-500/30 p-6 shadow-2xl shadow-cyan-950/50 flex flex-col space-y-5 animate-in zoom-in-95 duration-150 text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Paramètres Assistant JARVIS</h3>
              <p className="text-xs text-slate-400">Configuration des moteurs IA, voix et énergie</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Model Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
            <Cpu className="w-4 h-4" /> Modèle d'Orchestration
          </label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-xs text-slate-200 outline-none"
          >
            {models.length > 0 ? (
              models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.id}
                </option>
              ))
            ) : (
              <>
                <option value="qwen2.5:7b">Qwen 2.5 7B (Local NPU)</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Cloud Multi-Modal)</option>
                <option value="deepseek-r1:8b">DeepSeek R1 8B (Raisonnement)</option>
              </>
            )}
          </select>
        </div>

        {/* Wake Word "Hey JARVIS" Activation Controls */}
        <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/40 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-cyan-500/20">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-cyan-200">Activation Vocale "Hey JARVIS" (Wake Word)</span>
            </div>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                settings.wakeWordEnabled !== false
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}
            >
              {settings.wakeWordEnabled !== false ? 'WAKE WORD: ON' : 'WAKE WORD: OFF'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-slate-200">Écoute du mot-clé en continu</h4>
              <p className="text-[11px] text-slate-400">
                Déclenche JARVIS sans envoyer la conversation à l'IA avant détection.
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateSettings({ wakeWordEnabled: settings.wakeWordEnabled === false ? true : false })}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                settings.wakeWordEnabled !== false
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {settings.wakeWordEnabled !== false ? 'Activé' : 'Désactivé'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-cyan-400" /> Phrase d'Appel
              </label>
              <select
                value={settings.wakeWord || 'Hey JARVIS'}
                onChange={(e) => updateSettings({ wakeWord: e.target.value })}
                className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none"
              >
                <option value="Hey JARVIS">"Hey JARVIS"</option>
                <option value="JARVIS">"JARVIS"</option>
                <option value="Dis JARVIS">"Dis JARVIS"</option>
                <option value="OK JARVIS">"OK JARVIS"</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" /> Sensibilité Détection
                </label>
                <span className="text-xs font-mono text-cyan-400">
                  {Math.round((settings.wakeWordSensitivity || 0.85) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.30"
                max="1.00"
                step="0.05"
                value={settings.wakeWordSensitivity || 0.85}
                onChange={(e) => updateSettings({ wakeWordSensitivity: parseFloat(e.target.value) })}
                className="w-full accent-cyan-500"
              />
            </div>
          </div>

          {onOpenWakeWordTester && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenWakeWordTester();
              }}
              className="w-full py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              Ouvrir le Testeur de Cycle Complet "Hey JARVIS"
            </button>
          )}
        </div>

        {/* Voice & Speech Controls */}
        <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-cyan-500/20">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span className="text-xs font-bold text-cyan-200">Moteur Vocal Haute-Fidélité Deepgram (Style Iron Man)</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              Aura Orpheus (JARVIS)
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Dès que votre clé <code className="font-mono text-cyan-300">DEEPGRAM_API_KEY</code> est configurée sur le serveur, JARVIS utilise automatiquement le modèle Deepgram Aura <strong>Orpheus</strong> reproduisant le timbre britannique calme, distingué et précis de J.A.R.V.I.S. (Tony Stark).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-cyan-400" /> Langue Vocale
              </label>
              <select
                value={settings.voiceLanguage}
                onChange={(e) => updateSettings({ voiceLanguage: e.target.value })}
                className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none"
              >
                <option value="fr-FR">Français (fr-FR)</option>
                <option value="en-US">English (en-US)</option>
                <option value="es-ES">Español (es-ES)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> Rythme & Élocution
                </label>
                <span className="text-xs font-mono text-cyan-400">{settings.voiceRate}x</span>
              </div>
              <input
                type="range"
                min="0.80"
                max="1.30"
                step="0.05"
                value={settings.voiceRate}
                onChange={(e) => updateSettings({ voiceRate: parseFloat(e.target.value) })}
                className="w-full accent-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Battery & Performance Eco-Mode */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BatteryCharging className={`w-5 h-5 ${ecoMode ? 'text-emerald-400' : 'text-slate-400'}`} />
              <div>
                <h4 className="text-xs font-bold text-slate-200">Mode Éco Batterie & GPU</h4>
                <p className="text-[11px] text-slate-400">
                  Réduit le framerate d'animation à 30fps et allège les filtres de flou
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onToggleEcoMode(!ecoMode)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                ecoMode
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {ecoMode ? 'Activé' : 'Désactivé'}
            </button>
          </div>
        </div>

        {/* Auto Vocalize Toggle */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-300">Vocaliser automatiquement les réponses</span>
          <input
            type="checkbox"
            checked={settings.autoVocalize}
            onChange={(e) => updateSettings({ autoVocalize: e.target.checked })}
            className="w-4 h-4 accent-cyan-500 rounded"
          />
        </div>

        {/* Close Button */}
        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-cyan-500/20 active:scale-95 cursor-pointer"
          >
            Enregistrer & Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
