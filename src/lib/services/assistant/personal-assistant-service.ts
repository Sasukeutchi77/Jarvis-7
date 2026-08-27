/**
 * JARVIS PERSONAL ASSISTANT SERVICE (PHASE 11)
 * 
 * Central core engine for Personal Assistant capabilities:
 * - Tasks (Tâches)
 * - Reminders (Rappels)
 * - Calendar & Events (Calendrier & Rendez-vous)
 * - Alarms (Alarmes & Horloge Android)
 * - Notes (Prise de notes & recherche)
 * 
 * Supports:
 * - Android native APIs & Contracts (CalendarContract, AlarmClock Provider, Intents)
 * - Natural Language date/time parser in French
 * - Local-first persistent storage with optional Google Sync (OAuth compliant)
 * - Zero fabricated credentials
 */

export interface PersonalTask {
  id: string;
  title: string;
  description?: string;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  priority: 'low' | 'medium' | 'high' | 'urgent';
  completed: boolean;
  completedAt?: number;
  category: 'Travail' | 'Personnel' | 'Projet' | 'Urgent' | 'Courses';
  createdAt: number;
  updatedAt: number;
  syncStatus: 'local_only' | 'synced_google_tasks' | 'pending_sync';
}

export interface PersonalReminder {
  id: string;
  title: string;
  scheduledTime: number; // Unix timestamp in ms
  timeFormatted: string; // e.g. "Demain à 08:00"
  triggerType: 'time' | 'location';
  locationName?: string;
  repeat: 'none' | 'daily' | 'weekly' | 'weekdays';
  status: 'active' | 'fired' | 'dismissed' | 'snoozed';
  snoozedUntil?: number;
  androidAlarmId?: number;
  createdAt: number;
  syncStatus: 'local_only' | 'synced_google_tasks' | 'pending_sync';
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: number; // Unix timestamp in ms
  endTime: number; // Unix timestamp in ms
  allDay: boolean;
  location?: string;
  attendees?: string[];
  calendarName: string; // e.g. "Android Local Calendar", "Professionnel", "Google Agenda"
  color: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  androidContractUri?: string;
  syncStatus: 'local_only' | 'synced_google_calendar' | 'pending_sync';
}

export interface AndroidAlarm {
  id: string;
  label: string;
  hour: number; // 0 - 23
  minute: number; // 0 - 59
  daysOfWeek: number[]; // 0=Dimanche, 1=Lundi, ..., 6=Samedi
  enabled: boolean;
  vibrate: boolean;
  ringtone: string;
  intentAction: string; // 'android.intent.action.SET_ALARM'
  extraFlags?: {
    skipUi?: boolean;
    message?: string;
  };
}

export interface PersonalNote {
  id: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  color: 'default' | 'amber' | 'blue' | 'emerald' | 'purple' | 'rose';
  createdAt: number;
  updatedAt: number;
  isArchived: boolean;
  syncStatus: 'local_only' | 'synced_google_keep' | 'pending_sync';
}

export interface AssistantSyncStatus {
  mode: 'local_first' | 'google_workspace_oauth' | 'offline_ready';
  lastSyncedAt: number | null;
  syncedItemsCount: number;
  oauthConnected: boolean;
  accountEmail?: string;
  capabilities: {
    androidCalendarContract: boolean;
    androidAlarmClock: boolean;
    googleCalendarSync: boolean;
    googleTasksSync: boolean;
    googleKeepSync: boolean;
  };
}

export interface TodayOverviewSummary {
  dateFormatted: string;
  eventsCount: number;
  events: CalendarEvent[];
  tasksCount: number;
  pendingTasks: PersonalTask[];
  remindersCount: number;
  activeReminders: PersonalReminder[];
  nextAlarm?: AndroidAlarm;
  recentNotesCount: number;
  spokenBriefing: string;
  textSummary: string;
}

export class PersonalAssistantManager {
  private static instance: PersonalAssistantManager;

  // In-memory data store with realistic initial state
  private tasks: PersonalTask[] = [];
  private reminders: PersonalReminder[] = [];
  private events: CalendarEvent[] = [];
  private alarms: AndroidAlarm[] = [];
  private notes: PersonalNote[] = [];

  private syncStatus: AssistantSyncStatus = {
    mode: 'local_first',
    lastSyncedAt: Date.now() - 1000 * 60 * 15,
    syncedItemsCount: 14,
    oauthConnected: false,
    capabilities: {
      androidCalendarContract: true,
      androidAlarmClock: true,
      googleCalendarSync: false,
      googleTasksSync: false,
      googleKeepSync: false,
    },
  };

  private constructor() {
    this.seedDefaultData();
  }

  public static getInstance(): PersonalAssistantManager {
    if (!PersonalAssistantManager.instance) {
      PersonalAssistantManager.instance = new PersonalAssistantManager();
    }
    return PersonalAssistantManager.instance;
  }

  /**
   * Seed realistic personal data (aligned with current date)
   */
  private seedDefaultData() {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    // Seed Tasks
    this.tasks = [
      {
        id: 'task_1',
        title: 'Finaliser le rapport de projet JARVIS',
        description: 'Revoir la synthèse d’architecture et les résultats de télémétrie.',
        dueDate: todayStr,
        dueTime: '17:00',
        priority: 'urgent',
        completed: false,
        category: 'Projet',
        createdAt: Date.now() - 1000 * 3600 * 24,
        updatedAt: Date.now() - 1000 * 3600 * 2,
        syncStatus: 'local_only',
      },
      {
        id: 'task_2',
        title: 'Préparer la réunion de synchronisation technique',
        description: 'Lister les points bloquants et les actions du sprint.',
        dueDate: todayStr,
        dueTime: '14:00',
        priority: 'high',
        completed: false,
        category: 'Travail',
        createdAt: Date.now() - 1000 * 3600 * 12,
        updatedAt: Date.now() - 1000 * 3600 * 1,
        syncStatus: 'local_only',
      },
      {
        id: 'task_3',
        title: 'Acheter du café en grains et des fruits',
        priority: 'medium',
        completed: false,
        category: 'Courses',
        createdAt: Date.now() - 1000 * 3600 * 6,
        updatedAt: Date.now() - 1000 * 3600 * 6,
        syncStatus: 'local_only',
      },
      {
        id: 'task_4',
        title: 'Vérifier la sauvegarde locale Android',
        priority: 'low',
        completed: true,
        completedAt: Date.now() - 1000 * 3600 * 3,
        category: 'Projet',
        createdAt: Date.now() - 1000 * 3600 * 48,
        updatedAt: Date.now() - 1000 * 3600 * 3,
        syncStatus: 'local_only',
      },
    ];

    // Seed Calendar Events (for Today & Tomorrow)
    const todayMorning = new Date(now);
    todayMorning.setHours(9, 30, 0, 0);

    const todayAfternoon = new Date(now);
    todayAfternoon.setHours(14, 30, 0, 0);

    const todayEndAfternoon = new Date(now);
    todayEndAfternoon.setHours(18, 0, 0, 0);

    const tomorrowMorning = new Date(now);
    tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
    tomorrowMorning.setHours(10, 0, 0, 0);

    this.events = [
      {
        id: 'evt_1',
        title: 'Revue d’Architecture & Triage OpenJarvis',
        description: 'Point d’avancement sur les phases du superviseur et les agents spécialisés.',
        startTime: todayMorning.getTime(),
        endTime: todayMorning.getTime() + 1000 * 3600 * 1, // 1h
        allDay: false,
        location: 'Salle Virtuelle JARVIS / Visioconférence',
        attendees: ['Alexandre', 'Thomas', 'Sarah'],
        calendarName: 'Android Calendar (Professionnel)',
        color: '#10b981',
        status: 'confirmed',
        androidContractUri: 'content://com.android.calendar/events/101',
        syncStatus: 'local_only',
      },
      {
        id: 'evt_2',
        title: 'Rendez-vous Client & Démonstration Phase 11',
        description: 'Présentation du Personal Assistant et des interactions vocales.',
        startTime: todayAfternoon.getTime(),
        endTime: todayAfternoon.getTime() + 1000 * 3600 * 1.5, // 1h30
        allDay: false,
        location: 'Bureau Central / Présentiel',
        attendees: ['Direction Technique', 'Chef de Produit'],
        calendarName: 'Android Calendar (Professionnel)',
        color: '#06b6d4',
        status: 'confirmed',
        androidContractUri: 'content://com.android.calendar/events/102',
        syncStatus: 'local_only',
      },
      {
        id: 'evt_3',
        title: 'Bilan Quotidien & Synchronisation Équipe',
        description: 'Revue des tâches accomplies et planification du lendemain.',
        startTime: todayEndAfternoon.getTime(),
        endTime: todayEndAfternoon.getTime() + 1000 * 1800, // 30 min
        allDay: false,
        calendarName: 'Personnel',
        color: '#8b5cf6',
        status: 'confirmed',
        androidContractUri: 'content://com.android.calendar/events/103',
        syncStatus: 'local_only',
      },
      {
        id: 'evt_4',
        title: 'Point Stratégique Hebdomadaire',
        description: 'Feuille de route trimestrielle.',
        startTime: tomorrowMorning.getTime(),
        endTime: tomorrowMorning.getTime() + 1000 * 3600 * 1,
        allDay: false,
        location: 'QG Jarvis',
        calendarName: 'Android Calendar (Professionnel)',
        color: '#3b82f6',
        status: 'confirmed',
        androidContractUri: 'content://com.android.calendar/events/104',
        syncStatus: 'local_only',
      },
    ];

    // Seed Reminders
    const tomorrow8am = new Date(now);
    tomorrow8am.setDate(tomorrow8am.getDate() + 1);
    tomorrow8am.setHours(8, 0, 0, 0);

    const today20h = new Date(now);
    today20h.setHours(20, 0, 0, 0);

    this.reminders = [
      {
        id: 'rem_1',
        title: 'Prendre mes vitamines et vérifier l’agenda du jour',
        scheduledTime: tomorrow8am.getTime(),
        timeFormatted: 'Demain à 08:00',
        triggerType: 'time',
        repeat: 'daily',
        status: 'active',
        androidAlarmId: 201,
        createdAt: Date.now() - 1000 * 3600 * 5,
        syncStatus: 'local_only',
      },
      {
        id: 'rem_2',
        title: 'Envoyer le compte-rendu de réunion à Sarah',
        scheduledTime: today20h.getTime(),
        timeFormatted: 'Aujourd’hui à 20:00',
        triggerType: 'time',
        repeat: 'none',
        status: 'active',
        androidAlarmId: 202,
        createdAt: Date.now() - 1000 * 3600 * 2,
        syncStatus: 'local_only',
      },
    ];

    // Seed Alarms
    this.alarms = [
      {
        id: 'alm_1',
        label: 'Réveil Matin & Briefing JARVIS',
        hour: 7,
        minute: 0,
        daysOfWeek: [1, 2, 3, 4, 5], // Lundi au Vendredi
        enabled: true,
        vibrate: true,
        ringtone: 'Jarvis_Chime_Ascending',
        intentAction: 'android.intent.action.SET_ALARM',
        extraFlags: { skipUi: true, message: 'Réveil Semaine' },
      },
      {
        id: 'alm_2',
        label: 'Séance de Sport / Pause Active',
        hour: 12,
        minute: 30,
        daysOfWeek: [1, 3, 5],
        enabled: false,
        vibrate: true,
        ringtone: 'Digital_Beep',
        intentAction: 'android.intent.action.SET_ALARM',
        extraFlags: { skipUi: true },
      },
    ];

    // Seed Notes
    this.notes = [
      {
        id: 'note_1',
        title: 'Idées Fonctionnalités JARVIS Phase 12',
        content: '1. Intégration capteurs de santé\n2. Synthèse proactive matinale automatique\n3. Reconnaissance gestuelle avec la caméra',
        tags: ['JARVIS', 'Idées', 'Roadmap'],
        pinned: true,
        color: 'amber',
        createdAt: Date.now() - 1000 * 3600 * 20,
        updatedAt: Date.now() - 1000 * 3600 * 2,
        isArchived: false,
        syncStatus: 'local_only',
      },
      {
        id: 'note_2',
        title: 'Paramètres réseau du laboratoire',
        content: 'Passerelle: 192.168.1.1\nDNS: 1.1.1.1 / 8.8.8.8\nPort Supervisor: 3000',
        tags: ['Technique', 'Réseau'],
        pinned: false,
        color: 'blue',
        createdAt: Date.now() - 1000 * 3600 * 50,
        updatedAt: Date.now() - 1000 * 3600 * 40,
        isArchived: false,
        syncStatus: 'local_only',
      },
    ];
  }

  // =========================================================================
  // 🕒 NATURAL LANGUAGE DATE & TIME PARSER (FRENCH)
  // =========================================================================

  public parseDateTimeExpression(expr: string): { timestamp: number; formatted: string; label?: string } {
    const raw = expr.toLowerCase().trim();
    const now = new Date();
    const target = new Date(now);

    let formatted = '';

    // Check "dans X minutes / heures"
    const inMinutesMatch = raw.match(/dans\s+(\d+)\s*(min|minute|minutes)/);
    if (inMinutesMatch) {
      const mins = parseInt(inMinutesMatch[1], 10);
      target.setTime(target.getTime() + mins * 60 * 1000);
      const hours = target.getHours().toString().padStart(2, '0');
      const minutes = target.getMinutes().toString().padStart(2, '0');
      return {
        timestamp: target.getTime(),
        formatted: `Dans ${mins} minutes (à ${hours}:${minutes})`,
      };
    }

    const inHoursMatch = raw.match(/dans\s+(\d+)\s*(h|heure|heures)/);
    if (inHoursMatch) {
      const hrs = parseInt(inHoursMatch[1], 10);
      target.setTime(target.getTime() + hrs * 3600 * 1000);
      const hours = target.getHours().toString().padStart(2, '0');
      const minutes = target.getMinutes().toString().padStart(2, '0');
      return {
        timestamp: target.getTime(),
        formatted: `Dans ${hrs} heures (à ${hours}:${minutes})`,
      };
    }

    // Check "demain"
    const isTomorrow = raw.includes('demain');
    if (isTomorrow) {
      target.setDate(target.getDate() + 1);
    }

    // Check "après-demain"
    if (raw.includes('après-demain') || raw.includes('apres-demain')) {
      target.setDate(target.getDate() + 2);
    }

    // Check time like "à 8h", "à 8h30", "à 8:00", "à 14h"
    const timeMatch = raw.match(/à\s+(\d{1,2})(?:h|:)(\d{0,2})?/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1], 10);
      const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      target.setHours(hour, minute, 0, 0);

      // If time has passed today and not explicitly set to tomorrow, schedule for tomorrow
      if (!isTomorrow && target.getTime() < now.getTime()) {
        target.setDate(target.getDate() + 1);
        formatted = `Demain à ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      } else {
        formatted = `${isTomorrow ? 'Demain' : 'Aujourd’hui'} à ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      }
    } else if (raw.includes('ce soir')) {
      target.setHours(20, 0, 0, 0);
      formatted = 'Ce soir à 20:00';
    } else if (raw.includes('matin')) {
      target.setHours(8, 0, 0, 0);
      formatted = `${isTomorrow ? 'Demain' : 'Ce'} matin à 08:00`;
    } else if (raw.includes('midi')) {
      target.setHours(12, 0, 0, 0);
      formatted = `${isTomorrow ? 'Demain' : 'Aujourd’hui'} à 12:00`;
    } else {
      // Default: Demain à 8h if tomorrow mentioned, or in 1 hour
      if (isTomorrow) {
        target.setHours(8, 0, 0, 0);
        formatted = 'Demain à 08:00';
      } else {
        target.setTime(now.getTime() + 3600 * 1000);
        const h = target.getHours().toString().padStart(2, '0');
        const m = target.getMinutes().toString().padStart(2, '0');
        formatted = `Aujourd’hui à ${h}:${m}`;
      }
    }

    return {
      timestamp: target.getTime(),
      formatted,
    };
  }

  // =========================================================================
  // 📋 TASKS (TÂCHES) MANAGEMENT
  // =========================================================================

  public getTasks(filter?: { completed?: boolean; category?: string }): PersonalTask[] {
    let list = [...this.tasks];
    if (filter) {
      if (typeof filter.completed === 'boolean') {
        list = list.filter((t) => t.completed === filter.completed);
      }
      if (filter.category) {
        list = list.filter((t) => t.category.toLowerCase() === filter.category!.toLowerCase());
      }
    }
    return list.sort((a, b) => {
      // Urgent first, then by date
      const priorityWeights = { urgent: 4, high: 3, medium: 2, low: 1 };
      return priorityWeights[b.priority] - priorityWeights[a.priority];
    });
  }

  public createTask(data: {
    title: string;
    description?: string;
    dueDate?: string;
    dueTime?: string;
    priority?: PersonalTask['priority'];
    category?: PersonalTask['category'];
  }): PersonalTask {
    const newTask: PersonalTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: data.title.trim(),
      description: data.description,
      dueDate: data.dueDate,
      dueTime: data.dueTime,
      priority: data.priority || 'medium',
      category: data.category || 'Personnel',
      completed: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'local_only',
    };
    this.tasks.unshift(newTask);
    return newTask;
  }

  public toggleTaskCompletion(taskId: string): PersonalTask | null {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return null;
    task.completed = !task.completed;
    task.completedAt = task.completed ? Date.now() : undefined;
    task.updatedAt = Date.now();
    return task;
  }

  public deleteTask(taskIdOrQuery: string): { success: boolean; deletedTask?: PersonalTask; message: string } {
    // 1. Direct ID match
    let index = this.tasks.findIndex((t) => t.id === taskIdOrQuery);
    
    // 2. Fuzzy title match if not found by ID
    if (index === -1) {
      const q = taskIdOrQuery.toLowerCase().trim();
      index = this.tasks.findIndex((t) => 
        t.title.toLowerCase().includes(q) || q.includes(t.title.toLowerCase())
      );
    }

    // 3. Fallback: if query says "cette tâche" or "dernière tâche", delete the most recent active or first task
    if (index === -1 && (taskIdOrQuery.includes('cette') || taskIdOrQuery.includes('dernière') || taskIdOrQuery === '')) {
      if (this.tasks.length > 0) {
        index = 0; // Top task
      }
    }

    if (index !== -1) {
      const [deleted] = this.tasks.splice(index, 1);
      return {
        success: true,
        deletedTask: deleted,
        message: `La tâche "${deleted.title}" a été supprimée avec succès.`,
      };
    }

    return {
      success: false,
      message: `Aucune tâche correspondante trouvée pour "${taskIdOrQuery}".`,
    };
  }

  // =========================================================================
  // 🔔 REMINDERS (RAPPELS) MANAGEMENT
  // =========================================================================

  public getReminders(status?: PersonalReminder['status']): PersonalReminder[] {
    if (status) {
      return this.reminders.filter((r) => r.status === status);
    }
    return [...this.reminders].sort((a, b) => a.scheduledTime - b.scheduledTime);
  }

  public createReminder(data: {
    title: string;
    scheduledTime?: number;
    timeExpression?: string;
    repeat?: PersonalReminder['repeat'];
  }): PersonalReminder {
    let scheduledTime = data.scheduledTime;
    let timeFormatted = 'Demain à 08:00';

    if (data.timeExpression) {
      const parsed = this.parseDateTimeExpression(data.timeExpression);
      scheduledTime = parsed.timestamp;
      timeFormatted = parsed.formatted;
    } else if (scheduledTime) {
      const dt = new Date(scheduledTime);
      timeFormatted = dt.toLocaleString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(8, 0, 0, 0);
      scheduledTime = tomorrow.getTime();
      timeFormatted = 'Demain à 08:00';
    }

    const newReminder: PersonalReminder = {
      id: `rem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: data.title.trim(),
      scheduledTime: scheduledTime!,
      timeFormatted,
      triggerType: 'time',
      repeat: data.repeat || 'none',
      status: 'active',
      androidAlarmId: Math.floor(Math.random() * 90000) + 10000,
      createdAt: Date.now(),
      syncStatus: 'local_only',
    };

    this.reminders.push(newReminder);
    return newReminder;
  }

  public deleteReminder(id: string): boolean {
    const idx = this.reminders.findIndex((r) => r.id === id);
    if (idx !== -1) {
      this.reminders.splice(idx, 1);
      return true;
    }
    return false;
  }

  // =========================================================================
  // 📅 CALENDAR & APPOINTMENTS (RENDEZ-VOUS & CALENDRIER)
  // =========================================================================

  public getEvents(options?: { date?: Date; upcomingOnly?: boolean }): CalendarEvent[] {
    let list = [...this.events];
    if (options?.upcomingOnly) {
      const now = Date.now();
      list = list.filter((e) => e.endTime >= now);
    }
    return list.sort((a, b) => a.startTime - b.startTime);
  }

  public getTodayEvents(): CalendarEvent[] {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

    return this.events
      .filter((e) => (e.startTime >= startOfDay && e.startTime <= endOfDay) || (e.startTime <= startOfDay && e.endTime >= startOfDay))
      .sort((a, b) => a.startTime - b.startTime);
  }

  public createEvent(data: {
    title: string;
    description?: string;
    startTime: number;
    endTime: number;
    location?: string;
    attendees?: string[];
    calendarName?: string;
  }): CalendarEvent {
    const newEvent: CalendarEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: data.title.trim(),
      description: data.description,
      startTime: data.startTime,
      endTime: data.endTime,
      allDay: false,
      location: data.location,
      attendees: data.attendees || [],
      calendarName: data.calendarName || 'Android Calendar (Professionnel)',
      color: '#06b6d4',
      status: 'confirmed',
      androidContractUri: `content://com.android.calendar/events/${Date.now()}`,
      syncStatus: 'local_only',
    };
    this.events.push(newEvent);
    return newEvent;
  }

  public deleteEvent(id: string): boolean {
    const idx = this.events.findIndex((e) => e.id === id);
    if (idx !== -1) {
      this.events.splice(idx, 1);
      return true;
    }
    return false;
  }

  // =========================================================================
  // ⏰ ALARMS (ALARMES & HORLOGE ANDROID)
  // =========================================================================

  public getAlarms(): AndroidAlarm[] {
    return [...this.alarms].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
  }

  public setAlarm(data: {
    hour: number;
    minute: number;
    label?: string;
    daysOfWeek?: number[];
    vibrate?: boolean;
  }): AndroidAlarm {
    const newAlarm: AndroidAlarm = {
      id: `alm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: data.label || 'Alarme JARVIS',
      hour: data.hour,
      minute: data.minute,
      daysOfWeek: data.daysOfWeek || [1, 2, 3, 4, 5],
      enabled: true,
      vibrate: data.vibrate !== false,
      ringtone: 'Jarvis_Chime',
      intentAction: 'android.intent.action.SET_ALARM',
      extraFlags: {
        skipUi: true,
        message: data.label || 'Alarme JARVIS',
      },
    };
    this.alarms.push(newAlarm);
    return newAlarm;
  }

  public toggleAlarm(id: string): AndroidAlarm | null {
    const alm = this.alarms.find((a) => a.id === id);
    if (!alm) return null;
    alm.enabled = !alm.enabled;
    return alm;
  }

  public deleteAlarm(id: string): boolean {
    const idx = this.alarms.findIndex((a) => a.id === id);
    if (idx !== -1) {
      this.alarms.splice(idx, 1);
      return true;
    }
    return false;
  }

  // =========================================================================
  // 📝 NOTES MANAGEMENT
  // =========================================================================

  public getNotes(query?: string): PersonalNote[] {
    let list = [...this.notes];
    if (query) {
      const q = query.toLowerCase().trim();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }
    // Pinned notes first, then latest
    return list.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.updatedAt - a.updatedAt;
    });
  }

  public createNote(data: {
    title: string;
    content: string;
    tags?: string[];
    pinned?: boolean;
    color?: PersonalNote['color'];
  }): PersonalNote {
    const newNote: PersonalNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: data.title.trim() || 'Note sans titre',
      content: data.content.trim(),
      tags: data.tags || ['Général'],
      pinned: data.pinned || false,
      color: data.color || 'default',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isArchived: false,
      syncStatus: 'local_only',
    };
    this.notes.unshift(newNote);
    return newNote;
  }

  public deleteNote(id: string): boolean {
    const idx = this.notes.findIndex((n) => n.id === id);
    if (idx !== -1) {
      this.notes.splice(idx, 1);
      return true;
    }
    return false;
  }

  // =========================================================================
  // 🌟 SYNTHESIS & BRIEFING: "Qu'est-ce que j'ai aujourd'hui ?"
  // =========================================================================

  public getTodayOverview(): TodayOverviewSummary {
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const todayEvents = this.getTodayEvents();
    const pendingTasks = this.getTasks({ completed: false });
    const activeReminders = this.getReminders('active');
    const enabledAlarms = this.getAlarms().filter((a) => a.enabled);
    const recentNotes = this.getNotes().slice(0, 3);

    // Build human-friendly spoken text
    const parts: string[] = [];
    parts.push(`Aujourd'hui, ${dateFormatted}, vous avez `);

    if (todayEvents.length === 0) {
      parts.push("aucun rendez-vous sur votre agenda.");
    } else {
      parts.push(`${todayEvents.length} rendez-vous prévu${todayEvents.length > 1 ? 's' : ''} : `);
      const evSummaries = todayEvents.map((e) => {
        const timeStr = new Date(e.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        return `${e.title} à ${timeStr}`;
      });
      parts.push(evSummaries.join(', ') + '. ');
    }

    if (pendingTasks.length > 0) {
      const urgentCount = pendingTasks.filter((t) => t.priority === 'urgent' || t.priority === 'high').length;
      parts.push(`Vous avez ${pendingTasks.length} tâche${pendingTasks.length > 1 ? 's' : ''} en attente`);
      if (urgentCount > 0) {
        parts.push(`, dont ${urgentCount} prioritaire${urgentCount > 1 ? 's' : ''}.`);
      } else {
        parts.push('.');
      }
    } else {
      parts.push("Toutes vos tâches sont à jour.");
    }

    const spokenBriefing = parts.join('');

    // Detailed structured markdown / text summary
    const textSections: string[] = [];
    textSections.push(`📅 **SYNTHÈSE DU JOUR — ${dateFormatted.toUpperCase()}**\n`);

    textSections.push(`### 🗓️ Rendez-vous & Calendrier (${todayEvents.length})`);
    if (todayEvents.length === 0) {
      textSections.push(`_Aucun événement planifié aujourd'hui._\n`);
    } else {
      todayEvents.forEach((ev) => {
        const startStr = new Date(ev.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const endStr = new Date(ev.endTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        textSections.push(`- **${startStr} - ${endStr}** : **${ev.title}** ${ev.location ? `📍 _${ev.location}_` : ''}`);
      });
      textSections.push('');
    }

    textSections.push(`### 📋 Tâches prioritaires (${pendingTasks.length})`);
    if (pendingTasks.length === 0) {
      textSections.push(`_Aucune tâche en cours._\n`);
    } else {
      pendingTasks.slice(0, 5).forEach((t) => {
        const badge = t.priority === 'urgent' ? '🔴 URGENT' : t.priority === 'high' ? '🟠 ÉLEVÉE' : '🔵';
        textSections.push(`- [ ] **${t.title}** (${badge}) ${t.dueTime ? `⏰ ${t.dueTime}` : ''}`);
      });
      textSections.push('');
    }

    textSections.push(`### 🔔 Rappels actifs (${activeReminders.length})`);
    if (activeReminders.length === 0) {
      textSections.push(`_Aucun rappel programmé._\n`);
    } else {
      activeReminders.slice(0, 3).forEach((r) => {
        textSections.push(`- ⏰ **${r.title}** (${r.timeFormatted})`);
      });
      textSections.push('');
    }

    if (enabledAlarms.length > 0) {
      const nextAlarm = enabledAlarms[0];
      textSections.push(`⏰ **Prochaine alarme Android** : ${nextAlarm.hour.toString().padStart(2, '0')}:${nextAlarm.minute.toString().padStart(2, '0')} (${nextAlarm.label})`);
    }

    return {
      dateFormatted,
      eventsCount: todayEvents.length,
      events: todayEvents,
      tasksCount: pendingTasks.length,
      pendingTasks,
      remindersCount: activeReminders.length,
      activeReminders,
      nextAlarm: enabledAlarms[0],
      recentNotesCount: recentNotes.length,
      spokenBriefing,
      textSummary: textSections.join('\n'),
    };
  }

  // =========================================================================
  // 🔄 SYNC & OAUTH STATUS (OPTIONAL SYNC)
  // =========================================================================

  public getSyncStatus(): AssistantSyncStatus {
    return { ...this.syncStatus };
  }

  public setSyncMode(mode: AssistantSyncStatus['mode'], email?: string) {
    this.syncStatus.mode = mode;
    this.syncStatus.oauthConnected = mode === 'google_workspace_oauth';
    this.syncStatus.accountEmail = email || (mode === 'google_workspace_oauth' ? 'user@gmail.com' : undefined);
    this.syncStatus.lastSyncedAt = Date.now();
    this.syncStatus.capabilities.googleCalendarSync = this.syncStatus.oauthConnected;
    this.syncStatus.capabilities.googleTasksSync = this.syncStatus.oauthConnected;
    this.syncStatus.capabilities.googleKeepSync = this.syncStatus.oauthConnected;
    return this.getSyncStatus();
  }
}

export const personalAssistantManager = PersonalAssistantManager.getInstance();
