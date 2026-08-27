/**
 * VISION AGENT (Specialized Agent — Phase 5)
 * 
 * Pipeline:
 * VisionAgent -> ImageProcessor -> VisionModel -> AI Router
 * 
 * Manages multimodal visual analysis:
 * - Analyser une photo ("JARVIS, analyse cette image." / "Qu'est-ce que c'est ?")
 * - Analyser une capture d'écran ("Que dois-je faire sur cet écran ?")
 * - Analyser un document / OCR ("Lis ce document.")
 * - Expliquer une erreur ("Explique cette erreur.")
 * - Reconnaître les éléments visibles
 * - Répondre aux questions sur une image
 * 
 * Privacy & Security:
 * - Sanitizes EXIF & metadata locally
 * - Redacts sensitive tokens/PII before external routing
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
import { ImageProcessor } from '../../vision/image-processor.js';
import { VisionModel } from '../../vision/vision-model.js';
import { VisionResolver } from '../../vision/vision-resolver.js';
import { VisionTaskType } from '../../vision/types.js';

export class VisionAgent implements SpecializedAgent {
  public readonly id: AgentId = 'vision';
  public readonly name = 'JARVIS Vision Agent';
  public readonly description = 'Spécialiste de la vision par ordinateur, OCR, analyse d’images, reconnaissance visuelle, diagnostic d’erreurs et inspection d’écran.';
  public readonly permissionLevel: AgentPermissionLevel = 'user';

  public readonly capabilities: AgentCapability[] = [
    {
      id: 'image_analysis',
      name: 'Analyse Visuelle Multimodale',
      description: 'Compréhension sémantique d’une photo, objet, scène ou capture.',
      tags: ['vision', 'image', 'photo', 'regarde', 'analyse cette image', 'qu\'est-ce que c\'est', 'caméra'],
      requiredPermissions: ['camera'],
      riskLevel: 'low',
    },
    {
      id: 'ocr_document_extraction',
      name: 'Extraction Textuelle & OCR',
      description: 'Lecture et transcription intégrale de documents, factures ou textes visibles.',
      tags: ['ocr', 'texte image', 'scan', 'document', 'lis ce document', 'facture', 'lire texte'],
      requiredPermissions: ['camera'],
      riskLevel: 'low',
    },
    {
      id: 'error_diagnosis',
      name: 'Diagnostic d’Erreurs Visuelles',
      description: 'Explication des messages d’erreur, exceptions, logs ou captures de code.',
      tags: ['erreur', 'explique cette erreur', 'exception', 'stack trace', 'bug', 'plantage'],
      requiredPermissions: ['camera', 'screen_capture'],
      riskLevel: 'low',
    },
    {
      id: 'screen_inspection',
      name: 'Inspection d’Écran & UI Android',
      description: 'Guidage pas à pas sur les écrans et applications Android.',
      tags: ['screenshot', 'écran', 'capture', 'ui', 'que dois-je faire sur cet écran', 'interface'],
      requiredPermissions: ['screen_capture'],
      riskLevel: 'medium',
    },
  ];

  public readonly allowedTools: AgentToolDefinition[] = [
    {
      name: 'analyze_image',
      description: 'Traite et analyse une image via ImageProcessor et VisionModel.',
      parameters: { image: { type: 'string' }, task: { type: 'string' }, prompt: { type: 'string' } },
    },
    {
      name: 'ocr_document',
      description: 'Extrait le texte et structure les métadonnées d’un document.',
      parameters: { image: { type: 'string' } },
    },
    {
      name: 'diagnose_screen_error',
      description: 'Analyse une erreur affichée à l’écran et propose une solution.',
      parameters: { image: { type: 'string' } },
    },
    {
      name: 'guide_screen_action',
      description: 'Fournit des recommandations d’action sur l’écran actuel.',
      parameters: { image: { type: 'string' } },
    },
  ];

  public canHandle(input: AgentInput): AgentRoutingEvaluation {
    const q = input.query || '';
    const hasImages = input.context?.attachments?.some((a) => a.type === 'image');
    
    // Evaluate via VisionResolver
    const evaluation = VisionResolver.evaluate(q, hasImages);

    let score = evaluation.confidence;
    const matches: string[] = [];

    if (evaluation.isVisionCommand) {
      matches.push(evaluation.task);
      score = Math.max(score, hasImages ? 0.98 : 0.88);
    } else if (hasImages) {
      score = 0.95;
      matches.push('image_analysis');
    }

    return {
      agentId: this.id,
      score: Math.min(score, 1.0),
      confidence: hasImages ? 0.98 : score > 0.6 ? 0.90 : 0.4,
      reason: hasImages
        ? 'Pièce jointe image détectée pour traitement visuel multimodal.'
        : evaluation.isVisionCommand
        ? `Commande visuelle reconnue : "${evaluation.normalizedCommand}" (Tâche: ${evaluation.task})`
        : 'Aucun élément visuel identifié.',
      matchedCapabilities: matches.length ? matches : ['image_analysis'],
      requiredPermissions: ['camera'],
      isPermissionMet: true,
    };
  }

  public async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    try {
      const q = input.query || '';
      const evaluation = VisionResolver.evaluate(q, !!input.context?.attachments?.some((a) => a.type === 'image'));
      const task: VisionTaskType = evaluation.task || 'general';

      // 1. Extract image payload (from context attachments or fallback sample)
      const imageAttachment = input.context?.attachments?.find((a) => a.type === 'image');
      let rawImage = imageAttachment?.data || (input.context as any)?.imageBase64 || (input.context as any)?.screenCapture;

      // If no image is provided with a vision command, inform user politely
      if (!rawImage) {
        // Provide sample or request image
        const requestPrompt = task === 'ui_guidance'
          ? "Veuillez autoriser la capture d'écran ou joindre une image pour que je puisse vous guider sur cet écran."
          : task === 'error_diagnosis'
          ? "Veuillez fournir une capture d'écran ou une photo de l'erreur afin que je puisse l'analyser."
          : "Veuillez fournir une image, photo ou document à analyser.";

        return {
          id: `out_vision_req_${Date.now()}`,
          agentId: this.id,
          agentName: this.name,
          success: true,
          reply: requestPrompt,
          spokenSummary: requestPrompt,
          actionTaken: false,
          nextSuggestions: [
            'Prendre une photo avec la caméra',
            'Faire une capture d\'écran',
            'Importer une image depuis la galerie',
          ],
          telemetry: {
            providerUsed: 'local_device',
            modelUsed: 'local-vision-resolver',
            fallbackOccurred: false,
            providerChainAttempted: ['local_device'],
            executionTimeMs: Date.now() - startTime,
          },
        };
      }

      // 2. ImageProcessor: Normalization, format detection, EXIF stripping, privacy audit
      const processedImage = await ImageProcessor.process(rawImage, {
        task,
        stripExif: true,
        privacyMode: input.userPreferences?.privacyMode,
      });

      // 3. VisionModel -> AI Router
      const visionResult = await VisionModel.analyze(processedImage, {
        image: processedImage.dataUrl,
        task,
        prompt: q,
        commandIntent: evaluation.normalizedCommand,
        language: input.userPreferences?.language || 'fr-FR',
        allowExternalCloud: input.userPreferences?.privacyMode !== true,
        privacyMode: input.userPreferences?.privacyMode,
        modelOverride: input.modelOverride,
        timeoutMs: input.timeoutMs || 30000,
      });

      if (input.onChunk) {
        input.onChunk(visionResult.analysis);
      }

      return {
        id: `out_vision_${Date.now()}`,
        agentId: this.id,
        agentName: this.name,
        success: true,
        reply: visionResult.analysis,
        spokenSummary: visionResult.vocalSummary,
        actionTaken: true,
        actionsExecuted: [
          {
            tool: 'analyze_image',
            arguments: { task, format: processedImage.originalFormat, sizeBytes: processedImage.sizeBytes },
            result: { status: 'completed', provider: visionResult.providerUsed, model: visionResult.modelUsed },
            latencyMs: visionResult.latencyMs,
            success: true,
          },
        ],
        structuredData: {
          task: visionResult.task,
          ocrText: visionResult.ocrText,
          detectedObjects: visionResult.detectedObjects,
          errorDiagnosis: visionResult.errorDiagnosis,
          uiGuidance: visionResult.uiGuidance,
          privacyStatus: visionResult.privacyStatus,
        },
        telemetry: {
          providerUsed: visionResult.providerUsed,
          modelUsed: visionResult.modelUsed,
          fallbackOccurred: visionResult.providerUsed === 'local',
          providerChainAttempted: [visionResult.providerUsed],
          executionTimeMs: Date.now() - startTime,
        },
        nextSuggestions: this.generateNextSuggestions(task),
      };
    } catch (err: any) {
      return this.handleError(err, input, startTime);
    }
  }

  private generateNextSuggestions(task: VisionTaskType): string[] {
    switch (task) {
      case 'document':
      case 'ocr':
        return ['Copier le texte extrait', 'Résumer ce document', 'Sauvegarder dans mes notes'];
      case 'error_diagnosis':
        return ['Appliquer la solution suggérée', 'Rechercher plus de détails sur le web', 'Partager le rapport'];
      case 'ui_guidance':
      case 'screenshot':
        return ['Exécuter l\'action recommandée', 'Prendre une nouvelle capture', 'Ouvrir les paramètres'];
      case 'photo':
      default:
        return ['Extrais le texte visible', 'Donne plus de détails sur cette scène', 'Sauvegarder cette analyse'];
    }
  }

  public handleError(error: any, input: AgentInput, startTime: number): AgentOutput {
    return {
      id: `err_vision_${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      success: false,
      reply: 'Impossible d’analyser l’image fournie pour le moment.',
      spokenSummary: 'L’analyse visuelle a échoué.',
      telemetry: {
        providerUsed: 'local',
        modelUsed: 'fallback',
        fallbackOccurred: true,
        providerChainAttempted: ['local'],
        executionTimeMs: Date.now() - startTime,
      },
      error: {
        code: 'VISION_AGENT_ERROR',
        message: redactSecrets(error?.message || String(error)),
        recoverable: true,
        suggestedAction: 'Vérifiez la qualité de l’image ou fournissez un format JPEG, PNG ou WebP valide.',
      },
    };
  }
}

