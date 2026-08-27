/**
 * TIME & DATE CONTEXT PROVIDER (PHASE 14)
 * 
 * Computes localized French date, time, period of day (matin, après-midi, soir, nuit),
 * weekend status, and timezone context.
 */

import { ContextProvider, TimeContext, ContextSource } from '../types.js';

export class TimeContextProvider implements ContextProvider<TimeContext> {
  public readonly source: ContextSource = 'time';
  public readonly name = 'Horloge & Date';
  public readonly description = 'Fournit l\'heure précise, la date en français, la période de la journée et le fuseau horaire.';
  private enabled: boolean = true;

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public async fetchContext(): Promise<TimeContext> {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    let periodOfDay: TimeContext['periodOfDay'] = 'morning';
    if (hours >= 5 && hours < 12) {
      periodOfDay = 'morning';
    } else if (hours >= 12 && hours < 18) {
      periodOfDay = 'afternoon';
    } else if (hours >= 18 && hours < 23) {
      periodOfDay = 'evening';
    } else {
      periodOfDay = 'night';
    }

    const dayOfWeekStr = now.toLocaleDateString('fr-FR', { weekday: 'long' });
    const capitalizedDayOfWeek = dayOfWeekStr.charAt(0).toUpperCase() + dayOfWeekStr.slice(1);
    const monthNameStr = now.toLocaleDateString('fr-FR', { month: 'long' });
    const capitalizedMonthName = monthNameStr.charAt(0).toUpperCase() + monthNameStr.slice(1);

    const timeFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const dateFormatted = now.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const dayOfWeekIndex = now.getDay(); // 0 is Sunday, 6 is Saturday
    const isWeekend = dayOfWeekIndex === 0 || dayOfWeekIndex === 6;

    return {
      timestamp: now.getTime(),
      iso: now.toISOString(),
      timeFormatted,
      dateFormatted: dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1),
      dayOfWeek: capitalizedDayOfWeek,
      dayOfMonth: now.getDate(),
      monthName: capitalizedMonthName,
      year: now.getFullYear(),
      periodOfDay,
      isWeekend,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris',
    };
  }
}
