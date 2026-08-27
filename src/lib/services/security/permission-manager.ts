/**
 * JARVIS PERMISSION MANAGER (PHASE 13)
 * 
 * Manages runtime permissions per agent and globally,
 * supports granular revocation, privilege audits, and agent disabling.
 */

import { PermissionKey, AgentPermissionAssignment, ActionSecurityLevel } from './types.js';
import { SecurityPolicy } from './security-policy.js';

export class PermissionManager {
  // Map of agentId -> permission assignment
  private agentPermissions: Map<string, AgentPermissionAssignment> = new Map();

  // Disabled agents registry
  private disabledAgents: Set<string> = new Set();

  constructor() {
    this.initializeDefaultAssignments();
  }

  private initializeDefaultAssignments(): void {
    const knownAgents = [
      'supervisor', 'general_ai', 'coding', 'research', 'android',
      'task', 'reminder', 'notes', 'routine', 'media', 'security',
      'memory', 'voice', 'screen', 'vision', 'phone', 'communication'
    ];

    for (const agentId of knownAgents) {
      const granted: PermissionKey[] = [];
      const revoked: PermissionKey[] = [];

      for (const [permKey, def] of Object.entries(SecurityPolicy.PERMISSION_MAP)) {
        const key = permKey as PermissionKey;
        // Fine-tune perms by agent archetype
        if (agentId === 'security') {
          granted.push(key);
        } else if (agentId === 'phone' || agentId === 'communication') {
          if (['MAKE_PHONE_CALLS', 'SEND_SMS', 'READ_SMS', 'READ_CONTACTS', 'READ_NOTIFICATIONS', 'POST_NOTIFICATIONS', 'NETWORK_COMMUNICATION'].includes(key)) {
            granted.push(key);
          } else {
            revoked.push(key);
          }
        } else if (agentId === 'routine') {
          if (['APPLICATION_LAUNCH', 'READ_NOTIFICATIONS', 'POST_NOTIFICATIONS', 'SYSTEM_SETTINGS', 'NETWORK_COMMUNICATION', 'READ_STORAGE'].includes(key)) {
            granted.push(key);
          } else {
            revoked.push(key);
          }
        } else {
          // General default based on definition
          if (def.defaultGranted) {
            granted.push(key);
          } else {
            revoked.push(key);
          }
        }
      }

      this.agentPermissions.set(agentId, {
        agentId,
        grantedPermissions: granted,
        revokedPermissions: revoked,
        isAgentDisabled: false,
        lastUpdated: new Date().toISOString(),
      });
    }
  }

  /**
   * Check if an agent has a specific permission
   */
  public hasPermission(agentId: string, permission: PermissionKey): boolean {
    if (this.isAgentDisabled(agentId)) {
      return false;
    }

    const assignment = this.agentPermissions.get(agentId);
    if (!assignment) {
      // Fallback: check global default
      return SecurityPolicy.PERMISSION_MAP[permission]?.defaultGranted ?? false;
    }

    if (assignment.revokedPermissions.includes(permission)) {
      return false;
    }

    return assignment.grantedPermissions.includes(permission);
  }

  /**
   * Grant a specific permission to an agent
   */
  public grantPermission(agentId: string, permission: PermissionKey): boolean {
    let assignment = this.agentPermissions.get(agentId);
    if (!assignment) {
      assignment = {
        agentId,
        grantedPermissions: [],
        revokedPermissions: [],
        isAgentDisabled: false,
        lastUpdated: new Date().toISOString(),
      };
      this.agentPermissions.set(agentId, assignment);
    }

    assignment.revokedPermissions = assignment.revokedPermissions.filter((p) => p !== permission);
    if (!assignment.grantedPermissions.includes(permission)) {
      assignment.grantedPermissions.push(permission);
    }
    assignment.lastUpdated = new Date().toISOString();
    return true;
  }

  /**
   * Revoke a specific permission from an agent
   */
  public revokePermission(agentId: string, permission: PermissionKey): boolean {
    let assignment = this.agentPermissions.get(agentId);
    if (!assignment) {
      assignment = {
        agentId,
        grantedPermissions: [],
        revokedPermissions: [],
        isAgentDisabled: false,
        lastUpdated: new Date().toISOString(),
      };
      this.agentPermissions.set(agentId, assignment);
    }

    assignment.grantedPermissions = assignment.grantedPermissions.filter((p) => p !== permission);
    if (!assignment.revokedPermissions.includes(permission)) {
      assignment.revokedPermissions.push(permission);
    }
    assignment.lastUpdated = new Date().toISOString();
    return true;
  }

  /**
   * Revoke all permissions for an agent
   */
  public revokeAllPermissions(agentId: string): void {
    const allKeys = Object.keys(SecurityPolicy.PERMISSION_MAP) as PermissionKey[];
    let assignment = this.agentPermissions.get(agentId);
    if (!assignment) {
      assignment = {
        agentId,
        grantedPermissions: [],
        revokedPermissions: allKeys,
        isAgentDisabled: false,
        lastUpdated: new Date().toISOString(),
      };
      this.agentPermissions.set(agentId, assignment);
    } else {
      assignment.grantedPermissions = [];
      assignment.revokedPermissions = allKeys;
      assignment.lastUpdated = new Date().toISOString();
    }
  }

  /**
   * Enable or Disable an agent
   */
  public setAgentDisabled(agentId: string, disabled: boolean): boolean {
    if (disabled) {
      this.disabledAgents.add(agentId);
    } else {
      this.disabledAgents.delete(agentId);
    }

    const assignment = this.agentPermissions.get(agentId);
    if (assignment) {
      assignment.isAgentDisabled = disabled;
      assignment.lastUpdated = new Date().toISOString();
    }
    return disabled;
  }

  public isAgentDisabled(agentId: string): boolean {
    return this.disabledAgents.has(agentId);
  }

  public getDisabledAgents(): string[] {
    return Array.from(this.disabledAgents);
  }

  public getAllAssignments(): AgentPermissionAssignment[] {
    return Array.from(this.agentPermissions.values());
  }

  public getAgentAssignment(agentId: string): AgentPermissionAssignment | undefined {
    return this.agentPermissions.get(agentId);
  }

  public getStats(): { totalGranted: number; totalRevoked: number; disabledCount: number } {
    let totalGranted = 0;
    let totalRevoked = 0;

    for (const a of this.agentPermissions.values()) {
      totalGranted += a.grantedPermissions.length;
      totalRevoked += a.revokedPermissions.length;
    }

    return {
      totalGranted,
      totalRevoked,
      disabledCount: this.disabledAgents.size,
    };
  }
}

export const permissionManager = new PermissionManager();
