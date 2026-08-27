/**
 * JARVIS ANDROID PERMISSION AUDITOR & ENFORCEMENT REGISTRY
 *
 * Provides official auditing, classification, rationale, and official activation intents
 * for all 17 Android permissions and system capabilities.
 * 
 * Rules enforced:
 * 1. Never simulate permissions as granted when they are not.
 * 2. Never bypass Android native authorization channels.
 * 3. Never use permissions for unrelated tasks.
 */

import { AndroidPermissionType, AndroidPermissionAuditRecord, AndroidPermissionStatus } from '../../../types/index.js';

export interface AndroidPermissionMetadata {
  id: AndroidPermissionType;
  name: string;
  category: 'core' | 'privacy' | 'system' | 'device_admin';
  categoryLabel: string;
  kind: 'runtime' | 'special_access' | 'service_binding' | 'device_admin_policy';
  kindLabel: string;
  declaredManifest: boolean;
  targetApiMin: number;
  whyNeeded: string;
  officialIntentAction?: string | null;
  settingsResolutionPath: string;
  iconName: string;
  isCritical: boolean;
  relatedAgents: string[];
}

export const ALL_ANDROID_PERMISSIONS: AndroidPermissionMetadata[] = [
  {
    id: 'microphone',
    name: 'Microphone & Écoute Vocale',
    category: 'core',
    categoryLabel: 'Matériel & Audio Core',
    kind: 'runtime',
    kindLabel: 'Permission Runtime Dangereuse',
    declaredManifest: true,
    targetApiMin: 1,
    whyNeeded: "Détection du mot-clé de réveil 'Hey Jarvis', dictée vocale continue et traitement des commandes conversationnelles.",
    officialIntentAction: null,
    settingsResolutionPath: "Demande runtime ActivityCompat.requestPermissions / Paramètres de l'application",
    iconName: 'Mic',
    isCritical: true,
    relatedAgents: ['voice', 'supervisor', 'general_ai'],
  },
  {
    id: 'camera',
    name: 'Caméra & Analyse Multimodale',
    category: 'core',
    categoryLabel: 'Matériel & Vision Core',
    kind: 'runtime',
    kindLabel: 'Permission Runtime Dangereuse',
    declaredManifest: true,
    targetApiMin: 1,
    whyNeeded: "Capture de documents pour analyse OCR, identification d'objets physiques et assistance visuelle instantanée.",
    officialIntentAction: null,
    settingsResolutionPath: "Demande runtime ActivityCompat.requestPermissions / Paramètres de l'application",
    iconName: 'Camera',
    isCritical: true,
    relatedAgents: ['vision', 'screen'],
  },
  {
    id: 'notifications',
    name: 'Notifications Système (POST_NOTIFICATIONS)',
    category: 'privacy',
    categoryLabel: 'Communications & Alertes',
    kind: 'runtime',
    kindLabel: 'Permission Runtime Android 13+ (Tiramisu)',
    declaredManifest: true,
    targetApiMin: 33,
    whyNeeded: "Alertes de rappels programmés, alarmes prioritaires et notification des résultats d'agents en arrière-plan.",
    officialIntentAction: 'android.settings.APP_NOTIFICATION_SETTINGS',
    settingsResolutionPath: "Paramètres > Applications > J.A.R.V.I.S. > Notifications",
    iconName: 'Bell',
    isCritical: false,
    relatedAgents: ['reminder', 'task', 'routine', 'supervisor'],
  },
  {
    id: 'notification_listener',
    name: 'Écoute des Notifications (NotificationListenerService)',
    category: 'privacy',
    categoryLabel: 'Communications & Alertes',
    kind: 'service_binding',
    kindLabel: 'Accès Spécial Système (Service Lié)',
    declaredManifest: true,
    targetApiMin: 18,
    whyNeeded: "Détection des messages entrants (WhatsApp, SMS, Telegram) pour lecture vocale intelligente et préparation des réponses autorisées.",
    officialIntentAction: 'android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS',
    settingsResolutionPath: "Paramètres > Sécurité et confidentialité > Accès spécial > Accès aux notifications",
    iconName: 'MessageSquare',
    isCritical: true,
    relatedAgents: ['communication', 'phone', 'supervisor'],
  },
  {
    id: 'contacts',
    name: 'Contacts & Carnet d\'Adresses (READ/WRITE_CONTACTS)',
    category: 'privacy',
    categoryLabel: 'Données Personnelles',
    kind: 'runtime',
    kindLabel: 'Permission Runtime Dangereuse',
    declaredManifest: true,
    targetApiMin: 1,
    whyNeeded: "Résolution des noms de correspondants pour les appels téléphoniques, envoi de SMS et suggestions de messages personnalisés.",
    officialIntentAction: null,
    settingsResolutionPath: "Demande runtime ActivityCompat.requestPermissions",
    iconName: 'Users',
    isCritical: true,
    relatedAgents: ['phone', 'communication', 'personal_assistant'],
  },
  {
    id: 'calendar',
    name: 'Calendrier & Agenda (READ/WRITE_CALENDAR)',
    category: 'privacy',
    categoryLabel: 'Données Personnelles',
    kind: 'runtime',
    kindLabel: 'Permission Runtime Dangereuse',
    declaredManifest: true,
    targetApiMin: 1,
    whyNeeded: "Consultation des événements de la journée, détection des conflits d'horaires et planification vocale autonome.",
    officialIntentAction: null,
    settingsResolutionPath: "Demande runtime ActivityCompat.requestPermissions",
    iconName: 'Calendar',
    isCritical: false,
    relatedAgents: ['personal_assistant', 'routine', 'task'],
  },
  {
    id: 'phone',
    name: 'Téléphone & Appels Vocaux (CALL_PHONE / READ_PHONE_STATE)',
    category: 'privacy',
    categoryLabel: 'Communications & Appels',
    kind: 'runtime',
    kindLabel: 'Permission Runtime Dangereuse',
    declaredManifest: true,
    targetApiMin: 1,
    whyNeeded: "Composition et émission directe d'appels téléphoniques vocaux après confirmation explicite de l'utilisateur.",
    officialIntentAction: null,
    settingsResolutionPath: "Demande runtime ActivityCompat.requestPermissions",
    iconName: 'Phone',
    isCritical: true,
    relatedAgents: ['phone', 'communication'],
  },
  {
    id: 'sms',
    name: 'SMS & Textos (SEND_SMS / READ_SMS / RECEIVE_SMS)',
    category: 'privacy',
    categoryLabel: 'Communications & Appels',
    kind: 'runtime',
    kindLabel: 'Permission Runtime Dangereuse',
    declaredManifest: true,
    targetApiMin: 1,
    whyNeeded: "Envoi sécurisé de SMS et accusé de transmission instantané.",
    officialIntentAction: null,
    settingsResolutionPath: "Demande runtime ActivityCompat.requestPermissions",
    iconName: 'Mail',
    isCritical: true,
    relatedAgents: ['phone', 'communication'],
  },
  {
    id: 'geolocation',
    name: 'Localisation GPS Précise (ACCESS_FINE/COARSE_LOCATION)',
    category: 'privacy',
    categoryLabel: 'Contexte & Environnement',
    kind: 'runtime',
    kindLabel: 'Permission Runtime Dangereuse',
    declaredManifest: true,
    targetApiMin: 1,
    whyNeeded: "Météo locale temps réel certifiée (OpenWeather), itinéraires Google Maps et recherche de lieux à proximité.",
    officialIntentAction: null,
    settingsResolutionPath: "Demande runtime ActivityCompat.requestPermissions (Précise / Approximative)",
    iconName: 'MapPin',
    isCritical: false,
    relatedAgents: ['weather', 'context', 'routine'],
  },
  {
    id: 'bluetooth',
    name: 'Bluetooth & Objets Connectés (BLUETOOTH_CONNECT / SCAN)',
    category: 'core',
    categoryLabel: 'Connectivité Matérielle',
    kind: 'runtime',
    kindLabel: 'Permission Runtime Android 12+ (S)',
    declaredManifest: true,
    targetApiMin: 31,
    whyNeeded: "Détection et appairage avec les écouteurs audio, montres connectées et périphériques domotiques Bluetooth LE.",
    officialIntentAction: 'android.settings.BLUETOOTH_SETTINGS',
    settingsResolutionPath: "Paramètres > Bluetooth & Appareils connectés",
    iconName: 'Bluetooth',
    isCritical: false,
    relatedAgents: ['media', 'routine', 'smart_home'],
  },
  {
    id: 'storage',
    name: 'Stockage & Fichiers Multimédia (READ_MEDIA_* / STORAGE)',
    category: 'privacy',
    categoryLabel: 'Données Personnelles',
    kind: 'runtime',
    kindLabel: 'Permission Runtime Scoped Storage',
    declaredManifest: true,
    targetApiMin: 1,
    whyNeeded: "Indexation, résumé de fichiers PDF, lecture d'images et documents choisis par l'utilisateur pour la base de connaissances.",
    officialIntentAction: null,
    settingsResolutionPath: "Demande runtime PhotoPicker / READ_MEDIA_*",
    iconName: 'FolderLock',
    isCritical: false,
    relatedAgents: ['memory', 'data_sources', 'vision'],
  },
  {
    id: 'overlay',
    name: 'Affichage Flottant par-dessus les Applications (SYSTEM_ALERT_WINDOW)',
    category: 'system',
    categoryLabel: 'Accès Spécial Système',
    kind: 'special_access',
    kindLabel: 'Autorisation Spéciale Paramètres',
    declaredManifest: true,
    targetApiMin: 23,
    whyNeeded: "Affichage de la bulle vocale JARVIS et du HUD d'assistance interactive au-dessus de n'importe quelle application ouverte.",
    officialIntentAction: 'android.settings.action.MANAGE_OVERLAY_PERMISSION',
    settingsResolutionPath: "Paramètres > Applications > Accès spécial > Afficher sur d'autres applications",
    iconName: 'Layers',
    isCritical: true,
    relatedAgents: ['voice', 'screen', 'supervisor'],
  },
  {
    id: 'accessibility',
    name: 'Service d\'Accessibilité (Inspection UI & Automatisation)',
    category: 'system',
    categoryLabel: 'Accès Spécial Système',
    kind: 'service_binding',
    kindLabel: 'Service d\'Accessibilité Déclaré',
    declaredManifest: true,
    targetApiMin: 14,
    whyNeeded: "Lecture de l'arborescence UI, compréhension contextuelle de l'application active et assistance interactive sans capture continue.",
    officialIntentAction: 'android.settings.ACCESSIBILITY_SETTINGS',
    settingsResolutionPath: "Paramètres > Accessibilité > J.A.R.V.I.S. Core Accessibility Service",
    iconName: 'Eye',
    isCritical: true,
    relatedAgents: ['screen', 'routine', 'context'],
  },
  {
    id: 'screen_capture',
    name: 'Capture d\'Écran Ponctuelle (MediaProjection API)',
    category: 'system',
    categoryLabel: 'Vision & Écran',
    kind: 'special_access',
    kindLabel: 'Dialogue de Consentement Système MediaProjection',
    declaredManifest: true,
    targetApiMin: 21,
    whyNeeded: "Capture ponctuelle à la demande avec dialogue de consentement Android officiel pour le diagnostic visuel et OCR.",
    officialIntentAction: null,
    settingsResolutionPath: "MediaProjectionManager.createScreenCaptureIntent() avec consentement explicite",
    iconName: 'Monitor',
    isCritical: true,
    relatedAgents: ['vision', 'screen'],
  },
  {
    id: 'assistant',
    name: 'Assistant Vocal & Interaction par Défaut (Assist Intent)',
    category: 'system',
    categoryLabel: 'Rôle & Système Android',
    kind: 'special_access',
    kindLabel: 'Rôle d\'Application d\'Assistance Numérique',
    declaredManifest: true,
    targetApiMin: 23,
    whyNeeded: "Déclenchement direct de JARVIS par appui long sur le bouton d'alimentation ou geste d'accueil Android.",
    officialIntentAction: 'android.settings.VOICE_INPUT_SETTINGS',
    settingsResolutionPath: "Paramètres > Applications par défaut > Application d'assistance numérique",
    iconName: 'Bot',
    isCritical: true,
    relatedAgents: ['voice', 'supervisor'],
  },
  {
    id: 'device_admin',
    name: 'Super Administrateur de l\'Appareil (DevicePolicyManager)',
    category: 'device_admin',
    categoryLabel: 'Supervision & Sécurité Matérielle',
    kind: 'device_admin_policy',
    kindLabel: 'Politique d\'Administration de l\'Appareil',
    declaredManifest: true,
    targetApiMin: 8,
    whyNeeded: "Verrouillage immédiat sur ordre de sécurité, application des mises à jour OTA et politiques de protection renforcée.",
    officialIntentAction: 'android.app.action.ADD_DEVICE_ADMIN',
    settingsResolutionPath: "Paramètres > Sécurité et confidentialité > Administrateurs de l'appareil",
    iconName: 'ShieldAlert',
    isCritical: true,
    relatedAgents: ['security', 'supervisor'],
  },
  {
    id: 'vibration',
    name: 'Retour Haptique & Vibrations Système (VIBRATE)',
    category: 'core',
    categoryLabel: 'Matériel & Audio Core',
    kind: 'runtime',
    kindLabel: 'Permission Normale (Protection Standard)',
    declaredManifest: true,
    targetApiMin: 1,
    whyNeeded: "Retour tactile physique immédiat lors de la reconnaissance vocale et validation des actions.",
    officialIntentAction: null,
    settingsResolutionPath: "Accordée automatiquement par le système Android (Protection Normale)",
    iconName: 'Activity',
    isCritical: false,
    relatedAgents: ['voice', 'routine'],
  },
];

export type AndroidCapabilityStatus =
  | 'AVAILABLE'
  | 'AUTHORIZED'
  | 'NOT_AUTHORIZED'
  | 'REQUIRES_ROLE'
  | 'REQUIRES_USER_ACTION'
  | 'UNAVAILABLE';

export interface AndroidCapabilityEvaluation {
  id: AndroidPermissionType;
  name: string;
  status: AndroidCapabilityStatus;
  isOperable: boolean;
  reason: string;
  officialResolutionSteps: string;
  officialIntentAction: string | null;
  targetApiMin: number;
}

export class AndroidPermissionAuditor {
  private static permissionStates: Map<AndroidPermissionType, AndroidPermissionStatus> = new Map();

  static initialize(): void {
    for (const perm of ALL_ANDROID_PERMISSIONS) {
      if (!this.permissionStates.has(perm.id)) {
        // Default based on browser/server environment
        if (perm.id === 'vibration') {
          this.permissionStates.set(perm.id, 'granted');
        } else {
          this.permissionStates.set(perm.id, 'prompt');
        }
      }
    }
  }

  /**
   * Official Capability Check - NEVER assumes granted, returns exact operational status.
   */
  static checkCapability(id: AndroidPermissionType): AndroidCapabilityEvaluation {
    this.initialize();
    const meta = ALL_ANDROID_PERMISSIONS.find((p) => p.id === id);
    if (!meta) {
      return {
        id,
        name: id,
        status: 'UNAVAILABLE',
        isOperable: false,
        reason: "Capacité matérielle ou logicielle inconnue sur ce système.",
        officialResolutionSteps: "Vérifier la compatibilité matérielle de l'appareil.",
        officialIntentAction: null,
        targetApiMin: 1,
      };
    }

    const currentStatus = this.permissionStates.get(id) || 'prompt';

    if (currentStatus === 'granted') {
      return {
        id,
        name: meta.name,
        status: 'AUTHORIZED',
        isOperable: true,
        reason: "Autorisation accordée et vérifiée auprès d'Android.",
        officialResolutionSteps: "Opérationnel",
        officialIntentAction: meta.officialIntentAction || null,
        targetApiMin: meta.targetApiMin,
      };
    }

    if (currentStatus === 'unsupported') {
      return {
        id,
        name: meta.name,
        status: 'UNAVAILABLE',
        isOperable: false,
        reason: `Capacité non prise en charge par ce modèle ou cette version d'Android (Requis API ${meta.targetApiMin}+).`,
        officialResolutionSteps: "Mise à niveau matérielle ou version Android requise.",
        officialIntentAction: null,
        targetApiMin: meta.targetApiMin,
      };
    }

    if (meta.id === 'assistant') {
      return {
        id,
        name: meta.name,
        status: 'REQUIRES_ROLE',
        isOperable: false,
        reason: "Nécessite la sélection explicite de J.A.R.V.I.S. comme application d'assistance numérique par défaut.",
        officialResolutionSteps: meta.settingsResolutionPath,
        officialIntentAction: meta.officialIntentAction || 'android.settings.VOICE_INPUT_SETTINGS',
        targetApiMin: meta.targetApiMin,
      };
    }

    if (meta.kind === 'special_access' || meta.kind === 'service_binding' || meta.kind === 'device_admin_policy') {
      return {
        id,
        name: meta.name,
        status: 'REQUIRES_USER_ACTION',
        isOperable: false,
        reason: `Nécessite une activation manuelle dans les paramètres Android (${meta.kindLabel}).`,
        officialResolutionSteps: meta.settingsResolutionPath,
        officialIntentAction: meta.officialIntentAction || null,
        targetApiMin: meta.targetApiMin,
      };
    }

    return {
      id,
      name: meta.name,
      status: 'NOT_AUTHORIZED',
      isOperable: false,
      reason: "Autorisation non accordée. Requiert la confirmation de l'utilisateur.",
      officialResolutionSteps: meta.settingsResolutionPath,
      officialIntentAction: meta.officialIntentAction || null,
      targetApiMin: meta.targetApiMin,
    };
  }

  static getAuditReport(): AndroidPermissionAuditRecord[] {
    this.initialize();
    return ALL_ANDROID_PERMISSIONS.map((meta) => {
      const status = this.permissionStates.get(meta.id) || 'prompt';
      return {
        id: meta.id,
        name: meta.name,
        category: meta.category,
        categoryLabel: meta.categoryLabel,
        kind: meta.kind,
        kindLabel: meta.kindLabel,
        declaredManifest: meta.declaredManifest,
        targetApiMin: meta.targetApiMin,
        isGranted: status === 'granted',
        status,
        whyNeeded: meta.whyNeeded,
        officialIntentAction: meta.officialIntentAction,
        settingsResolutionPath: meta.settingsResolutionPath,
        iconName: meta.iconName,
        isCritical: meta.isCritical,
      };
    });
  }

  static updatePermissionStatus(id: AndroidPermissionType, status: AndroidPermissionStatus): boolean {
    this.initialize();
    this.permissionStates.set(id, status);
    return true;
  }

  static getPermissionStatus(id: AndroidPermissionType): AndroidPermissionStatus {
    this.initialize();
    return this.permissionStates.get(id) || 'prompt';
  }
}
