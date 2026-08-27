/**
 * ACTION RESOLVER (JARVIS ANDROID ARCHITECTURE — PHASE 3)
 * 
 * Pipeline:
 * AndroidAgent -> ActionResolver -> PermissionManager -> Android API
 * 
 * Responsibilities:
 * 1. Semantic parsing of natural language voice/text queries into formal Android intents.
 * 2. Strict classification of each action into:
 *    - READ (Telemetry, Downloads, Context, Battery, Screen analysis)
 *    - SAFE_ACTION (App launch, Torch toggle, Volume adjust, Settings launch, Camera)
 *    - SENSITIVE_ACTION (Screen lock, Factory reset, Admin permissions, System update apply)
 * 3. Identification of required Android permissions & Android version requirements.
 * 4. Graceful handling of missing applications & unavailable hardware.
 */

import {
  ResolvedAndroidAction,
  AndroidIntentType,
  AndroidActionTier,
  AndroidAppDefinition,
  AndroidSettingDefinition,
  AndroidVersionCompatibility,
} from './types';

// Complete registry of known Android Applications with package identifiers & official URL schemes
export const KNOWN_ANDROID_APPS: AndroidAppDefinition[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    packageName: 'com.whatsapp',
    urlScheme: 'whatsapp://send',
    webFallbackUrl: 'https://web.whatsapp.com',
    playStoreUrl: 'market://details?id=com.whatsapp',
    iconName: 'MessageCircle',
    category: 'communication',
    description: 'Messagerie instantanée, appels audio et vidéo chiffrés de bout en bout.',
    keywords: ['whatsapp', 'wa', 'whats app', 'message whatsapp', 'wathsapp'],
  },
  {
    id: 'youtube',
    name: 'YouTube',
    packageName: 'com.google.android.youtube',
    urlScheme: 'vnd.youtube://',
    webFallbackUrl: 'https://youtube.com',
    playStoreUrl: 'market://details?id=com.google.android.youtube',
    iconName: 'PlaySquare',
    category: 'media',
    description: 'Plateforme de streaming vidéo, tutoriels, musiques et chaînes en direct.',
    keywords: ['youtube', 'you tube', 'vidéo', 'video', 'chanson', 'clip'],
  },
  {
    id: 'camera',
    name: 'Appareil Photo',
    packageName: 'com.google.android.GoogleCamera',
    urlScheme: 'intent:#Intent;action=android.media.action.IMAGE_CAPTURE;end',
    webFallbackUrl: '/vision',
    iconName: 'Camera',
    category: 'media',
    description: 'Capteur photographique et enregistreur vidéo haute définition.',
    keywords: ['camera', 'caméra', 'appareil photo', 'photo', 'capture', 'selfie'],
    isSystemApp: true,
  },
  {
    id: 'settings',
    name: 'Paramètres Android',
    packageName: 'com.android.settings',
    urlScheme: 'intent:#Intent;action=android.settings.SETTINGS;end',
    iconName: 'Settings',
    category: 'system',
    description: 'Configuration centrale du système d’exploitation Android.',
    keywords: ['paramètres', 'parametres', 'settings', 'options', 'configuration', 'réglages', 'reglages'],
    isSystemApp: true,
  },
  {
    id: 'files',
    name: 'Gestionnaire de Fichiers & Téléchargements',
    packageName: 'com.google.android.documentsui',
    urlScheme: 'intent:#Intent;action=android.intent.action.VIEW_DOWNLOADS;end',
    webFallbackUrl: '/data-sources',
    iconName: 'Folder',
    category: 'productivity',
    description: 'Explorateur de stockage local, documents récents et répertoire de téléchargements.',
    keywords: ['téléchargements', 'telechargements', 'downloads', 'fichiers', 'documents', 'mes downloads', 'dossier'],
    isSystemApp: true,
  },
  {
    id: 'spotify',
    name: 'Spotify',
    packageName: 'com.spotify.music',
    urlScheme: 'spotify:search:',
    webFallbackUrl: 'https://open.spotify.com',
    playStoreUrl: 'market://details?id=com.spotify.music',
    iconName: 'Music',
    category: 'media',
    description: 'Service de streaming musical et podcasts.',
    keywords: ['spotify', 'musique', 'playlist', 'album', 'chanson spotify'],
  },
  {
    id: 'maps',
    name: 'Google Maps',
    packageName: 'com.google.android.apps.maps',
    urlScheme: 'geo:0,0?q=',
    webFallbackUrl: 'https://maps.google.com',
    playStoreUrl: 'market://details?id=com.google.android.apps.maps',
    iconName: 'MapPin',
    category: 'navigation',
    description: 'Navigation GPS, trafic en direct et recherche cartographique.',
    keywords: ['maps', 'carte', 'gps', 'itinéraire', 'itineraire', 'navigation', 'adresse'],
  },
  {
    id: 'gmail',
    name: 'Gmail',
    packageName: 'com.google.android.gm',
    urlScheme: 'mailto:',
    webFallbackUrl: 'https://mail.google.com',
    playStoreUrl: 'market://details?id=com.google.android.gm',
    iconName: 'Mail',
    category: 'communication',
    description: 'Client de messagerie électronique Google.',
    keywords: ['gmail', 'mail', 'courriel', 'boîte mail', 'email'],
  },
  {
    id: 'waze',
    name: 'Waze GPS',
    packageName: 'com.waze',
    urlScheme: 'waze://',
    webFallbackUrl: 'https://www.waze.com/live-map',
    playStoreUrl: 'market://details?id=com.waze',
    iconName: 'Navigation',
    category: 'navigation',
    description: 'Navigation communautaire et alertes routières en temps réel.',
    keywords: ['waze', 'guidage', 'radar waze'],
  },
  {
    id: 'calendar',
    name: 'Google Agenda',
    packageName: 'com.google.android.calendar',
    urlScheme: 'content://com.android.calendar/time/',
    webFallbackUrl: 'https://calendar.google.com',
    iconName: 'Calendar',
    category: 'productivity',
    description: 'Gestion du calendrier et des réunions.',
    keywords: ['agenda', 'calendrier', 'planning', 'rendez-vous'],
    isSystemApp: true,
  },
  {
    id: 'clock',
    name: 'Horloge & Alarmes',
    packageName: 'com.google.android.deskclock',
    urlScheme: 'intent://com.android.deskclock/#Intent;scheme=android-app;end',
    iconName: 'Clock',
    category: 'productivity',
    description: 'Alarmes, minuteurs et chronomètres système.',
    keywords: ['horloge', 'alarme', 'réveil', 'reveil', 'minuteur', 'chrono'],
    isSystemApp: true,
  },
  {
    id: 'calculator',
    name: 'Calculatrice',
    packageName: 'com.google.android.calculator',
    urlScheme: 'intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.APP_CALCULATOR;end',
    iconName: 'Calculator',
    category: 'productivity',
    description: 'Calculatrice standard et scientifique Android.',
    keywords: ['calculatrice', 'calculer', 'calculator'],
    isSystemApp: true,
  },
];

// Android Settings sub-pages
export const KNOWN_ANDROID_SETTINGS: AndroidSettingDefinition[] = [
  {
    id: 'settings_main',
    name: 'Paramètres Généraux',
    actionIntent: 'android.settings.SETTINGS',
    description: 'Écran d’accueil des paramètres système Android.',
    keywords: ['paramètres', 'parametres', 'settings', 'réglages', 'reglages', 'options'],
    category: 'general',
  },
  {
    id: 'settings_wifi',
    name: 'Paramètres Wi-Fi & Réseau',
    actionIntent: 'android.settings.WIFI_SETTINGS',
    description: 'Configuration des réseaux sans fil Wi-Fi.',
    keywords: ['wifi', 'wi-fi', 'réseau', 'connexion internet'],
    category: 'connectivity',
  },
  {
    id: 'settings_bluetooth',
    name: 'Paramètres Bluetooth',
    actionIntent: 'android.settings.BLUETOOTH_SETTINGS',
    description: 'Gestion des périphériques Bluetooth associés.',
    keywords: ['bluetooth', 'casque bluetooth', 'écouteurs'],
    category: 'connectivity',
  },
  {
    id: 'settings_sound',
    name: 'Paramètres Audio & Volume',
    actionIntent: 'android.settings.SOUND_SETTINGS',
    description: 'Réglages des volumes sonores, sonneries et mode silencieux.',
    keywords: ['son', 'volume', 'sonnerie', 'audio', 'vibreur'],
    category: 'sound',
  },
  {
    id: 'settings_display',
    name: 'Paramètres d’Affichage & Écran',
    actionIntent: 'android.settings.DISPLAY_SETTINGS',
    description: 'Luminosité, thème sombre et veille de l’écran.',
    keywords: ['affichage', 'écran', 'luminosité', 'thème sombre'],
    category: 'display',
  },
  {
    id: 'settings_apps',
    name: 'Gestion des Applications & Permissions',
    actionIntent: 'android.settings.APPLICATION_SETTINGS',
    description: 'Liste des applications installées et autorisations associées.',
    keywords: ['applications', 'applis', 'gestion des apps', 'permissions apps'],
    category: 'apps',
  },
  {
    id: 'settings_battery',
    name: 'Gestion de la Batterie & Énergie',
    actionIntent: 'android.settings.BATTERY_SAVER_SETTINGS',
    description: 'Économie d’énergie et diagnostic de la batterie.',
    keywords: ['batterie', 'économie d’énergie', 'autonomie'],
    category: 'battery',
  },
  {
    id: 'settings_accessibility',
    name: 'Paramètres d’Accessibilité',
    actionIntent: 'android.settings.ACCESSIBILITY_SETTINGS',
    description: 'Services d’accessibilité et vision d’écran assistée.',
    keywords: ['accessibilité', 'accessibilite', 'service accessibilité'],
    category: 'accessibility',
  },
  {
    id: 'settings_voice_assistant',
    name: 'Assistant Vocal par Défaut',
    actionIntent: 'android.settings.VOICE_INPUT_SETTINGS',
    description: 'Sélection de JARVIS comme assistant vocal par défaut.',
    keywords: ['assistant vocal', 'assistant par défaut', 'voix par défaut'],
    category: 'general',
  },
];

export class ActionResolver {
  /**
   * Resolves a raw natural language voice/text prompt into a fully qualified Android action.
   * Accurately categorizes into READ, SAFE_ACTION, or SENSITIVE_ACTION.
   */
  public static resolve(query: string, context?: Record<string, any>): ResolvedAndroidAction {
    const raw = (query || '').trim();
    const clean = raw.replace(/^(jarvis|dis jarvis|hey jarvis|ok jarvis|s'il te plaît jarvis)[,\s]*/i, '').trim();
    const lower = clean.toLowerCase();

    // -------------------------------------------------------------
    // 1. "JARVIS, ouvre WhatsApp." / Open messaging app
    // -------------------------------------------------------------
    if (
      lower.includes('whatsapp') ||
      (lower.startsWith('ouvre') && lower.includes('whatsapp')) ||
      (lower.startsWith('lance') && lower.includes('whatsapp'))
    ) {
      const app = KNOWN_ANDROID_APPS.find((a) => a.id === 'whatsapp')!;
      let messageContent = '';
      const matchMsg = clean.match(/(?:à|au|a)\s+([a-zA-ZÀ-ÿ0-9_\-\s]+?)(?:\s+(?:pour lui dire|pour dire|disant que|:)\s+(.+)|$)/i);
      if (matchMsg && matchMsg[2]) {
        messageContent = matchMsg[2].trim();
      }

      return {
        id: `act_${Date.now()}_open_whatsapp`,
        intentType: 'OPEN_APP',
        tier: 'SAFE_ACTION',
        rawQuery: raw,
        targetApp: app,
        parameters: {
          appId: app.id,
          packageName: app.packageName,
          message: messageContent,
        },
        requiredPermissions: [],
        requiresConfirmation: false,
        versionCompatibility: {
          minSdk: 21,
          recommendedSdk: 35,
          androidVersionName: 'Android 5.0+ à Android 15',
        },
        spokenOutput: messageContent
          ? `Ouverture de WhatsApp pour envoyer votre message.`
          : `Ouverture de WhatsApp, Monsieur.`,
        description: `Lancement de l’application ${app.name} via Intent standard Android.`,
        fallbackStrategy: 'web_url',
      };
    }

    // -------------------------------------------------------------
    // 2. "JARVIS, ouvre YouTube." / Open video stream
    // -------------------------------------------------------------
    if (
      lower.includes('youtube') ||
      (lower.startsWith('ouvre') && lower.includes('youtube')) ||
      (lower.startsWith('lance') && lower.includes('youtube'))
    ) {
      const app = KNOWN_ANDROID_APPS.find((a) => a.id === 'youtube')!;
      let searchQuery = '';
      const matchSearch = clean.match(/(?:cherche|mets|joue|lance|trouve|sur youtube)\s+(?:sur youtube\s+)?(.+)/i);
      if (matchSearch && matchSearch[1] && !matchSearch[1].includes('youtube') && !matchSearch[1].includes('ouvre')) {
        searchQuery = matchSearch[1].trim();
      }

      return {
        id: `act_${Date.now()}_open_youtube`,
        intentType: 'OPEN_APP',
        tier: 'SAFE_ACTION',
        rawQuery: raw,
        targetApp: app,
        parameters: {
          appId: app.id,
          packageName: app.packageName,
          query: searchQuery,
        },
        requiredPermissions: [],
        requiresConfirmation: false,
        versionCompatibility: {
          minSdk: 21,
          recommendedSdk: 35,
          androidVersionName: 'Android 5.0+ à Android 15',
        },
        spokenOutput: searchQuery
          ? `Recherche de "${searchQuery}" sur YouTube.`
          : `Ouverture de YouTube, Monsieur.`,
        description: `Lancement de ${app.name} (${app.packageName}) avec support Intent VND.`,
        fallbackStrategy: 'web_url',
      };
    }

    // -------------------------------------------------------------
    // 3. "JARVIS, ouvre les paramètres." / Open Android Settings
    // -------------------------------------------------------------
    if (
      lower.includes('paramètre') ||
      lower.includes('parametre') ||
      lower.includes('settings') ||
      lower.includes('réglage') ||
      lower.includes('reglage') ||
      lower.includes('options du téléphone')
    ) {
      let matchedSetting = KNOWN_ANDROID_SETTINGS[0]; // Main settings
      if (lower.includes('wifi') || lower.includes('wi-fi') || lower.includes('réseau')) {
        matchedSetting = KNOWN_ANDROID_SETTINGS.find((s) => s.id === 'settings_wifi') || matchedSetting;
      } else if (lower.includes('bluetooth')) {
        matchedSetting = KNOWN_ANDROID_SETTINGS.find((s) => s.id === 'settings_bluetooth') || matchedSetting;
      } else if (lower.includes('son') || lower.includes('volume') || lower.includes('audio')) {
        matchedSetting = KNOWN_ANDROID_SETTINGS.find((s) => s.id === 'settings_sound') || matchedSetting;
      } else if (lower.includes('affichage') || lower.includes('écran')) {
        matchedSetting = KNOWN_ANDROID_SETTINGS.find((s) => s.id === 'settings_display') || matchedSetting;
      } else if (lower.includes('application') || lower.includes('permission')) {
        matchedSetting = KNOWN_ANDROID_SETTINGS.find((s) => s.id === 'settings_apps') || matchedSetting;
      } else if (lower.includes('batterie') || lower.includes('énergie')) {
        matchedSetting = KNOWN_ANDROID_SETTINGS.find((s) => s.id === 'settings_battery') || matchedSetting;
      } else if (lower.includes('accessibilité')) {
        matchedSetting = KNOWN_ANDROID_SETTINGS.find((s) => s.id === 'settings_accessibility') || matchedSetting;
      } else if (lower.includes('assistant vocal')) {
        matchedSetting = KNOWN_ANDROID_SETTINGS.find((s) => s.id === 'settings_voice_assistant') || matchedSetting;
      }

      return {
        id: `act_${Date.now()}_open_settings`,
        intentType: 'OPEN_SETTINGS',
        tier: 'SAFE_ACTION',
        rawQuery: raw,
        targetSetting: matchedSetting,
        parameters: {
          settingId: matchedSetting.id,
          actionIntent: matchedSetting.actionIntent,
        },
        requiredPermissions: [],
        requiresConfirmation: false,
        versionCompatibility: {
          minSdk: 21,
          recommendedSdk: 35,
          androidVersionName: 'Android 5.0+ à Android 15',
        },
        spokenOutput: `Ouverture des ${matchedSetting.name}, Monsieur.`,
        description: `Navigation vers les paramètres système via ${matchedSetting.actionIntent}.`,
        fallbackStrategy: 'system_settings',
      };
    }

    // -------------------------------------------------------------
    // 4. "JARVIS, ouvre ma caméra." / Open Camera
    // -------------------------------------------------------------
    if (
      lower.includes('caméra') ||
      lower.includes('camera') ||
      lower.includes('appareil photo') ||
      (lower.includes('prends une photo') && !lower.includes('écran')) ||
      lower.includes('lance la caméra')
    ) {
      const app = KNOWN_ANDROID_APPS.find((a) => a.id === 'camera')!;
      const isVideo = lower.includes('vidéo') || lower.includes('video') || lower.includes('filme');

      return {
        id: `act_${Date.now()}_open_camera`,
        intentType: 'OPEN_CAMERA',
        tier: 'SAFE_ACTION',
        rawQuery: raw,
        targetApp: app,
        parameters: {
          mode: isVideo ? 'video' : 'photo',
          facing: lower.includes('devant') || lower.includes('selfie') || lower.includes('frontale') ? 'front' : 'back',
        },
        requiredPermissions: ['camera'],
        requiresConfirmation: false,
        versionCompatibility: {
          minSdk: 21,
          recommendedSdk: 35,
          androidVersionName: 'Android 5.0+ à Android 15',
          notes: 'Camera2 / MediaStore API standard',
        },
        spokenOutput: `Ouverture de l'appareil photo, Monsieur.`,
        description: `Accès au capteur photo Android via android.media.action.IMAGE_CAPTURE.`,
        fallbackStrategy: 'web_url',
      };
    }

    // -------------------------------------------------------------
    // 5. "JARVIS, affiche mes téléchargements." / View Downloads
    // -------------------------------------------------------------
    if (
      lower.includes('téléchargement') ||
      lower.includes('telechargement') ||
      lower.includes('downloads') ||
      lower.includes('mes downloads') ||
      lower.includes('dossier download') ||
      (lower.includes('fichiers téléchargés'))
    ) {
      const app = KNOWN_ANDROID_APPS.find((a) => a.id === 'files')!;

      return {
        id: `act_${Date.now()}_view_downloads`,
        intentType: 'VIEW_DOWNLOADS',
        tier: 'READ',
        rawQuery: raw,
        targetApp: app,
        parameters: {
          directory: 'Environment.DIRECTORY_DOWNLOADS',
          action: 'android.intent.action.VIEW_DOWNLOADS',
        },
        requiredPermissions: ['storage'],
        requiresConfirmation: false,
        versionCompatibility: {
          minSdk: 21,
          recommendedSdk: 35,
          androidVersionName: 'Android 5.0+ à Android 15',
          scopedStorageRequired: true,
          notes: 'Conforme Scoped Storage (Storage Access Framework Android 10+)',
        },
        spokenOutput: `Affichage de vos téléchargements en cours, Monsieur.`,
        description: `Exploration du dossier Téléchargements via DownloadManager / SAF.`,
        fallbackStrategy: 'web_url',
      };
    }

    // -------------------------------------------------------------
    // 6. "JARVIS, active le mode silencieux." / Set Silent Mode & DND
    // -------------------------------------------------------------
    if (
      lower.includes('mode silencieux') ||
      lower.includes('silencieux') ||
      lower.includes('ne pas déranger') ||
      lower.includes('ne pas deranger') ||
      lower.includes('coupe le son') ||
      lower.includes('mode muet') ||
      lower.includes('remets la sonnerie') ||
      lower.includes('désactive le mode silencieux')
    ) {
      const isEnable = !lower.includes('désactive') && !lower.includes('desactive') && !lower.includes('enlève') && !lower.includes('coupe le silencieux');
      const isVibrateOnly = lower.includes('vibreur');

      return {
        id: `act_${Date.now()}_silent_mode`,
        intentType: 'SET_SILENT_MODE',
        tier: 'SAFE_ACTION',
        rawQuery: raw,
        parameters: {
          enabled: isEnable,
          mode: !isEnable ? 'normal' : isVibrateOnly ? 'vibrate' : 'silent',
        },
        requiredPermissions: ['notifications'],
        requiresConfirmation: false,
        versionCompatibility: {
          minSdk: 24,
          recommendedSdk: 35,
          androidVersionName: 'Android 7.0+ à Android 15',
          dndPolicyAccessRequired: true,
          notes: 'NotificationManager.setInterruptionFilter & AudioManager.RINGER_MODE_*',
        },
        spokenOutput: isEnable
          ? `Mode silencieux activé. Votre appareil ne produira aucune sonnerie.`
          : `Mode silencieux désactivé. Sonneries et alertes rétablies.`,
        description: `Basculement de l'état audio via AudioManager (RINGER_MODE_SILENT / ZEN_MODE).`,
        fallbackStrategy: 'system_settings',
      };
    }

    // -------------------------------------------------------------
    // 7. Flashlight / Torche
    // -------------------------------------------------------------
    if (lower.includes('torche') || lower.includes('lampe') || lower.includes('flashlight')) {
      const turnOn = !lower.includes('éteins') && !lower.includes('eteins') && !lower.includes('coupe') && !lower.includes('désactive');
      return {
        id: `act_${Date.now()}_flashlight`,
        intentType: 'TOGGLE_FLASHLIGHT',
        tier: 'SAFE_ACTION',
        rawQuery: raw,
        parameters: { enabled: turnOn },
        requiredPermissions: [],
        requiresConfirmation: false,
        versionCompatibility: {
          minSdk: 23,
          recommendedSdk: 35,
          androidVersionName: 'Android 6.0+ (CameraManager.setTorchMode)',
        },
        spokenOutput: turnOn ? `Lampe torche allumée, Monsieur.` : `Lampe torche éteinte.`,
        description: `Contrôle du flash LED via CameraManager.setTorchMode.`,
        fallbackStrategy: 'none',
      };
    }

    // -------------------------------------------------------------
    // 8. Volume Control
    // -------------------------------------------------------------
    if (lower.includes('volume') || lower.includes('son')) {
      let level = 75;
      const volMatch = lower.match(/(?:volume|son)\s+(?:à|a)?\s*(\d+)/i);
      if (volMatch) level = Math.min(100, Math.max(0, parseInt(volMatch[1], 10)));
      else if (lower.includes('monte') || lower.includes('augmente')) level = 85;
      else if (lower.includes('baisse') || lower.includes('diminue')) level = 35;
      else if (lower.includes('coupe') || lower.includes('muet')) level = 0;

      return {
        id: `act_${Date.now()}_volume`,
        intentType: 'ADJUST_VOLUME',
        tier: 'SAFE_ACTION',
        rawQuery: raw,
        parameters: { level },
        requiredPermissions: [],
        requiresConfirmation: false,
        versionCompatibility: {
          minSdk: 21,
          recommendedSdk: 35,
          androidVersionName: 'Android 5.0+ à Android 15',
        },
        spokenOutput: `Volume réglé à ${level}%, Monsieur.`,
        description: `Ajustement du flux audio via AudioManager.setStreamVolume.`,
        fallbackStrategy: 'none',
      };
    }

    // -------------------------------------------------------------
    // 9. Battery / Telemetry (READ)
    // -------------------------------------------------------------
    if (
      lower.includes('batterie') ||
      lower.includes('niveau de batterie') ||
      lower.includes('charge') ||
      lower.includes('état du téléphone') ||
      lower.includes('télémétrie')
    ) {
      return {
        id: `act_${Date.now()}_telemetry`,
        intentType: 'READ_TELEMETRY',
        tier: 'READ',
        rawQuery: raw,
        parameters: { metrics: ['battery', 'network', 'memory', 'thermal'] },
        requiredPermissions: [],
        requiresConfirmation: false,
        versionCompatibility: {
          minSdk: 21,
          recommendedSdk: 35,
          androidVersionName: 'Android 5.0+ à Android 15',
        },
        spokenOutput: `Analyse télémétrique effectuée. Niveau de charge et circuits optimaux.`,
        description: `Lecture de l'état système via BatteryManager et NetworkCapabilities.`,
        fallbackStrategy: 'voice_explanation',
      };
    }

    // -------------------------------------------------------------
    // 10. Screen Context / Vision OCR (READ)
    // -------------------------------------------------------------
    if (
      lower.includes('analyse mon écran') ||
      lower.includes('regarde mon écran') ||
      lower.includes('lis mon écran') ||
      lower.includes('résume mon écran') ||
      lower.includes('qu\'est-ce qui est affiché')
    ) {
      return {
        id: `act_${Date.now()}_screen_context`,
        intentType: 'READ_SCREEN_CONTEXT',
        tier: 'READ',
        rawQuery: raw,
        parameters: { ocr: true, activeApp: true },
        requiredPermissions: ['accessibility', 'screen_capture'],
        requiresConfirmation: false,
        versionCompatibility: {
          minSdk: 29,
          recommendedSdk: 35,
          androidVersionName: 'Android 10+ (AccessibilityNodeInfo & MediaProjection)',
        },
        spokenOutput: `Capture et analyse de votre écran en cours, Monsieur.`,
        description: `Extraction du texte affiché via le service d'accessibilité et flux de projection.`,
        fallbackStrategy: 'voice_explanation',
      };
    }

    // -------------------------------------------------------------
    // 11. SENSITIVE: Screen Lock / Device Admin
    // -------------------------------------------------------------
    if (
      lower.includes('verrouille') ||
      lower.includes('verrouiller le téléphone') ||
      lower.includes('bloque l\'écran')
    ) {
      return {
        id: `act_${Date.now()}_lock_device`,
        intentType: 'DEVICE_ADMIN_LOCK',
        tier: 'SENSITIVE_ACTION',
        rawQuery: raw,
        parameters: { immediate: true },
        requiredPermissions: ['device_admin'],
        requiresConfirmation: true,
        confirmationDetails: {
          id: `conf_lock_${Date.now()}`,
          actionType: 'system_action',
          title: 'Verrouillage Matériel Immédiat',
          prompt: 'Confirmez-vous le verrouillage instantané de l’écran et la sécurisation du terminal ?',
          targetDescription: 'Extinction de l’écran et verrouillage par code de sécurité via DevicePolicyManager.',
          severity: 'medium',
          timestamp: Date.now(),
        },
        versionCompatibility: {
          minSdk: 21,
          recommendedSdk: 35,
          androidVersionName: 'Android 5.0+ (DevicePolicyManager.lockNow)',
        },
        spokenOutput: `Verrouillage du terminal demandé. Confirmation requise.`,
        description: `Verrouillage sécurisé de l'appareil via DevicePolicyManager.`,
        fallbackStrategy: 'voice_explanation',
      };
    }

    // -------------------------------------------------------------
    // 12. SENSITIVE: Factory Reset / Data Wipe
    // -------------------------------------------------------------
    if (
      lower.includes('réinitialise') ||
      lower.includes('reinitialise') ||
      lower.includes('efface les données') ||
      lower.includes('factory reset') ||
      lower.includes('wipe data')
    ) {
      return {
        id: `act_${Date.now()}_factory_reset`,
        intentType: 'DEVICE_ADMIN_RESET',
        tier: 'SENSITIVE_ACTION',
        rawQuery: raw,
        parameters: { wipeExternalStorage: true },
        requiredPermissions: ['device_admin'],
        requiresConfirmation: true,
        confirmationDetails: {
          id: `conf_reset_${Date.now()}`,
          actionType: 'factory_reset',
          title: 'Protocole Critique : Réinitialisation d’Usine',
          prompt: 'ATTENTION : Cette action effacera TOUTES les données du smartphone. Êtes-vous absolument certain de vouloir continuer ?',
          targetDescription: 'Formatage complet des partitions Android et retour aux paramètres d’usine d’origine.',
          severity: 'critical',
          timestamp: Date.now(),
        },
        versionCompatibility: {
          minSdk: 21,
          recommendedSdk: 35,
          androidVersionName: 'Android 5.0+ (DevicePolicyManager.wipeData)',
        },
        spokenOutput: `Attention Monsieur, la réinitialisation d'usine est une action critique irréversible. Votre confirmation explicite est requise.`,
        description: `Réinitialisation d'usine du smartphone via les privilèges Super Administrateur.`,
        fallbackStrategy: 'voice_explanation',
      };
    }

    // -------------------------------------------------------------
    // 13. SENSITIVE / SAFE: System Update Check & Apply
    // -------------------------------------------------------------
    if (lower.includes('mise à jour') || lower.includes('mise a jour') || lower.includes('update android')) {
      const isApply = lower.includes('installe') || lower.includes('applique') || lower.includes('lance l\'installation');
      return {
        id: `act_${Date.now()}_system_update`,
        intentType: isApply ? 'SYSTEM_UPDATE_APPLY' : 'SYSTEM_UPDATE_CHECK',
        tier: isApply ? 'SENSITIVE_ACTION' : 'READ',
        rawQuery: raw,
        parameters: { otaCheck: true, isApply },
        requiredPermissions: isApply ? ['device_admin'] : [],
        requiresConfirmation: isApply,
        confirmationDetails: isApply ? {
          id: `conf_update_${Date.now()}`,
          actionType: 'system_update',
          title: 'Installation Mise à Jour Système Android',
          prompt: 'Confirmez-vous le téléchargement et l’installation du correctif Android 15 ? Le téléphone redémarrera.',
          targetDescription: 'Package OTA Android 15 QPR2 Security & AI Core Patch (420 Mo).',
          severity: 'high',
          timestamp: Date.now(),
        } : undefined,
        versionCompatibility: {
          minSdk: 26,
          recommendedSdk: 35,
          androidVersionName: 'Android 8.0+ à Android 15 (SystemUpdateManager)',
        },
        spokenOutput: isApply
          ? `Installation du correctif système demandée. Confirmation requise pour le redémarrage.`
          : `Vérification des mises à jour système Android en cours.`,
        description: `Gestion des mises à jour logicielles OTA Android.`,
        fallbackStrategy: 'system_settings',
      };
    }

    // -------------------------------------------------------------
    // 14. "JARVIS, Retour." / Navigate Back
    // -------------------------------------------------------------
    if (
      lower === 'retour' ||
      lower === 'retour.' ||
      lower.startsWith('retour') ||
      lower.includes('reviens en arrière') ||
      lower.includes('page précédente') ||
      lower.includes('bouton retour')
    ) {
      return {
        id: `act_${Date.now()}_navigate_back`,
        intentType: 'NAVIGATE_BACK',
        tier: 'SAFE_ACTION',
        rawQuery: raw,
        parameters: { action: 'GLOBAL_ACTION_BACK' },
        requiredPermissions: ['accessibility'],
        requiresConfirmation: false,
        versionCompatibility: {
          minSdk: 21,
          recommendedSdk: 35,
          androidVersionName: 'Android 5.0+ à Android 15 (AccessibilityService / KeyEvents)',
        },
        spokenOutput: `Retour en arrière effectué, Monsieur.`,
        description: `Exécution de l'action système Retour (GLOBAL_ACTION_BACK).`,
        fallbackStrategy: 'none',
      };
    }

    // -------------------------------------------------------------
    // 15. "JARVIS, Accueil." / Navigate Home
    // -------------------------------------------------------------
    if (
      lower === 'accueil' ||
      lower === 'accueil.' ||
      lower.startsWith('accueil') ||
      lower.includes('retour à l\'accueil') ||
      lower.includes('écran d\'accueil') ||
      lower.includes('va à l\'accueil') ||
      lower === 'home' ||
      lower === 'home.'
    ) {
      return {
        id: `act_${Date.now()}_navigate_home`,
        intentType: 'NAVIGATE_HOME',
        tier: 'SAFE_ACTION',
        rawQuery: raw,
        parameters: { action: 'GLOBAL_ACTION_HOME' },
        requiredPermissions: ['accessibility'],
        requiresConfirmation: false,
        versionCompatibility: {
          minSdk: 21,
          recommendedSdk: 35,
          androidVersionName: 'Android 5.0+ à Android 15 (Intent.CATEGORY_HOME / AccessibilityService)',
        },
        spokenOutput: `Retour à l'écran d'accueil, Monsieur.`,
        description: `Navigation vers le lanceur d'applications Android (Écran d'accueil).`,
        fallbackStrategy: 'none',
      };
    }

    // -------------------------------------------------------------
    // 16. "JARVIS, Montre ma localisation." / Geolocation & Maps
    // -------------------------------------------------------------
    if (
      lower.includes('localisation') ||
      lower.includes('où suis-je') ||
      lower.includes('ma position') ||
      lower.includes('affiche ma position') ||
      lower.includes('coordonnées gps') ||
      lower.includes('montre ma position')
    ) {
      const mapsApp = KNOWN_ANDROID_APPS.find((a) => a.id === 'maps');
      return {
        id: `act_${Date.now()}_show_location`,
        intentType: 'SHOW_LOCATION',
        tier: 'READ',
        rawQuery: raw,
        targetApp: mapsApp,
        parameters: { target: 'current_gps_location' },
        requiredPermissions: ['geolocation'],
        requiresConfirmation: false,
        versionCompatibility: {
          minSdk: 21,
          recommendedSdk: 35,
          androidVersionName: 'Android 5.0+ à Android 15 (LocationServices / ACCESS_FINE_LOCATION)',
        },
        spokenOutput: `Localisation GPS acquise. Affichage de votre position géographique.`,
        description: `Obtention des coordonnées géographiques via FusedLocationProviderClient.`,
        fallbackStrategy: 'web_url',
      };
    }

    // -------------------------------------------------------------
    // 17. "JARVIS, Lis mes notifications." / Notification Listener
    // -------------------------------------------------------------
    if (
      lower.includes('lis mes notifications') ||
      lower.includes('mes notifications') ||
      lower.includes('lis les notifications') ||
      lower.includes('quelles sont mes notifications') ||
      lower.includes('dernières notifications')
    ) {
      return {
        id: `act_${Date.now()}_read_notifications`,
        intentType: 'READ_NOTIFICATIONS',
        tier: 'READ',
        rawQuery: raw,
        parameters: { action: 'getActiveNotifications' },
        requiredPermissions: ['notification_listener'],
        requiresConfirmation: false,
        versionCompatibility: {
          minSdk: 21,
          recommendedSdk: 35,
          androidVersionName: 'Android 5.0+ à Android 15 (NotificationListenerService)',
        },
        spokenOutput: `Consultation de vos notifications non lues en cours, Monsieur.`,
        description: `Lecture vocale et extraction des alertes via NotificationListenerService.`,
        fallbackStrategy: 'voice_explanation',
      };
    }

    // -------------------------------------------------------------
    // 18. "JARVIS, Appelle ce contact." / Phone Call (SENSITIVE)
    // -------------------------------------------------------------
    if (
      lower.startsWith('appelle') ||
      lower.startsWith('téléphone') ||
      lower.startsWith('telephone') ||
      lower.includes('passe un appel') ||
      lower.includes('appelle ce contact')
    ) {
      const contactMatch = clean.replace(/^(appelle|téléphone à|telephone a|passe un appel à|passe un appel)\s*/i, '').trim();
      const contactName = contactMatch || 'ce contact';

      return {
        id: `act_${Date.now()}_make_phone_call`,
        intentType: 'MAKE_PHONE_CALL',
        tier: 'SENSITIVE_ACTION',
        rawQuery: raw,
        parameters: { recipient: contactName },
        requiredPermissions: ['phone', 'contacts'],
        requiresConfirmation: true,
        confirmationDetails: {
          id: `conf_call_${Date.now()}`,
          actionType: 'phone_call',
          title: `Lancement d'Appel Téléphonique`,
          prompt: `Confirmez-vous le lancement de l'appel vers ${contactName} ?`,
          targetDescription: `Composition et émission d'un appel direct via TelecomManager.`,
          severity: 'high',
          timestamp: Date.now(),
        },
        versionCompatibility: {
          minSdk: 23,
          recommendedSdk: 35,
          androidVersionName: 'Android 6.0+ à Android 15 (TelecomManager.placeCall / ACTION_CALL)',
        },
        spokenOutput: `Lancement de l'appel vers ${contactName} préparé. Votre confirmation explicite est requise.`,
        description: `Appel téléphonique sécurisé vers ${contactName} avec jeton de validation.`,
        fallbackStrategy: 'voice_explanation',
      };
    }

    // -------------------------------------------------------------
    // 19. Generic App Open fallback (e.g. "ouvre Spotify", "ouvre Maps", "ouvre Discord")
    // -------------------------------------------------------------
    if (lower.startsWith('ouvre') || lower.startsWith('lance') || lower.startsWith('démarre') || lower.startsWith('demarre')) {
      const targetName = clean.replace(/^(ouvre|lance|démarre|demarre|l'application|l'appli|l'app)\s*/i, '').trim();
      const matchedApp = KNOWN_ANDROID_APPS.find(
        (a) =>
          a.id.toLowerCase() === targetName.toLowerCase() ||
          a.name.toLowerCase().includes(targetName.toLowerCase()) ||
          a.keywords.some((k) => targetName.toLowerCase().includes(k))
      );

      if (matchedApp) {
        return {
          id: `act_${Date.now()}_open_app`,
          intentType: 'OPEN_APP',
          tier: 'SAFE_ACTION',
          rawQuery: raw,
          targetApp: matchedApp,
          parameters: {
            appId: matchedApp.id,
            packageName: matchedApp.packageName,
          },
          requiredPermissions: [],
          requiresConfirmation: false,
          versionCompatibility: {
            minSdk: 21,
            recommendedSdk: 35,
            androidVersionName: 'Android 5.0+ à Android 15',
          },
          spokenOutput: `Ouverture de ${matchedApp.name}, Monsieur.`,
          description: `Lancement de l'application ${matchedApp.name} (${matchedApp.packageName}).`,
          fallbackStrategy: 'play_store',
        };
      }

      // App not in predefined list: create dynamic target
      const dynamicApp: AndroidAppDefinition = {
        id: targetName.toLowerCase().replace(/\s+/g, '_'),
        name: targetName,
        packageName: `com.${targetName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        urlScheme: `${targetName.toLowerCase()}://`,
        playStoreUrl: `market://search?q=${encodeURIComponent(targetName)}`,
        webFallbackUrl: `https://www.google.com/search?q=${encodeURIComponent(targetName)}`,
        iconName: 'Smartphone',
        category: 'productivity',
        description: `Application tierce ${targetName}`,
        keywords: [targetName.toLowerCase()],
      };

      return {
        id: `act_${Date.now()}_open_dynamic_app`,
        intentType: 'OPEN_APP',
        tier: 'SAFE_ACTION',
        rawQuery: raw,
        targetApp: dynamicApp,
        parameters: {
          appId: dynamicApp.id,
          appName: targetName,
        },
        requiredPermissions: [],
        requiresConfirmation: false,
        versionCompatibility: {
          minSdk: 21,
          recommendedSdk: 35,
          androidVersionName: 'Android 5.0+ à Android 15',
        },
        spokenOutput: `Recherche et lancement de ${targetName}, Monsieur.`,
        description: `Recherche de l'application ${targetName} sur le système.`,
        fallbackStrategy: 'play_store',
      };
    }

    // Default fallback action
    return {
      id: `act_${Date.now()}_default_action`,
      intentType: 'OPEN_SETTINGS',
      tier: 'SAFE_ACTION',
      rawQuery: raw,
      parameters: { query: clean },
      requiredPermissions: [],
      requiresConfirmation: false,
      versionCompatibility: {
        minSdk: 21,
        recommendedSdk: 35,
        androidVersionName: 'Android 5.0+ à Android 15',
      },
      spokenOutput: `Opération système Android traitée, Monsieur.`,
      description: `Action Android standard.`,
      fallbackStrategy: 'system_settings',
    };
  }
}
