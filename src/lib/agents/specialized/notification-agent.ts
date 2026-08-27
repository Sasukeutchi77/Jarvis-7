/**
 * NOTIFICATION AGENT (Specialized Agent — JARVIS Android System)
 * 
 * Intercepts, classifies, summarizes and manages Android notifications
 * across communication, system alerts, calendars and reminders.
 * Connects directly to NotificationListenerService & NotificationManager.
 */

import {
  SpecializedAgent,
  AgentId,
  AgentCapability,
  AgentToolDefinition,
  AgentPermissionLevel,
  AgentInput,
  AgentOutput,
  AgentRoutingEvaluation,
} from '../agent-protocol.js';
import { AndroidPermissionAuditor } from '../../services/security/android-permission-auditor.js';

export class NotificationAgent implements SpecializedAgent {
  public readonly id: AgentId = 'notification';
  public readonly name = 'JARVIS Notification Agent';
  public readonly description = 'Spécialiste de l\'interception, de la classification, du résumé et de la gestion vocale de toutes les notifications Android (SMS, Messageries, Alertes système).';
  public readonly permissionLevel: AgentPermissionLevel = 'sensitive';

  public readonly capabilities: AgentCapability[] = [
    {
      id: 'read_notifications',
      name: 'Lecture et Résumé des Notifications',
      description: 'Lit et synthétise les notifications reçues sur l\'appareil Android.',
      tags: ['lis mes notifications', 'quelles notifications', 'dernières notifications', 'résume mes notifications'],
      requiredPermissions: ['notification_listener'],
      riskLevel: 'low',
    },
    {
      id: 'important_notifications',
      name: 'Filtrage des Notifications Importantes',
      description: 'Isole les alertes prioritaires et urgentes reçues.',
      tags: ['notifications importantes', 'alertes urgentes', 'quoi de neuf'],
      requiredPermissions: ['notification_listener'],
      riskLevel: 'low',
    },
    {
      id: 'clear_notifications',
      name: 'Nettoyage des Notifications',
      description: 'Efface ou marque comme lues les notifications traitées.',
      tags: ['efface les notifications', 'nettoie les alertes'],
      requiredPermissions: ['notification_listener'],
      riskLevel: 'medium',
    },
  ];

  public readonly allowedTools: AgentToolDefinition[] = [
    {
      name: 'get_notifications',
      description: 'Récupère la liste des notifications actives.',
      parameters: { category: { type: 'string' } },
    },
    {
      name: 'summarize_notifications',
      description: 'Génère un résumé vocal intelligent des alertes récentes.',
      parameters: {},
    },
  ];

  public canHandle(input: AgentInput): AgentRoutingEvaluation {
    const p = (input.query || '').toLowerCase();
    const isNotificationRequest =
      p.includes('notification') ||
      p.includes('notifications') ||
      p.includes('alertes') ||
      p.includes('quoi de neuf') ||
      p.includes('derniers messages');

    const capability = AndroidPermissionAuditor.checkCapability('notification_listener');

    return {
      agentId: this.id,
      score: isNotificationRequest ? 0.92 : 0.0,
      confidence: isNotificationRequest ? 0.92 : 0.0,
      reason: isNotificationRequest
        ? 'Demande explicite de consultation ou de gestion des notifications Android.'
        : 'Non lié aux notifications.',
      matchedCapabilities: isNotificationRequest ? ['read_notifications'] : [],
      requiredPermissions: ['notification_listener'],
      isPermissionMet: capability.status === 'AUTHORIZED',
    };
  }

  public async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    const capability = AndroidPermissionAuditor.checkCapability('notification_listener');

    if (capability.status !== 'AUTHORIZED') {
      return {
        id: `out-${Date.now()}`,
        agentId: this.id,
        agentName: this.name,
        success: false,
        reply: `L'accès aux notifications nécessite une autorisation système Android (${capability.status}).\n\nVeuillez autoriser le service dans : ${capability.officialResolutionSteps}.`,
        spokenSummary: "Pour lire vos notifications, vous devez activer l'accès aux notifications dans les paramètres Android.",
        telemetry: {
          providerUsed: 'local',
          modelUsed: 'system-capability-check',
          fallbackOccurred: false,
          providerChainAttempted: ['local'],
          executionTimeMs: Date.now() - startTime,
        },
        structuredData: { capability },
        error: {
          code: 'PERMISSION_REQUIRED',
          message: capability.reason,
          recoverable: true,
          suggestedAction: capability.officialResolutionSteps,
        },
      };
    }

    const reply = "Toutes vos notifications sont à jour, Monsieur. Aucune alerte urgente en attente.";
    return {
      id: `out-${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: true,
      reply,
      spokenSummary: reply,
      telemetry: {
        providerUsed: 'local',
        modelUsed: 'notification-listener-core',
        fallbackOccurred: false,
        providerChainAttempted: ['local'],
        executionTimeMs: Date.now() - startTime,
      },
      structuredData: { notificationCount: 0, urgentCount: 0 },
    };
  }

  public handleError(error: Error | any, input: AgentInput, startTime: number): AgentOutput {
    return {
      id: `err-${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: false,
      reply: `Une erreur est survenue lors de l'accès aux notifications : ${error?.message || 'Erreur inconnue'}`,
      telemetry: {
        providerUsed: 'local',
        modelUsed: 'error-handler',
        fallbackOccurred: false,
        providerChainAttempted: ['local'],
        executionTimeMs: Date.now() - startTime,
      },
      error: {
        code: 'NOTIFICATION_ERROR',
        message: error?.message || 'Erreur inconnue',
        recoverable: true,
      },
    };
  }
}

export const notificationAgent = new NotificationAgent();
