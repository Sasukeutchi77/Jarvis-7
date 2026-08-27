/**
 * MEDIA & AUDIO AGENT (Specialized Agent — Phase 12 Media)
 * 
 * Manages media playback, music controls (Spotify/YouTube), sound effects,
 * media session toggles (play/pause/next), and ambient audio synthesis.
 * Connects directly to AndroidBridge and browser media session APIs.
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
import { redactSecrets } from '../../services/security-redactor.js';
import { AndroidBridge } from '../../android-bridge.js';

export class MediaAgent implements SpecializedAgent {
  public readonly id: AgentId = 'media';
  public readonly name = 'JARVIS Media & Music Agent';
  public readonly description = 'Spécialiste de la lecture multimédia, flux musicaux (Spotify, YouTube), contrôle des sessions audio et lecture en streaming.';
  public readonly permissionLevel: AgentPermissionLevel = 'user';

  public readonly capabilities: AgentCapability[] = [
    {
      id: 'music_control',
      name: 'Contrôle Musique & Lecture',
      description: 'Lancement de morceaux, play, pause, piste suivante sur Spotify / YouTube Music.',
      tags: ['musique', 'spotify', 'joue', 'mets de la musique', 'pause musique', 'chanson', 'morceau', 'playlist', 'youtube music'],
      requiredPermissions: [],
      riskLevel: 'low',
    },
    {
      id: 'media_session_toggle',
      name: 'Gestion de Session Multimédia',
      description: 'Mise en pause, reprise, arrêt ou changement de piste.',
      tags: ['pause', 'reprends', 'stop musique', 'piste suivante', 'morceau suivant'],
      requiredPermissions: [],
      riskLevel: 'low',
    },
  ];

  public readonly allowedTools: AgentToolDefinition[] = [
    {
      name: 'dispatch_media_action',
      description: 'Envoie un ordre de lecture multimédia (play, pause, next, track) vers Spotify ou YouTube.',
      parameters: { action: { type: 'string' }, query: { type: 'string' }, provider: { type: 'string' } },
    },
  ];

  public canHandle(input: AgentInput): AgentRoutingEvaluation {
    const q = input.query.toLowerCase().trim();
    const mediaKeywords = [
      'musique', 'mets de la musique', 'joue', 'spotify', 'chanson', 'morceau',
      'pause la musique', 'piste suivante', 'playlist', 'reggae', 'jazz', 'rock',
      'youtube music', 'écoute', 'mets du'
    ];

    let score = 0.05;
    const matches: string[] = [];

    for (const kw of mediaKeywords) {
      if (q.includes(kw)) {
        score += 0.45;
        matches.push('music_control');
      }
    }

    if (q.startsWith('pause') || q.includes('stop musique') || q.includes('coupe la musique')) {
      score = Math.max(score, 0.95);
      matches.push('media_session_toggle');
    }

    score = Math.min(score, 1.0);

    return {
      agentId: this.id,
      score,
      confidence: score > 0.5 ? 0.95 : 0.35,
      reason: matches.length > 0
        ? `Commande multimédia identifiée : ${matches.join(', ')}`
        : 'Pas de commande multimédia directe.',
      matchedCapabilities: Array.from(new Set(matches)),
      requiredPermissions: [],
      isPermissionMet: true,
    };
  }

  public async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    try {
      const q = input.query.trim();
      const lower = q.toLowerCase();

      // Check if user requested a pause or stop
      if (lower.startsWith('pause') || lower.includes('stop musique') || lower.includes('coupe la musique')) {
        // Pause local media / dispatch pause intent
        if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'paused';
        }
        
        return {
          id: `out_media_${Date.now()}`,
          agentId: this.id,
          agentName: this.name,
          success: true,
          reply: 'Session multimédia mise en pause, Monsieur.',
          spokenSummary: 'Musique en pause.',
          actionTaken: true,
          actionsExecuted: [{
            tool: 'dispatch_media_action',
            arguments: { action: 'pause' },
            result: { state: 'paused' },
            latencyMs: Date.now() - startTime,
            success: true,
          }],
          telemetry: {
            providerUsed: 'navigator_media_session',
            modelUsed: 'media_controller',
            fallbackOccurred: false,
            providerChainAttempted: ['navigator_media_session'],
            executionTimeMs: Date.now() - startTime,
          },
          nextSuggestions: ['Reprends la musique', 'Piste suivante', 'Baisse le volume'],
        };
      }

      // Extract music search target
      let provider: 'spotify' | 'youtube' = lower.includes('youtube') ? 'youtube' : 'spotify';
      let targetMusic = q
        .replace(/^(jarvis[\s,:]*)?(mets\s+de\s+la\s+musique|mets\s+du|mets\s+de|mets|joue|lance|écoute|sur\s+spotify|sur\s+youtube|musique)\s*/i, '')
        .replace(/sur\s+(spotify|youtube)/i, '')
        .trim();

      if (!targetMusic) {
        targetMusic = 'votre playlist favorite';
      }

      // Execute real app opening via AndroidBridge
      const bridgeResult = await AndroidBridge.openApp(provider, targetMusic);

      const actionLog = {
        tool: 'dispatch_media_action',
        arguments: { action: 'play', track: targetMusic, provider },
        result: bridgeResult,
        latencyMs: Date.now() - startTime,
        success: bridgeResult.success,
      };

      if (!bridgeResult.success) {
        return {
          id: `err_media_${Date.now()}`,
          agentId: this.id,
          agentName: this.name,
          success: false,
          reply: `Impossible de lancer "${targetMusic}" sur ${provider === 'spotify' ? 'Spotify' : 'YouTube'}.`,
          spokenSummary: `Erreur lors de la lecture multimédia.`,
          actionTaken: false,
          actionsExecuted: [actionLog],
          error: {
            code: 'MEDIA_LAUNCH_FAILED',
            message: bridgeResult.message || 'Failed to trigger media intent',
            recoverable: true,
            suggestedAction: 'Vérifiez les permissions de lancement d’applications ou installez le lecteur média.',
          },
          telemetry: {
            providerUsed: provider,
            modelUsed: 'android_intent',
            fallbackOccurred: true,
            providerChainAttempted: [provider],
            executionTimeMs: Date.now() - startTime,
          },
        };
      }

      const reply = `🎵 Lancement de **${targetMusic}** sur ${provider === 'spotify' ? 'Spotify' : 'YouTube'}.`;
      const spokenSummary = `Lecture de ${targetMusic} lancée sur ${provider === 'spotify' ? 'Spotify' : 'YouTube'}.`;

      return {
        id: `out_media_${Date.now()}`,
        agentId: this.id,
        agentName: this.name,
        success: true,
        reply: redactSecrets(reply),
        spokenSummary: redactSecrets(spokenSummary),
        actionTaken: true,
        actionsExecuted: [actionLog],
        telemetry: {
          providerUsed: provider,
          modelUsed: 'android_intent',
          fallbackOccurred: false,
          providerChainAttempted: [provider],
          executionTimeMs: Date.now() - startTime,
        },
        nextSuggestions: [
          'Pause la musique',
          'Piste suivante',
          'Baisse le volume de 20%',
        ],
      };
    } catch (err: any) {
      return this.handleError(err, input, startTime);
    }
  }

  public handleError(error: any, input: AgentInput, startTime: number): AgentOutput {
    return {
      id: `err_media_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: false,
      reply: 'Impossible de contrôler la session multimédia.',
      spokenSummary: 'Erreur multimédia.',
      telemetry: {
        providerUsed: 'local',
        modelUsed: 'fallback',
        fallbackOccurred: true,
        providerChainAttempted: ['local'],
        executionTimeMs: Date.now() - startTime,
      },
      error: {
        code: 'MEDIA_AGENT_ERROR',
        message: redactSecrets(error?.message || String(error)),
        recoverable: true,
        suggestedAction: 'Vérifiez qu’une application de musique est disponible ou installée.',
      },
    };
  }
}
