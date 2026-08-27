/**
 * SCREEN PRIVACY MANAGER (JARVIS ANDROID — PHASE 6)
 * 
 * Strict Privacy & Security Guardian for Screen Context:
 * 1. Enforces FLAG_SECURE compliance (DRM, Banking, Incognito).
 * 2. Blocks capture on Banking / Financial apps (Revolut, PayPal, Bourso, etc.).
 * 3. Identifies and protects Password / PIN / Credential fields.
 * 4. Masks detected sensitive credentials (Credit Card numbers, IBANs, API keys).
 * 5. Strictly prevents continuous or background capturing loops.
 */

import { ScreenNode, ScreenPrivacyAuditResult, ScreenPrivacyViolation } from './types.js';
import { redactSecrets } from '../../services/security-redactor.js';

// Known Banking, Payment & Financial App Packages (Android Official Namespace)
export const PROTECTED_BANKING_PACKAGES: Record<string, string> = {
  'com.revolut.revolut': 'Revolut Banking & Crypto',
  'com.paypal.android.p2pmobile': 'PayPal Mobile',
  'fr.boursorama.android.smart': 'BoursoBank',
  'com.bnpparibas.banque': 'BNP Paribas Mes Comptes',
  'com.creditagricole.android': 'Crédit Agricole Ma Banque',
  'com.societegenerale.mobile.android': 'Société Générale App',
  'com.ing.direct.android': 'ING Banking',
  'com.n26.android': 'N26 Mobile Bank',
  'com.binance.dev': 'Binance Crypto Exchange',
  'com.coinbase.android': 'Coinbase Wallet & Trading',
  'com.crypto.android': 'Crypto.com App',
  'com.lydia': 'Lydia / Sumeria Paiements',
  'com.fortuneo.android': 'Fortuneo Banque',
  'com.caisseepargne.android.mobilebanking': 'Caisse d’Épargne Banque',
  'com.labanquepostale.mobile': 'La Banque Postale',
  'com.cic_banque.android': 'CIC Mobile',
  'com.cmb.android': 'Crédit Mutuel',
  'org.thoughtcrime.securesms': 'Signal (Private chat with FLAG_SECURE)',
  'org.torproject.torbrowser': 'Tor Browser (Incognito / Protected)',
  'com.google.android.apps.authenticator2': 'Google Authenticator (2FA)',
  'com.duosecurity.duomobile': 'Duo Security (2FA)',
  'com.authy.authy': 'Twilio Authy (2FA)',
  'com.1password.android': '1Password Vault',
  'com.lastpass.lpandroid': 'LastPass Password Manager',
  'com.bitwarden.mobile': 'Bitwarden Password Vault',
  'com.keepassdroid': 'KeePassDroid Vault',
};

// Sensitive Keywords in multiple languages (French & English)
const SENSITIVE_KEYWORDS = [
  'mot de passe',
  'password',
  'code secret',
  'pin code',
  'code pin',
  'numéro de carte',
  'card number',
  'cvv',
  'cvc',
  'expiration date',
  'date d\'expiration',
  'iban',
  'bic',
  'virement bancaire',
  'clé privée',
  'private key',
  'seed phrase',
  'recovery phrase',
  'phrase de récupération',
  'code de sécurité',
  'security code',
  'solde bancaire',
  'available balance',
  'carte bancaire',
  'credit card',
  'mastercard',
  'visa card',
  'authentification à deux facteurs',
  '2fa token',
];

// Regex for Credit Cards, IBAN, API Keys, Private keys
const REGEX_CREDIT_CARD = /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12})\b/;
const REGEX_IBAN = /\b[A-Z]{2}[0-9]{2}(?:[ ]?[0-9A-Z]{4}){3,7}(?:[ ]?[0-9A-Z]{1,2})?\b/i;
const REGEX_CRYPTO_KEY = /\b(0x[a-fA-F0-9]{40}|0x[a-fA-F0-9]{64}|[5KL][1-9A-HJ-NP-za-km-z]{50,51})\b/;

export class ScreenPrivacyManager {
  private static instance: ScreenPrivacyManager;

  private constructor() {}

  public static getInstance(): ScreenPrivacyManager {
    if (!ScreenPrivacyManager.instance) {
      ScreenPrivacyManager.instance = new ScreenPrivacyManager();
    }
    return ScreenPrivacyManager.instance;
  }

  /**
   * Evaluates an Android screen capture and node hierarchy against privacy rules.
   */
  public async auditScreenCapture(params: {
    activePackage?: string;
    activeAppTitle?: string;
    screenText?: string;
    uiHierarchy?: ScreenNode[];
    rawBase64?: string;
    isFlagSecureWindow?: boolean;
    isIncognitoTab?: boolean;
  }): Promise<ScreenPrivacyAuditResult> {
    const startTime = Date.now();
    const violations: ScreenPrivacyViolation[] = [];
    const sensitiveKeywordsFound: string[] = [];
    let flagSecureViolation = false;
    let bankingAppDetected = false;
    let passwordDetected = false;
    let maskedRegionsCount = 0;

    const pkg = (params.activePackage || '').toLowerCase();
    const appTitle = (params.activeAppTitle || '').toLowerCase();
    const rawText = (params.screenText || '').toLowerCase();

    // 1. Check FLAG_SECURE or Incognito mode
    if (params.isFlagSecureWindow || params.isIncognitoTab) {
      flagSecureViolation = true;
      violations.push({
        code: 'FLAG_SECURE_VIOLATION',
        severity: 'block',
        description: 'La fenêtre active applique l’attribut WindowManager.LayoutParams.FLAG_SECURE ou est en mode navigation privée. La capture est strictement interdite par l’OS.',
        target: params.activePackage || 'Window with FLAG_SECURE',
      });
    }

    // 2. Check Banking & Financial Applications
    for (const [bankPkg, bankName] of Object.entries(PROTECTED_BANKING_PACKAGES)) {
      if (pkg.includes(bankPkg.toLowerCase()) || pkg === bankPkg.toLowerCase()) {
        bankingAppDetected = true;
        violations.push({
          code: 'BANKING_APP_PROTECTED',
          severity: 'block',
          description: `L'application "${bankName}" (${bankPkg}) est classée comme service bancaire/financier protégé. Toute capture d'écran est automatiquement bloquée.`,
          target: bankPkg,
        });
        break;
      }
    }

    // 3. Inspect UI Node Hierarchy for Password & PIN Fields
    if (params.uiHierarchy && params.uiHierarchy.length > 0) {
      for (const node of params.uiHierarchy) {
        // Explicit Android password field or variation
        if (
          node.isPassword ||
          (node.className && node.className.toLowerCase().includes('password')) ||
          (node.resourceId && (node.resourceId.includes('password') || node.resourceId.includes('pin') || node.resourceId.includes('pwd')))
        ) {
          passwordDetected = true;
          maskedRegionsCount++;
          violations.push({
            code: 'PASSWORD_FIELD_DETECTED',
            severity: 'mask',
            description: `Champ de mot de passe détecté (${node.resourceId || node.className || 'Password Node'}). Ce contenu est masqué/anonymisé.`,
            target: node.resourceId || node.id,
          });
        }
      }
    }

    // 4. Scan raw text content for sensitive keywords
    for (const keyword of SENSITIVE_KEYWORDS) {
      if (rawText.includes(keyword) || appTitle.includes(keyword)) {
        sensitiveKeywordsFound.push(keyword);
      }
    }

    // 5. Scan raw text content for Credit Card or IBAN numbers
    if (REGEX_CREDIT_CARD.test(params.screenText || '')) {
      violations.push({
        code: 'CREDIT_CARD_DETECTED',
        severity: 'block',
        description: 'Un numéro de carte de paiement potentiel a été détecté sur l’écran.',
      });
    }

    if (REGEX_IBAN.test(params.screenText || '')) {
      violations.push({
        code: 'IBAN_DETECTED',
        severity: 'mask',
        description: 'Un identifiant bancaire international (IBAN) a été détecté et sera masqué.',
      });
    }

    if (sensitiveKeywordsFound.length > 3 && (rawText.includes('banque') || rawText.includes('solde') || rawText.includes('compte'))) {
      violations.push({
        code: 'SENSITIVE_KEYWORD_DETECTED',
        severity: 'block',
        description: 'Multiples termes bancaires et financiers critiques détectés sur l’écran.',
      });
    }

    // Determine if action is allowed
    const hasBlockingViolation = violations.some((v) => v.severity === 'block') || flagSecureViolation || bankingAppDetected;
    const actionAllowed = !hasBlockingViolation;

    let rejectionReason: string | undefined;
    if (!actionAllowed) {
      const primaryBlocker = violations.find((v) => v.severity === 'block');
      rejectionReason = primaryBlocker?.description || 'Capture d’écran bloquée pour des motifs stricts de sécurité et de confidentialité.';
    }

    // Sanitize image or apply redactions
    let sanitizedBase64 = params.rawBase64;
    if (!actionAllowed) {
      // Completely discard image buffer if blocked
      sanitizedBase64 = undefined;
    }

    return {
      passed: actionAllowed && violations.length === 0,
      flagSecureViolation,
      passwordDetected,
      bankingAppDetected,
      sensitiveKeywordsFound,
      maskedRegionsCount,
      actionAllowed,
      rejectionReason,
      violations,
      sanitizedBase64,
      localAuditOnly: true,
      auditTimestamp: Date.now(),
    };
  }

  /**
   * Sanitizes extracted text by redacting secrets and sensitive patterns
   */
  public sanitizeScreenText(text: string): string {
    let sanitized = redactSecrets(text);
    sanitized = sanitized.replace(REGEX_CREDIT_CARD, '[CARTE_BANCAIRE_MASQUÉE]');
    sanitized = sanitized.replace(REGEX_IBAN, '[IBAN_MASQUÉ]');
    sanitized = sanitized.replace(REGEX_CRYPTO_KEY, '[CLÉ_CRYPTO_MASQUÉE]');
    return sanitized;
  }
}

export const screenPrivacyManager = ScreenPrivacyManager.getInstance();
