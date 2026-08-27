/**
 * MEMORY STORE (Phase 7 - Long-Term Memory System)
 * 
 * Persistent and tiered storage engine for JARVIS memories:
 * - Short-Term Memory (volatile/session)
 * - Long-Term Memory (durable)
 * - Semantic Memory (vector indexed)
 * - User Preferences (explicitly retained rules)
 * - Project Memory (context of developer projects)
 * - Temporary Memory (ephemeral working memory)
 * 
 * Includes encryption tagging, security redactions and export/import.
 */

import { MemoryEntry, MemoryTier, MemoryCategory, MemoryStats, ProjectMemoryContext } from './types.js';
import { localVectorStore } from './vector-store.js';
import { redactSecrets } from '../services/security-redactor.js';

const STORAGE_KEY = 'jarvis_memory_store_v2';
const PROJECT_STORAGE_KEY = 'jarvis_project_memory_v2';

export class MemoryStore {
  private entries: Map<string, MemoryEntry> = new Map();
  private projectContexts: Map<string, ProjectMemoryContext> = new Map();
  private systemEnabled: boolean = true;
  private isInitialized: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') {
      this.seedInitialMemories();
      this.seedInitialProjects();
      this.isInitialized = true;
      return;
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: MemoryEntry[] = JSON.parse(saved);
        parsed.forEach(entry => {
          this.entries.set(entry.id, entry);
          if (entry.embedding && entry.embedding.length > 0) {
            localVectorStore.upsertVector(entry.id, entry.embedding, { tier: entry.tier, category: entry.category });
          }
        });
      } else {
        // Seed initial standard memories
        this.seedInitialMemories();
      }

      const savedProjects = localStorage.getItem(PROJECT_STORAGE_KEY);
      if (savedProjects) {
        const parsed: ProjectMemoryContext[] = JSON.parse(savedProjects);
        parsed.forEach(proj => this.projectContexts.set(proj.projectId, proj));
      } else {
        this.seedInitialProjects();
      }

      this.isInitialized = true;
    } catch (e) {
      console.warn('[MemoryStore] Failed to load memories from localStorage:', e);
      this.seedInitialMemories();
      this.seedInitialProjects();
    }
  }

  private seedInitialMemories() {
    const defaultEntries: Omit<MemoryEntry, 'embedding'>[] = [
      {
        id: 'mem_pref_lang',
        tier: 'user_preferences',
        category: 'PREFERENCE',
        title: 'Langue & Style de Communication',
        content: "L'utilisateur préfère que JARVIS s'exprime en français, avec un ton concis, respectueux et direct (« Monsieur »).",
        tags: ['langue', 'style', 'vocal', 'politesse'],
        source: 'Préférences Système (Initialisation)',
        importanceScore: 1.0,
        confidenceScore: 1.0,
        isExplicit: true,
        isEncrypted: false,
        createdAt: Date.now() - 86400000 * 5,
        updatedAt: Date.now() - 86400000 * 5,
      },
      {
        id: 'mem_pref_briefing',
        tier: 'user_preferences',
        category: 'HABIT',
        title: 'Habitude du Briefing Matinal',
        content: "Briefing exécutif quotidien configuré à 08h00 avec météo, calendrier, batterie et état des sous-systèmes.",
        tags: ['briefing', 'matin', 'agenda', 'meteo'],
        source: 'Habitude Explicitée',
        importanceScore: 0.9,
        confidenceScore: 0.95,
        isExplicit: true,
        isEncrypted: false,
        createdAt: Date.now() - 86400000 * 3,
        updatedAt: Date.now() - 86400000 * 3,
      },
      {
        id: 'mem_proj_openjarvis',
        tier: 'project',
        category: 'PROJECT',
        title: 'Projet OpenJarvis Stark Core',
        content: "OpenJarvis est une architecture d'assistant IA personnel souverain multi-agents pour Android 15 et Web, intégrant vision, voix, mémoire sémantique et contrôle d'appareils.",
        tags: ['openjarvis', 'architecture', 'agents', 'android', 'react', 'typescript'],
        source: 'Projet Développeur Actif',
        importanceScore: 1.0,
        confidenceScore: 1.0,
        isExplicit: true,
        isEncrypted: false,
        createdAt: Date.now() - 86400000 * 2,
        updatedAt: Date.now() - 86400000 * 2,
      },
      {
        id: 'mem_fact_user_profile',
        tier: 'long_term',
        category: 'USER_PROFILE',
        title: 'Profil Développeur Principal',
        content: "L'utilisateur est le Super Administrateur & Architecte Principal du système JARVIS.",
        tags: ['profil', 'administrateur', 'identite'],
        source: 'Profil Sécurisé',
        importanceScore: 0.95,
        confidenceScore: 1.0,
        isExplicit: true,
        isEncrypted: true,
        createdAt: Date.now() - 86400000 * 4,
        updatedAt: Date.now() - 86400000 * 4,
      }
    ];

    defaultEntries.forEach(async (entry) => {
      const embedding = await localVectorStore.generateEmbedding(entry.content + ' ' + entry.tags.join(' '));
      const fullEntry: MemoryEntry = { ...entry, embedding };
      this.entries.set(fullEntry.id, fullEntry);
      localVectorStore.upsertVector(fullEntry.id, embedding, { tier: fullEntry.tier, category: fullEntry.category });
    });

    this.persist();
  }

  private seedInitialProjects() {
    const p1: ProjectMemoryContext = {
      projectId: 'proj_openjarvis',
      projectName: 'OpenJarvis Android & Web',
      description: 'Assistant IA autonome, superviseur multi-agents, vision par ordinateur, mémoire sémantique et exécution locale souveraine.',
      architectureHighlights: [
        'Supervisor Agent orchestrant les sous-agents spécialisés',
        'Long-Term Memory avec vecteur sémantique local',
        'Screen Context Agent (MediaProjection / Accessibility) respectant FLAG_SECURE',
        'Android Bridge pour le contrôle matériel (Bluetooth, Wifi, DND, AlarmManager)'
      ],
      activeMilestones: [
        'Phase 6 : Screen Context Agent (Terminé)',
        'Phase 7 : Long-Term Memory System (En cours)',
        'Phase 8 : Optimisation On-Device & Sécurité Renforcée'
      ],
      techStack: ['TypeScript', 'React 18', 'Tailwind CSS', 'Vite', 'Express', 'Gemini AI API'],
      keyDecisions: [
        'Zéro mémorisation automatique invasive des conversations (Autorité explicite utilisateur)',
        'Isolation stricte des données bancaires et des mots de passe',
        'Indexation vectorielle hybride sans dépendance externe obligatoire'
      ],
      updatedAt: Date.now(),
    };
    this.projectContexts.set(p1.projectId, p1);
    this.persistProjects();
  }

  private persist() {
    if (typeof window === 'undefined') return;
    try {
      const list = Array.from(this.entries.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('[MemoryStore] Failed to persist memories:', e);
    }
  }

  private persistProjects() {
    if (typeof window === 'undefined') return;
    try {
      const list = Array.from(this.projectContexts.values());
      localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('[MemoryStore] Failed to persist projects:', e);
    }
  }

  // --- CRUD Operations ---

  public async addEntry(params: {
    content: string;
    tier?: MemoryTier;
    category?: MemoryCategory;
    title?: string;
    tags?: string[];
    source?: string;
    importanceScore?: number;
    isExplicit?: boolean;
    isEncrypted?: boolean;
    expiresAt?: number | null;
    metadata?: Record<string, any>;
  }): Promise<MemoryEntry> {
    const id = `mem_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const content = redactSecrets(params.content.trim());
    const tier = params.tier || (params.category === 'PREFERENCE' ? 'user_preferences' : params.category === 'PROJECT' ? 'project' : 'long_term');
    const category = params.category || (tier === 'user_preferences' ? 'PREFERENCE' : tier === 'project' ? 'PROJECT' : 'IMPORTANT_FACT');
    const tags = params.tags || this.extractAutomaticTags(content);

    // Generate vector embedding
    const embedding = await localVectorStore.generateEmbedding(`${content} ${tags.join(' ')}`);

    const entry: MemoryEntry = {
      id,
      tier,
      category,
      title: params.title || (content.length > 40 ? content.slice(0, 38) + '...' : content),
      content,
      tags,
      source: params.source || 'Enregistrement Manuel',
      importanceScore: params.importanceScore ?? 0.85,
      confidenceScore: 1.0,
      isExplicit: params.isExplicit ?? true,
      isEncrypted: Boolean(params.isEncrypted),
      expiresAt: params.expiresAt || null,
      metadata: params.metadata || {},
      embedding,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      accessCount: 0,
    };

    this.entries.set(id, entry);
    await localVectorStore.upsertVector(id, embedding, { tier, category });
    this.persist();

    return entry;
  }

  public async updateEntry(id: string, updates: Partial<Omit<MemoryEntry, 'id' | 'createdAt'>>): Promise<MemoryEntry | null> {
    const existing = this.entries.get(id);
    if (!existing) return null;

    const updated: MemoryEntry = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    if (updates.content || updates.tags) {
      const textToEmbed = `${updated.content} ${updated.tags.join(' ')}`;
      updated.embedding = await localVectorStore.generateEmbedding(textToEmbed);
      await localVectorStore.upsertVector(id, updated.embedding, { tier: updated.tier, category: updated.category });
    }

    this.entries.set(id, updated);
    this.persist();
    return updated;
  }

  public async deleteEntry(id: string): Promise<boolean> {
    const existed = this.entries.delete(id);
    if (existed) {
      await localVectorStore.deleteVector(id);
      this.persist();
    }
    return existed;
  }

  public async clearAll(): Promise<void> {
    const keys = Array.from(this.entries.keys());
    for (const key of keys) {
      await localVectorStore.deleteVector(key);
    }
    this.entries.clear();
    this.persist();
  }

  public getEntry(id: string): MemoryEntry | null {
    const e = this.entries.get(id);
    if (e) {
      e.accessCount = (e.accessCount || 0) + 1;
      e.lastAccessedAt = Date.now();
    }
    return e || null;
  }

  public getAllEntries(): MemoryEntry[] {
    return Array.from(this.entries.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public getAll(): MemoryEntry[] {
    return this.getAllEntries();
  }

  public async saveMemory(params: {
    content: string;
    tier?: MemoryTier;
    category?: MemoryCategory;
    title?: string;
    tags?: string[];
    source?: string;
    importanceScore?: number;
    isExplicit?: boolean;
    isEncrypted?: boolean;
    expiresAt?: number | null;
    metadata?: Record<string, any>;
  }): Promise<MemoryEntry> {
    return this.addEntry(params);
  }

  public async deleteMemory(id: string): Promise<boolean> {
    return this.deleteEntry(id);
  }

  public getEntriesByTier(tier: MemoryTier): MemoryEntry[] {
    return this.getAllEntries().filter(e => e.tier === tier);
  }

  public getEntriesByCategory(category: MemoryCategory): MemoryEntry[] {
    return this.getAllEntries().filter(e => e.category === category);
  }

  // --- Project Contexts ---
  public getProjects(): ProjectMemoryContext[] {
    return Array.from(this.projectContexts.values());
  }

  public getProject(projectId: string): ProjectMemoryContext | null {
    return this.projectContexts.get(projectId) || null;
  }

  public saveProject(context: ProjectMemoryContext): void {
    this.projectContexts.set(context.projectId, { ...context, updatedAt: Date.now() });
    this.persistProjects();
  }

  public deleteProject(projectId: string): boolean {
    const res = this.projectContexts.delete(projectId);
    this.persistProjects();
    return res;
  }

  // --- System Configuration & Stats ---
  public isSystemEnabled(): boolean {
    return this.systemEnabled;
  }

  public setSystemEnabled(enabled: boolean): void {
    this.systemEnabled = enabled;
  }

  public getStats(): MemoryStats {
    const all = this.getAllEntries();
    const byTier: Record<MemoryTier, number> = {
      short_term: 0,
      long_term: 0,
      semantic: 0,
      user_preferences: 0,
      project: 0,
      temporary: 0,
    };
    const byCategory: Record<MemoryCategory, number> = {
      PREFERENCE: 0,
      PROJECT: 0,
      IMPORTANT_FACT: 0,
      HABIT: 0,
      USER_PROFILE: 0,
      CONVERSATION_CONTEXT: 0,
      AUTOMATION_NOTE: 0,
      TEMPORARY_SCRATCHPAD: 0,
    };

    let explicitCount = 0;
    let encryptedCount = 0;

    all.forEach(e => {
      if (byTier[e.tier] !== undefined) byTier[e.tier]++;
      if (byCategory[e.category] !== undefined) byCategory[e.category]++;
      if (e.isExplicit) explicitCount++;
      if (e.isEncrypted) encryptedCount++;
    });

    const totalJson = JSON.stringify(all);
    const storageUsageKb = Number((new Blob([totalJson]).size / 1024).toFixed(2));

    return {
      totalCount: all.length,
      byTier,
      byCategory,
      explicitCount,
      encryptedCount,
      activeProjectsCount: this.projectContexts.size,
      systemEnabled: this.systemEnabled,
      vectorBackend: localVectorStore.name,
      storageUsageKb,
      lastSavedAt: Date.now(),
    };
  }

  private extractAutomaticTags(text: string): string[] {
    const tags = new Set<string>();
    const lower = text.toLowerCase();
    const commonTokens = ['openjarvis', 'stark', 'android', 'react', 'preference', 'projet', 'habitude', 'briefing', 'securite', 'vocal', 'api', 'code'];
    for (const t of commonTokens) {
      if (lower.includes(t)) tags.add(t);
    }
    return Array.from(tags);
  }
}

export const memoryStore = new MemoryStore();
