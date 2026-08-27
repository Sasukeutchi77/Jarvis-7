/**
 * JARVIS CONFIRMATION MANAGER (PHASE 13)
 * 
 * Manages tokenized security gates for Sensitive (LEVEL 3) and Critical (LEVEL 4) actions.
 * Enforces rule: "Aucune action critique ne doit être exécutée automatiquement."
 */

import { ActionSecurityLevel, ConfirmationRequest } from './types.js';

export class ConfirmationManager {
  private pendingConfirmations: Map<string, ConfirmationRequest> = new Map();
  private readonly DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Request confirmation for an action.
   * Generates a cryptographic-style token with TTL.
   */
  public requestConfirmation(params: {
    actionId: string;
    actionName: string;
    level: ActionSecurityLevel;
    agentId: string;
    targetResource?: string;
    description: string;
    riskDetails: string;
    payloadSummary: Record<string, any>;
    requiresBiometrics?: boolean;
  }): ConfirmationRequest {
    // Generate unique confirmation token
    const token = `SEC_AUTH_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const now = Date.now();

    const request: ConfirmationRequest = {
      token,
      actionId: params.actionId,
      actionName: params.actionName,
      level: params.level,
      agentId: params.agentId,
      targetResource: params.targetResource,
      description: params.description,
      riskDetails: params.riskDetails,
      payloadSummary: params.payloadSummary || {},
      createdAt: now,
      expiresAt: now + this.DEFAULT_TTL_MS,
      status: 'pending',
      requiresBiometrics: params.requiresBiometrics ?? (params.level === ActionSecurityLevel.LEVEL_4_CRITICAL),
    };

    this.pendingConfirmations.set(token, request);
    this.cleanExpiredRequests();

    return request;
  }

  /**
   * Validate and approve a confirmation token
   */
  public approveConfirmation(token: string, approverNotes?: string): { success: boolean; request?: ConfirmationRequest; error?: string } {
    this.cleanExpiredRequests();
    const req = this.pendingConfirmations.get(token);

    if (!req) {
      return { success: false, error: 'Jeton de confirmation introuvable ou expiré.' };
    }

    if (req.status !== 'pending') {
      return { success: false, error: `Ce jeton a déjà été traité (statut: ${req.status}).` };
    }

    req.status = 'approved';
    return { success: true, request: req };
  }

  /**
   * Reject a confirmation request
   */
  public rejectConfirmation(token: string, reason?: string): { success: boolean; request?: ConfirmationRequest; error?: string } {
    const req = this.pendingConfirmations.get(token);
    if (!req) {
      return { success: false, error: 'Jeton de confirmation introuvable.' };
    }

    req.status = 'rejected';
    return { success: true, request: req };
  }

  /**
   * Verify if a token is currently valid and approved
   */
  public isTokenApproved(token: string, actionId?: string): boolean {
    const req = this.pendingConfirmations.get(token);
    if (!req) return false;
    if (req.status !== 'approved') return false;
    if (Date.now() > req.expiresAt) return false;
    if (actionId && req.actionId !== actionId) return false;
    return true;
  }

  /**
   * Get all active pending confirmations
   */
  public getPendingConfirmations(): ConfirmationRequest[] {
    this.cleanExpiredRequests();
    return Array.from(this.pendingConfirmations.values()).filter((r) => r.status === 'pending');
  }

  /**
   * Clean up expired tokens
   */
  private cleanExpiredRequests(): void {
    const now = Date.now();
    for (const [token, req] of this.pendingConfirmations.entries()) {
      if (now > req.expiresAt && req.status === 'pending') {
        req.status = 'expired';
      }
    }
  }

  public getPendingCount(): number {
    return this.getPendingConfirmations().length;
  }
}

export const confirmationManager = new ConfirmationManager();
