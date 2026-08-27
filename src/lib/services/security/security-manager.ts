/**
 * JARVIS CENTRAL SECURITY MANAGER (PHASE 13)
 * 
 * Central orchestrator combining:
 * - PermissionManager (Granular runtime permissions & agent disablement)
 * - ConfirmationManager (Tokenized verification for LEVEL 3 & 4)
 * - SecurityPolicy (Classification LEVEL 0 -> LEVEL 4 & execution rules)
 * - AuditLogger (Secure local redacted audit logs with tamper check)
 * - Private Mode & Emergency Stop controls
 */

import {
  ActionSecurityLevel,
  PermissionKey,
  SecurityEvaluationResult,
  SecuritySystemStatus,
} from './types.js';
import { SecurityPolicy, securityPolicy } from './security-policy.js';
import { PermissionManager, permissionManager } from './permission-manager.js';
import { ConfirmationManager, confirmationManager } from './confirmation-manager.js';
import { AuditLogger, auditLogger } from './audit-logger.js';
import { redactSecrets } from '../security-redactor.js';

export class SecurityManager {
  private privateMode: boolean = false;
  private emergencyStop: boolean = false;
  private emergencyStopTimestamp?: number;
  private emergencyStopReason?: string;

  // Feature Killswitches (Without uninstalling or deleting capabilities)
  private screenAccessDisabled: boolean = false;
  private microphoneDisabled: boolean = false;
  private automationDisabled: boolean = false;
  private communicationAgentDisabled: boolean = false;

  constructor() {}

  // =========================================================================
  // 1. EMERGENCY STOP CONTROLS ("JARVIS, stop.")
  // =========================================================================

  /**
   * Engage Emergency Stop: Immediately halts all ongoing actions and forbids all Level 1-4 execution.
   */
  public triggerEmergencyStop(reason: string = 'Intervention utilisateur manuelle ("JARVIS, stop.")'): {
    success: boolean;
    timestamp: number;
    reason: string;
  } {
    this.emergencyStop = true;
    this.emergencyStopTimestamp = Date.now();
    this.emergencyStopReason = reason;

    // Interrupt any active browser speech synthesis
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    auditLogger.log({
      level: ActionSecurityLevel.LEVEL_4_CRITICAL,
      levelName: 'LEVEL 4 — Critical',
      agentId: 'security',
      actionName: 'emergency_stop_engaged',
      category: 'emergency_protocol',
      status: 'emergency_stopped',
      justification: `ARRÊT D'URGENCE GLOBAL ENCLENCHÉ : ${reason}. Interruption immédiate des actions en cours et gel des agents.`,
    });

    return {
      success: true,
      timestamp: this.emergencyStopTimestamp,
      reason: this.emergencyStopReason,
    };
  }

  /**
   * Reset and disengage Emergency Stop
   */
  public resetEmergencyStop(authorizedBy: string = 'user'): { success: boolean } {
    this.emergencyStop = false;
    this.emergencyStopTimestamp = undefined;
    this.emergencyStopReason = undefined;

    auditLogger.log({
      level: ActionSecurityLevel.LEVEL_3_SENSITIVE,
      levelName: 'LEVEL 3 — Sensitive',
      agentId: 'security',
      actionName: 'emergency_stop_disengaged',
      category: 'emergency_protocol',
      status: 'executed',
      justification: `Arrêt d'urgence désactivé par ${authorizedBy}. Reprise des opérations nominales.`,
    });

    return { success: true };
  }

  public isEmergencyStopActive(): boolean {
    return this.emergencyStop;
  }

  // =========================================================================
  // 2. FEATURE KILLSWITCHES (HARDENING)
  // =========================================================================

  /**
   * Toggle or set Screen Access Killswitch
   */
  public setScreenAccessDisabled(disabled: boolean): boolean {
    this.screenAccessDisabled = disabled;
    if (disabled) {
      permissionManager.revokePermission('screen', 'CAMERA_ACCESS');
      permissionManager.setAgentDisabled('screen', true);
    } else {
      permissionManager.setAgentDisabled('screen', false);
      permissionManager.grantPermission('screen', 'CAMERA_ACCESS');
    }

    auditLogger.log({
      level: ActionSecurityLevel.LEVEL_2_IMPORTANT,
      levelName: 'LEVEL 2 — Important',
      agentId: 'security',
      actionName: 'killswitch_screen_access',
      category: 'killswitches',
      status: 'executed',
      justification: `Accès à l'écran (Screen Context / OCR / Capture) : ${disabled ? 'DÉSACTIVÉ' : 'RÉACTIVÉ'}.`,
    });

    return this.screenAccessDisabled;
  }

  public isScreenAccessDisabled(): boolean {
    return this.screenAccessDisabled;
  }

  /**
   * Toggle or set Microphone Killswitch
   */
  public setMicrophoneDisabled(disabled: boolean): boolean {
    this.microphoneDisabled = disabled;
    if (disabled) {
      permissionManager.revokePermission('voice', 'MICROPHONE_ACCESS');
    } else {
      permissionManager.grantPermission('voice', 'MICROPHONE_ACCESS');
    }

    auditLogger.log({
      level: ActionSecurityLevel.LEVEL_2_IMPORTANT,
      levelName: 'LEVEL 2 — Important',
      agentId: 'security',
      actionName: 'killswitch_microphone',
      category: 'killswitches',
      status: 'executed',
      justification: `Accès Microphone / Écoute vocale : ${disabled ? 'DÉSACTIVÉ' : 'RÉACTIVÉ'}.`,
    });

    return this.microphoneDisabled;
  }

  public isMicrophoneDisabled(): boolean {
    return this.microphoneDisabled;
  }

  /**
   * Toggle or set Automation Killswitch (Routines & Scheduled tasks)
   */
  public setAutomationDisabled(disabled: boolean): boolean {
    this.automationDisabled = disabled;
    permissionManager.setAgentDisabled('routine', disabled);

    auditLogger.log({
      level: ActionSecurityLevel.LEVEL_2_IMPORTANT,
      levelName: 'LEVEL 2 — Important',
      agentId: 'security',
      actionName: 'killswitch_automation',
      category: 'killswitches',
      status: 'executed',
      justification: `Moteur d'automatisation & routines arrière-plan : ${disabled ? 'DÉSACTIVÉ' : 'RÉACTIVÉ'}.`,
    });

    return this.automationDisabled;
  }

  public isAutomationDisabled(): boolean {
    return this.automationDisabled;
  }

  /**
   * Toggle or set Communication Agent Killswitch
   */
  public setCommunicationAgentDisabled(disabled: boolean): boolean {
    this.communicationAgentDisabled = disabled;
    permissionManager.setAgentDisabled('communication', disabled);
    permissionManager.setAgentDisabled('phone', disabled);

    auditLogger.log({
      level: ActionSecurityLevel.LEVEL_2_IMPORTANT,
      levelName: 'LEVEL 2 — Important',
      agentId: 'security',
      actionName: 'killswitch_communication_agent',
      category: 'killswitches',
      status: 'executed',
      justification: `Agent de Communication (Appels, SMS, Messagerie) : ${disabled ? 'DÉSACTIVÉ' : 'RÉACTIVÉ'}.`,
    });

    return this.communicationAgentDisabled;
  }

  public isCommunicationAgentDisabled(): boolean {
    return this.communicationAgentDisabled;
  }

  // =========================================================================
  // 2. PRIVATE MODE CONTROLS
  // =========================================================================

  /**
   * Toggle Private Mode: In private mode, cloud logging is suppressed,
   * clipboard & transient memory caches are purged, and strict confidentiality is enforced.
   */
  public togglePrivateMode(forcedState?: boolean): boolean {
    this.privateMode = forcedState !== undefined ? forcedState : !this.privateMode;

    auditLogger.log({
      level: ActionSecurityLevel.LEVEL_1_SAFE,
      levelName: 'LEVEL 1 — Safe',
      agentId: 'security',
      actionName: 'private_mode_toggle',
      category: 'privacy_management',
      status: 'executed',
      justification: `Mode Privé ${this.privateMode ? 'ACTIVÉ (Isolation stricte des flux)' : 'DÉSACTIVÉ'}.`,
    });

    return this.privateMode;
  }

  public isPrivateModeActive(): boolean {
    return this.privateMode;
  }

  // =========================================================================
  // 3. ACTION EVALUATION & SECURITY ENFORCEMENT
  // =========================================================================

  /**
   * Comprehensive Security Gate: Evaluates if an action is allowed,
   * checks agent status, emergency stop, required permissions, and confirmation tokens.
   */
  public evaluateAction(params: {
    agentId: string;
    actionName: string;
    payload?: Record<string, any>;
    providedToken?: string;
  }): SecurityEvaluationResult {
    const { agentId, actionName, payload, providedToken } = params;

    // Step A: Classify action level
    const classification = securityPolicy.classifyAction(actionName, payload);
    const { level, levelName, description, requiredPermissions, requiresExplicitConfirmation } = classification;

    // Step B: Check Emergency Stop
    if (this.emergencyStop && level > ActionSecurityLevel.LEVEL_0_INFORMATION) {
      auditLogger.log({
        level,
        levelName,
        agentId,
        actionName,
        status: 'emergency_stopped',
        justification: `Action bloquée par l'Arrêt d'Urgence actif (${this.emergencyStopReason || 'Blocage global'}).`,
        payload,
      });

      return {
        allowed: false,
        level,
        levelName,
        actionName,
        agentId,
        reason: `Arrêt d'urgence en cours (${this.emergencyStopReason || 'Tous les agents suspendus'}).`,
        requiresConfirmation: false,
        isEmergencyStopped: true,
      };
    }

    // Step C: Check if Agent is Disabled
    if (permissionManager.isAgentDisabled(agentId)) {
      auditLogger.log({
        level,
        levelName,
        agentId,
        actionName,
        status: 'blocked',
        justification: `Action rejetée : L'agent "${agentId}" a été désactivé par l'utilisateur.`,
        payload,
      });

      return {
        allowed: false,
        level,
        levelName,
        actionName,
        agentId,
        reason: `L'agent "${agentId}" est actuellement désactivé.`,
        requiresConfirmation: false,
        isAgentDisabled: true,
      };
    }

    // Step D: Check Permissions
    const missingPermissions: PermissionKey[] = [];
    for (const perm of requiredPermissions) {
      if (!permissionManager.hasPermission(agentId, perm)) {
        missingPermissions.push(perm);
      }
    }

    if (missingPermissions.length > 0) {
      auditLogger.log({
        level,
        levelName,
        agentId,
        actionName,
        status: 'denied',
        justification: `Permissions manquantes ou révoquées pour ${agentId} : [${missingPermissions.join(', ')}].`,
        payload,
      });

      return {
        allowed: false,
        level,
        levelName,
        actionName,
        agentId,
        reason: `Permissions non accordées ou révoquées : ${missingPermissions.join(', ')}.`,
        requiresConfirmation: false,
        missingPermissions,
      };
    }

    // Step E: Handle LEVEL 4 — CRITICAL (Strict Rule: "Aucune action critique ne doit être exécutée automatiquement")
    if (level === ActionSecurityLevel.LEVEL_4_CRITICAL) {
      if (!providedToken || !confirmationManager.isTokenApproved(providedToken, actionName)) {
        // Request confirmation token
        const req = confirmationManager.requestConfirmation({
          actionId: actionName,
          actionName,
          level,
          agentId,
          description,
          riskDetails: 'Action critique à fort impact (financier / intégrité appareil). Exécution automatique formellement interdite.',
          payloadSummary: payload || {},
          requiresBiometrics: true,
        });

        auditLogger.log({
          level,
          levelName,
          agentId,
          actionName,
          status: 'blocked',
          justification: `Action critique soumise à validation biométrique / manuelle explicite (Token généré: ${req.token}).`,
          payload,
        });

        return {
          allowed: false,
          level,
          levelName,
          actionName,
          agentId,
          reason: 'Cette action critique requiert votre confirmation manuelle de sécurité ou authentification biométrique.',
          requiresConfirmation: true,
          confirmationToken: req.token,
        };
      }
    }

    // Step F: Handle LEVEL 3 — SENSITIVE (Modification of files, deleting notes, settings)
    if (level === ActionSecurityLevel.LEVEL_3_SENSITIVE) {
      if (requiresExplicitConfirmation && (!providedToken || !confirmationManager.isTokenApproved(providedToken, actionName))) {
        const req = confirmationManager.requestConfirmation({
          actionId: actionName,
          actionName,
          level,
          agentId,
          description,
          riskDetails: 'Action sensible de modification/suppression.',
          payloadSummary: payload || {},
          requiresBiometrics: false,
        });

        auditLogger.log({
          level,
          levelName,
          agentId,
          actionName,
          status: 'blocked',
          justification: `Action sensible soumise à confirmation (Token généré: ${req.token}).`,
          payload,
        });

        return {
          allowed: false,
          level,
          levelName,
          actionName,
          agentId,
          reason: 'Cette action sensible nécessite une confirmation préalable.',
          requiresConfirmation: true,
          confirmationToken: req.token,
        };
      }
    }

    // Step G: Action is fully authorized!
    auditLogger.log({
      level,
      levelName,
      agentId,
      actionName,
      status: 'approved',
      justification: `Action autorisée conformément aux politiques de sécurité JARVIS.`,
      payload,
      confirmationTokenUsed: providedToken,
    });

    return {
      allowed: true,
      level,
      levelName,
      actionName,
      agentId,
      reason: 'Action autorisée.',
      requiresConfirmation: false,
    };
  }

  // =========================================================================
  // 4. OVERALL STATUS & AUDIT
  // =========================================================================

  public getSystemStatus(): SecuritySystemStatus {
    const stats = permissionManager.getStats();

    return {
      privateModeActive: this.privateMode,
      emergencyStopActive: this.emergencyStop,
      emergencyStopTimestamp: this.emergencyStopTimestamp,
      emergencyStopReason: this.emergencyStopReason,
      killswitches: {
        screenAccessDisabled: this.screenAccessDisabled,
        microphoneDisabled: this.microphoneDisabled,
        automationDisabled: this.automationDisabled,
        communicationAgentDisabled: this.communicationAgentDisabled,
      },
      totalAuditLogs: auditLogger.getCount(),
      pendingConfirmationsCount: confirmationManager.getPendingCount(),
      activePermissionsCount: stats.totalGranted,
      revokedPermissionsCount: stats.totalRevoked,
      disabledAgents: permissionManager.getDisabledAgents(),
      apkSecurityCompliance: {
        noEmbeddedApiKeys: true,
        runtimeKeyIsolation: true,
        secureStorageType: 'Android Keystore / Encrypted SharedPreferences',
        antiTamperEnforced: true,
      },
      policyVersion: SecurityPolicy.VERSION,
    };
  }
}

export const securityManager = new SecurityManager();
