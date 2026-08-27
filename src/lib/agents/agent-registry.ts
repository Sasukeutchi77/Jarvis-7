/**
 * AGENT REGISTRY (JARVIS Ecosystem Phase 1)
 * 
 * Central registry maintaining all specialized agents, their capabilities,
 * permission levels, tool bounds and live availability.
 */

import { SpecializedAgent, AgentId } from './agent-protocol.js';
import { GeneralAiAgent } from './specialized/general-ai-agent.js';
import { VoiceAgent } from './specialized/voice-agent.js';
import { VisionAgent } from './specialized/vision-agent.js';
import { ScreenAgent } from './specialized/screen-agent.js';
import { AndroidAgent } from './specialized/android-agent.js';
import { AccessibilityAgent } from './specialized/accessibility-agent.js';
import { NotificationAgent } from './specialized/notification-agent.js';
import { CommunicationAgent } from './specialized/communication-agent.js';
import { ResearchAgent } from './specialized/research-agent.js';
import { CodingAgent } from './specialized/coding-agent.js';
import { PhoneAgent } from './specialized/phone-agent.js';
import { CalendarAgent } from './specialized/calendar-agent.js';
import { TaskAgent } from './specialized/task-agent.js';
import { ReminderAgent } from './specialized/reminder-agent.js';
import { NotesAgent } from './specialized/notes-agent.js';
import { RoutineAgent } from './specialized/routine-agent.js';
import { MediaAgent } from './specialized/media-agent.js';
import { SecurityAgent } from './specialized/security-agent.js';
import { MemoryAgent } from './specialized/memory-agent.js';
import { WeatherAgent } from './specialized/weather-agent.js';

export class AgentRegistry {
  private static instance: AgentRegistry;
  private agents: Map<AgentId, SpecializedAgent> = new Map();

  private constructor() {
    this.registerDefaults();
  }

  public static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  private registerDefaults() {
    this.register(new GeneralAiAgent());
    this.register(new VoiceAgent());
    this.register(new VisionAgent());
    this.register(new ScreenAgent());
    this.register(new AndroidAgent());
    this.register(new AccessibilityAgent());
    this.register(new NotificationAgent());
    this.register(new CommunicationAgent());
    this.register(new ResearchAgent());
    this.register(new CodingAgent());
    this.register(new PhoneAgent());
    this.register(new CalendarAgent());
    this.register(new TaskAgent());
    this.register(new ReminderAgent());
    this.register(new NotesAgent());
    this.register(new RoutineAgent());
    this.register(new MediaAgent());
    this.register(new SecurityAgent());
    this.register(new MemoryAgent());
    this.register(new WeatherAgent());
  }

  public register(agent: SpecializedAgent) {
    this.agents.set(agent.id, agent);
  }

  public getAgent(id: AgentId): SpecializedAgent | undefined {
    return this.agents.get(id);
  }

  public getAllAgents(): SpecializedAgent[] {
    return Array.from(this.agents.values());
  }

  public getAgentSummaries() {
    return this.getAllAgents().map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      permissionLevel: a.permissionLevel,
      capabilitiesCount: a.capabilities.length,
      capabilities: a.capabilities,
      allowedTools: a.allowedTools.map((t) => t.name),
    }));
  }
}

export const agentRegistry = AgentRegistry.getInstance();
