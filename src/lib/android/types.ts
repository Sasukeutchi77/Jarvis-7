/**
 * JARVIS ANDROID AGENT PROTOCOL & CORE TYPES (PHASE 3)
 * 
 * Strict 3-tier action classification architecture:
 * READ | SAFE_ACTION | SENSITIVE_ACTION
 */

import { AndroidPermissionType, AndroidActionConfirmation } from '../../types';

export type AndroidActionTier = 'READ' | 'SAFE_ACTION' | 'SENSITIVE_ACTION';

export type AndroidIntentType =
  | 'OPEN_APP'
  | 'OPEN_SETTINGS'
  | 'OPEN_CAMERA'
  | 'VIEW_DOWNLOADS'
  | 'SET_SILENT_MODE'
  | 'SET_RINGER_MODE'
  | 'TOGGLE_FLASHLIGHT'
  | 'ADJUST_VOLUME'
  | 'ADJUST_BRIGHTNESS'
  | 'VIBRATE_DEVICE'
  | 'READ_TELEMETRY'
  | 'READ_SCREEN_CONTEXT'
  | 'NAVIGATE_BACK'
  | 'NAVIGATE_HOME'
  | 'SHOW_LOCATION'
  | 'READ_NOTIFICATIONS'
  | 'MAKE_PHONE_CALL'
  | 'DEVICE_ADMIN_LOCK'
  | 'DEVICE_ADMIN_RESET'
  | 'SYSTEM_UPDATE_CHECK'
  | 'SYSTEM_UPDATE_APPLY';

export interface AndroidAppDefinition {
  id: string;
  name: string;
  packageName: string;
  urlScheme?: string;
  webFallbackUrl?: string;
  playStoreUrl?: string;
  iconName: string;
  category: 'communication' | 'media' | 'productivity' | 'navigation' | 'system' | 'social';
  description: string;
  keywords: string[];
  isSystemApp?: boolean;
}

export interface AndroidSettingDefinition {
  id: string;
  name: string;
  actionIntent: string; // e.g. "android.settings.SETTINGS"
  description: string;
  keywords: string[];
  category: 'general' | 'connectivity' | 'sound' | 'display' | 'apps' | 'privacy' | 'battery' | 'storage' | 'accessibility';
}

export interface AndroidVersionCompatibility {
  minSdk: number;
  recommendedSdk: number;
  androidVersionName: string;
  scopedStorageRequired?: boolean;
  notificationPermissionRequired?: boolean; // Android 13+ (API 33)
  vibratorManagerRequired?: boolean; // Android 12+ (API 31)
  dndPolicyAccessRequired?: boolean; // Android 7+ (API 24)
  notes?: string;
}

export interface ResolvedAndroidAction {
  id: string;
  intentType: AndroidIntentType;
  tier: AndroidActionTier;
  rawQuery: string;
  targetApp?: AndroidAppDefinition;
  targetSetting?: AndroidSettingDefinition;
  parameters: Record<string, any>;
  requiredPermissions: AndroidPermissionType[];
  requiresConfirmation: boolean;
  confirmationDetails?: AndroidActionConfirmation;
  versionCompatibility: AndroidVersionCompatibility;
  spokenOutput: string;
  description: string;
  fallbackStrategy: 'web_url' | 'play_store' | 'system_settings' | 'voice_explanation' | 'none';
}

export interface PermissionCheckResult {
  isAuthorized: boolean;
  tier: AndroidActionTier;
  missingPermissions: AndroidPermissionType[];
  deniedPermissions: AndroidPermissionType[];
  requiresUserConfirmation: boolean;
  confirmationDetails?: AndroidActionConfirmation;
  reason?: string;
  remediationAdvice?: string;
}

export interface AndroidApiExecutionResult {
  success: boolean;
  intentType: AndroidIntentType;
  tier: AndroidActionTier;
  methodUsed: string;
  actionSummary: string;
  spokenMessage: string;
  data?: Record<string, any>;
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
    missingApp?: string;
    deniedPermission?: AndroidPermissionType;
    suggestedAction?: string;
  };
}
