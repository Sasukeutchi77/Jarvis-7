/**
 * JARVIS CONTEXT AWARENESS ENGINE — TYPES & SCHEMAS (PHASE 14)
 * 
 * Defines all data models, provider contracts, snapshot structures,
 * permission gating, and battery optimization policies for Context Awareness.
 */

import { PermissionKey } from '../security/types.js';

export type ContextSource =
  | 'time'
  | 'device'
  | 'location'
  | 'app'
  | 'notifications'
  | 'agenda'
  | 'preferences'
  | 'routines';

export interface TimeContext {
  timestamp: number;
  iso: string;
  timeFormatted: string; // e.g. "15:42"
  dateFormatted: string; // e.g. "Lundi 24 Août 2026"
  dayOfWeek: string;     // e.g. "Lundi"
  dayOfMonth: number;    // e.g. 24
  monthName: string;     // e.g. "Août"
  year: number;          // e.g. 2026
  periodOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  isWeekend: boolean;
  timezone: string;
}

export interface DeviceNetworkState {
  type: 'wifi' | 'cellular_5g' | 'cellular_4g' | 'cellular_3g' | 'offline' | 'ethernet' | 'unknown';
  ssid?: string;
  isMetered: boolean;
  isOnline: boolean;
  signalStrengthPct: number;
}

export interface DeviceScreenState {
  isScreenOn: boolean;
  brightnessPct: number;
  orientation: 'portrait' | 'landscape';
}

export interface DeviceAudioState {
  ringerMode: 'normal' | 'vibrate' | 'silent';
  mediaVolumePct: number;
  headsetConnected: boolean;
  bluetoothAudioConnected: boolean;
}

export interface DeviceContext {
  batteryLevel: number; // 0 - 100
  isCharging: boolean;
  powerSaveMode: boolean;
  temperatureC?: number;
  network: DeviceNetworkState;
  screen: DeviceScreenState;
  audio: DeviceAudioState;
}

export interface LocationContext {
  permissionGranted: boolean;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  city?: string;
  locality?: string;
  country?: string;
  timezone?: string;
  source: 'gps' | 'network' | 'simulated' | 'none';
  lastUpdated?: number;
}

export interface ActiveAppContext {
  permissionGranted: boolean;
  packageName?: string;
  appName?: string;
  windowTitle?: string;
  category?: 'communication' | 'media' | 'productivity' | 'navigation' | 'system' | 'tools' | 'other';
  foregroundDurationSec?: number;
}

export interface NotificationItem {
  id: string;
  appName: string;
  packageName: string;
  title: string;
  snippet: string;
  timestamp: number;
  isUrgent?: boolean;
}

export interface NotificationContext {
  permissionGranted: boolean;
  unreadCount: number;
  urgentCount: number;
  recentNotifications: NotificationItem[];
}

export interface AgendaEventItem {
  id: string;
  title: string;
  time: string;
  startTime: number;
  endTime: number;
  location?: string;
  calendarName: string;
}

export interface AgendaTaskItem {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueTime?: string;
  category: string;
}

export interface AgendaContext {
  todayEventsCount: number;
  todayEvents: AgendaEventItem[];
  nextEvent?: AgendaEventItem & { minutesUntil: number };
  pendingTasksCount: number;
  urgentTasksCount: number;
  topTasks: AgendaTaskItem[];
  activeRemindersCount: number;
  nextReminder?: { id: string; title: string; timeFormatted: string; scheduledTime: number };
  enabledAlarmsCount: number;
  nextAlarm?: { id: string; label: string; timeFormatted: string; hour: number; minute: number };
  holisticDailyBriefing: string;
}

export interface UserPreferenceContext {
  language: string;
  persona: string;
  conciseMode: boolean;
  privacyMode: boolean;
  homeCity: string;
  workHours: { start: string; end: string };
  favoriteApps: string[];
}

export interface RoutineContext {
  activeRoutineId?: string;
  activeRoutineName?: string;
  lastExecutedRoutine?: { name: string; timestamp: number; success: boolean };
  nextScheduledRoutine?: { name: string; scheduledTime: string; triggerSummary: string };
  availableRoutinesCount: number;
}

export interface ContextFreshness {
  cached: boolean;
  cacheAgeMs: number;
  batteryOptimized: boolean;
  ttlMs: number;
  generatedAt: number;
}

export interface ContextSnapshot {
  id: string;
  timestamp: number;
  isoDate: string;
  freshness: ContextFreshness;
  time: TimeContext;
  device: DeviceContext;
  location: LocationContext;
  activeApp: ActiveAppContext;
  notifications: NotificationContext;
  agenda: AgendaContext;
  preferences: UserPreferenceContext;
  routines: RoutineContext;
  permissions: Record<string, boolean>;
  summary: string;
  spokenSummary: string;
  systemPromptFragment: string;
}

export interface ContextProvider<T = any> {
  readonly source: ContextSource;
  readonly name: string;
  readonly description: string;
  readonly requiredPermission?: PermissionKey;
  isEnabled(): boolean;
  setEnabled(enabled: boolean): void;
  fetchContext(options?: { forceRefresh?: boolean }): Promise<T>;
}

export interface ContextEngineConfig {
  cacheTtlMs: number;               // Default: 30000 (30 seconds)
  batterySaverCacheTtlMs: number;   // Default: 120000 (2 minutes)
  batterySaverEnabled: boolean;     // Adaptive low-power throttling
  autoRefreshOnQuery: boolean;      // Pull on demand when user sends query
  proactiveAwareness: boolean;      // Enable context-based proactive suggestions
  disabledSources: ContextSource[]; // Explicitly excluded providers
}
