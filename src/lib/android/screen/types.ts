/**
 * SCREEN CONTEXT AGENT TYPES & ARCHITECTURE (PHASE 6)
 * 
 * Defines data structures, privacy classifications, node hierarchy models,
 * and analysis contracts for on-demand Android screen context evaluation.
 */

export type ScreenContextTask =
  | 'screen_explanation'      // "JARVIS, explique-moi cet écran."
  | 'screen_guidance'          // "Que dois-je faire ici ?"
  | 'screen_error_diagnosis'   // "Pourquoi cette erreur apparaît ?"
  | 'screen_general';

export type ScreenCaptureTrigger =
  | 'voice_command'
  | 'ui_button'
  | 'shortcut'
  | 'assist_gesture'
  | 'simulation_test';

export interface ScreenNode {
  id: string;
  text?: string;
  className?: string; // e.g. "android.widget.Button", "android.widget.EditText"
  resourceId?: string;
  contentDescription?: string;
  isPassword?: boolean;
  isClickable?: boolean;
  isEditable?: boolean;
  isScrollable?: boolean;
  bounds?: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
}

export interface ScreenPrivacyViolation {
  code: 'FLAG_SECURE_VIOLATION' | 'BANKING_APP_PROTECTED' | 'PASSWORD_FIELD_DETECTED' | 'CREDIT_CARD_DETECTED' | 'IBAN_DETECTED' | 'SENSITIVE_KEYWORD_DETECTED';
  severity: 'block' | 'mask' | 'warning';
  description: string;
  target?: string;
}

export interface ScreenPrivacyAuditResult {
  passed: boolean;
  flagSecureViolation: boolean;
  passwordDetected: boolean;
  bankingAppDetected: boolean;
  sensitiveKeywordsFound: string[];
  maskedRegionsCount: number;
  actionAllowed: boolean;
  rejectionReason?: string;
  violations: ScreenPrivacyViolation[];
  sanitizedBase64?: string;
  localAuditOnly: boolean;
  auditTimestamp: number;
}

export interface ScreenContextSnapshot {
  id: string;
  timestamp: number;
  trigger: ScreenCaptureTrigger;
  activePackage: string;
  activeAppTitle: string;
  screenText: string;
  uiHierarchy: ScreenNode[];
  image?: {
    base64Data: string;
    mimeType: string;
    width?: number;
    height?: number;
    sizeBytes: number;
  };
  privacyAudit: ScreenPrivacyAuditResult;
  userExplicitConsent: boolean;
  isMockSample?: boolean;
}

export interface ScreenAnalysisResponse {
  success: boolean;
  query: string;
  task: ScreenContextTask;
  explanation: string;
  spokenSummary: string;
  suggestedActions: string[];
  errorDiagnosis?: {
    errorMessage: string;
    rootCause: string;
    stepByStepSolution: string[];
  };
  uiGuidance?: {
    currentScreenName: string;
    targetAction: string;
    stepSequence: string[];
  };
  privacyAudit: ScreenPrivacyAuditResult;
  activePackage: string;
  activeAppTitle: string;
  telemetry: {
    executionTimeMs: number;
    providerUsed: string;
    modelUsed: string;
    isOneShot: boolean;
  };
}

export interface ScreenIndicatorState {
  isActive: boolean;
  status: 'idle' | 'requesting_permission' | 'capturing' | 'auditing_privacy' | 'analyzing' | 'blocked_privacy';
  message: string;
  timestamp: number;
  trigger?: ScreenCaptureTrigger;
}
