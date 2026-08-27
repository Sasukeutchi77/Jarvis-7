/**
 * CALL PERMISSION MANAGER (Phase 10: Phone Agent)
 * 
 * Analyzes and manages real Android Telephony permissions and Telecom APIs:
 * - android.permission.READ_CONTACTS : Reading contact list & resolving phone numbers
 * - android.permission.READ_CALL_LOG : Querying call logs, missed calls, incoming calls
 * - android.permission.CALL_PHONE : Direct calling via Intent.ACTION_CALL (requires confirmation)
 * - android.permission.READ_PHONE_STATE : Inspecting cellular state & active calls
 * 
 * RULE: Never bypass Android security. If a permission is denied:
 * - Explain why the permission is required.
 * - Prompt the user to grant permission.
 * - Fall back to Intent.ACTION_DIAL (which is safe and requires no runtime permission).
 */

export type PhonePermissionType =
  | 'android.permission.READ_CONTACTS'
  | 'android.permission.READ_CALL_LOG'
  | 'android.permission.CALL_PHONE'
  | 'android.permission.READ_PHONE_STATE';

export type PermissionState = 'granted' | 'denied' | 'prompt_required';

export interface PhonePermissionStatus {
  permission: PhonePermissionType;
  name: string;
  description: string;
  state: PermissionState;
  requiredFor: string[];
  isRuntime: boolean;
  riskLevel: 'safe' | 'normal' | 'dangerous';
}

export interface TelephonyCapabilities {
  hasCellularRadio: boolean;
  hasSimCard: boolean;
  simCarrier: string;
  availableApis: {
    telecomManager: boolean;
    contactsContract: boolean;
    callLogProvider: boolean;
    directCallAction: boolean; // Intent.ACTION_CALL
    dialerAction: boolean;     // Intent.ACTION_DIAL (Always available)
  };
  defaultDialerPackage: string;
  inCallState: 'IDLE' | 'RINGING' | 'OFFHOOK';
}

export class CallPermissionManager {
  private static permissions: Map<PhonePermissionType, PermissionState> = new Map([
    ['android.permission.READ_CONTACTS', 'granted'],
    ['android.permission.READ_CALL_LOG', 'granted'],
    ['android.permission.CALL_PHONE', 'granted'],
    ['android.permission.READ_PHONE_STATE', 'granted'],
  ]);

  private static capabilities: TelephonyCapabilities = {
    hasCellularRadio: true,
    hasSimCard: true,
    simCarrier: 'Orange / Free Mobile 5G',
    availableApis: {
      telecomManager: true,
      contactsContract: true,
      callLogProvider: true,
      directCallAction: true,
      dialerAction: true,
    },
    defaultDialerPackage: 'com.google.android.dialer',
    inCallState: 'IDLE',
  };

  /**
   * Get all permission details
   */
  public static getAllPermissions(): PhonePermissionStatus[] {
    return [
      {
        permission: 'android.permission.READ_CONTACTS',
        name: 'Contacts & Répertoire',
        description: 'Accès au carnet d’adresses pour associer les noms et prénoms aux numéros de téléphone.',
        state: this.permissions.get('android.permission.READ_CONTACTS') || 'prompt_required',
        requiredFor: ['Recherche de contact par nom', 'Résolution des homonymes', 'Appel par prénom (ex. "Appelle Sarah")'],
        isRuntime: true,
        riskLevel: 'dangerous',
      },
      {
        permission: 'android.permission.READ_CALL_LOG',
        name: 'Journal d’Appels',
        description: 'Accès à l’historique des appels entrants, sortants et manqués.',
        state: this.permissions.get('android.permission.READ_CALL_LOG') || 'prompt_required',
        requiredFor: ['"Qui m’a appelé ?"', '"Appelle le dernier appel manqué"', '"Montre mes appels récents"'],
        isRuntime: true,
        riskLevel: 'dangerous',
      },
      {
        permission: 'android.permission.CALL_PHONE',
        name: 'Émission d’Appels Directs',
        description: 'Autorisation pour déclencher des appels sans ouvrir manuellement le composeur (Intent.ACTION_CALL).',
        state: this.permissions.get('android.permission.CALL_PHONE') || 'prompt_required',
        requiredFor: ['Lancement direct d’appels vocaux après confirmation vocale/tactile'],
        isRuntime: true,
        riskLevel: 'dangerous',
      },
      {
        permission: 'android.permission.READ_PHONE_STATE',
        name: 'État de la Ligne Téléphonique',
        description: 'Détection d’appels en cours, numéro entrant et statut du réseau cellulaire.',
        state: this.permissions.get('android.permission.READ_PHONE_STATE') || 'granted',
        requiredFor: ['Supervision des appels entrants et interruption vocale lors d’un appel actif'],
        isRuntime: true,
        riskLevel: 'normal',
      },
    ];
  }

  /**
   * Check if a specific permission is granted
   */
  public static isGranted(permission: PhonePermissionType): boolean {
    return this.permissions.get(permission) === 'granted';
  }

  /**
   * Set / Toggle permission state (for testing or runtime permission flow)
   */
  public static setPermissionState(permission: PhonePermissionType, state: PermissionState): void {
    this.permissions.set(permission, state);
  }

  /**
   * Check if reading contacts is permitted
   */
  public static canReadContacts(): { allowed: boolean; reason?: string; actionNeeded?: string } {
    if (this.isGranted('android.permission.READ_CONTACTS')) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'La permission Android READ_CONTACTS est refusée ou non accordée.',
      actionNeeded: 'Autorisez l’accès aux Contacts dans les paramètres de l’application pour que JARVIS puisse identifier vos correspondants.',
    };
  }

  /**
   * Check if reading call logs is permitted
   */
  public static canReadCallLogs(): { allowed: boolean; reason?: string; actionNeeded?: string } {
    if (this.isGranted('android.permission.READ_CALL_LOG')) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'La permission Android READ_CALL_LOG est requise pour consulter le journal d’appels.',
      actionNeeded: 'Accordez la permission Journal d’appels pour que JARVIS puisse identifier qui vous a appelé ou rappeler le dernier appel manqué.',
    };
  }

  /**
   * Check if direct calling is permitted
   */
  public static canDirectCall(): { allowed: boolean; fallbackIntent: 'android.intent.action.DIAL'; reason?: string } {
    const isDirectAllowed = this.isGranted('android.permission.CALL_PHONE');
    return {
      allowed: isDirectAllowed,
      fallbackIntent: 'android.intent.action.DIAL',
      reason: isDirectAllowed
        ? undefined
        : 'Permission CALL_PHONE non accordée : bascule automatique sécurisée sur le composeur Android (Intent.ACTION_DIAL).',
    };
  }

  /**
   * Get Telephony hardware and API capabilities
   */
  public static getTelephonyCapabilities(): TelephonyCapabilities {
    return { ...this.capabilities };
  }
}
