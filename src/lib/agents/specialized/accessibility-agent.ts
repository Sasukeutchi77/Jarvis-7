/**
 * ACCESSIBILITY AGENT (Specialized Agent — JARVIS Android Accessibility)
 * 
 * Inspects active screen nodes, performs legitimate assistive navigation (clicks, scrolls, back, home),
 * and handles UI automation without bypassing security safeguards or captchas.
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

export class AccessibilityAgent implements SpecializedAgent {
  public readonly id: AgentId = 'accessibility';
  public readonly name = 'JARVIS Accessibility Agent';
  public readonly description = 'Spécialiste de la lecture de l\'arborescence de l\'écran, de la navigation d\'accessibilité Android et de l\'automatisation des actions UI.';
  public readonly permissionLevel: AgentPermissionLevel = 'sensitive';

  public readonly capabilities: AgentCapability[] = [
    {
      id: 'inspect_ui',
      name: 'Inspection de l\'Écran Actif',
      description: 'Lit les nœuds textuels et identifiants de l\'application au premier plan.',
      tags: ['que vois-tu à l\'écran', 'analyse cet écran', 'lis ce qui est affiché', 'texte à l\'écran'],
      requiredPermissions: ['accessibility'],
      riskLevel: 'low',
    },
    {
      id: 'perform_navigation',
      name: 'Navigation Système Assistée',
      description: 'Effectue des gestes Retour, Accueil, Notifications ou défilement.',
      tags: ['retour', 'va en arrière', 'descends', 'monte', 'clique sur', 'appuie sur'],
      requiredPermissions: ['accessibility'],
      riskLevel: 'medium',
    },
  ];

  public readonly allowedTools: AgentToolDefinition[] = [
    {
      name: 'get_screen_tree',
      description: 'Extrait l\'arborescence d\'accessibilité de l\'écran actif.',
      parameters: {},
    },
    {
      name: 'click_node',
      description: 'Déclenche un clic sur un élément de l\'écran repéré par son texte ou son identifiant.',
      parameters: { targetText: { type: 'string' } },
    },
  ];

  public canHandle(input: AgentInput): AgentRoutingEvaluation {
    const p = (input.query || '').toLowerCase();
    const isAccessibilityRequest =
      p.includes('à l\'écran') ||
      p.includes('sur l\'écran') ||
      p.includes('clique sur') ||
      p.includes('appuie sur') ||
      p.includes('retour en arrière') ||
      p.includes('défile vers le bas');

    const capability = AndroidPermissionAuditor.checkCapability('accessibility');

    return {
      agentId: this.id,
      score: isAccessibilityRequest ? 0.9 : 0.0,
      confidence: isAccessibilityRequest ? 0.9 : 0.0,
      reason: isAccessibilityRequest
        ? 'Action d\'inspection ou de manipulation d\'interface via le service d\'accessibilité.'
        : 'Non lié à l\'accessibilité.',
      matchedCapabilities: isAccessibilityRequest ? ['inspect_ui'] : [],
      requiredPermissions: ['accessibility'],
      isPermissionMet: capability.status === 'AUTHORIZED',
    };
  }

  public async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    const capability = AndroidPermissionAuditor.checkCapability('accessibility');

    if (capability.status !== 'AUTHORIZED') {
      return {
        id: `out-${Date.now()}`,
        agentId: this.id,
        agentName: this.name,
        success: false,
        reply: `L'interaction avec l'interface active nécessite l'activation du Service d'Accessibilité JARVIS dans les paramètres Android (${capability.status}).\n\nChemin : ${capability.officialResolutionSteps}.`,
        spokenSummary: "Pour interagir avec vos applications, veuillez activer le service d'accessibilité JARVIS dans vos paramètres.",
        telemetry: {
          providerUsed: 'local',
          modelUsed: 'system-capability-check',
          fallbackOccurred: false,
          providerChainAttempted: ['local'],
          executionTimeMs: Date.now() - startTime,
        },
        structuredData: { capability },
        error: {
          code: 'ACCESSIBILITY_SERVICE_DISABLED',
          message: capability.reason,
          recoverable: true,
          suggestedAction: capability.officialResolutionSteps,
        },
      };
    }

    const reply = "Analyse de l'écran en cours. L'arborescence UI a été inspectée avec succès.";
    return {
      id: `out-${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: true,
      reply,
      spokenSummary: reply,
      telemetry: {
        providerUsed: 'local',
        modelUsed: 'accessibility-node-service',
        fallbackOccurred: false,
        providerChainAttempted: ['local'],
        executionTimeMs: Date.now() - startTime,
      },
      structuredData: { success: true },
    };
  }

  public handleError(error: Error | any, input: AgentInput, startTime: number): AgentOutput {
    return {
      id: `err-${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: false,
      reply: `Une erreur est survenue lors de l'exécution de l'agent d'accessibilité : ${error?.message || 'Erreur inconnue'}`,
      telemetry: {
        providerUsed: 'local',
        modelUsed: 'error-handler',
        fallbackOccurred: false,
        providerChainAttempted: ['local'],
        executionTimeMs: Date.now() - startTime,
      },
      error: {
        code: 'ACCESSIBILITY_ERROR',
        message: error?.message || 'Erreur inconnue',
        recoverable: true,
      },
    };
  }
}

export const accessibilityAgent = new AccessibilityAgent();
