/**
 * Utility to sanitize text for speech synthesis and text-to-speech engines,
 * ensuring JARVIS is pronounced fluidly as a single word ("Jarvis")
 * rather than spelled out letter-by-letter with dots ("J-A-R-V-I-S").
 */

export function sanitizeSpeechText(rawText: string): string {
  if (!rawText) return '';

  return (
    rawText
      // Replace J.A.R.V.I.S / J.a.r.v.i.s / J-A-R-V-I-S / j.a.r.v.i.s with JARVIS
      .replace(/\bJ\.A\.R\.V\.I\.S\.?\b/gi, 'JARVIS')
      .replace(/\bJ-A-R-V-I-S\b/gi, 'JARVIS')
      .replace(/\bJ\.\s*A\.\s*R\.\s*V\.\s*I\.\s*S\.?\b/gi, 'JARVIS')
      // Remove code blocks and markdown formatting that sound awkward when read aloud
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_~#]/g, '')
      // Clean multiple spaces and trim
      .replace(/\s+/g, ' ')
      .trim()
  );
}

// Mapping of spoken French and English number words to digits for vocal code recognition
const NUMBER_WORDS_MAP: Record<string, string> = {
  // French
  zéro: '0',
  zero: '0',
  un: '1',
  une: '1',
  deux: '2',
  trois: '3',
  quatre: '4',
  cinq: '5',
  six: '6',
  sept: '7',
  huit: '8',
  neuf: '9',
  dix: '10',
  // English
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six_en: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
};

/**
 * Normalizes a spoken transcript or typed passcode into a canonical string
 * so that saying "quatre neuf deux zéro", "4 9 2 0", "4920", "Stark Alpha"
 * matches reliably.
 */
export function normalizeSecurityCode(input: string): string {
  if (!input) return '';

  let normalized = input.toLowerCase().trim();

  // Replace punctuation and dashes with spaces
  normalized = normalized.replace(/[,.:!?;_\-\/]/g, ' ');

  // Tokenize and replace number words
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const convertedTokens = tokens.map((tok) => NUMBER_WORDS_MAP[tok] || tok);

  // If all converted tokens are single digits, combine them (e.g. ['4', '9', '2', '0'] -> '4920')
  const digitsOnly = convertedTokens.every((t) => /^[0-9]$/.test(t));
  if (digitsOnly && convertedTokens.length > 0) {
    return convertedTokens.join('');
  }

  // Otherwise return clean joined alphanumeric string (e.g. 'stark alpha' or 'stark 01')
  return convertedTokens.join(' ').trim();
}

/**
 * Compares an input (spoken or typed) against the configured master security code.
 */
export function matchSecurityCode(input: string, masterCode: string): boolean {
  if (!input || !masterCode) return false;

  const cleanMaster = normalizeSecurityCode(masterCode);
  const cleanInput = normalizeSecurityCode(input);

  // Direct exact match
  if (cleanInput === cleanMaster) return true;

  // Compact comparison without spaces (e.g. '4920' vs '4 9 2 0')
  const compactMaster = cleanMaster.replace(/\s+/g, '');
  const compactInput = cleanInput.replace(/\s+/g, '');
  if (compactInput === compactMaster) return true;

  // Substring inclusion (if user says "mon code est 4920" or "code 4920")
  if (cleanInput.includes(cleanMaster) || compactInput.includes(compactMaster)) {
    return true;
  }

  return false;
}
