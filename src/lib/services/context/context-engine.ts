/**
 * JARVIS CONTEXT ENGINE & CONTEXT AWARENESS CORE (PHASE 14)
 * 
 * Central engine orchestrating contextual understanding across:
 * - Time & Date (Heure, jour, période)
 * - Device & Hardware (Batterie, charge, réseau, volume)
 * - Location (Localisation autorisée avec contrôle strict de permission)
 * - Foreground / Active App (Application active Android)
 * - Notifications (Alerte et messages récents)
 * - Agenda & Tasks (Calendrier, tâches du jour, rappels, alarmes)
 * - User Preferences (Langue, ville par défaut, favoris)
 * - Routines & Automation (Routines en cours ou planifiées)
 * 
 * Guarantees:
 * 1. Strict permission enforcement (zero tracking if permission is revoked).
 * 2. Zero continuous battery-draining polling (on-demand pull with adaptive caching).
 * 3. Doze mode & Battery Saver compliance (extended TTL on low battery).
 * 4. Rich prompt & snapshot synthesis for SupervisorAgent.
 */

import {
  ContextSnapshot,
  ContextProvider,
  ContextSource,
  ContextEngineConfig,
  ContextFreshness,
} from './types.js';
import { TimeContextProvider } from './providers/time-provider.js';
import { DeviceContextProvider } from './providers/device-provider.js';
import { LocationContextProvider } from './providers/location-provider.js';
import { ActiveAppContextProvider } from './providers/app-provider.js';
import { NotificationContextProvider } from './providers/notification-provider.js';
import { AgendaContextProvider } from './providers/agenda-provider.js';
import { PreferencesContextProvider } from './providers/preferences-provider.js';
import { RoutineContextProvider } from './providers/routine-provider.js';
import { securityManager, permissionManager } from '../security/index.js';

export interface ContextSynthesisResult {
  handled: boolean;
  intent: string;
  reply?: string;
  spokenSummary?: string;
  enrichedQuery?: string;
  suggestedAgentId?: string;
  contextUsed: ContextSource[];
  confidence: number;
}

export class ContextEngine {
  private static instance: ContextEngine;

  // Providers Registry
  private timeProvider = new TimeContextProvider();
  private deviceProvider = new DeviceContextProvider();
  private locationProvider = new LocationContextProvider();
  private appProvider = new ActiveAppContextProvider();
  private notificationProvider = new NotificationContextProvider();
  private agendaProvider = new AgendaContextProvider();
  private preferencesProvider = new PreferencesContextProvider();
  private routineProvider = new RoutineContextProvider();

  private providers: Map<ContextSource, ContextProvider> = new Map();

  // Cached Snapshot
  private cachedSnapshot: ContextSnapshot | null = null;
  private lastSnapshotTime: number = 0;

  // Engine Configuration
  private config: ContextEngineConfig = {
    cacheTtlMs: 30000,              // 30 seconds standard cache
    batterySaverCacheTtlMs: 120000, // 2 minutes in battery saver mode
    batterySaverEnabled: true,      // Auto-throttle when battery < 20%
    autoRefreshOnQuery: true,       // Refresh if cache expired when query arrives
    proactiveAwareness: true,
    disabledSources: [],
  };

  private constructor() {
    this.providers.set('time', this.timeProvider);
    this.providers.set('device', this.deviceProvider);
    this.providers.set('location', this.locationProvider);
    this.providers.set('app', this.appProvider);
    this.providers.set('notifications', this.notificationProvider);
    this.providers.set('agenda', this.agendaProvider);
    this.providers.set('preferences', this.preferencesProvider);
    this.providers.set('routines', this.routineProvider);
  }

  public static getInstance(): ContextEngine {
    if (!ContextEngine.instance) {
      ContextEngine.instance = new ContextEngine();
    }
    return ContextEngine.instance;
  }

  /**
   * Returns all registered providers with their metadata
   */
  public getProviders(): Array<{
    source: ContextSource;
    name: string;
    description: string;
    requiredPermission?: string;
    isEnabled: boolean;
    hasPermission: boolean;
  }> {
    return Array.from(this.providers.entries()).map(([source, provider]) => {
      const perm = provider.requiredPermission;
      const hasPerm = perm ? permissionManager.hasPermission('supervisor', perm) : true;
      return {
        source,
        name: provider.name,
        description: provider.description,
        requiredPermission: perm,
        isEnabled: provider.isEnabled() && !this.config.disabledSources.includes(source),
        hasPermission: hasPerm,
      };
    });
  }

  public getProvider<T extends ContextProvider>(source: ContextSource): T | undefined {
    return this.providers.get(source) as T | undefined;
  }

  public setProviderEnabled(source: ContextSource, enabled: boolean): void {
    const provider = this.providers.get(source);
    if (provider) {
      provider.setEnabled(enabled);
      if (!enabled && !this.config.disabledSources.includes(source)) {
        this.config.disabledSources.push(source);
      } else if (enabled) {
        this.config.disabledSources = this.config.disabledSources.filter((s) => s !== source);
      }
      this.invalidateCache();
    }
  }

  public updateConfig(partial: Partial<ContextEngineConfig>): ContextEngineConfig {
    this.config = {
      ...this.config,
      ...partial,
    };
    return { ...this.config };
  }

  public getConfig(): ContextEngineConfig {
    return { ...this.config };
  }

  public invalidateCache(): void {
    this.cachedSnapshot = null;
    this.lastSnapshotTime = 0;
  }

  /**
   * Core method to generate or retrieve a battery-efficient ContextSnapshot
   */
  public async getSnapshot(forceRefresh: boolean = false): Promise<ContextSnapshot> {
    const now = Date.now();
    const isPrivateMode = securityManager.isPrivateModeActive();

    // Check effective TTL based on battery optimization
    const rawDevice = await this.deviceProvider.fetchContext();
    const isLowBattery = rawDevice.batteryLevel <= 20 && !rawDevice.isCharging;
    const effectiveTtl = (this.config.batterySaverEnabled && isLowBattery)
      ? this.config.batterySaverCacheTtlMs
      : this.config.cacheTtlMs;

    const cacheAge = now - this.lastSnapshotTime;

    // Return cached snapshot if fresh and not forced
    if (!forceRefresh && this.cachedSnapshot && cacheAge < effectiveTtl) {
      return {
        ...this.cachedSnapshot,
        freshness: {
          cached: true,
          cacheAgeMs: cacheAge,
          batteryOptimized: isLowBattery,
          ttlMs: effectiveTtl,
          generatedAt: this.lastSnapshotTime,
        },
      };
    }

    // Fetch from providers concurrently
    const [time, device, location, activeApp, notifications, agenda, preferences, routines] = await Promise.all([
      this.timeProvider.fetchContext(),
      this.deviceProvider.fetchContext(),
      isPrivateMode ? Promise.resolve({ permissionGranted: false, source: 'none' as const }) : this.locationProvider.fetchContext(),
      this.appProvider.fetchContext(),
      this.notificationProvider.fetchContext(),
      this.agendaProvider.fetchContext(),
      this.preferencesProvider.fetchContext(),
      this.routineProvider.fetchContext(),
    ]);

    // Track permission status summary
    const permissions: Record<string, boolean> = {
      location: location.permissionGranted,
      app: activeApp.permissionGranted,
      notifications: notifications.permissionGranted,
      privateMode: isPrivateMode,
    };

    const freshness: ContextFreshness = {
      cached: false,
      cacheAgeMs: 0,
      batteryOptimized: isLowBattery,
      ttlMs: effectiveTtl,
      generatedAt: now,
    };

    // Generate human-friendly markdown summary
    const summary = this.buildMarkdownSummary({
      time,
      device,
      location,
      activeApp,
      notifications,
      agenda,
      preferences,
      routines,
      isPrivateMode,
    });

    // Generate natural spoken summary
    const spokenSummary = this.buildSpokenSummary({
      time,
      device,
      location,
      agenda,
      notifications,
    });

    // Generate LLM System Prompt Fragment
    const systemPromptFragment = this.buildSystemPromptFragment({
      time,
      device,
      location,
      activeApp,
      notifications,
      agenda,
      preferences,
      routines,
      isPrivateMode,
    });

    const snapshot: ContextSnapshot = {
      id: `ctx_${now}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: now,
      isoDate: new Date(now).toISOString(),
      freshness,
      time,
      device,
      location,
      activeApp,
      notifications,
      agenda,
      preferences,
      routines,
      permissions,
      summary,
      spokenSummary,
      systemPromptFragment,
    };

    this.cachedSnapshot = snapshot;
    this.lastSnapshotTime = now;

    return snapshot;
  }

  /**
   * Synthesizes and routes contextual queries directly using verified context data.
   * Handles queries like:
   * - "Qu'est-ce que j'ai aujourd'hui ?"
   * - "Quelle est la météo ?"
   * - "Niveau de batterie ?"
   * - "Quelle heure est-il ?"
   * - "Suis-je en wifi ?"
   */
  public async synthesizeIntent(query: string, preloadedSnapshot?: ContextSnapshot): Promise<ContextSynthesisResult> {
    const snapshot = preloadedSnapshot || (await this.getSnapshot());
    const q = query.toLowerCase().trim();

    // =========================================================================
    // 1. "Qu'est-ce que j'ai aujourd'hui ?" / "Mon programme" / "Mon planning"
    // =========================================================================
    if (
      q.includes("qu'est-ce que j'ai aujourd'hui") ||
      q.includes("qu'ai-je aujourd'hui") ||
      q.includes("qu'est ce que j'ai aujourd'hui") ||
      q.includes('planning du jour') ||
      q.includes('programme du jour') ||
      q.includes('mon agenda aujourd') ||
      q.includes('briefing du jour') ||
      q.includes('résumé de ma journée')
    ) {
      const agenda = snapshot.agenda;
      const time = snapshot.time;
      const loc = snapshot.location;

      let reply = `### 📅 Programme du Jour — ${time.dateFormatted}\n\n`;
      reply += `**Heure actuelle** : ${time.timeFormatted} (${time.periodOfDay === 'morning' ? 'Matin' : time.periodOfDay === 'afternoon' ? 'Après-midi' : 'Soirée'})\n`;
      if (loc.permissionGranted && loc.city) {
        reply += `**Localisation** : ${loc.city}, ${loc.country || 'France'}\n`;
      }
      reply += `\n---\n\n`;

      // Events
      if (agenda.todayEventsCount === 0) {
        reply += `#### 🗓️ Événements Calendrier\n- *Aucun événement planifié aujourd'hui.*\n\n`;
      } else {
        reply += `#### 🗓️ Événements Calendrier (${agenda.todayEventsCount})\n`;
        agenda.todayEvents.forEach((ev) => {
          reply += `- **${ev.time}** : **${ev.title}** ${ev.location ? `📍 *${ev.location}*` : ''} *(${ev.calendarName})*\n`;
        });
        reply += `\n`;
      }

      // Tasks
      if (agenda.pendingTasksCount === 0) {
        reply += `#### ✅ Tâches en attente\n- *Toutes vos tâches sont terminées !*\n\n`;
      } else {
        reply += `#### ✅ Tâches en attente (${agenda.pendingTasksCount})\n`;
        agenda.topTasks.forEach((t) => {
          const priorityIcon = t.priority === 'urgent' ? '🔴' : t.priority === 'high' ? '🟠' : '🟡';
          reply += `- ${priorityIcon} **${t.title}** ${t.dueTime ? `(Échéance: ${t.dueTime})` : ''} — *${t.category}*\n`;
        });
        reply += `\n`;
      }

      // Reminders & Alarms
      if (agenda.nextReminder || agenda.nextAlarm) {
        reply += `#### ⏰ Rappels & Alarmes\n`;
        if (agenda.nextReminder) {
          reply += `- 🔔 Prochain rappel : **${agenda.nextReminder.title}** (${agenda.nextReminder.timeFormatted})\n`;
        }
        if (agenda.nextAlarm) {
          reply += `- ⏰ Prochaine alarme : **${agenda.nextAlarm.label}** à **${agenda.nextAlarm.timeFormatted}**\n`;
        }
      }

      return {
        handled: true,
        intent: 'agenda_today_briefing',
        reply,
        spokenSummary: agenda.holisticDailyBriefing,
        suggestedAgentId: 'calendar',
        contextUsed: ['agenda', 'time', 'location'],
        confidence: 0.98,
      };
    }

    // =========================================================================
    // 2. "Quelle est la météo ?" / "Quel temps fait-il ?" (Phase 3 Real Weather Engine)
    // =========================================================================
    if (
      q.includes('météo') ||
      q.includes('meteo') ||
      q.includes('quel temps fait-il') ||
      q.includes('prevision meteo') ||
      q.includes('pleuvoir') ||
      q.includes('pluie') ||
      q.includes('temperature dehors')
    ) {
      const loc = snapshot.location;
      return {
        handled: false, // WeatherAgent executes directly with OpenWeather Real API
        intent: 'weather_inquiry',
        suggestedAgentId: 'weather',
        contextUsed: ['location', 'time'],
        confidence: 0.99,
      };
    }

    // =========================================================================
    // 3. "Niveau de batterie" / "Batterie" / "État de charge"
    // =========================================================================
    if (
      q.includes('batterie') ||
      q.includes('niveau de charge') ||
      q.includes('suis-je en charge') ||
      q.includes('pourcentage batterie')
    ) {
      const dev = snapshot.device;
      const reply = `### 🔋 État de la Batterie\n\n- **Niveau** : **${dev.batteryLevel}%**\n- **Statut** : ${dev.isCharging ? '⚡ En charge rapide' : '🔋 Sur batterie'}\n- **Économiseur** : ${dev.powerSaveMode ? 'Activé (Mode éco)' : 'Désactivé'}\n- **Température** : ${dev.temperatureC ? `${dev.temperatureC}°C` : 'Normale'}`;
      const spokenSummary = `Votre batterie est à ${dev.batteryLevel} pour cent, ${dev.isCharging ? 'actuellement en charge' : 'sur batterie'}.`;

      return {
        handled: true,
        intent: 'device_battery_status',
        reply,
        spokenSummary,
        suggestedAgentId: 'android',
        contextUsed: ['device'],
        confidence: 0.99,
      };
    }

    // =========================================================================
    // 4. "Réseau" / "Connexion Wifi" / "Suis-je en 5G ?"
    // =========================================================================
    if (
      q.includes('réseau') ||
      q.includes('wifi') ||
      q.includes('connexion internet') ||
      q.includes('suis-je connecté') ||
      q.includes('signal')
    ) {
      const net = snapshot.device.network;
      const reply = `### 📶 Statut Réseau & Connectivité\n\n- **État** : ${net.isOnline ? '🟢 En ligne' : '🔴 Hors ligne'}\n- **Type de réseau** : **${net.type.toUpperCase()}** ${net.ssid ? `(\`${net.ssid}\`)` : ''}\n- **Signal** : ${net.signalStrengthPct}%\n- **Connexion mesurée** : ${net.isMetered ? 'Oui (Cellulaire facturé)' : 'Non (Illimité)'}`;
      const spokenSummary = `Vous êtes connecté en ${net.type === 'wifi' ? 'Wifi sur ' + (net.ssid || 'votre réseau') : 'données mobiles'} avec une force de signal de ${net.signalStrengthPct}%.`;

      return {
        handled: true,
        intent: 'device_network_status',
        reply,
        spokenSummary,
        suggestedAgentId: 'android',
        contextUsed: ['device'],
        confidence: 0.98,
      };
    }

    // =========================================================================
    // 5. "Quelle heure est-il ?" / "Quel jour sommes-nous ?"
    // =========================================================================
    if (
      q.includes('quelle heure') ||
      q.includes("donne-moi l'heure") ||
      q.includes('quel jour') ||
      q.includes('la date du jour')
    ) {
      const t = snapshot.time;
      const reply = `Il est actuellement **${t.timeFormatted}**, **${t.dateFormatted}** (Fuseau : \`${t.timezone}\`).`;
      const spokenSummary = `Il est ${t.timeFormatted}, ${t.dateFormatted}.`;

      return {
        handled: true,
        intent: 'time_date_lookup',
        reply,
        spokenSummary,
        suggestedAgentId: 'general_ai',
        contextUsed: ['time'],
        confidence: 0.99,
      };
    }

    // =========================================================================
    // 6. "Application active" / "Qu'est-ce qui est ouvert ?"
    // =========================================================================
    if (
      q.includes('application active') ||
      q.includes('application ouverte') ||
      q.includes('app en premier plan') ||
      q.includes('sur quelle appli')
    ) {
      const app = snapshot.activeApp;
      if (app.permissionGranted && app.appName) {
        const reply = `### 📱 Application en Premier Plan\n\n- **Application** : **${app.appName}**\n- **Package Android** : \`${app.packageName}\`\n- **Catégorie** : *${app.category}*\n- **Active depuis** : ${app.foregroundDurationSec} secondes`;
        const spokenSummary = `L'application actuellement au premier plan est ${app.appName}.`;
        return {
          handled: true,
          intent: 'active_app_status',
          reply,
          spokenSummary,
          suggestedAgentId: 'android',
          contextUsed: ['app'],
          confidence: 0.95,
        };
      } else {
        return {
          handled: true,
          intent: 'active_app_permission_needed',
          reply: `L'accès à l'application active nécessite la permission **APPLICATION_LAUNCH / Accessibilité**. Actuellement non autorisée.`,
          spokenSummary: `La détection de l'application active n'est pas autorisée.`,
          suggestedAgentId: 'android',
          contextUsed: ['app'],
          confidence: 0.9,
        };
      }
    }

    return {
      handled: false,
      intent: 'general_query',
      contextUsed: ['time', 'device', 'preferences'],
      confidence: 0.5,
    };
  }

  // =========================================================================
  // HELPER FORMATTERS
  // =========================================================================

  private buildMarkdownSummary(data: any): string {
    const { time, device, location, activeApp, notifications, agenda, routines, isPrivateMode } = data;

    let md = `### 🧭 Aperçu du Contexte JARVIS\n\n`;
    md += `- 🕒 **Heure & Date** : ${time.dateFormatted} à ${time.timeFormatted} (${time.periodOfDay})\n`;
    md += `- 🔋 **Batterie** : ${device.batteryLevel}% (${device.isCharging ? 'En charge' : 'Sur batterie'})\n`;
    md += `- 📶 **Réseau** : ${device.network.type.toUpperCase()} (${device.network.isOnline ? 'En ligne' : 'Hors ligne'})\n`;

    if (location.permissionGranted && location.city) {
      md += `- 📍 **Localisation** : ${location.city}, ${location.country || 'France'} (Autorisée)\n`;
    } else {
      md += `- 📍 **Localisation** : *Non autorisée / Masquée*\n`;
    }

    if (activeApp.permissionGranted && activeApp.appName) {
      md += `- 📱 **App Active** : ${activeApp.appName} (\`${activeApp.packageName}\`)\n`;
    }

    md += `- 📅 **Agenda** : ${agenda.todayEventsCount} événement(s), ${agenda.pendingTasksCount} tâche(s) en attente\n`;

    if (notifications.permissionGranted && notifications.unreadCount > 0) {
      md += `- 🔔 **Notifications** : ${notifications.unreadCount} non lue(s)\n`;
    }

    if (routines.activeRoutineName) {
      md += `- ⚡ **Routine active** : ${routines.activeRoutineName}\n`;
    }

    if (isPrivateMode) {
      md += `- 🛡️ **Mode Privé** : ACTIF (Télémétrie coupée)\n`;
    }

    return md;
  }

  private buildSpokenSummary(data: any): string {
    const { time, device, location, agenda } = data;
    const parts: string[] = [];

    parts.push(`Il est ${time.timeFormatted}. `);
    if (location.permissionGranted && location.city) {
      parts.push(`Vous êtes à ${location.city}. `);
    }

    if (agenda.todayEventsCount > 0) {
      parts.push(`Vous avez ${agenda.todayEventsCount} événement${agenda.todayEventsCount > 1 ? 's' : ''} aujourd'hui. `);
    }

    if (device.batteryLevel < 20 && !device.isCharging) {
      parts.push(`Attention, votre batterie est faible à ${device.batteryLevel} pour cent.`);
    }

    return parts.join('');
  }

  private buildSystemPromptFragment(data: any): string {
    const { time, device, location, activeApp, notifications, agenda, preferences } = data;

    return `
[JARVIS AUTHORIZED CONTEXT]
- Current Local Time: ${time.dateFormatted}, ${time.timeFormatted} (${time.timezone})
- Period of Day: ${time.periodOfDay} (Weekend: ${time.isWeekend ? 'Yes' : 'No'})
- Device State: Battery ${device.batteryLevel}% (${device.isCharging ? 'Charging' : 'Discharging'}), Network ${device.network.type} (Online: ${device.network.isOnline})
- Authorized Location: ${location.permissionGranted ? `${location.city || 'Paris'}, ${location.country || 'France'} (Lat: ${location.latitude}, Lon: ${location.longitude})` : 'Permission Denied / Hidden'}
- Foreground Android App: ${activeApp.permissionGranted ? `${activeApp.appName} (${activeApp.packageName})` : 'Unknown / Permission Denied'}
- Notifications: ${notifications.unreadCount} unread (${notifications.urgentCount} urgent)
- Today Agenda: ${agenda.todayEventsCount} events, ${agenda.pendingTasksCount} pending tasks (${agenda.urgentTasksCount} urgent), ${agenda.activeRemindersCount} active reminders
- User Preferences: Language=${preferences.language}, Persona=${preferences.persona}, ConciseMode=${preferences.conciseMode}
`;
  }
}

export const contextEngine = ContextEngine.getInstance();
