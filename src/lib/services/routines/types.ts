/**
 * JARVIS SMART ROUTINES & AUTOMATIONS (PHASE 12)
 * Types and interfaces for RoutineEngine, TriggerManager, ActionManager & RoutineScheduler.
 */

export type RoutineTriggerType =
  | 'time'
  | 'day'
  | 'location'
  | 'event'
  | 'notification'
  | 'user_action';

export interface TimeTriggerConfig {
  time: string; // HH:mm (e.g. "07:30", "22:00")
  timezone?: string;
  exactAlarm?: boolean; // Uses AlarmManager.setExactAndAllowWhileIdle
}

export interface DayTriggerConfig {
  days: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[];
  preset?: 'weekdays' | 'weekends' | 'all' | 'custom';
}

export interface LocationTriggerConfig {
  latitude?: number;
  longitude?: number;
  radiusMeters?: number; // Geofence radius
  locationName: string; // e.g. "Maison", "Bureau", "Salle de Sport"
  transition: 'enter' | 'exit' | 'dwell';
  dwellTimeSeconds?: number;
}

export interface EventTriggerConfig {
  eventType: 'calendar_event_start' | 'alarm_dismissed' | 'battery_level' | 'headset_connected' | 'car_bluetooth_connected';
  filterKey?: string;
  filterValue?: string | number;
}

export interface NotificationTriggerConfig {
  packageName?: string; // e.g. "com.whatsapp", "com.google.android.gm"
  keywordFilter?: string; // e.g. "Urgent", "Alerte", "Réunion"
  senderFilter?: string;
}

export interface UserActionTriggerConfig {
  voicePhrases: string[]; // e.g. ["lance le mode matin", "active la routine du matin", "bonjour jarvis"]
  shortcutName?: string;
  widgetId?: string;
  nfcTagId?: string;
}

export interface RoutineTrigger {
  id: string;
  type: RoutineTriggerType;
  label: string;
  enabled: boolean;
  timeConfig?: TimeTriggerConfig;
  dayConfig?: DayTriggerConfig;
  locationConfig?: LocationTriggerConfig;
  eventConfig?: EventTriggerConfig;
  notificationConfig?: NotificationTriggerConfig;
  userActionConfig?: UserActionTriggerConfig;
}

export type RoutineActionType =
  | 'weather_briefing'
  | 'calendar_digest'
  | 'important_messages'
  | 'tasks_review'
  | 'voice_briefing'
  | 'device_settings'
  | 'app_launcher'
  | 'smart_home_toggle'
  | 'alarm_set'
  | 'dnd_toggle'
  | 'sensitive_action';

export interface WeatherActionParams {
  city?: string;
  includeHourly?: boolean;
  includeAlerts?: boolean;
}

export interface CalendarActionParams {
  timeframe: 'today' | 'tomorrow' | 'next_meeting';
  calendarFilter?: string[];
  maxEvents?: number;
}

export interface MessagesActionParams {
  sources: ('email' | 'sms' | 'chat' | 'calls')[];
  unreadOnly: boolean;
  urgentOnly: boolean;
  limit?: number;
}

export interface TasksActionParams {
  scope: 'today_pending' | 'tomorrow_plan' | 'urgent_only';
  categoryFilter?: string;
  autoScheduleUncompleted?: boolean;
}

export interface VoiceBriefingParams {
  template?: string;
  tone?: 'formal' | 'concise' | 'energetic' | 'calm';
  autoSpeak?: boolean;
  customIntro?: string;
}

export interface DeviceSettingsParams {
  dnd?: boolean;
  volumePercent?: number;
  vibrateMode?: 'silent' | 'vibrate' | 'normal';
  screenBrightnessPercent?: number;
  wifi?: boolean;
  bluetooth?: boolean;
  batterySaver?: boolean;
  darkTheme?: boolean;
}

export interface AppLauncherParams {
  authorizedApps?: { name: string; packageName: string }[];
  primaryAppToLaunch?: { name: string; packageName: string };
  blockNonAuthorizedApps?: boolean;
}

export interface SmartHomeParams {
  deviceId?: string;
  deviceType?: 'light' | 'thermostat' | 'lock' | 'all_lights';
  room?: string;
  state?: boolean;
  value?: number;
}

export interface SensitiveActionParams {
  actionIdentifier: string; // e.g. "wipe_cache", "emergency_broadcast", "disable_security_alarms", "send_auto_sms"
  description: string;
  targetPayload: Record<string, any>;
  riskLevel: 'medium' | 'high' | 'critical';
}

export interface RoutineAction {
  id: string;
  type: RoutineActionType;
  name: string;
  description: string;
  order: number;
  enabled: boolean;
  isSensitive: boolean;
  params: Record<string, any>;
  lastStatus?: 'pending' | 'success' | 'failed' | 'requires_confirmation' | 'skipped';
  lastExecutionResult?: any;
}

export interface SmartRoutine {
  id: string;
  name: string;
  presetKey?: 'morning' | 'work' | 'night' | 'custom';
  description: string;
  icon: string; // Lucide icon identifier (e.g. 'Sun', 'Briefcase', 'Moon', 'Sparkles')
  color: string; // Hex color (e.g. '#6366f1', '#f59e0b', '#3b82f6')
  enabled: boolean;
  isBuiltin: boolean;
  triggers: RoutineTrigger[];
  actions: RoutineAction[];
  executionPolicy: {
    stopOnError: boolean;
    parallelExecutionAllowed: boolean;
    requireBiometricConfirmationForSensitive: boolean;
    wakeScreenOnRun: boolean;
    keepForegroundNotification: boolean;
  };
  stats: {
    runCount: number;
    lastRunAt: number | null;
    lastRunStatus: 'success' | 'warning' | 'error' | null;
    lastDurationMs: number | null;
  };
  createdAt: number;
  updatedAt: number;
}

export interface RoutineExecutionStepLog {
  actionId: string;
  actionName: string;
  actionType: RoutineActionType;
  status: 'started' | 'success' | 'failed' | 'requires_confirmation' | 'skipped';
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  result?: any;
  error?: string;
  confirmationRequired?: {
    token: string;
    description: string;
    riskLevel: 'medium' | 'high' | 'critical';
    expiresAt: number;
  };
}

export interface RoutineExecutionReport {
  executionId: string;
  routineId: string;
  routineName: string;
  triggerSource: string; // e.g. "manual_ui", "voice_command", "time_alarm_07:30", "geofence_bureau"
  startedAt: number;
  completedAt: number;
  totalDurationMs: number;
  status: 'success' | 'partial' | 'failed' | 'awaiting_confirmation';
  steps: RoutineExecutionStepLog[];
  spokenBriefing?: string;
  pendingConfirmations?: {
    token: string;
    actionId: string;
    description: string;
    riskLevel: 'medium' | 'high' | 'critical';
  }[];
}

export interface AndroidSchedulerStatus {
  serviceState: 'active' | 'standby' | 'restricted';
  workManagerJobsCount: number;
  exactAlarmsRegistered: number;
  geofencesActive: number;
  batteryOptimizationIgnored: boolean;
  dozeModeCompliant: boolean;
  activeForegroundRoutines: string[];
  systemConstraints: {
    networkConnected: boolean;
    charging: boolean;
    batteryLevel: number;
    powerSaveMode: boolean;
  };
}
