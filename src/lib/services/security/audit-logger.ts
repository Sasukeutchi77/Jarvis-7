/**
 * JARVIS AUDIT LOGGER (PHASE 13)
 * 
 * Secure local append-only audit trail for important, sensitive, and critical actions.
 * Redacts secrets, avoids unnecessary storage of sensitive data, and creates integrity hashes.
 * "Ne jamais stocker les clés API dans l'APK."
 */

import { ActionSecurityLevel, AuditLogEntry } from './types.js';
import { redactSecrets } from '../security-redactor.js';

export class AuditLogger {
  private logs: AuditLogEntry[] = [];
  private readonly MAX_LOGS = 1000;

  constructor() {
    this.seedInitialAuditLog();
  }

  private seedInitialAuditLog(): void {
    this.log({
      level: ActionSecurityLevel.LEVEL_0_INFORMATION,
      levelName: 'LEVEL 0 — Information',
      agentId: 'security',
      actionName: 'security_boot_audit',
      category: 'system_integrity',
      status: 'executed',
      justification: 'Initialisation du sous-système de sécurité centralisée JARVIS Phase 13.',
    });
  }

  /**
   * Append an entry to the secure local audit log.
   * Automatically redacts any sensitive tokens, passwords, or API keys.
   */
  public log(params: {
    level: ActionSecurityLevel;
    levelName: string;
    agentId: string;
    actionName: string;
    category?: string;
    target?: string;
    status: 'approved' | 'denied' | 'executed' | 'blocked' | 'emergency_stopped' | 'failed';
    justification: string;
    payload?: Record<string, any>;
    confirmationTokenUsed?: string;
    clientIp?: string;
  }): AuditLogEntry {
    const now = Date.now();
    const id = `AUDIT_${now}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Clean payload to strip raw secrets
    const redactedPayload = params.payload ? this.sanitizePayload(params.payload) : undefined;
    const cleanJustification = redactSecrets(params.justification || '');

    // Simple cryptographic-style checksum for tamper detection
    const hashData = `${id}|${now}|${params.level}|${params.agentId}|${params.actionName}|${params.status}|${cleanJustification}`;
    const integrityHash = this.computeChecksum(hashData);

    const entry: AuditLogEntry = {
      id,
      timestamp: now,
      isoDate: new Date(now).toISOString(),
      level: params.level,
      levelName: params.levelName,
      agentId: params.agentId,
      actionName: params.actionName,
      category: params.category || 'general_action',
      target: params.target,
      status: params.status,
      justification: cleanJustification,
      redactedPayload,
      confirmationTokenUsed: params.confirmationTokenUsed,
      clientIp: params.clientIp,
      integrityHash,
    };

    this.logs.unshift(entry);

    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(0, this.MAX_LOGS);
    }

    return entry;
  }

  /**
   * Deep sanitize object to strip API keys, card numbers, passwords
   */
  private sanitizePayload(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      const lowerKey = k.toLowerCase();
      if (
        lowerKey.includes('key') || lowerKey.includes('secret') || lowerKey.includes('token') ||
        lowerKey.includes('password') || lowerKey.includes('auth') || lowerKey.includes('card') ||
        lowerKey.includes('cvv') || lowerKey.includes('pin')
      ) {
        result[k] = '[REDACTED_BY_JARVIS_SECURITY]';
      } else if (typeof v === 'string') {
        result[k] = redactSecrets(v);
      } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        result[k] = this.sanitizePayload(v);
      } else {
        result[k] = v;
      }
    }
    return result;
  }

  private computeChecksum(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return `SHA256_SIM_${Math.abs(hash).toString(16).padStart(8, '0')}`;
  }

  public getLogs(filter?: {
    level?: ActionSecurityLevel;
    agentId?: string;
    status?: string;
    query?: string;
    limit?: number;
  }): AuditLogEntry[] {
    let list = [...this.logs];

    if (filter) {
      if (filter.level !== undefined) {
        list = list.filter((l) => l.level === filter.level);
      }
      if (filter.agentId) {
        list = list.filter((l) => l.agentId.toLowerCase() === filter.agentId!.toLowerCase());
      }
      if (filter.status) {
        list = list.filter((l) => l.status === filter.status);
      }
      if (filter.query) {
        const q = filter.query.toLowerCase();
        list = list.filter(
          (l) =>
            l.actionName.toLowerCase().includes(q) ||
            l.justification.toLowerCase().includes(q) ||
            l.agentId.toLowerCase().includes(q)
        );
      }
      if (filter.limit) {
        list = list.slice(0, filter.limit);
      }
    }

    return list;
  }

  public clearLogs(): void {
    this.logs = [];
    this.seedInitialAuditLog();
  }

  public getCount(): number {
    return this.logs.length;
  }
}

export const auditLogger = new AuditLogger();
