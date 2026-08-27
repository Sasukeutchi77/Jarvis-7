/**
 * JARVIS Security & Secret Redactor
 * 
 * Provides:
 * 1. Secret pattern detection & masking for logs, error messages, and responses.
 * 2. Safe environment variable validation without value exposure.
 * 3. Log protection wrapper preventing accidental token leakage in console.
 */

// Common secret patterns & API key prefixes
const SECRET_PATTERNS = [
  /gsk_[a-zA-Z0-9_-]{20,}/g, // Groq API Key
  /AIza[a-zA-Z0-9_-]{35}/g,  // Google Gemini API Key
  /sk-ant-[a-zA-Z0-9_-]{20,}/g, // Anthropic API Key
  /sk-or-v1-[a-zA-Z0-9_-]{20,}/g, // OpenRouter API Key
  /sk-[a-zA-Z0-9_-]{20,}/g,  // OpenAI / Generic Secret
  /tvly-[a-zA-Z0-9_-]{20,}/g, // Tavily Search Key
  /dg_[a-zA-Z0-9_-]{20,}/g,  // Deepgram Key
  /ghp_[a-zA-Z0-9_-]{30,}/g, // GitHub Personal Access Token
  /github_pat_[a-zA-Z0-9_]{50,}/g, // GitHub Fine-grained PAT
  /[0-9]{9,10}:[a-zA-Z0-9_-]{35}/g, // Telegram Bot Token
  /jarvis-[a-zA-Z0-9_-]{20,}/gi, // OpenJarvis Key
  /Bearer\s+[a-zA-Z0-9_.\-+/=]{20,}/gi, // Authorization Bearer headers
];

/**
 * Sanitizes any string or error message by masking discovered secrets
 */
export function redactSecrets(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') return '';
  let sanitized = text;

  // Mask known patterns
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => {
      if (match.length <= 8) return '***REDACTED***';
      return `${match.slice(0, 4)}...[REDACTED]...${match.slice(-3)}`;
    });
  }

  // Also mask if exact env vars match
  const serverKeys = [
    process.env.GROQ_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.ANTHROPIC_API_KEY,
    process.env.OPENROUTER_API_KEY,
    process.env.TAVILY_API_KEY,
    process.env.DEEPGRAM_API_KEY,
    process.env.OPENAI_API_KEY,
    process.env.OPENJARVIS_API_KEY,
    process.env.GITHUB_TOKEN,
    process.env.OPENWEATHER_API_KEY,
    process.env.SPOTIFY_CLIENT_SECRET,
    process.env.TELEGRAM_BOT_TOKEN,
  ].filter(Boolean) as string[];

  for (const key of serverKeys) {
    if (key && key.length > 5) {
      sanitized = sanitized.split(key).join('***[REDACTED_SECRET]***');
    }
  }

  return sanitized;
}

/**
 * Formats error objects safely for API responses without revealing stack keys
 */
export function formatSafeErrorMessage(err: unknown, defaultMessage = 'An internal operation failed'): string {
  if (!err) return defaultMessage;
  const rawMsg = err instanceof Error ? err.message : String(err);
  return redactSecrets(rawMsg);
}

export interface EnvAuditResult {
  key: string;
  configured: boolean;
  status: 'active' | 'missing';
  scope: 'backend-only';
}

/**
 * Safely validates the environment variables status without leaking any values
 */
export function validateEnvironmentSecurity(): {
  allRequiredSafe: boolean;
  variables: EnvAuditResult[];
  auditTimestamp: string;
} {
  const monitoredKeys = [
    'OPENROUTER_API_KEY',
    'OPENJARVIS_API_KEY',
    'GROQ_API_KEY',
    'GEMINI_API_KEY',
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'TAVILY_API_KEY',
    'DEEPGRAM_API_KEY',
    'GITHUB_TOKEN',
    'OPENWEATHER_API_KEY',
    'SPOTIFY_CLIENT_ID',
    'SPOTIFY_CLIENT_SECRET',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID',
  ];

  const variables: EnvAuditResult[] = monitoredKeys.map((key) => {
    const val = process.env[key];
    const isConfigured = !!val && val.trim().length > 0;
    return {
      key,
      configured: isConfigured,
      status: isConfigured ? 'active' : 'missing',
      scope: 'backend-only',
    };
  });

  return {
    allRequiredSafe: true,
    variables,
    auditTimestamp: new Date().toISOString(),
  };
}
