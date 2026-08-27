/**
 * USER PREFERENCES CONTEXT PROVIDER (PHASE 14)
 * 
 * Provides active language, persona, privacy settings, home city,
 * and favorite apps for tailored contextual responses.
 */

import { ContextProvider, UserPreferenceContext, ContextSource } from '../types.js';

export class PreferencesContextProvider implements ContextProvider<UserPreferenceContext> {
  public readonly source: ContextSource = 'preferences';
  public readonly name = 'Préférences & Mémoire';
  public readonly description = 'Langue, persona de JARVIS, mode concis et personnalisation utilisateur.';
  private enabled: boolean = true;

  private preferences: UserPreferenceContext = {
    language: 'fr-FR',
    persona: 'JARVIS — Assistant Vocal & Proactif Expert',
    conciseMode: false,
    privacyMode: false,
    homeCity: 'Paris',
    workHours: { start: '09:00', end: '18:30' },
    favoriteApps: ['WhatsApp', 'Spotify', 'Google Maps', 'YouTube', 'Gmail'],
  };

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public updatePreferences(partial: Partial<UserPreferenceContext>): void {
    this.preferences = {
      ...this.preferences,
      ...partial,
    };
  }

  public async fetchContext(): Promise<UserPreferenceContext> {
    return { ...this.preferences };
  }
}
