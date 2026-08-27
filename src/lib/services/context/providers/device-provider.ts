/**
 * DEVICE HARDWARE & NETWORK CONTEXT PROVIDER (PHASE 14)
 * 
 * Extracts battery state, charging, network connectivity (Wifi/5G/Offline),
 * screen status, and audio modes with battery-safe querying.
 */

import { ContextProvider, DeviceContext, ContextSource } from '../types.js';

export class DeviceContextProvider implements ContextProvider<DeviceContext> {
  public readonly source: ContextSource = 'device';
  public readonly name = 'État Matériel & Réseau';
  public readonly description = 'Niveau de batterie, statut de charge, connexion réseau (Wifi/Cellulaire) et réglages audio.';
  private enabled: boolean = true;

  // Internal mutable state for Android simulated or live overrides
  private simulatedState: Partial<DeviceContext> = {
    batteryLevel: 84,
    isCharging: false,
    powerSaveMode: false,
    temperatureC: 28.5,
    network: {
      type: 'wifi',
      ssid: 'JARVIS-Home-5G',
      isMetered: false,
      isOnline: true,
      signalStrengthPct: 92,
    },
    screen: {
      isScreenOn: true,
      brightnessPct: 75,
      orientation: 'portrait',
    },
    audio: {
      ringerMode: 'normal',
      mediaVolumePct: 60,
      headsetConnected: false,
      bluetoothAudioConnected: true,
    },
  };

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public updateSimulatedState(partial: Partial<DeviceContext>): void {
    this.simulatedState = {
      ...this.simulatedState,
      ...partial,
      network: {
        ...(this.simulatedState.network || {
          type: 'wifi',
          isMetered: false,
          isOnline: true,
          signalStrengthPct: 90,
        }),
        ...(partial.network || {}),
      },
      screen: {
        ...(this.simulatedState.screen || {
          isScreenOn: true,
          brightnessPct: 75,
          orientation: 'portrait',
        }),
        ...(partial.screen || {}),
      },
      audio: {
        ...(this.simulatedState.audio || {
          ringerMode: 'normal',
          mediaVolumePct: 60,
          headsetConnected: false,
          bluetoothAudioConnected: false,
        }),
        ...(partial.audio || {}),
      },
    };
  }

  public async fetchContext(): Promise<DeviceContext> {
    // If running in browser environment with navigator.getBattery support
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      try {
        const battery: any = await (navigator as any).getBattery();
        if (battery) {
          const batteryLevel = Math.round(battery.level * 100);
          const isCharging = battery.charging;
          const powerSaveMode = batteryLevel < 20 && !isCharging;

          return {
            batteryLevel,
            isCharging,
            powerSaveMode,
            temperatureC: this.simulatedState.temperatureC || 28.0,
            network: {
              type: navigator.onLine ? (this.simulatedState.network?.type || 'wifi') : 'offline',
              ssid: this.simulatedState.network?.ssid || 'Wifi Connecté',
              isMetered: this.simulatedState.network?.isMetered || false,
              isOnline: navigator.onLine,
              signalStrengthPct: this.simulatedState.network?.signalStrengthPct || 85,
            },
            screen: this.simulatedState.screen || {
              isScreenOn: true,
              brightnessPct: 75,
              orientation: 'portrait',
            },
            audio: this.simulatedState.audio || {
              ringerMode: 'normal',
              mediaVolumePct: 60,
              headsetConnected: false,
              bluetoothAudioConnected: false,
            },
          };
        }
      } catch (e) {
        // Fallback to simulated state on security/policy restriction
      }
    }

    // Default safe fallback state
    return {
      batteryLevel: this.simulatedState.batteryLevel ?? 84,
      isCharging: this.simulatedState.isCharging ?? false,
      powerSaveMode: (this.simulatedState.batteryLevel ?? 84) < 20 && !this.simulatedState.isCharging,
      temperatureC: this.simulatedState.temperatureC ?? 28.5,
      network: this.simulatedState.network || {
        type: 'wifi',
        ssid: 'JARVIS-Home-5G',
        isMetered: false,
        isOnline: true,
        signalStrengthPct: 90,
      },
      screen: this.simulatedState.screen || {
        isScreenOn: true,
        brightnessPct: 75,
        orientation: 'portrait',
      },
      audio: this.simulatedState.audio || {
        ringerMode: 'normal',
        mediaVolumePct: 60,
        headsetConnected: false,
        bluetoothAudioConnected: true,
      },
    };
  }
}
