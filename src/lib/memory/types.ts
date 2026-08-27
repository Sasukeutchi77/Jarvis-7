/**
 * MEMORY SYSTEM ARCHITECTURE TYPES (Phase 7 - Long-Term Memory System)
 * 
 * Multi-layer memory architecture:
 * 1. Short-Term Memory (Context of active turn & ephemeral state)
 * 2. Long-Term Memory (Persistent episodic memories & stored facts)
 * 3. Semantic Memory (Vector embeddings, concepts, semantic associations)
 * 4. User Preferences (Explicit instructions, constraints, stylistic choices)
 * 5. Project Memory (Codebases, architecture decisions, active goals)
 * 6. Temporary Memory (Working scratchpads, TTL-based session notes)
 */

export type MemoryTier = 
  | 'short_term' 
  | 'long_term' 
  | 'semantic' 
  | 'user_preferences' 
  | 'project' 
  | 'temporary';

export type MemoryCategory =
  | 'PREFERENCE'
  | 'PROJECT'
  | 'IMPORTANT_FACT'
  | 'HABIT'
  | 'USER_PROFILE'
  | 'CONVERSATION_CONTEXT'
  | 'AUTOMATION_NOTE'
  | 'TEMPORARY_SCRATCHPAD';

export interface MemoryEntry {
  id: string;
  tier: MemoryTier;
  category: MemoryCategory;
  title?: string;
  content: string;
  tags: string[];
  source: string; // e.g. 'Explicit User Voice ("JARVIS, retiens ceci")', 'Project Notes', etc.
  importanceScore: number; // 0.0 to 1.0
  confidenceScore: number; // 0.0 to 1.0
  isExplicit: boolean; // True if manually requested ("JARVIS retiens ceci"), false if auto-detected
  isEncrypted: boolean;
  expiresAt?: number | null; // TTL for temporary memory
  metadata?: Record<string, any>;
  embedding?: number[]; // Vector representation for semantic search
  createdAt: number;
  updatedAt: number;
  lastAccessedAt?: number;
  accessCount?: number;
}

export interface SemanticSearchResult {
  entry: MemoryEntry;
  similarity: number; // 0.0 to 1.0
  matchedTerms: string[];
  relevanceExplanation?: string;
}

export interface MemoryStats {
  totalCount: number;
  byTier: Record<MemoryTier, number>;
  byCategory: Record<MemoryCategory, number>;
  explicitCount: number;
  encryptedCount: number;
  activeProjectsCount: number;
  systemEnabled: boolean;
  vectorBackend: string;
  storageUsageKb: number;
  lastSavedAt: number;
}

export interface VectorStoreAdapter {
  id: string;
  name: string;
  isReady: () => boolean;
  generateEmbedding: (text: string) => Promise<number[]>;
  searchSimilar: (queryEmbedding: number[], topK?: number, minScore?: number) => Promise<Array<{ id: string; score: number }>>;
  upsertVector: (id: string, embedding: number[], metadata?: Record<string, any>) => Promise<void>;
  deleteVector: (id: string) => Promise<void>;
}

export interface ProjectMemoryContext {
  projectId: string;
  projectName: string;
  description: string;
  architectureHighlights: string[];
  activeMilestones: string[];
  techStack: string[];
  keyDecisions: string[];
  updatedAt: number;
}
