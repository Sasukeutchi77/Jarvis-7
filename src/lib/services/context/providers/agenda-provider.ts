/**
 * AGENDA, TASKS & REMINDERS CONTEXT PROVIDER (PHASE 14)
 * 
 * Aggregates calendar events, pending tasks, active reminders, and alarms
 * from personalAssistantManager to answer queries like "Qu'est-ce que j'ai aujourd'hui ?".
 */

import { ContextProvider, AgendaContext, ContextSource } from '../types.js';
import { personalAssistantManager } from '../../assistant/personal-assistant-service.js';

export class AgendaContextProvider implements ContextProvider<AgendaContext> {
  public readonly source: ContextSource = 'agenda';
  public readonly name = 'Agenda, Tâches & Rappels';
  public readonly description = 'Agrège les événements du calendrier, les tâches urgentes, les rappels et les alarmes actives.';
  private enabled: boolean = true;

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public async fetchContext(): Promise<AgendaContext> {
    const todayOverview = personalAssistantManager.getTodayOverview();
    const todayEvents = personalAssistantManager.getTodayEvents();
    const pendingTasks = personalAssistantManager.getTasks({ completed: false });
    const urgentTasks = pendingTasks.filter((t) => t.priority === 'urgent' || t.priority === 'high');
    const activeReminders = personalAssistantManager.getReminders('active');
    const enabledAlarms = personalAssistantManager.getAlarms().filter((a) => a.enabled);

    const nowMs = Date.now();

    // Map events
    const mappedEvents = todayEvents.map((e) => ({
      id: e.id,
      title: e.title,
      time: new Date(e.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      startTime: e.startTime,
      endTime: e.endTime,
      location: e.location,
      calendarName: e.calendarName,
    }));

    // Find next upcoming event
    const upcomingEvents = todayEvents.filter((e) => e.startTime > nowMs).sort((a, b) => a.startTime - b.startTime);
    let nextEvent: AgendaContext['nextEvent'];
    if (upcomingEvents.length > 0) {
      const target = upcomingEvents[0];
      const minutesUntil = Math.max(0, Math.round((target.startTime - nowMs) / (1000 * 60)));
      nextEvent = {
        id: target.id,
        title: target.title,
        time: new Date(target.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        startTime: target.startTime,
        endTime: target.endTime,
        location: target.location,
        calendarName: target.calendarName,
        minutesUntil,
      };
    }

    // Top tasks (max 5)
    const topTasks = pendingTasks.slice(0, 5).map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      dueTime: t.dueTime,
      category: t.category,
    }));

    // Next reminder
    let nextReminder: AgendaContext['nextReminder'];
    if (activeReminders.length > 0) {
      const sortedReminders = [...activeReminders].sort((a, b) => a.scheduledTime - b.scheduledTime);
      nextReminder = {
        id: sortedReminders[0].id,
        title: sortedReminders[0].title,
        timeFormatted: sortedReminders[0].timeFormatted,
        scheduledTime: sortedReminders[0].scheduledTime,
      };
    }

    // Next alarm
    let nextAlarm: AgendaContext['nextAlarm'];
    if (enabledAlarms.length > 0) {
      const sortedAlarms = [...enabledAlarms].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
      const a = sortedAlarms[0];
      nextAlarm = {
        id: a.id,
        label: a.label,
        timeFormatted: `${String(a.hour).padStart(2, '0')}:${String(a.minute).padStart(2, '0')}`,
        hour: a.hour,
        minute: a.minute,
      };
    }

    return {
      todayEventsCount: todayEvents.length,
      todayEvents: mappedEvents,
      nextEvent,
      pendingTasksCount: pendingTasks.length,
      urgentTasksCount: urgentTasks.length,
      topTasks,
      activeRemindersCount: activeReminders.length,
      nextReminder,
      enabledAlarmsCount: enabledAlarms.length,
      nextAlarm,
      holisticDailyBriefing: todayOverview.spokenBriefing,
    };
  }
}
