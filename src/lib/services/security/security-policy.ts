/**
 * JARVIS SECURITY POLICY (PHASE 13)
 * 
 * Rules engine for action classification (LEVEL 0 -> LEVEL 4),
 * policy constraints, Private Mode behaviors, and Emergency Stop enforcement.
 */

import { ActionSecurityLevel, ActionTierName, PermissionKey, SecurityEvaluationResult } from './types.js';

export class SecurityPolicy {
  public static readonly VERSION = '1.3.0';

  // Permission definitions repository
  public static readonly PERMISSION_MAP: Record<PermissionKey, {
    name: string;
    category: 'system' | 'privacy' | 'hardware' | 'sensitive' | 'financial';
    requiredLevel: ActionSecurityLevel;
    isDangerous: boolean;
    defaultGranted: boolean;
  }> = {
    READ_STORAGE: { name: 'Lecture Stockage', category: 'privacy', requiredLevel: ActionSecurityLevel.LEVEL_1_SAFE, isDangerous: false, defaultGranted: true },
    WRITE_STORAGE: { name: 'Écriture / Modification Fichiers', category: 'sensitive', requiredLevel: ActionSecurityLevel.LEVEL_3_SENSITIVE, isDangerous: true, defaultGranted: false },
    SEND_SMS: { name: 'Envoi de SMS', category: 'sensitive', requiredLevel: ActionSecurityLevel.LEVEL_2_IMPORTANT, isDangerous: true, defaultGranted: true },
    READ_SMS: { name: 'Lecture des SMS', category: 'privacy', requiredLevel: ActionSecurityLevel.LEVEL_2_IMPORTANT, isDangerous: true, defaultGranted: true },
    MAKE_PHONE_CALLS: { name: 'Appels Téléphoniques', category: 'sensitive', requiredLevel: ActionSecurityLevel.LEVEL_2_IMPORTANT, isDangerous: true, defaultGranted: true },
    READ_CONTACTS: { name: 'Lecture des Contacts', category: 'privacy', requiredLevel: ActionSecurityLevel.LEVEL_2_IMPORTANT, isDangerous: false, defaultGranted: true },
    WRITE_CONTACTS: { name: 'Modification des Contacts', category: 'sensitive', requiredLevel: ActionSecurityLevel.LEVEL_3_SENSITIVE, isDangerous: true, defaultGranted: false },
    FINE_LOCATION: { name: 'Géolocalisation Précise', category: 'privacy', requiredLevel: ActionSecurityLevel.LEVEL_2_IMPORTANT, isDangerous: true, defaultGranted: true },
    CAMERA_ACCESS: { name: 'Caméra & Flux Vidéo', category: 'hardware', requiredLevel: ActionSecurityLevel.LEVEL_2_IMPORTANT, isDangerous: true, defaultGranted: true },
    MICROPHONE_ACCESS: { name: 'Microphone & Écoute Vocale', category: 'hardware', requiredLevel: ActionSecurityLevel.LEVEL_2_IMPORTANT, isDangerous: true, defaultGranted: true },
    READ_NOTIFICATIONS: { name: 'Lecture des Notifications', category: 'privacy', requiredLevel: ActionSecurityLevel.LEVEL_1_SAFE, isDangerous: false, defaultGranted: true },
    POST_NOTIFICATIONS: { name: 'Publication de Notifications', category: 'system', requiredLevel: ActionSecurityLevel.LEVEL_1_SAFE, isDangerous: false, defaultGranted: true },
    FINANCIAL_TRANSACTIONS: { name: 'Paiements & Transactions Financières', category: 'financial', requiredLevel: ActionSecurityLevel.LEVEL_4_CRITICAL, isDangerous: true, defaultGranted: false },
    SYSTEM_SETTINGS: { name: 'Modification Paramètres Android / OS', category: 'system', requiredLevel: ActionSecurityLevel.LEVEL_3_SENSITIVE, isDangerous: true, defaultGranted: false },
    DEVICE_ADMIN: { name: 'Verrouillage / Admin Appareil', category: 'sensitive', requiredLevel: ActionSecurityLevel.LEVEL_4_CRITICAL, isDangerous: true, defaultGranted: false },
    APPLICATION_LAUNCH: { name: 'Lancement d\'Applications', category: 'system', requiredLevel: ActionSecurityLevel.LEVEL_1_SAFE, isDangerous: false, defaultGranted: true },
    NETWORK_COMMUNICATION: { name: 'Accès Réseau & Internet', category: 'system', requiredLevel: ActionSecurityLevel.LEVEL_1_SAFE, isDangerous: false, defaultGranted: true },
  };

  /**
   * Classify an action and its payload into a strict Security Level (READ, SAFE, IMPORTANT, SENSITIVE, CRITICAL).
   */
  public classifyAction(actionName: string, payload?: Record<string, any>): {
    level: ActionSecurityLevel;
    levelName: string;
    tierName: ActionTierName;
    description: string;
    requiredPermissions: PermissionKey[];
    requiresExplicitConfirmation: boolean;
  } {
    const act = (actionName || '').toLowerCase().trim();
    const payloadStr = JSON.stringify(payload || {}).toLowerCase();

    // =========================================================================
    // LEVEL 4 — CRITICAL (Action bancaire, virement, paiement, wipe data, factory reset)
    // Strictly gated, NO auto-execution ever allowed. Mandatory confirmation + biometrics.
    // =========================================================================
    if (
      act.includes('banking') || act.includes('banque') || act.includes('bancaire') ||
      act.includes('payment') || act.includes('paiement') || act.includes('transfer') || act.includes('virement') ||
      act.includes('pay') || act.includes('acheter') || act.includes('crypto') || act.includes('wallet') ||
      act.includes('wipe') || act.includes('factory_reset') || act.includes('format') ||
      act.includes('change_password') || act.includes('root') || act.includes('device_admin_reset') || act.includes('device_admin_lock') ||
      payloadStr.includes('payment') || payloadStr.includes('virement') || payloadStr.includes('credit_card') || payloadStr.includes('bancaire')
    ) {
      return {
        level: ActionSecurityLevel.LEVEL_4_CRITICAL,
        levelName: 'CRITICAL (Niveau 4 — Critique)',
        tierName: 'CRITICAL',
        description: 'Action bancaire, financière ou critique système. Confirmation explicite obligatoire et authentification requise.',
        requiredPermissions: ['FINANCIAL_TRANSACTIONS', 'DEVICE_ADMIN'],
        requiresExplicitConfirmation: true,
      };
    }

    // =========================================================================
    // LEVEL 3 — SENSITIVE (Envoyer message par défaut, supprimer fichier, installer application, modifier réglages)
    // Requires confirmation / explicit gating before execution.
    // =========================================================================
    if (
      act.includes('send_sms') || act.includes('send_message') || act.includes('send_email') || act.includes('envoi_message') ||
      act.includes('delete_file') || act.includes('supprimer_fichier') || act.includes('write_storage') || act.includes('modify_file') ||
      act.includes('delete_note') || act.includes('delete_routine') || act.includes('delete_task') ||
      act.includes('install_app') || act.includes('installer_application') || act.includes('install_package') ||
      act.includes('make_phone_call') || act.includes('make_call') || act.includes('phone_call') ||
      act.includes('system_settings') || act.includes('change_wifi') || act.includes('change_bluetooth') ||
      act.includes('sensitive') || act.includes('export_keys') || act.includes('write_contacts') ||
      payloadStr.includes('rm -rf') || payloadStr.includes('delete') || payloadStr.includes('supprimer') || payloadStr.includes('install')
    ) {
      const perms: PermissionKey[] = ['WRITE_STORAGE', 'SYSTEM_SETTINGS'];
      if (act.includes('sms') || act.includes('message')) perms.push('SEND_SMS');
      if (act.includes('call') || act.includes('phone')) perms.push('MAKE_PHONE_CALLS');
      if (act.includes('install')) perms.push('APPLICATION_LAUNCH');

      return {
        level: ActionSecurityLevel.LEVEL_3_SENSITIVE,
        levelName: 'SENSITIVE (Niveau 3 — Sensible)',
        tierName: 'SENSITIVE',
        description: 'Action sensible (Envoi de message par défaut, suppression de fichier, installation d\'app, modification système). Confirmation requise.',
        requiredPermissions: perms,
        requiresExplicitConfirmation: true,
      };
    }

    // =========================================================================
    // LEVEL 2 — IMPORTANT (Lire notifications selon configuration, créer événement, alarmes, notes)
    // Logged to audit trail, executed according to configured permissions.
    // =========================================================================
    if (
      act.includes('read_notifications') || act.includes('lire_notifications') || act.includes('notifications') ||
      act.includes('create_event') || act.includes('create_calendar') || act.includes('create_alarm') ||
      act.includes('add_task') || act.includes('save_note') || act.includes('update_note') ||
      act.includes('share') || act.includes('location_query') || act.includes('show_location') ||
      act.includes('camera_capture') || act.includes('open_camera') || act.includes('mic_listen')
    ) {
      const perms: PermissionKey[] = [];
      if (act.includes('notification')) perms.push('READ_NOTIFICATIONS');
      if (act.includes('location')) perms.push('FINE_LOCATION');
      if (act.includes('camera')) perms.push('CAMERA_ACCESS');
      if (act.includes('mic')) perms.push('MICROPHONE_ACCESS');

      return {
        level: ActionSecurityLevel.LEVEL_2_IMPORTANT,
        levelName: 'IMPORTANT (Niveau 2 — Important)',
        tierName: 'IMPORTANT',
        description: 'Action importante (Lecture notifications selon config, création agenda/notes, capteurs). Journalisée dans le registre de sécurité.',
        requiredPermissions: perms.length > 0 ? perms : ['READ_NOTIFICATIONS'],
        requiresExplicitConfirmation: false,
      };
    }

    // =========================================================================
    // LEVEL 1 — SAFE (Ouvrir application, retour, accueil, média, changer thème, volume)
    // Executed automatically without data risk.
    // =========================================================================
    if (
      act.includes('open_app') || act.includes('launch_app') || act.includes('open_settings') ||
      act.includes('navigate_back') || act.includes('navigate_home') ||
      act.includes('theme') || act.includes('volume') || act.includes('dnd_toggle') || act.includes('silent_mode') ||
      act.includes('read_storage') || act.includes('list_routines') || act.includes('media_play') ||
      act.includes('media_pause') || act.includes('media_next') || act.includes('vibrate')
    ) {
      return {
        level: ActionSecurityLevel.LEVEL_1_SAFE,
        levelName: 'SAFE (Niveau 1 — Sûr)',
        tierName: 'SAFE',
        description: 'Action sûre (Lancement d\'application, navigation retour/accueil, lecteur média). Exécution automatique immédiate.',
        requiredPermissions: ['APPLICATION_LAUNCH'],
        requiresExplicitConfirmation: false,
      };
    }

    // =========================================================================
    // LEVEL 0 — READ (Lire météo, heure, statut, diagnostics, lecture écran)
    // Zero-risk read-only action. Automatic immediate execution.
    // =========================================================================
    return {
      level: ActionSecurityLevel.LEVEL_0_READ,
      levelName: 'READ (Niveau 0 — Lecture / Info)',
      tierName: 'READ',
      description: 'Action en lecture seule / informative (Météo, heure, diagnostics, statut système). Exécution automatique immédiate.',
      requiredPermissions: [],
      requiresExplicitConfirmation: false,
    };
  }

  /**
   * Helper to format human-readable level badge
   */
  public static getLevelColor(level: ActionSecurityLevel | ActionTierName): string {
    if (level === 'CRITICAL' || level === ActionSecurityLevel.LEVEL_4_CRITICAL) return '#ef4444'; // Red
    if (level === 'SENSITIVE' || level === ActionSecurityLevel.LEVEL_3_SENSITIVE) return '#f97316'; // Orange
    if (level === 'IMPORTANT' || level === ActionSecurityLevel.LEVEL_2_IMPORTANT) return '#f59e0b'; // Amber
    if (level === 'SAFE' || level === ActionSecurityLevel.LEVEL_1_SAFE) return '#10b981'; // Emerald
    return '#06b6d4'; // Cyan (READ)
  }
}

export const securityPolicy = new SecurityPolicy();
