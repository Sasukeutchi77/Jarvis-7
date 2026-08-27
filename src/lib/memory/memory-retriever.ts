/**
 * MEMORY RETRIEVER (Phase 7 - Long-Term Memory System)
 * 
 * Provides hybrid search capabilities:
 * 1. Semantic Vector Similarity (Cosine distance via vector embeddings)
 * 2. Keyword / Token Exact Match (BM25-style term intersection)
 * 3. Temporal & Importance Recency Weighting
 * 4. Contextual Project & Preference Extraction
 */

import { MemoryEntry, MemoryTier, MemoryCategory, SemanticSearchResult } from './types.js';
import { memoryStore } from './memory-store.js';
import { localVectorStore } from './vector-store.js';

export class MemoryRetriever {
  /**
   * Retrieves the most relevant memories using hybrid vector + keyword scoring
   */
  public async search(params: {
    query: string;
    topK?: number;
    tier?: MemoryTier;
    category?: MemoryCategory;
    minScore?: number;
    requireExplicit?: boolean;
  }): Promise<SemanticSearchResult[]> {
    const { query, topK = 5, tier, category, minScore = 0.25, requireExplicit = false } = params;
    if (!query || !query.trim()) {
      return this.getRecentRelevant(topK, tier, category);
    }

    const cleanQuery = query.toLowerCase().trim();
    const queryTokens = cleanQuery.split(/\s+/).filter(t => t.length > 2);

    // 1. Generate Query Vector & Perform Vector Similarity Search
    const queryEmbedding = await localVectorStore.generateEmbedding(cleanQuery);
    const vectorMatches = await localVectorStore.searchSimilar(queryEmbedding, 20, 0.1);
    const vectorScoreMap = new Map<string, number>();
    vectorMatches.forEach(m => vectorScoreMap.set(m.id, m.score));

    // 2. Fetch candidates from store
    let allEntries = memoryStore.getAllEntries();

    if (tier) {
      allEntries = allEntries.filter(e => e.tier === tier);
    }
    if (category) {
      allEntries = allEntries.filter(e => e.category === category);
    }
    if (requireExplicit) {
      allEntries = allEntries.filter(e => e.isExplicit);
    }

    // 3. Compute Composite Score (Vector 60% + Keyword 30% + Importance 10%)
    const results: SemanticSearchResult[] = [];

    for (const entry of allEntries) {
      const vectorScore = vectorScoreMap.get(entry.id) || 0;
      
      // Keyword matching
      const contentLower = entry.content.toLowerCase();
      const titleLower = (entry.title || '').toLowerCase();
      const tagsLower = entry.tags.map(t => t.toLowerCase());

      let matchedTerms: string[] = [];
      let keywordHits = 0;

      for (const token of queryTokens) {
        if (contentLower.includes(token) || titleLower.includes(token) || tagsLower.includes(token)) {
          matchedTerms.push(token);
          keywordHits++;
        }
      }

      const keywordScore = queryTokens.length > 0 ? (keywordHits / queryTokens.length) : 0;
      const importanceBoost = (entry.importanceScore || 0.5) * 0.1;

      // Composite similarity score
      const finalScore = (vectorScore * 0.6) + (keywordScore * 0.3) + importanceBoost;

      if (finalScore >= minScore || matchedTerms.length > 0) {
        let explanation = '';
        if (vectorScore > 0.6) {
          explanation = 'Correspondance sémantique forte';
        } else if (matchedTerms.length > 0) {
          explanation = `Mots-clés trouvés : ${matchedTerms.join(', ')}`;
        } else {
          explanation = 'Contexte associatif';
        }

        results.push({
          entry,
          similarity: Math.min(1.0, Number(finalScore.toFixed(3))),
          matchedTerms,
          relevanceExplanation: explanation,
        });
      }
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }

  /**
   * Retrieves contextual knowledge for answering specific queries about projects, habits, or user profile
   */
  public async getRelevantContextForPrompt(query: string, maxTokens: number = 500): Promise<string> {
    const matches = await this.search({ query, topK: 4, minScore: 0.35 });
    if (matches.length === 0) return '';

    const lines = ['[CONNAISSANCES & MÉMOIRE JARVIS RETENUES EXPLICITEMENT] :'];
    for (const m of matches) {
      lines.push(`- (${m.entry.category}) ${m.entry.content}`);
    }
    return lines.join('\n');
  }

  /**
   * Fallback retrieval for recent memories
   */
  private getRecentRelevant(topK: number, tier?: MemoryTier, category?: MemoryCategory): SemanticSearchResult[] {
    let entries = memoryStore.getAllEntries();
    if (tier) entries = entries.filter(e => e.tier === tier);
    if (category) entries = entries.filter(e => e.category === category);

    return entries.slice(0, topK).map(entry => ({
      entry,
      similarity: entry.importanceScore || 0.8,
      matchedTerms: [],
      relevanceExplanation: 'Souvenir récent ou prioritaire',
    }));
  }
}

export const memoryRetriever = new MemoryRetriever();
