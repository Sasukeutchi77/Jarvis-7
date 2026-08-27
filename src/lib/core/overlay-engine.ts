/**
 * OVERLAY ENGINE (JARVIS Floating HUD & System Alert Window Coordinator)
 * 
 * Manages out-of-application floating bubble HUD, system overlay permissions,
 * draggable coordinates, and cross-application display.
 */

import { IOverlayEngine, OverlayConfig } from './types.js';
import { AndroidPermissionAuditor } from '../services/security/android-permission-auditor.js';

export class OverlayEngine implements IOverlayEngine {
  private static instance: OverlayEngine;
  private _config: OverlayConfig = {
    visible: false,
    mode: 'bubble',
    pinnedToCorner: false,
    interactive: true,
    coordinates: { x: 24, y: 100 },
  };

  private constructor() {
    this.loadState();
  }

  public static getInstance(): OverlayEngine {
    if (!OverlayEngine.instance) {
      OverlayEngine.instance = new OverlayEngine();
    }
    return OverlayEngine.instance;
  }

  private loadState(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('jarvis_overlay_config');
        if (raw) {
          this._config = { ...this._config, ...JSON.parse(raw) };
        }
      } catch {
        // ignore fallback
      }
    }
  }

  private saveState(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('jarvis_overlay_config', JSON.stringify(this._config));
      } catch {
        // ignore
      }
    }
  }

  public get isOverlayActive(): boolean {
    return this._config.visible;
  }

  public get overlayConfig(): OverlayConfig {
    return { ...this._config };
  }

  public async showOverlay(mode?: OverlayConfig['mode']): Promise<boolean> {
    if (mode) {
      this._config.mode = mode;
    }
    this._config.visible = true;
    this.saveState();
    return true;
  }

  public async hideOverlay(): Promise<boolean> {
    this._config.visible = false;
    this.saveState();
    return true;
  }

  public async toggleOverlay(): Promise<boolean> {
    this._config.visible = !this._config.visible;
    this.saveState();
    return this._config.visible;
  }

  public updatePosition(x: number, y: number): void {
    this._config.coordinates = { x, y };
    this.saveState();
  }

  public canDrawOverlays(): boolean {
    const audit = AndroidPermissionAuditor.checkCapability('overlay');
    return audit.status === 'AUTHORIZED';
  }

  public async requestOverlayPermission(): Promise<boolean> {
    const audit = AndroidPermissionAuditor.checkCapability('overlay');
    if (audit.status === 'AUTHORIZED') return true;

    if (audit.officialIntentAction && typeof window !== 'undefined') {
      window.location.href = `intent:#Intent;action=${audit.officialIntentAction};end`;
    }
    return false;
  }
}

export const overlayEngine = OverlayEngine.getInstance();
