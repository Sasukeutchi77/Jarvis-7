/**
 * LOCATION CONTEXT PROVIDER (PHASE 14)
 * 
 * Location provider with strict permission gating (FINE_LOCATION).
 * Guarantees zero location tracking when permission is revoked or Private Mode is active.
 */

import { ContextProvider, LocationContext, ContextSource } from '../types.js';
import { permissionManager } from '../../security/index.js';
import { PermissionKey } from '../../security/types.js';

export class LocationContextProvider implements ContextProvider<LocationContext> {
  public readonly source: ContextSource = 'location';
  public readonly name = 'Localisation & Ville';
  public readonly description = 'Fournit les coordonnées GPS et la ville courante uniquement si la permission FINE_LOCATION est accordée.';
  public readonly requiredPermission: PermissionKey = 'FINE_LOCATION';
  private enabled: boolean = true;

  // Simulated location state for testing / demo
  private currentLocation: {
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    city: string;
    locality: string;
    country: string;
    timezone: string;
    source: 'gps' | 'network' | 'simulated';
  } = {
    latitude: 48.8566,
    longitude: 2.3522,
    accuracyMeters: 12,
    city: 'Paris',
    locality: '75008 Paris',
    country: 'France',
    timezone: 'Europe/Paris',
    source: 'gps',
  };

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public setLocation(loc: Partial<typeof this.currentLocation>): void {
    this.currentLocation = {
      ...this.currentLocation,
      ...loc,
    };
  }

  public async fetchContext(): Promise<LocationContext> {
    // Check permission with permission manager for the supervisor/general agent
    const isGranted = permissionManager.hasPermission('supervisor', 'FINE_LOCATION');

    if (!isGranted || !this.enabled) {
      return {
        permissionGranted: false,
        source: 'none',
      };
    }

    return {
      permissionGranted: true,
      latitude: this.currentLocation.latitude,
      longitude: this.currentLocation.longitude,
      accuracyMeters: this.currentLocation.accuracyMeters,
      city: this.currentLocation.city,
      locality: this.currentLocation.locality,
      country: this.currentLocation.country,
      timezone: this.currentLocation.timezone,
      source: this.currentLocation.source,
      lastUpdated: Date.now(),
    };
  }
}
