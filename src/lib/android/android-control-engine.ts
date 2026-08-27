/**
 * ANDROID CONTROL ENGINE (JARVIS ANDROID ARCHITECTURE — ÉTAPE 7/10)
 *
 * Responsabilités majeures :
 * 1. Moteur central orchestrant toutes les capacités Android du terminal.
 * 2. Méthode pivot `checkAllCapabilities()` pour un diagnostic exhaustif et en temps réel.
 * 3. Classification exacte des 5 états :
 *    - ACTIVE
 *    - INACTIVE
 *    - REQUIRES_PERMISSION
 *    - REQUIRES_SPECIAL_ACCESS
 *    - UNAVAILABLE
 * 4. Jamais de contournement de permission : application stricte du protocole de sécurité.
 * 5. Adaptation dynamique selon la version d'Android détectée (API 29 à API 35+).
 */

import {
  AndroidCapabilityKey,
  AndroidCapabilityInfo,
  AndroidCapabilityState,
  AndroidDeviceCapabilitiesReport,
  AndroidPermissionType,
} from '../../types';
import { jarvisPermissionManager, AndroidVersionInfo } from './jarvis-permission-manager';
import { AndroidBridge } from '../android-bridge';
import { apiFetch } from '../api';

export class AndroidControlEngine {
  private static instance: AndroidControlEngine;
  private lastReport: AndroidDeviceCapabilitiesReport | null = null;
  private isScanning = false;
  private listeners: Array<(report: AndroidDeviceCapabilitiesReport) => void> = [];

  private constructor() {}

  public static getInstance(): AndroidControlEngine {
    if (!AndroidControlEngine.instance) {
      AndroidControlEngine.instance = new AndroidControlEngine();
    }
    return AndroidControlEngine.instance;
  }

  /**
   * Diagnostic central et complet de TOUTES les capacités Android
   * Retourne l'état précis du téléphone et de chaque sous-système.
   */
  public async checkAllCapabilities(forceRefresh = false): Promise<AndroidDeviceCapabilitiesReport> {
    if (this.isScanning && this.lastReport) {
      return this.lastReport;
    }

    this.isScanning = true;

    try {
      const version: AndroidVersionInfo = jarvisPermissionManager.detectAndroidVersion();
      const battery = await AndroidBridge.getBatteryStatus();

      // Récupération de l'état réseau réel
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      const connection = typeof navigator !== 'undefined' ? (navigator as any).connection : null;
      const networkType = connection?.type || (isOnline ? 'Wi-Fi / 5G Mobile' : 'Déconnecté');
      const effectiveType = connection?.effectiveType || '4g';

      // Vérification individuelle de chacune des 16 capacités requises
      const [
        micState,
        camState,
        contactsState,
        phoneState,
        smsState,
        calendarState,
        locationState,
        notifState,
        notifListenerState,
        accessibilityState,
        overlayState,
        mediaProjState,
        voiceAssistantState,
        bluetoothState,
        networkState,
        storageState,
      ] = await Promise.all([
        this.evaluateMicrophone(version),
        this.evaluateCamera(version),
        this.evaluateContacts(version),
        this.evaluatePhone(version),
        this.evaluateSms(version),
        this.evaluateCalendar(version),
        this.evaluateLocation(version),
        this.evaluateNotifications(version),
        this.evaluateNotificationListener(version),
        this.evaluateAccessibility(version),
        this.evaluateOverlay(version),
        this.evaluateMediaProjection(version),
        this.evaluateVoiceAssistant(version),
        this.evaluateBluetooth(version),
        this.evaluateNetwork(version, isOnline),
        this.evaluateStorage(version),
      ]);

      const capabilities: Record<AndroidCapabilityKey, AndroidCapabilityInfo> = {
        microphone: micState,
        camera: camState,
        contacts: contactsState,
        phone: phoneState,
        sms: smsState,
        calendar: calendarState,
        location: locationState,
        notifications: notifState,
        notification_listener: notifListenerState,
        accessibility: accessibilityState,
        overlay: overlayState,
        media_projection: mediaProjState,
        voice_assistant: voiceAssistantState,
        bluetooth: bluetoothState,
        network: networkState,
        storage: storageState,
      };

      // Calcul des métriques globales
      let activeCount = 0;
      let inactiveCount = 0;
      let requiresPermissionCount = 0;
      let requiresSpecialAccessCount = 0;
      let unavailableCount = 0;

      for (const cap of Object.values(capabilities)) {
        switch (cap.state) {
          case 'ACTIVE':
            activeCount++;
            break;
          case 'INACTIVE':
            inactiveCount++;
            break;
          case 'REQUIRES_PERMISSION':
            requiresPermissionCount++;
            break;
          case 'REQUIRES_SPECIAL_ACCESS':
            requiresSpecialAccessCount++;
            break;
          case 'UNAVAILABLE':
            unavailableCount++;
            break;
        }
      }

      const totalCapabilities = Object.keys(capabilities).length;
      let overallHealth: 'optimal' | 'warning' | 'restricted' = 'optimal';

      if (requiresSpecialAccessCount > 2 || requiresPermissionCount > 3) {
        overallHealth = 'restricted';
      } else if (requiresPermissionCount > 0 || requiresSpecialAccessCount > 0 || unavailableCount > 2) {
        overallHealth = 'warning';
      }

      const report: AndroidDeviceCapabilitiesReport = {
        timestamp: Date.now(),
        osVersion: `${version.versionName} (${version.releaseName})`,
        sdkInt: version.sdkInt,
        deviceModel: version.model,
        isAndroid: version.isAndroid,
        battery: {
          level: battery.level,
          charging: battery.charging,
        },
        network: {
          type: networkType,
          online: isOnline,
          effectiveType,
        },
        overallHealth,
        activeCount,
        inactiveCount,
        requiresPermissionCount,
        requiresSpecialAccessCount,
        unavailableCount,
        totalCapabilities,
        capabilities,
      };

      this.lastReport = report;
      this.notifyListeners(report);
      return report;
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Configure une capacité en ouvrant son réglage système Android dédié
   */
  public async configureCapability(key: AndroidCapabilityKey): Promise<{ success: boolean; message: string }> {
    AndroidBridge.vibrate('medium');

    const cap = this.lastReport?.capabilities[key];
    if (!cap) {
      return jarvisPermissionManager.openSettingsFor(key);
    }

    if (cap.state === 'REQUIRES_PERMISSION') {
      // Pour une permission standard, tente d'abord la demande d'invite système directe
      const permType = key as AndroidPermissionType;
      const res = await jarvisPermissionManager.requestPermission(permType);
      if (res.granted) {
        await this.checkAllCapabilities(true);
        return { success: true, message: `Autorisation "${cap.name}" accordée avec succès.` };
      }
    }

    // Sinon, redirection vers les paramètres officiels Android (Special Access ou Paramètres système)
    const settingsRes = await jarvisPermissionManager.openSettingsFor(key);
    return {
      success: settingsRes.success,
      message: settingsRes.message || `Ouverture des réglages Android pour "${cap.name}"`,
    };
  }

  /**
   * Vérifie si JARVIS a le droit d'exécuter une action liée à cette capacité
   */
  public async canExecute(key: AndroidCapabilityKey): Promise<boolean> {
    const report = await this.checkAllCapabilities();
    const cap = report.capabilities[key];
    return cap?.state === 'ACTIVE';
  }

  // --- ÉVALUATIONS DÉTAILLÉES DES 16 CAPACITÉS SYSTÈME ---

  private async evaluateMicrophone(version: AndroidVersionInfo): Promise<AndroidCapabilityInfo> {
    const perm = await jarvisPermissionManager.checkPermission('microphone');
    let state: AndroidCapabilityState = 'REQUIRES_PERMISSION';

    if (perm === 'unsupported') {
      state = 'UNAVAILABLE';
    } else if (perm === 'granted') {
      state = 'ACTIVE';
    } else if (perm === 'denied') {
      state = 'REQUIRES_PERMISSION';
    } else {
      state = 'REQUIRES_PERMISSION';
    }

    return {
      id: 'microphone',
      name: 'MICROPHONE',
      category: 'hardware',
      state,
      description: 'Capture vocale haute fidélité, détection "Hey Jarvis" et streaming Audio VAD.',
      technicalDetails: 'AudioRecord API / WebAudio API — Buffer 16kHz PCM 16-bit.',
      requiredPermissions: ['android.permission.RECORD_AUDIO'],
      isSpecialAccess: false,
      targetApiLevel: 1,
      modernApiNotes: 'Indicateur de confidentialité microphone actif sous Android 12+ (API 31).',
      configureIntent: 'android.settings.APPLICATION_DETAILS_SETTINGS',
      iconName: 'Mic',
      isRealCheck: true,
      hardwareAvailable: perm !== 'unsupported',
      canExecute: state === 'ACTIVE',
      lastVerifiedAt: Date.now(),
    };
  }

  private async evaluateCamera(version: AndroidVersionInfo): Promise<AndroidCapabilityInfo> {
    const perm = await jarvisPermissionManager.checkPermission('camera');
    let state: AndroidCapabilityState = 'REQUIRES_PERMISSION';

    if (perm === 'unsupported') {
      state = 'UNAVAILABLE';
    } else if (perm === 'granted') {
      state = 'ACTIVE';
    } else {
      state = 'REQUIRES_PERMISSION';
    }

    return {
      id: 'camera',
      name: 'CAMÉRA',
      category: 'hardware',
      state,
      description: 'Vision IA multimodale, scan de documents OCR et reconnaissance d\'objets.',
      technicalDetails: 'Camera2 API / ImageAnalysis — Traitement de flux 1080p RGB.',
      requiredPermissions: ['android.permission.CAMERA'],
      isSpecialAccess: false,
      targetApiLevel: 1,
      modernApiNotes: 'Indicateur vert de caméra active sous Android 12+ (API 31).',
      configureIntent: 'android.settings.APPLICATION_DETAILS_SETTINGS',
      iconName: 'Camera',
      isRealCheck: true,
      hardwareAvailable: perm !== 'unsupported',
      canExecute: state === 'ACTIVE',
      lastVerifiedAt: Date.now(),
    };
  }

  private async evaluateContacts(version: AndroidVersionInfo): Promise<AndroidCapabilityInfo> {
    const perm = await jarvisPermissionManager.checkPermission('contacts');
    const state: AndroidCapabilityState = perm === 'granted' ? 'ACTIVE' : 'REQUIRES_PERMISSION';

    return {
      id: 'contacts',
      name: 'CONTACTS',
      category: 'privacy',
      state,
      description: 'Accès au carnet d\'adresses pour appels et SMS ciblés par nom de contact.',
      technicalDetails: 'ContactsContract Provider / Contact Picker API.',
      requiredPermissions: ['android.permission.READ_CONTACTS', 'android.permission.WRITE_CONTACTS'],
      isSpecialAccess: false,
      targetApiLevel: 1,
      modernApiNotes: 'Accès granulaire aux contacts sous Android 14+ (API 34).',
      configureIntent: 'android.settings.APPLICATION_DETAILS_SETTINGS',
      iconName: 'Users',
      isRealCheck: true,
      hardwareAvailable: true,
      canExecute: state === 'ACTIVE',
      lastVerifiedAt: Date.now(),
    };
  }

  private async evaluatePhone(version: AndroidVersionInfo): Promise<AndroidCapabilityInfo> {
    const perm = await jarvisPermissionManager.checkPermission('phone');
    const state: AndroidCapabilityState = perm === 'granted' ? 'ACTIVE' : 'REQUIRES_PERMISSION';

    return {
      id: 'phone',
      name: 'TÉLÉPHONE',
      category: 'communication',
      state,
      description: 'Déclenchement direct et gestion des appels téléphoniques vocaux.',
      technicalDetails: 'TelecomManager / Telecom Call Intent.',
      requiredPermissions: ['android.permission.CALL_PHONE', 'android.permission.READ_PHONE_STATE'],
      isSpecialAccess: false,
      targetApiLevel: 1,
      modernApiNotes: 'Contrôle télécom via TelecomManager et CallScreeningService.',
      configureIntent: 'android.settings.APPLICATION_DETAILS_SETTINGS',
      iconName: 'Phone',
      isRealCheck: true,
      hardwareAvailable: true,
      canExecute: state === 'ACTIVE',
      lastVerifiedAt: Date.now(),
    };
  }

  private async evaluateSms(version: AndroidVersionInfo): Promise<AndroidCapabilityInfo> {
    const perm = await jarvisPermissionManager.checkPermission('sms');
    const state: AndroidCapabilityState = perm === 'granted' ? 'ACTIVE' : 'REQUIRES_PERMISSION';

    return {
      id: 'sms',
      name: 'SMS',
      category: 'communication',
      state,
      description: 'Lecture, rédaction et transmission de SMS sécurisés avec accusé.',
      technicalDetails: 'SmsManager / Telephony.Sms Intents.',
      requiredPermissions: ['android.permission.SEND_SMS', 'android.permission.READ_SMS'],
      isSpecialAccess: false,
      targetApiLevel: 1,
      modernApiNotes: 'Support RCS et gestionnaire SMS par défaut Android.',
      configureIntent: 'android.settings.APPLICATION_DETAILS_SETTINGS',
      iconName: 'MessageSquare',
      isRealCheck: true,
      hardwareAvailable: true,
      canExecute: state === 'ACTIVE',
      lastVerifiedAt: Date.now(),
    };
  }

  private async evaluateCalendar(version: AndroidVersionInfo): Promise<AndroidCapabilityInfo> {
    const perm = await jarvisPermissionManager.checkPermission('calendar');
    const state: AndroidCapabilityState = perm === 'granted' ? 'ACTIVE' : 'REQUIRES_PERMISSION';

    return {
      id: 'calendar',
      name: 'CALENDRIER',
      category: 'privacy',
      state,
      description: 'Synchronisation de l\'agenda, détection des conflits et ajout d\'événements.',
      technicalDetails: 'CalendarContract API / Google Calendar Sync Provider.',
      requiredPermissions: ['android.permission.READ_CALENDAR', 'android.permission.WRITE_CALENDAR'],
      isSpecialAccess: false,
      targetApiLevel: 1,
      modernApiNotes: 'API CalendarContract officielle avec synchronisation cloud.',
      configureIntent: 'android.settings.APPLICATION_DETAILS_SETTINGS',
      iconName: 'Calendar',
      isRealCheck: true,
      hardwareAvailable: true,
      canExecute: state === 'ACTIVE',
      lastVerifiedAt: Date.now(),
    };
  }

  private async evaluateLocation(version: AndroidVersionInfo): Promise<AndroidCapabilityInfo> {
    const perm = await jarvisPermissionManager.checkPermission('geolocation');
    let state: AndroidCapabilityState = 'REQUIRES_PERMISSION';

    if (perm === 'unsupported') {
      state = 'UNAVAILABLE';
    } else if (perm === 'granted') {
      state = 'ACTIVE';
    } else {
      state = 'REQUIRES_PERMISSION';
    }

    return {
      id: 'location',
      name: 'LOCALISATION',
      category: 'hardware',
      state,
      description: 'Position GPS précise pour météo, calcul d\'itinéraires et domotique.',
      technicalDetails: 'FusedLocationProviderClient / W3C Geolocation API.',
      requiredPermissions: ['android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION'],
      isSpecialAccess: false,
      targetApiLevel: 1,
      modernApiNotes: 'Support de la précision approximative ou exacte sous Android 12+.',
      configureIntent: 'android.settings.LOCATION_SOURCE_SETTINGS',
      iconName: 'MapPin',
      isRealCheck: true,
      hardwareAvailable: perm !== 'unsupported',
      canExecute: state === 'ACTIVE',
      lastVerifiedAt: Date.now(),
    };
  }

  private async evaluateNotifications(version: AndroidVersionInfo): Promise<AndroidCapabilityInfo> {
    const perm = await jarvisPermissionManager.checkPermission('notifications');
    let state: AndroidCapabilityState = 'REQUIRES_PERMISSION';

    if (perm === 'unsupported') {
      state = 'UNAVAILABLE';
    } else if (perm === 'granted') {
      state = 'ACTIVE';
    } else {
      state = 'REQUIRES_PERMISSION';
    }

    return {
      id: 'notifications',
      name: 'NOTIFICATIONS',
      category: 'system_service',
      state,
      description: 'Diffusion d\'alertes, minuteurs, rappels et rapports d\'arrière-plan.',
      technicalDetails: 'NotificationManager / NotificationChannel API.',
      requiredPermissions: version.sdkInt >= 33 ? ['android.permission.POST_NOTIFICATIONS'] : [],
      isSpecialAccess: false,
      targetApiLevel: 33,
      modernApiNotes: 'Autorisation runtime explicite obligatoire depuis Android 13 (API 33).',
      configureIntent: 'android.settings.APP_NOTIFICATION_SETTINGS',
      iconName: 'Bell',
      isRealCheck: true,
      hardwareAvailable: perm !== 'unsupported',
      canExecute: state === 'ACTIVE',
      lastVerifiedAt: Date.now(),
    };
  }

  private async evaluateNotificationListener(version: AndroidVersionInfo): Promise<AndroidCapabilityInfo> {
    const perm = await jarvisPermissionManager.checkPermission('notification_listener');
    const state: AndroidCapabilityState = perm === 'granted' ? 'ACTIVE' : 'REQUIRES_SPECIAL_ACCESS';

    return {
      id: 'notification_listener',
      name: 'NOTIFICATION LISTENER',
      category: 'system_service',
      state,
      description: 'Lecture vocale des messages reçus (WhatsApp, SMS, Telegram, Signal) & réponses rapides.',
      technicalDetails: 'NotificationListenerService / BIND_NOTIFICATION_LISTENER_SERVICE.',
      requiredPermissions: ['android.permission.BIND_NOTIFICATION_LISTENER_SERVICE'],
      isSpecialAccess: true,
      targetApiLevel: 18,
      modernApiNotes: 'Exige une validation explicite dans l\'écran d\'accès aux notifications Android.',
      configureIntent: 'android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS',
      iconName: 'MessageSquare',
      isRealCheck: true,
      hardwareAvailable: true,
      canExecute: state === 'ACTIVE',
      lastVerifiedAt: Date.now(),
    };
  }

  private async evaluateAccessibility(version: AndroidVersionInfo): Promise<AndroidCapabilityInfo> {
    const perm = await jarvisPermissionManager.checkPermission('accessibility');
    const state: AndroidCapabilityState = perm === 'granted' ? 'ACTIVE' : 'REQUIRES_SPECIAL_ACCESS';

    return {
      id: 'accessibility',
      name: 'ACCESSIBILITY',
      category: 'system_service',
      state,
      description: 'Inspection de l\'écran UI, compréhension contextuelle et automatisation gestuelle.',
      technicalDetails: 'AccessibilityService / AccessibilityNodeInfo tree parsing.',
      requiredPermissions: ['android.permission.BIND_ACCESSIBILITY_SERVICE'],
      isSpecialAccess: true,
      targetApiLevel: 16,
      modernApiNotes: 'Service de premier plan sécurisé avec restrictions renforcées sous Android 14/15.',
      configureIntent: 'android.settings.ACCESSIBILITY_SETTINGS',
      iconName: 'Eye',
      isRealCheck: true,
      hardwareAvailable: true,
      canExecute: state === 'ACTIVE',
      lastVerifiedAt: Date.now(),
    };
  }

  private async evaluateOverlay(version: AndroidVersionInfo): Promise<AndroidCapabilityInfo> {
    const perm = await jarvisPermissionManager.checkPermission('overlay');
    const state: AndroidCapabilityState = perm === 'granted' ? 'ACTIVE' : 'REQUIRES_SPECIAL_ACCESS';

    return {
      id: 'overlay',
      name: 'OVERLAY',
      category: 'system_service',
      state,
      description: 'Bulle flottante JARVIS et HUD réactif affichés par-dessus les autres applications.',
      technicalDetails: 'WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY.',
      requiredPermissions: ['android.permission.SYSTEM_ALERT_WINDOW'],
      isSpecialAccess: true,
      targetApiLevel: 23,
      modernApiNotes: 'Permission "Afficher sur d\'autres applications" sous Android 10 à 15.',
      configureIntent: 'android.settings.action.MANAGE_OVERLAY_PERMISSION',
      iconName: 'Layers',
      isRealCheck: true,
      hardwareAvailable: true,
      canExecute: state === 'ACTIVE',
      lastVerifiedAt: Date.now(),
    };
  }

  private async evaluateMediaProjection(version: AndroidVersionInfo): Promise<AndroidCapabilityInfo> {
    const perm = await jarvisPermissionManager.checkPermission('screen_capture');
    let state: AndroidCapabilityState = 'REQUIRES_PERMISSION';

    if (typeof navigator !== 'undefined' && !navigator.mediaDevices?.getDisplayMedia) {
      state = 'UNAVAILABLE';
    } else if (perm === 'granted') {
      state = 'ACTIVE';
    } else {
      state = 'INACTIVE'; // Prêt à être déclenché ponctuellement à la demande
    }

    return {
      id: 'media_projection',
      name: 'SCREEN CAPTURE',
      category: 'hardware',
      state,
      description: 'Capture d\'écran ponctuelle et analyse multimodale visuelle en direct.',
      technicalDetails: 'MediaProjectionManager / ScreenCaptureService — Consentement à la demande.',
      requiredPermissions: ['android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION'],
      isSpecialAccess: false,
      targetApiLevel: 21,
      modernApiNotes: 'Consentement requis à chaque session sous Android 14+ (Partage partiel d\'application).',
      configureIntent: 'android.settings.APPLICATION_DETAILS_SETTINGS',
      iconName: 'Monitor',
      isRealCheck: true,
      hardwareAvailable: state !== 'UNAVAILABLE',
      canExecute: state === 'ACTIVE' || state === 'INACTIVE',
      lastVerifiedAt: Date.now(),
    };
  }

  private async evaluateVoiceAssistant(version: AndroidVersionInfo): Promise<AndroidCapabilityInfo> {
    const perm = await jarvisPermissionManager.checkPermission('assistant');
    const state: AndroidCapabilityState = perm === 'granted' ? 'ACTIVE' : 'REQUIRES_SPECIAL_ACCESS';

    return {
      id: 'voice_assistant',
      name: 'ASSISTANT VOCAL',
      category: 'system_service',
      state,
      description: 'Rôle d\'assistant numérique par défaut déclenché par bouton d\'accueil/Power.',
      technicalDetails: 'VoiceInteractionService / ACTION_VOICE_COMMAND.',
      requiredPermissions: ['android.permission.BIND_VOICE_INTERACTION'],
      isSpecialAccess: true,
      targetApiLevel: 23,
      modernApiNotes: 'Attribution du rôle "Assistant numérique par défaut" dans les paramètres système.',
      configureIntent: 'android.settings.VOICE_INPUT_SETTINGS',
      iconName: 'Bot',
      isRealCheck: true,
      hardwareAvailable: true,
      canExecute: state === 'ACTIVE',
      lastVerifiedAt: Date.now(),
    };
  }

  private async evaluateBluetooth(version: AndroidVersionInfo): Promise<AndroidCapabilityInfo> {
    const perm = await jarvisPermissionManager.checkPermission('bluetooth');
    let state: AndroidCapabilityState = 'REQUIRES_PERMISSION';

    if (perm === 'unsupported') {
      state = 'UNAVAILABLE';
    } else if (perm === 'granted') {
      state = 'ACTIVE';
    } else {
      state = 'REQUIRES_PERMISSION';
    }

    return {
      id: 'bluetooth',
      name: 'BLUETOOTH',
      category: 'hardware',
      state,
      description: 'Détection des écouteurs, casques et objets connectés domotiques appairés.',
      technicalDetails: 'BluetoothAdapter / Web Bluetooth API — Profils A2DP et BLE.',
      requiredPermissions:
        version.sdkInt >= 31
          ? ['android.permission.BLUETOOTH_CONNECT', 'android.permission.BLUETOOTH_SCAN']
          : ['android.permission.BLUETOOTH', 'android.permission.BLUETOOTH_ADMIN'],
      isSpecialAccess: false,
      targetApiLevel: 31,
      modernApiNotes: 'Permissions granulaires BLUETOOTH_CONNECT/SCAN sous Android 12+ (API 31).',
      configureIntent: 'android.settings.BLUETOOTH_SETTINGS',
      iconName: 'Bluetooth',
      isRealCheck: true,
      hardwareAvailable: perm !== 'unsupported',
      canExecute: state === 'ACTIVE',
      lastVerifiedAt: Date.now(),
    };
  }

  private async evaluateNetwork(version: AndroidVersionInfo, isOnline: boolean): Promise<AndroidCapabilityInfo> {
    const state: AndroidCapabilityState = isOnline ? 'ACTIVE' : 'INACTIVE';

    return {
      id: 'network',
      name: 'RÉSEAU & CONNECTIVITÉ',
      category: 'storage_network',
      state,
      description: 'Supervision de la liaison Internet (Wi-Fi, 5G, 4G LTE) et latence serveur.',
      technicalDetails: 'ConnectivityManager / NetworkCapabilities / Network Information API.',
      requiredPermissions: ['android.permission.ACCESS_NETWORK_STATE'],
      isSpecialAccess: false,
      targetApiLevel: 1,
      modernApiNotes: 'Détection du type de transport et statut métrique sans consommation abusive.',
      configureIntent: 'android.settings.WIRELESS_SETTINGS',
      iconName: 'Zap',
      isRealCheck: true,
      hardwareAvailable: true,
      canExecute: state === 'ACTIVE',
      lastVerifiedAt: Date.now(),
    };
  }

  private async evaluateStorage(version: AndroidVersionInfo): Promise<AndroidCapabilityInfo> {
    const perm = await jarvisPermissionManager.checkPermission('storage');
    const state: AndroidCapabilityState = perm === 'granted' ? 'ACTIVE' : 'REQUIRES_PERMISSION';

    return {
      id: 'storage',
      name: 'STOCKAGE MODERNE',
      category: 'storage_network',
      state,
      description: 'Stockage partitionné (Scoped Storage), MediaStore et sélecteur de documents.',
      technicalDetails: 'Storage Access Framework (SAF) / MediaStore API / Photo Picker.',
      requiredPermissions:
        version.sdkInt >= 33
          ? ['android.permission.READ_MEDIA_IMAGES', 'android.permission.READ_MEDIA_VIDEO', 'android.permission.READ_MEDIA_AUDIO']
          : version.sdkInt >= 30
            ? ['android.permission.READ_EXTERNAL_STORAGE', 'android.permission.MANAGE_EXTERNAL_STORAGE']
            : ['android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE'],
      isSpecialAccess: version.sdkInt >= 30,
      targetApiLevel: 30,
      modernApiNotes: 'Sélecteur de photos intégré sous Android 13+ et Scoped Storage strict.',
      configureIntent: 'android.settings.MANAGE_ALL_FILES_ACCESS_PERMISSION',
      iconName: 'FolderLock',
      isRealCheck: true,
      hardwareAvailable: true,
      canExecute: state === 'ACTIVE',
      lastVerifiedAt: Date.now(),
    };
  }

  public subscribe(listener: (report: AndroidDeviceCapabilitiesReport) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(report: AndroidDeviceCapabilitiesReport) {
    for (const l of this.listeners) {
      try {
        l(report);
      } catch {}
    }
  }
}

export const androidControlEngine = AndroidControlEngine.getInstance();
