/**
 * JARVIS VISION RESOLVER (PHASE 5)
 * 
 * Classifies user intent and voice commands for the Vision Agent:
 * - "JARVIS, analyse cette image."
 * - "Qu'est-ce que c'est ?"
 * - "Lis ce document."
 * - "Explique cette erreur."
 * - "Que dois-je faire sur cet écran ?"
 */

import { VisionCommandEvaluation, VisionTaskType } from './types.js';

export class VisionResolver {
  /**
   * Evaluate if an input text/query is a vision command and classify its task
   */
  public static evaluate(query: string, hasAttachment = false): VisionCommandEvaluation {
    const raw = (query || '').trim();
    const lower = raw.toLowerCase();

    // 1. "Explique cette erreur" / "D'où vient cette erreur" / "Résous ce bug"
    if (
      lower.includes('explique cette erreur') ||
      lower.includes('explique l\'erreur') ||
      lower.includes('explique cette exception') ||
      lower.includes('quelle est cette erreur') ||
      lower.includes('d\'où vient cette erreur') ||
      lower.includes('analyse cette erreur') ||
      lower.includes('pourquoi ça plante') ||
      lower.includes('corrige cette erreur')
    ) {
      return {
        isVisionCommand: true,
        task: 'error_diagnosis',
        normalizedCommand: 'Explique cette erreur.',
        confidence: 0.98,
        requiresCameraOrScreen: !hasAttachment,
      };
    }

    // 2. "Que dois-je faire sur cet écran ?" / "Que faire sur cet écran" / "Aide-moi sur cet écran"
    if (
      lower.includes('que dois-je faire sur cet écran') ||
      lower.includes('que dois je faire sur cet ecran') ||
      lower.includes('que faire sur cet écran') ||
      lower.includes('que faire sur cet ecran') ||
      lower.includes('sur cet écran') ||
      lower.includes('sur cet ecran') ||
      lower.includes('aide-moi sur cet écran') ||
      lower.includes('guide-moi sur cet écran') ||
      lower.includes('comment valider cet écran')
    ) {
      return {
        isVisionCommand: true,
        task: 'ui_guidance',
        normalizedCommand: 'Que dois-je faire sur cet écran ?',
        confidence: 0.98,
        requiresCameraOrScreen: true,
      };
    }

    // 3. "Lis ce document." / "Extrais le texte" / "OCR" / "Lis ce texte"
    if (
      lower.includes('lis ce document') ||
      lower.includes('lis le document') ||
      lower.includes('extrais le texte') ||
      lower.includes('extraire le texte') ||
      lower.includes('ocr') ||
      lower.includes('lis ce texte') ||
      lower.includes('scanne ce document') ||
      lower.includes('scan document') ||
      lower.includes('lire le document') ||
      lower.includes('lis la facture')
    ) {
      return {
        isVisionCommand: true,
        task: 'document',
        normalizedCommand: 'Lis ce document.',
        confidence: 0.98,
        requiresCameraOrScreen: !hasAttachment,
      };
    }

    // 4. "Qu'est-ce que c'est ?" / "C'est quoi cet objet ?" / "Qu'est ce que c'est"
    if (
      lower.includes("qu'est-ce que c'est") ||
      lower.includes("qu'est ce que c'est") ||
      lower.includes("c'est quoi ça") ||
      lower.includes("c'est quoi cet objet") ||
      lower.includes("qu'est-ce que c'est que ça") ||
      lower.includes("identifie cet objet") ||
      lower.includes("que vois-tu") ||
      lower.includes("que vois tu")
    ) {
      return {
        isVisionCommand: true,
        task: 'photo',
        normalizedCommand: "Qu'est-ce que c'est ?",
        confidence: 0.95,
        requiresCameraOrScreen: !hasAttachment,
      };
    }

    // 5. "JARVIS, analyse cette image." / "Analyse cette photo" / "Regarde cette image"
    if (
      lower.includes('analyse cette image') ||
      lower.includes('analyse l\'image') ||
      lower.includes('analyse cette photo') ||
      lower.includes('analyse la photo') ||
      lower.includes('analyse cette capture') ||
      lower.includes('regarde cette image') ||
      lower.includes('regarde cette photo') ||
      lower.includes('décris cette image') ||
      lower.includes('decris cette image')
    ) {
      const isScreenshot = lower.includes('capture') || lower.includes('screenshot');
      return {
        isVisionCommand: true,
        task: isScreenshot ? 'screenshot' : 'photo',
        normalizedCommand: 'JARVIS, analyse cette image.',
        confidence: 0.98,
        requiresCameraOrScreen: !hasAttachment,
      };
    }

    // 6. Generic attachment or vision keyword match
    if (hasAttachment) {
      return {
        isVisionCommand: true,
        task: 'general',
        normalizedCommand: raw || 'JARVIS, analyse cette image.',
        extractedQuery: raw,
        confidence: 0.92,
        requiresCameraOrScreen: false,
      };
    }

    return {
      isVisionCommand: false,
      task: 'general',
      normalizedCommand: raw,
      confidence: 0.0,
      requiresCameraOrScreen: false,
    };
  }
}
