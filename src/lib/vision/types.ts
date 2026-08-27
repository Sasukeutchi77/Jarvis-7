/**
 * JARVIS VISION AGENT — TYPES & INTERFACES (PHASE 5)
 */

export type VisionTaskType =
  | 'photo'
  | 'screenshot'
  | 'document'
  | 'ocr'
  | 'error_diagnosis'
  | 'ui_guidance'
  | 'general';

export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'gif' | 'svg' | 'bmp' | 'unknown';

export type ConfidentialityLevel = 'public' | 'confidential' | 'restricted';

export interface ProcessedImage {
  originalFormat: ImageFormat;
  mimeType: string;
  base64Data: string; // Clean base64 without data URI prefix
  dataUrl: string;    // Complete data:image/...;base64,...
  width?: number;
  height?: number;
  sizeBytes: number;
  isSanitized: boolean;
  hasPotentialPII: boolean;
  hash: string;
  confidentiality: ConfidentialityLevel;
}

export interface ImageProcessingOptions {
  task?: VisionTaskType;
  maxDimension?: number;
  quality?: number;
  stripExif?: boolean;
  privacyMode?: boolean;
  enhanceForOcr?: boolean;
}

export interface VisionAnalysisRequest {
  image: string | Blob | ArrayBuffer;
  additionalImages?: Array<string | Blob | ArrayBuffer>;
  task?: VisionTaskType;
  prompt?: string;
  commandIntent?: string;
  language?: string;
  allowExternalCloud?: boolean;
  privacyMode?: boolean;
  modelOverride?: string;
  timeoutMs?: number;
}

export interface DetectedTextBlock {
  text: string;
  confidence: number;
  language?: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ErrorDiagnosis {
  errorMessage?: string;
  errorType?: string;
  probableCause?: string;
  suggestedFix?: string;
  actionableSteps?: string[];
  codeSnippet?: string;
}

export interface UIGuidance {
  screenTitle?: string;
  detectedApp?: string;
  visibleElements?: string[];
  recommendedAction?: string;
  actionSteps?: string[];
}

export interface VisionPrivacyReport {
  sanitized: boolean;
  exifStripped: boolean;
  sensitiveDataRedacted: boolean;
  providerUsed: string;
  localOnly: boolean;
  externalAuthorized: boolean;
}

export interface VisionAnalysisResult {
  analysis: string;
  vocalSummary: string;
  task: VisionTaskType;
  ocrText?: string;
  confidence: number;
  detectedObjects?: string[];
  detectedTextBlocks?: DetectedTextBlock[];
  errorDiagnosis?: ErrorDiagnosis;
  uiGuidance?: UIGuidance;
  privacyStatus: VisionPrivacyReport;
  providerUsed: string;
  modelUsed: string;
  latencyMs: number;
  timestamp: number;
  processedImageMeta?: {
    format: string;
    sizeBytes: number;
    mimeType: string;
    confidentiality: ConfidentialityLevel;
  };
}

export interface VisionCommandEvaluation {
  isVisionCommand: boolean;
  task: VisionTaskType;
  normalizedCommand: string;
  extractedQuery?: string;
  confidence: number;
  requiresCameraOrScreen: boolean;
}
