import { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Mic,
  Eye,
  User,
  Lock,
  KeyRound,
  Bell,
  MessageSquare,
  Users,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Layers,
  Monitor,
  Bot,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { AndroidBridge } from '../lib/android-bridge';
import { useAppStore } from '../lib/store';
import { sanitizeSpeechText } from '../lib/tts-sanitizer';
import appIcon from '../assets/images/openjarvis_app_icon_1787449013809.jpg';
import { AndroidPermissionType, AndroidPermissionStatus } from '../types';

interface Props {
  onReady: (userName: string) => void;
}

interface OnboardingPermissionItem {
  id: AndroidPermissionType;
  stepNumber: number;
  name: string;
  whyNeeded: string;
  consequenceIfDenied: string;
  icon: any;
  isSpecialSettings: boolean;
}

const ONBOARDING_PERMISSIONS: OnboardingPermissionItem[] = [
  {
    id: 'microphone',
    stepNumber: 1,
    name: 'Microphone & Écoute Continue',
    whyNeeded: "Indispensable pour capter vos commandes vocales et le mot-clé de réveil 'Hey Jarvis'.",
    consequenceIfDenied: 'Commandes vocales et synthèse vocale interactive désactivées.',
    icon: Mic,
    isSpecialSettings: false,
  },
  {
    id: 'notifications',
    stepNumber: 2,
    name: 'Notifications Système',
    whyNeeded: 'Permet de vous alerter lors de rappels importants et de la finalisation des tâches d\'arrière-plan.',
    consequenceIfDenied: 'Aucune alerte de rappel ou alarme ne pourra vous être transmise.',
    icon: Bell,
    isSpecialSettings: false,
  },
  {
    id: 'notification_listener',
    stepNumber: 3,
    name: 'Accès aux Notifications (Messages)',
    whyNeeded: 'Permet à JARVIS de lire les messages WhatsApp, SMS, Telegram et de préparer des réponses.',
    consequenceIfDenied: 'JARVIS ne pourra pas détecter ni vous lire les messages entrants.',
    icon: MessageSquare,
    isSpecialSettings: true,
  },
  {
    id: 'accessibility',
    stepNumber: 4,
    name: 'Service d\'Accessibilité',
    whyNeeded: 'Permet à JARVIS d\'analyser l\'écran de l\'application active et de vous assister dans l\'interface.',
    consequenceIfDenied: 'Impossible de lire le contenu des applications ouvertes ou d\'automatiser la navigation.',
    icon: Eye,
    isSpecialSettings: true,
  },
  {
    id: 'screen_capture',
    stepNumber: 5,
    name: 'Capture d\'Écran Ponctuelle',
    whyNeeded: 'Permet à JARVIS d\'analyser visuellement des schémas, photos et graphiques affichés.',
    consequenceIfDenied: 'L\'analyse multimodale d\'écran par Vision IA ne sera pas disponible.',
    icon: Monitor,
    isSpecialSettings: true,
  },
  {
    id: 'contacts',
    stepNumber: 6,
    name: 'Contacts & Répertoire',
    whyNeeded: 'Permet de retrouver automatiquement vos proches pour appeler ou envoyer des messages.',
    consequenceIfDenied: 'Vous devrez dicter manuellement le numéro de téléphone complet à chaque appel.',
    icon: Users,
    isSpecialSettings: false,
  },
  {
    id: 'phone',
    stepNumber: 7,
    name: 'Téléphone & Appels',
    whyNeeded: 'Permet de composer et lancer directement des appels téléphoniques après votre confirmation.',
    consequenceIfDenied: 'JARVIS ne pourra pas composer de numéro de téléphone pour vous.',
    icon: Phone,
    isSpecialSettings: false,
  },
  {
    id: 'sms',
    stepNumber: 8,
    name: 'SMS & Messagerie Directe',
    whyNeeded: 'Permet de dicter et d\'envoyer des textos en toute sécurité.',
    consequenceIfDenied: 'L\'envoi direct de textos par commande vocale sera indisponible.',
    icon: Mail,
    isSpecialSettings: false,
  },
  {
    id: 'calendar',
    stepNumber: 9,
    name: 'Calendrier & Agenda',
    whyNeeded: 'Permet de consulter votre planning, planifier des réunions et prévenir des retards.',
    consequenceIfDenied: 'La gestion d\'agenda et la synchronisation de planning seront inactives.',
    icon: Calendar,
    isSpecialSettings: false,
  },
  {
    id: 'geolocation',
    stepNumber: 10,
    name: 'Localisation GPS Précise',
    whyNeeded: 'Permet de calculer vos trajets routiers, la météo locale exacte et les points d\'intérêt proches.',
    consequenceIfDenied: 'La météo et le guidage GPS nécessiteront la saisie manuelle de votre ville.',
    icon: MapPin,
    isSpecialSettings: false,
  },
  {
    id: 'overlay',
    stepNumber: 11,
    name: 'Affichage Flottant (Overlay)',
    whyNeeded: 'Affiche la bulle vocale JARVIS et les réponses instantanées par-dessus les autres applications.',
    consequenceIfDenied: 'JARVIS ne pourra s\'afficher que dans son application propre.',
    icon: Layers,
    isSpecialSettings: true,
  },
  {
    id: 'assistant',
    stepNumber: 12,
    name: 'Assistant Vocal par Défaut',
    whyNeeded: 'Permet de réveiller JARVIS instantanément par un appui long sur le bouton Home ou Alimentation.',
    consequenceIfDenied: 'JARVIS ne sera pas déclenché par les raccourcis matériels du smartphone.',
    icon: Bot,
    isSpecialSettings: true,
  },
];

export function SetupScreen({ onReady }: Props) {
  const [step, setStep] = useState<'name' | 'security' | 'permissions' | 'synced'>('name');
  const [userName, setUserName] = useState('');
  const [securityCode, setSecurityCode] = useState('4920');
  const [isListeningCode, setIsListeningCode] = useState(false);
  const [spokenCodePreview, setSpokenCodePreview] = useState('');
  const [reactorPower, setReactorPower] = useState(30);

  const [permissionStates, setPermissionStates] = useState<Record<string, AndroidPermissionStatus>>({});
  const [isVerifying, setIsVerifying] = useState(false);

  const setJarvisSecurityCode = useAppStore((s) => s.setJarvisSecurityCode);
  const setStoreUserName = useAppStore((s) => s.setUserName);
  const recognitionRef = useRef<any>(null);

  const speak = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const clean = sanitizeSpeechText(text);
        const utterance = new SpeechSynthesisUtterance(clean);
        utterance.lang = 'fr-FR';
        utterance.rate = 1.0;
        utterance.pitch = 0.95;
        window.speechSynthesis.speak(utterance);
      } catch {}
    }
  };

  const checkAllPermissionStatuses = async () => {
    setIsVerifying(true);
    const newStates: Record<string, AndroidPermissionStatus> = {};
    for (const item of ONBOARDING_PERMISSIONS) {
      newStates[item.id] = await AndroidBridge.checkPermission(item.id);
    }
    setPermissionStates(newStates);
    setIsVerifying(false);
  };

  useEffect(() => {
    speak("Initialisation du système JARVIS. Mes salutations. Comment dois-je vous appeler, Monsieur ?");
    checkAllPermissionStatuses();
  }, []);

  const handleConfirmName = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = userName.trim() || 'Monsieur';
    setUserName(finalName);
    setStoreUserName(finalName);
    AndroidBridge.vibrate('light');

    localStorage.setItem('jarvis_user_name', finalName);
    fetch('/api/user/name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: finalName }),
    }).catch(() => {});

    speak(
      `Très bien, Monsieur ${finalName}. Étant donné que je dispose d'un accès complet à votre téléphone, nous devons définir votre code secret de confirmation d'identité pour empêcher toute utilisation non autorisée.`
    );

    setStep('security');
  };

  const startVoiceCodeListening = () => {
    if (typeof window === 'undefined') return;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }

      const rec = new SpeechRec();
      rec.lang = 'fr-FR';
      rec.continuous = false;
      rec.interimResults = true;

      rec.onstart = () => {
        setIsListeningCode(true);
        setSpokenCodePreview('');
      };

      rec.onresult = (event: any) => {
        const text = event.results[0]?.[0]?.transcript || '';
        setSpokenCodePreview(text);
        const digits = text.replace(/[^0-9]/g, '');
        if (digits.length >= 2) {
          setSecurityCode(digits);
        } else if (text.trim()) {
          setSecurityCode(text.trim());
        }
      };

      rec.onend = () => setIsListeningCode(false);
      rec.onerror = () => setIsListeningCode(false);

      recognitionRef.current = rec;
      rec.start();
    } catch {
      setIsListeningCode(false);
    }
  };

  const handleConfirmSecurityCode = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCode = securityCode.trim() || '4920';
    setSecurityCode(finalCode);
    setJarvisSecurityCode(finalCode);
    AndroidBridge.vibrate('light');

    localStorage.setItem('jarvis_security_code', finalCode);
    localStorage.setItem('jarvis_auth_enabled', 'true');
    fetch('/api/user/security-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: finalCode, enabled: true }),
    }).catch(() => {});

    speak(
      `Pour fonctionner avec toutes les capacités Android disponibles, JARVIS doit être configuré. Passons en revue les autorisations nécessaires.`
    );

    setStep('permissions');
    checkAllPermissionStatuses();
  };

  const handleRequestSinglePermission = async (permId: AndroidPermissionType) => {
    AndroidBridge.vibrate('light');
    await AndroidBridge.requestPermission(permId);
    await checkAllPermissionStatuses();
  };

  const handleGrantAll = async () => {
    AndroidBridge.vibrate('heavy');
    for (const item of ONBOARDING_PERMISSIONS) {
      await AndroidBridge.requestPermission(item.id);
    }
    await checkAllPermissionStatuses();
  };

  const handleProceedToFinal = () => {
    AndroidBridge.vibrate('success');
    setReactorPower(100);
    speak(
      `Configuration enregistrée. Tous les systèmes sont en ligne sous votre autorité, Monsieur ${userName}. JARVIS est à vos ordres.`
    );
    setStep('synced');
  };

  const handleFinish = () => {
    AndroidBridge.vibrate('success');
    localStorage.setItem('jarvis_installed', 'true');
    onReady(userName);
  };

  const grantedCount = Object.values(permissionStates).filter((s) => s === 'granted').length;

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-100 p-4 relative overflow-hidden">
      {/* Background Stark Industries Glowing Radial FX */}
      <div className="absolute w-[600px] h-[600px] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none -top-40 -left-40 animate-pulse" />
      <div className="absolute w-[500px] h-[500px] rounded-full bg-amber-500/5 blur-[100px] pointer-events-none -bottom-20 -right-20" />

      <div className="max-w-2xl w-full p-6 md:p-8 rounded-3xl bg-slate-900/95 border border-cyan-500/30 text-center space-y-6 shadow-2xl backdrop-blur-xl relative z-10 max-h-[92vh] flex flex-col">
        {/* Animated Arc Reactor with App Icon */}
        <div className="relative mx-auto w-20 h-20 flex items-center justify-center shrink-0">
          <div className="absolute inset-0 rounded-2xl border border-cyan-500/40 animate-[spin_10s_linear_infinite]" />
          <div className="absolute inset-1 rounded-2xl border border-dashed border-cyan-400/50 animate-[spin_15s_linear_infinite_reverse]" />
          <img
            src={appIcon}
            alt="OpenJarvis Arc Reactor Icon"
            referrerPolicy="no-referrer"
            className="w-14 h-14 rounded-xl border border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.6)] object-cover relative z-10"
          />
        </div>

        {/* STEP 1 : USER NAME REQUEST */}
        {step === 'name' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/20">
                  Protocole d'Identification
                </span>
              </div>
              <h1 className="text-xl font-bold text-slate-100">Initialisation de J.A.R.V.I.S.</h1>
              <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                « Mes salutations. Avant que nous n'activions vos protocoles, comment souhaitez-vous que je m'adresse à vous, Monsieur ? »
              </p>
            </div>

            <form onSubmit={handleConfirmName} className="space-y-4">
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-3.5 text-cyan-400" />
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Entrez votre nom (ex: Stark, Alex...)"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full bg-slate-950 border border-cyan-500/40 rounded-2xl pl-10 pr-4 py-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-cyan-500/25 active:scale-95"
              >
                <span>Confirmer l'Identité</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* STEP 2 : SECURITY CODE / VOCAL IDENTITY CONFIRMATION */}
        {step === 'security' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-amber-400" />
                  Sécurité & Clé Vocale
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-100">Code de Confirmation d'Identité</h2>
              <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                « Comme je dispose d'un accès complet à votre téléphone, définissez votre code secret. Vous devrez l'énoncer ou le saisir à l'activation pour empêcher tout tiers d'en prendre le contrôle. »
              </p>
            </div>

            <form onSubmit={handleConfirmSecurityCode} className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-cyan-400" />
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Code PIN ou phrase vocale (ex: 4920, Stark-01...)"
                    value={securityCode}
                    onChange={(e) => setSecurityCode(e.target.value)}
                    className="w-full bg-slate-950 border border-cyan-500/40 rounded-2xl pl-10 pr-24 py-3 text-sm font-mono tracking-wider text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={startVoiceCodeListening}
                    className={`absolute right-2 top-2 px-3 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      isListeningCode
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30'
                    }`}
                  >
                    <Mic className="w-3 h-3" />
                    <span>{isListeningCode ? 'Écoute...' : 'Dicter'}</span>
                  </button>
                </div>

                {spokenCodePreview && (
                  <p className="text-[11px] text-cyan-400 font-mono text-left px-2">
                    Voix détectée : « {spokenCodePreview} »
                  </p>
                )}

                <div className="flex items-center gap-1.5 justify-center pt-1 text-[11px] text-slate-400">
                  <span>Exemples :</span>
                  {['4920', '1042', 'Stark-01', '7700'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setSecurityCode(preset)}
                      className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono hover:text-cyan-300 transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-cyan-500/30 active:scale-95"
              >
                <Lock className="w-4 h-4" />
                <span>Enregistrer le Code & Continuer</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* STEP 3 : PROGRESSIVE 12-STEP ANDROID PERMISSION WIZARD */}
        {step === 'permissions' && (
          <div className="space-y-4 animate-in fade-in duration-300 flex-1 flex flex-col overflow-hidden text-left">
            <div className="text-center space-y-1">
              <div className="flex items-center justify-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/20">
                  Configuration Initiale des Autorisations
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-100">
                Bienvenue dans JARVIS, Monsieur <span className="text-cyan-400">{userName}</span>
              </h2>
              <p className="text-xs text-slate-300 max-w-lg mx-auto">
                « Pour fonctionner avec toutes les capacités Android disponibles, JARVIS doit être configuré. Aucune permission n'est simulée. »
              </p>
            </div>

            {/* Status summary bar */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span className="text-slate-300">
                  Progression : <strong className="text-cyan-400">{grantedCount}</strong> sur <strong>{ONBOARDING_PERMISSIONS.length}</strong> autorisées
                </span>
              </div>
              <button
                onClick={handleGrantAll}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-2 cursor-pointer"
              >
                Demander tout
              </button>
            </div>

            {/* Scrollable list of 12 progressive permissions */}
            <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
              {ONBOARDING_PERMISSIONS.map((item) => {
                const status = permissionStates[item.id] || 'prompt';
                const isGranted = status === 'granted';
                const IconComponent = item.icon;

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                      isGranted
                        ? 'bg-emerald-950/20 border-emerald-500/30'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-xl border shrink-0 mt-0.5 ${
                        isGranted
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                      }`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-slate-500">#{item.stepNumber}</span>
                          <h4 className="text-xs font-bold text-slate-100">{item.name}</h4>
                        </div>
                        <p className="text-[11px] text-slate-300">{item.whyNeeded}</p>
                        {!isGranted && (
                          <p className="text-[10px] text-amber-400 flex items-center gap-1 mt-1">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>Si refusée : {item.consequenceIfDenied}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isGranted ? (
                        <div className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-xs font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Accordée</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleRequestSinglePermission(item.id)}
                          className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-md shadow-cyan-500/20 cursor-pointer active:scale-95 transition-all"
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

            {/* Bottom Actions */}
            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={handleProceedToFinal}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-cyan-500/30 active:scale-95"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Valider la Configuration et Activer J.A.R.V.I.S.</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 : SYNCED & ARC REACTOR 100% */}
        {step === 'synced' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  Système 100% Opérationnel
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-100">Tous les Systèmes Sont en Ligne</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                « Matrice neuronale et protection d'accès synchronisées avec succès, Monsieur <strong className="text-cyan-300">{userName}</strong>. Groq AI, Gemini et les modules matériels sont sous vos ordres. »
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 text-xs space-y-2">
              <div className="flex items-center justify-between text-cyan-300">
                <span className="font-semibold">Niveau d'Énergie Arc Reactor</span>
                <span className="font-bold font-mono">{reactorPower}%</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-cyan-500/30">
                <div className="bg-cyan-400 h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_#22d3ee]" style={{ width: `${reactorPower}%` }} />
              </div>
            </div>

            <button
              onClick={handleFinish}
              className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-cyan-500/30 active:scale-95"
            >
              <span>Accéder au Centre de Commande</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
