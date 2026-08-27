/**
 * JARVIS SECURITY & GOVERNANCE TYPES (PHASE 13)
 * 
 * Central classification of action security levels, permissions,
 * confirmation tokens, security policies, and audit logging.
 */

export enum ActionSecurityLevel {
  LEVEL_0_READ = 0,        // READ / Information (Lire météo, heure, statut, lecture notes) -> Auto execution
  LEVEL_0_INFORMATION = 0, // Information alias
  LEVEL_1_SAFE = 1,        // SAFE (Ouvrir application, lecture multimédia, changer thème) -> Auto execution
  LEVEL_2_IMPORTANT = 2,   // IMPORTANT (Lire notification selon config, créer événement, alarme, notes) -> Logged to audit
  LEVEL_3_SENSITIVE = 3,   // SENSITIVE (Envoyer message/SMS par défaut, supprimer fichier/note, modifier paramètres, installer application) -> Requires confirmation
  LEVEL_4_CRITICAL = 4,    // CRITICAL (Action bancaire, virement, paiement, wipe data, factory reset, changer mot de passe, root/admin) -> Mandatory biometric/explicit confirmation
}

export type ActionTierName = 'READ' | 'SAFE' | 'IMPORTANT' | 'SENSITIVE' | 'CRITICAL';

export type PermissionKey =
  | 'READ_STORAGE'
  | 'WRITE_STORAGE'
  | 'SEND_SMS'
  | 'READ_SMS'
  | 'MAKE_PHONE_CALLS'
  | 'READ_CONTACTS'
  | 'WRITE_CONTACTS'
  | 'FINE_LOCATION'
  | 'CAMERA_ACCESS'
  | 'MICROPHONE_ACCESS'
  | 'READ_NOTIFICATIONS'
  | 'POST_NOTIFICATIONS'
  | 'FINANCIAL_TRANSACTIONS'
  | 'SYSTEM_SETTINGS'
  | 'DEVICE_ADMIN'
  | 'APPLICATION_LAUNCH'
  | 'NETWORK_COMMUNICATION';

export interface PermissionDefinition {
  key: PermissionKey;
  name: string;
  description: string;
  category: 'system' | 'privacy' | 'hardware' | 'sensitive' | 'financial';
  requiredLevel: ActionSecurityLevel;
  isDangerous: boolean;
  defaultGranted: boolean;
}

export interface AgentPermissionAssignment {
  agentId: string;
  grantedPermissions: PermissionKey[];
  revokedPermissions: PermissionKey[];
  isAgentDisabled: boolean;
  lastUpdated: string;
}

export interface ConfirmationRequest {
  token: string;
  actionId: string;
  actionName: string;
  level: ActionSecurityLevel;
  agentId: string;
  targetResource?: string;
  description: string;
  riskDetails: string;
  payloadSummary: Record<string, any>;
  createdAt: number;
  expiresAt: number; // TTL (e.g. 5 minutes)
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  requiresBiometrics: boolean;
}

export interface SecurityEvaluationResult {
  allowed: boolean;
  level: ActionSecurityLevel;
  levelName: string;
  actionName: string;
  agentId: string;
  reason: string;
  requiresConfirmation: boolean;
  confirmationToken?: string;
  missingPermissions?: PermissionKey[];
  isEmergencyStopped?: boolean;
  isPrivateModeConstrained?: boolean;
  isAgentDisabled?: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  isoDate: string;
  level: ActionSecurityLevel;
  levelName: string;
  agentId: string;
  actionName: string;
  category: string;
  target?: string;
  status: 'approved' | 'denied' | 'executed' | 'blocked' | 'emergency_stopped' | 'failed';
  justification: string;
  redactedPayload?: Record<string, any>;
  confirmationTokenUsed?: string;
  clientIp?: string;
  integrityHash: string;
}

export interface SecuritySystemStatus {
  privateModeActive: boolean;
  emergencyStopActive: boolean;
  emergencyStopTimestamp?: number;
  emergencyStopReason?: string;
  killswitches: {
    screenAccessDisabled: boolean;
    microphoneDisabled: boolean;
    automationDisabled: boolean;
    communicationAgentDisabled: boolean;
  };
  totalAuditLogs: number;
  pendingConfirmationsCount: number;
  activePermissionsCount: number;
  revokedPermissionsCount: number;
  disabledAgents: string[];
  apkSecurityCompliance: {
    noEmbeddedApiKeys: boolean;
    runtimeKeyIsolation: boolean;
    secureStorageType: 'Android Keystore / Encrypted SharedPreferences';
    antiTamperEnforced: boolean;
  };
  policyVersion: string;
}
