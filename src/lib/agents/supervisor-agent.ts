/**
 * SUPERVISOR AGENT & ORCHESTRATION CORE (PHASE 1 & PHASE 13 SECURITY)
 * 
 * Central supervisor that orchestrates:
 * JARVIS -> Supervisor Agent -> AI Router -> Specialized Agents -> Tools / Android APIs / Backend
 * 
 * Responsibilities:
 * 1. Semantic intent classification & capability matching.
 * 2. Intelligent delegation to specialized agents.
 * 3. Multi-agent step planning when complex goals require chaining.
 * 4. Permission boundary enforcement and safe execution via SecurityManager.
 * 5. Emergency Stop gating & Disabled Agent bypass protection.
 * 6. Secure telemetry & technical logging (Zero PII / Zero secret exposure).
 */

import {
  AgentInput,
  AgentOutput,
  SupervisorRoutePlan,
  AgentRoutingEvaluation,
  AgentId,
} from './agent-protocol.js';
import { agentRegistry } from './agent-registry.js';
import { securityManager, ActionSecurityLevel } from '../services/security/index.js';
import { contextEngine, ContextSnapshot } from '../services/context/index.js';
import { redactSecrets } from '../services/security-redactor.js';

export interface SupervisorExecutionLog {
  timestamp: number;
  inputId: string;
  primaryAgent: AgentId;
  routedConfidence: number;
  multiStep: boolean;
  totalLatencyMs: number;
  success: boolean;
  providerUsed: string;
  error?: string;
}

export class SupervisorAgent {
  private static instance: SupervisorAgent;
  private executionLogs: SupervisorExecutionLog[] = [];

  private constructor() {}

  public static getInstance(): SupervisorAgent {
    if (!SupervisorAgent.instance) {
      SupervisorAgent.instance = new SupervisorAgent();
    }
    return SupervisorAgent.instance;
  }

  /**
   * Intelligently routes the incoming request to the best specialized agent or pipeline
   */
  public async route(input: AgentInput): Promise<SupervisorRoutePlan> {
    // Check Context Engine first for fast contextual intent resolution
    const contextSynthesis = await contextEngine.synthesizeIntent(input.query);

    const agents = agentRegistry.getAllAgents();
    const candidateEvaluations: AgentRoutingEvaluation[] = [];

    // Evaluate all specialized agents
    for (const agent of agents) {
      try {
        const evalResult = await Promise.resolve(agent.canHandle(input));
        // Boost score if context synthesis matched this agent archetype
        if (contextSynthesis.suggestedAgentId === agent.id) {
          evalResult.score = Math.max(evalResult.score, contextSynthesis.confidence);
          evalResult.reason = `Priorité Contextuelle (Phase 14) : ${contextSynthesis.intent}`;
        }
        candidateEvaluations.push(evalResult);
      } catch (e) {
        console.warn(`[Supervisor] Error evaluating agent ${agent.id}`, e);
      }
    }

    // Sort by score descending
    candidateEvaluations.sort((a, b) => b.score - a.score);

    const topCandidate = candidateEvaluations[0] || {
      agentId: (contextSynthesis.suggestedAgentId as AgentId) || 'general_ai',
      score: 0.5,
      confidence: 0.8,
      reason: 'Routage par défaut vers l’agent généraliste.',
      matchedCapabilities: ['general_dialogue'],
      requiredPermissions: [],
      isPermissionMet: true,
    };

    // Determine if request is multi-step (e.g. "regarde la météo et envoie un sms à Alexandre")
    const q = input.query.toLowerCase();
    const isMultiStep = (q.includes(' et envoie ') || q.includes(' et préviens ') || q.includes(' et rappelle-moi ')) &&
      (q.includes('cherche') || q.includes('actualité') || q.includes('météo') || q.includes('meteo'));

    let executionPlan: SupervisorRoutePlan['executionPlan'];

    if (isMultiStep) {
      const isWeather = q.includes('météo') || q.includes('meteo') || q.includes('temps');
      executionPlan = [
        {
          step: 1,
          agentId: isWeather ? 'weather' : 'research',
          purpose: isWeather ? 'Acquisition en direct de la météo certifiée OpenWeather' : 'Recherche et synthèse des informations web',
        },
        {
          step: 2,
          agentId: 'communication',
          purpose: 'Préparation et envoi du message avec le contenu synthétisé',
          passContextFromStep: 1,
        },
      ];
    }

    return {
      primaryAgent: topCandidate.agentId,
      confidence: topCandidate.confidence,
      reasoning: topCandidate.reason,
      intent: contextSynthesis.intent || topCandidate.matchedCapabilities[0] || 'general_interaction',
      candidates: candidateEvaluations,
      isMultiStep,
      executionPlan,
    };
  }

  /**
   * Executes the request through the supervisor pipeline with Security Governance gating
   */
  public async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    const rawQuery = (input.query || '').trim();
    const qLower = rawQuery.toLowerCase();

    // =========================================================================
    // 0. EMERGENCY STOP IMMEDIATE INTERCEPTION ("JARVIS, stop." / "Stop")
    // =========================================================================
    if (
      qLower === 'stop' ||
      qLower === 'jarvis, stop' ||
      qLower === 'jarvis stop' ||
      qLower === 'jarvis, stop.' ||
      qLower === 'jarvis stop.' ||
      qLower === 'arrête' ||
      qLower === 'arrete' ||
      qLower === 'arrête tout' ||
      qLower === 'stop tout' ||
      qLower === 'urgence stop' ||
      qLower.startsWith('jarvis, stop') ||
      qLower.startsWith('jarvis stop')
    ) {
      securityManager.triggerEmergencyStop('Commande d\'urgence immédiate ("JARVIS, stop.")');

      const output: AgentOutput = {
        id: `emergency_stop_${Date.now()}`,
        agentId: 'security',
        agentName: 'JARVIS Security Governance',
        success: true,
        reply: `### 🛑 Arrêt d'Urgence Immédiat Engagé\n\nToutes les actions et requêtes en cours ont été interrompues, Monsieur.\n\n- **Statut** : 🛑 **ARRÊT D'URGENCE GLOBAL ACTIF**\n- **Niveau d'exécution** : Restreint à **READ (Niveau 0)** uniquement\n- **Actions sensibles / critiques** : Bloquées\n\nPour réactiver le système, dites *« JARVIS, reprends les opérations »* ou débloquez via le panneau Sécurité.`,
        spokenSummary: `Arrêt d'urgence activé. Toutes les opérations en cours ont été interrompues, Monsieur.`,
        actionTaken: true,
        telemetry: {
          providerUsed: 'security_governor',
          modelUsed: 'zero-trust-v1',
          fallbackOccurred: false,
          providerChainAttempted: ['security_governor'],
          executionTimeMs: Date.now() - startTime,
        },
      };

      this.recordSecureLog({
        timestamp: Date.now(),
        inputId: input.id,
        primaryAgent: 'security',
        routedConfidence: 1.0,
        multiStep: false,
        totalLatencyMs: Date.now() - startTime,
        success: true,
        providerUsed: 'security_governor',
      });

      return output;
    }

    // =========================================================================
    // 0b. KILLSWITCH CONTROLS (SCREEN, MICROPHONE, AUTOMATION, COMMUNICATION)
    // =========================================================================
    if (
      qLower.includes('disable screen access') || qLower.includes('désactive l\'accès écran') ||
      qLower.includes('désactive l\'écran') || qLower.includes('enable screen access') || qLower.includes('active l\'accès écran') ||
      qLower.includes('disable microphone') || qLower.includes('désactive le micro') || qLower.includes('coupe le micro') ||
      qLower.includes('enable microphone') || qLower.includes('active le micro') ||
      qLower.includes('disable automation') || qLower.includes('désactive l\'automatisation') || qLower.includes('désactive les routines') ||
      qLower.includes('enable automation') || qLower.includes('active l\'automatisation') ||
      qLower.includes('disable communication agent') || qLower.includes('désactive l\'agent communication') || qLower.includes('désactive les communications') ||
      qLower.includes('enable communication agent') || qLower.includes('active l\'agent communication')
    ) {
      let switchName = '';
      let newState = false;

      if (qLower.includes('screen') || qLower.includes('écran') || qLower.includes('ecran')) {
        const disable = qLower.includes('disable') || qLower.includes('désactive') || qLower.includes('desactive');
        securityManager.setScreenAccessDisabled(disable);
        switchName = "Accès à l'écran (Screen Context / OCR / Capture)";
        newState = !disable;
      } else if (qLower.includes('micro') || qLower.includes('microphone')) {
        const disable = qLower.includes('disable') || qLower.includes('désactive') || qLower.includes('desactive') || qLower.includes('coupe');
        securityManager.setMicrophoneDisabled(disable);
        switchName = "Microphone & Écoute Vocale";
        newState = !disable;
      } else if (qLower.includes('automation') || qLower.includes('automatisation') || qLower.includes('routine')) {
        const disable = qLower.includes('disable') || qLower.includes('désactive') || qLower.includes('desactive');
        securityManager.setAutomationDisabled(disable);
        switchName = "Moteur d'Automatisation & Routines Arrière-Plan";
        newState = !disable;
      } else if (qLower.includes('communication') || qLower.includes('message') || qLower.includes('appel')) {
        const disable = qLower.includes('disable') || qLower.includes('désactive') || qLower.includes('desactive');
        securityManager.setCommunicationAgentDisabled(disable);
        switchName = "Agent de Communication (SMS, Appels, Messages)";
        newState = !disable;
      }

      const output: AgentOutput = {
        id: `killswitch_${Date.now()}`,
        agentId: 'security',
        agentName: 'JARVIS Security Governance',
        success: true,
        reply: `### 🛡️ Commutateur de Sécurité Mis à Jour\n\n- **Fonctionnalité** : **${switchName}**\n- **Nouvel État** : ${newState ? '🟢 **ACTIVÉ (Opérationnel)**' : '🔴 **DÉSACTIVÉ (Verrouillé sans désinstallation)**'}\n- **Impact** : La capacité reste disponible dans le noyau JARVIS mais son exécution est ${newState ? 'débloquée' : 'bloquée par la politique de sécurité'}.`,
        spokenSummary: `${switchName} est désormais ${newState ? 'activé' : 'désactivé'}, Monsieur.`,
        actionTaken: true,
        telemetry: {
          providerUsed: 'security_governor',
          modelUsed: 'zero-trust-v1',
          fallbackOccurred: false,
          providerChainAttempted: ['security_governor'],
          executionTimeMs: Date.now() - startTime,
        },
      };

      return output;
    }

    // 1. Evaluate context awareness synthesis (e.g., "Qu'est-ce que j'ai aujourd'hui ?", "Météo", "Batterie")
    const contextSynthesis = await contextEngine.synthesizeIntent(input.query);

    // If context engine handles the request directly (e.g. daily briefing, battery, time, active app)
    if (contextSynthesis.handled && contextSynthesis.reply) {
      const output: AgentOutput = {
        id: `ctx_exec_${Date.now()}`,
        agentId: (contextSynthesis.suggestedAgentId as AgentId) || 'supervisor',
        agentName: `JARVIS Context Awareness (${contextSynthesis.contextUsed.join(', ')})`,
        success: true,
        reply: contextSynthesis.reply,
        spokenSummary: contextSynthesis.spokenSummary,
        actionTaken: false,
        telemetry: {
          providerUsed: 'context_engine',
          modelUsed: 'context-awareness-v14',
          fallbackOccurred: false,
          providerChainAttempted: ['context_engine'],
          executionTimeMs: Date.now() - startTime,
        },
      };

      this.recordSecureLog({
        timestamp: Date.now(),
        inputId: input.id,
        primaryAgent: (contextSynthesis.suggestedAgentId as AgentId) || 'supervisor',
        routedConfidence: contextSynthesis.confidence,
        multiStep: false,
        totalLatencyMs: Date.now() - startTime,
        success: true,
        providerUsed: 'context_engine',
      });

      return output;
    }

    // If context synthesis enriched the query (e.g. adding authorized location to weather query)
    let processedInput = input;
    if (contextSynthesis.enrichedQuery) {
      processedInput = {
        ...input,
        query: contextSynthesis.enrichedQuery,
      };
    }

    // Enrich device state in input.context from Context Engine snapshot if missing
    if (!processedInput.context?.deviceState) {
      const snapshot = await contextEngine.getSnapshot();
      processedInput = {
        ...processedInput,
        context: {
          ...(processedInput.context || {}),
          deviceState: {
            battery: snapshot.device.batteryLevel,
            charging: snapshot.device.isCharging,
            network: snapshot.device.network.type === 'wifi' ? 'wifi' : snapshot.device.network.type === 'offline' ? 'offline' : 'cellular',
            screenOn: snapshot.device.screen.isScreenOn,
            currentApp: snapshot.activeApp.appName,
            volumeLevel: snapshot.device.audio.mediaVolumePct,
            ringerMode: snapshot.device.audio.ringerMode,
            bluetoothConnected: snapshot.device.audio.bluetoothAudioConnected,
            location: snapshot.location.permissionGranted && snapshot.location.latitude && snapshot.location.longitude
              ? {
                  latitude: snapshot.location.latitude,
                  longitude: snapshot.location.longitude,
                  accuracy: snapshot.location.accuracyMeters,
                }
              : undefined,
          },
        },
      };
    }

    const routePlan = await this.route(processedInput);
    const targetAgentId = routePlan.primaryAgent;
    const agent = agentRegistry.getAgent(targetAgentId) || agentRegistry.getAgent('general_ai')!;

    // Security Pre-flight Gate
    const securityCheck = securityManager.evaluateAction({
      agentId: targetAgentId,
      actionName: routePlan.intent || 'agent_execution',
      payload: { query: processedInput.query },
    });

    if (!securityCheck.allowed && targetAgentId !== 'security') {
      const output: AgentOutput = {
        id: `sec_gate_${Date.now()}`,
        agentId: 'security',
        agentName: 'JARVIS Security Agent',
        success: false,
        reply: `### 🛡️ Contrôle de Sécurité — Action Bloquée\n\n${securityCheck.reason}\n\n- **Agent ciblé** : \`${targetAgentId}\`\n- **Niveau d'action** : **${securityCheck.levelName}**\n${securityCheck.confirmationToken ? `- **Jeton de confirmation** : \`${securityCheck.confirmationToken}\`\n\nVeuillez approuver la requête depuis le panneau Sécurité pour procéder.` : ''}`,
        spokenSummary: redactSecrets(securityCheck.reason),
        actionTaken: false,
        telemetry: {
          providerUsed: 'security_governor',
          modelUsed: 'zero-trust-v1',
          fallbackOccurred: true,
          providerChainAttempted: ['security_governor'],
          executionTimeMs: Date.now() - startTime,
        },
      };

      this.recordSecureLog({
        timestamp: Date.now(),
        inputId: processedInput.id,
        primaryAgent: targetAgentId,
        routedConfidence: routePlan.confidence,
        multiStep: false,
        totalLatencyMs: Date.now() - startTime,
        success: false,
        providerUsed: 'security_governor',
        error: 'SECURITY_BLOCKED',
      });

      return output;
    }

    console.log(`[Supervisor] Routed query "${processedInput.query.slice(0, 40)}..." -> ${agent.name} (confidence: ${(routePlan.confidence * 100).toFixed(0)}%)`);

    let output: AgentOutput;

    if (routePlan.isMultiStep && routePlan.executionPlan && routePlan.executionPlan.length > 1) {
      // Execute multi-agent step pipeline
      console.log(`[Supervisor] Executing multi-step agent pipeline with ${routePlan.executionPlan.length} steps.`);
      let accumulatedContext = '';
      let lastOutput: AgentOutput | null = null;
      const delegatedAgents: AgentId[] = [];

      for (const step of routePlan.executionPlan) {
        const stepAgent = agentRegistry.getAgent(step.agentId);
        if (!stepAgent) continue;

        delegatedAgents.push(step.agentId);
        const stepInput: AgentInput = {
          ...processedInput,
          id: `${processedInput.id}_step_${step.step}`,
          query: accumulatedContext ? `${processedInput.query}\nContexte intermédiaire : ${accumulatedContext}` : processedInput.query,
        };

        const stepResult = await stepAgent.execute(stepInput);
        lastOutput = stepResult;
        accumulatedContext += `\nRésultat étape ${step.step} (${stepAgent.name}): ${stepResult.reply}`;
      }

      output = lastOutput || (await agent.execute(processedInput));
      output.delegatedTo = delegatedAgents;
    } else {
      // Execute single specialized agent
      output = await agent.execute(processedInput);
    }

    const totalLatencyMs = Date.now() - startTime;

    // Secure log entry (no private content or raw token leakage)
    this.recordSecureLog({
      timestamp: Date.now(),
      inputId: input.id,
      primaryAgent: targetAgentId,
      routedConfidence: routePlan.confidence,
      multiStep: routePlan.isMultiStep,
      totalLatencyMs,
      success: output.success,
      providerUsed: output.telemetry?.providerUsed || 'unknown',
      error: output.error ? output.error.code : undefined,
    });

    return output;
  }

  private recordSecureLog(log: SupervisorExecutionLog) {
    this.executionLogs.unshift(log);
    if (this.executionLogs.length > 200) {
      this.executionLogs.pop();
    }
  }

  public getExecutionLogs(): SupervisorExecutionLog[] {
    return [...this.executionLogs];
  }

  public getStats() {
    const total = this.executionLogs.length;
    const successful = this.executionLogs.filter((l) => l.success).length;
    const avgLatency = total > 0 ? Math.round(this.executionLogs.reduce((acc, l) => acc + l.totalLatencyMs, 0) / total) : 0;

    const byAgent: Record<string, number> = {};
    for (const log of this.executionLogs) {
      byAgent[log.primaryAgent] = (byAgent[log.primaryAgent] || 0) + 1;
    }

    return {
      totalRequests: total,
      successRate: total > 0 ? ((successful / total) * 100).toFixed(1) + '%' : '100%',
      avgLatencyMs: avgLatency,
      delegationsByAgent: byAgent,
      activeAgentsCount: agentRegistry.getAllAgents().length,
    };
  }
}

export const supervisorAgent = SupervisorAgent.getInstance();
