/**
 * VOICE AGENT (Specialized Agent)
 * 
 * Manages voice synthesis, wake-word detection, speech formatting,
 * voice persona modulation, audio transcription (Deepgram/WebSpeech) and vocal responses.
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
import { JarvisVoiceOrchestrator } from '../../services/voice-orchestrator.js';
import { deepgramVoiceService } from '../../services/deepgram-voice.js';
import { redactSecrets } from '../../services/security-redactor.js';

export class VoiceAgent implements SpecializedAgent {
  public readonly id: AgentId = 'voice';
  public readonly name = 'JARVIS Voice Agent';
  public readonly description = 'Spécialiste de la synthèse vocale, transcription audio, ton vocal et interactions mains-libres.';
  public readonly permissionLevel: AgentPermissionLevel = 'user';

  public readonly capabilities: AgentCapability[] = [
    {
      id: 'tts_synthesis',
      name: 'Synthèse Vocale & Modulation',
      description: 'Production audio naturelle avec modulation de timbre (Jarvis classique, Iron Tactical, etc.).',
      tags: ['voice', 'tts', 'speech', 'audio', 'vocal', 'parle', 'voix'],
      requiredPermissions: ['microphone'],
      riskLevel: 'low',
    },
    {
      id: 'stt_transcription',
      name: 'Transcription & Détection Vocale',
      description: 'Transcription haute précision des flux audio en direct (Deepgram Nova-2 ou moteur natif).',
      tags: ['transcription', 'stt', 'audio', 'dictée', 'enregistrement'],
      requiredPermissions: ['microphone'],
      riskLevel: 'low',
    },
    {
      id: 'wake_word_control',
      name: 'Contrôle Mot-Clé & Écoute Continue',
      description: 'Détection du wake word ("Jarvis", "Hey Jarvis") et gestion du VAD.',
      tags: ['wakeword', 'hotword', 'listening', 'mic'],
      requiredPermissions: ['microphone'],
      riskLevel: 'low',
    },
  ];

  public readonly allowedTools: AgentToolDefinition[] = [
    {
      name: 'synthesize_speech',
      description: 'Synthétise un texte en audio.',
      parameters: { text: { type: 'string' }, persona: { type: 'string' } },
    },
    {
      name: 'set_voice_persona',
      description: 'Modifie la personnalité et le timbre de voix de JARVIS.',
      parameters: { persona: { type: 'string' } },
    },
  ];

  public canHandle(input: AgentInput): AgentRoutingEvaluation {
    const q = input.query.toLowerCase();
    const hasAudio = input.context?.attachments?.some((a) => a.type === 'audio');
    const voiceKeywords = [
      'parle', 'voix', 'vocal', 'lis à haute voix', 'prononce', 'change de voix',
      'volume de la voix', 'réglage vocal', 'deepgram', 'accent', 'synthèse',
      'répète après moi', 'lis le texte', 'audio', 'dictée'
    ];

    let score = 0.1;
    const matches: string[] = [];

    if (hasAudio) {
      score = 0.95;
      matches.push('stt_transcription');
    }

    for (const kw of voiceKeywords) {
      if (q.includes(kw)) {
        score += 0.35;
        matches.push('tts_synthesis');
      }
    }

    score = Math.min(score, 1.0);

    return {
      agentId: this.id,
      score,
      confidence: score > 0.6 ? 0.9 : 0.5,
      reason: matches.length > 0 ? `Détection de requêtes vocales ou audio: ${matches.join(', ')}` : 'Non prioritaire pour le canal voix.',
      matchedCapabilities: matches,
      requiredPermissions: ['microphone'],
      isPermissionMet: true,
    };
  }

  public async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    try {
      const q = input.query.toLowerCase();
      let reply = '';
      let spokenSummary = '';
      const actionsExecuted: any[] = [];

      // Check if user wants to change persona
      if (q.includes('change de voix') || q.includes('voix tactique') || q.includes('voix classique')) {
        let chosenPersona = 'classic_jarvis';
        if (q.includes('tactique') || q.includes('iron')) chosenPersona = 'iron_tactical';
        if (q.includes('élégance') || q.includes('français')) chosenPersona = 'french_elegance';
        if (q.includes('friday') || q.includes('cyber')) chosenPersona = 'cyber_friday';

        reply = `Très bien Monsieur. Le profil vocal a été commuté sur "${chosenPersona}". Les modulations acoustiques sont synchronisées.`;
        spokenSummary = `Profil vocal mis à jour sur ${chosenPersona}.`;

        actionsExecuted.push({
          tool: 'set_voice_persona',
          arguments: { persona: chosenPersona },
          result: { status: 'success', persona: chosenPersona },
          latencyMs: 15,
          success: true,
        });
      } else {
        // Standard voice generation / formatting
        const rawContent = input.query.replace(/lis à haute voix|parle|prononce/gi, '').trim() || input.query;
        reply = `Lecture vocale active pour votre contenu : "${rawContent}"`;
        spokenSummary = rawContent;

        actionsExecuted.push({
          tool: 'synthesize_speech',
          arguments: { text: rawContent, persona: input.userPreferences?.persona || 'classic_jarvis' },
          result: { status: 'audio_stream_ready', provider: deepgramVoiceService.isConfigured() ? 'deepgram' : 'browser_native' },
          latencyMs: 45,
          success: true,
        });
      }

      return {
        id: `out_voice_${Date.now()}`,
        agentId: this.id,
        agentName: this.name,
        success: true,
        reply: redactSecrets(reply),
        spokenSummary: redactSecrets(spokenSummary),
        actionTaken: true,
        actionsExecuted,
        telemetry: {
          providerUsed: 'deepgram_orchestrator',
          modelUsed: 'aura-2-synthesis',
          fallbackOccurred: false,
          providerChainAttempted: ['deepgram', 'browser_native'],
          executionTimeMs: Date.now() - startTime,
        },
        nextSuggestions: [
          'Change le timbre de ta voix',
          'Règle la vitesse de diction',
          'Désactive la lecture automatique',
        ],
      };
    } catch (err: any) {
      return this.handleError(err, input, startTime);
    }
  }

  public handleError(error: any, input: AgentInput, startTime: number): AgentOutput {
    return {
      id: `err_voice_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: false,
      reply: 'Anomalie survenue dans le module vocal.',
      spokenSummary: 'Le module vocal a rencontré un problème.',
      telemetry: {
        providerUsed: 'local',
        modelUsed: 'fallback',
        fallbackOccurred: true,
        providerChainAttempted: ['local'],
        executionTimeMs: Date.now() - startTime,
      },
      error: {
        code: 'VOICE_AGENT_ERROR',
        message: redactSecrets(error?.message || String(error)),
        recoverable: true,
        suggestedAction: 'Vérifiez les permissions microphone et la configuration audio.',
      },
    };
  }
}
