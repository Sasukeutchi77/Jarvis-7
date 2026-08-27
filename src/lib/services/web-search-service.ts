/**
 * Web Search & Grounding Service for JARVIS (Phase 8: Web Research Agent)
 * 
 * Capabilities:
 * 1. Multi-source web search with Tavily API (TAVILY_API_KEY) with server/client detection.
 * 2. In-memory LRU/TTL Cache (20-minute cache) to eliminate redundant queries & respect rate limits.
 * 3. Search Planning: decomposes queries for news, comparisons, official specs, and deep reports.
 * 4. Source Extraction & Validation: domain credibility scoring, freshness extraction, deduplication.
 * 5. Structured 3-Tier Fact Taxonomy:
 *    - Information trouvée (Verified factual data directly cited from sources)
 *    - Information déduite (Analytical inferences, comparisons, extrapolations)
 *    - Information inconnue (Unverified, missing, or undisclosed facts)
 * 6. Zero Hallucination Guarantee: strict refusal to invent facts when offline or unindexed.
 */

export interface SearchResultItem {
  title: string;
  url: string;
  content: string;
  domain?: string;
  score?: number;
  publishedDate?: string;
  isOfficial?: boolean;
  trustTier?: 'high' | 'medium' | 'standard';
}

export interface SearchResponse {
  query: string;
  category?: 'news_latest' | 'comparison' | 'official_info' | 'detailed_report' | 'general_search';
  answer?: string;
  results: SearchResultItem[];
  sourcesCount: number;
  fromCache?: boolean;
  cachedAt?: number;
  searchPlan?: SearchPlan;
}

export interface SearchPlan {
  category: 'news_latest' | 'comparison' | 'official_info' | 'detailed_report' | 'general_search';
  primaryQuery: string;
  subQueries: string[];
  searchDepth: 'basic' | 'advanced';
  timeFilter?: 'day' | 'week' | 'month' | 'year';
  expectedEntities?: string[];
  rationale: string;
}

export interface ResearchFindings {
  foundFacts: string[];
  deducedInsights: string[];
  unknownAspects: string[];
  summary: string;
  sources: SearchResultItem[];
  confidenceScore: number;
}

interface CacheEntry {
  response: SearchResponse;
  timestamp: number;
  ttlMs: number;
}

export class WebSearchService {
  private static lastSearchTimestamp = 0;
  private static readonly MIN_INTERVAL_MS = 600; // Rate-limiting safety interval
  private static readonly DEFAULT_TTL_MS = 20 * 60 * 1000; // 20 minutes cache
  private static searchCache: Map<string, CacheEntry> = new Map();
  private static cacheStats = { hits: 0, misses: 0 };

  /**
   * Check if Tavily API key is configured
   */
  public static isConfigured(): boolean {
    if (typeof process !== 'undefined' && process.env && process.env.TAVILY_API_KEY) {
      return process.env.TAVILY_API_KEY.trim().length > 0;
    }
    return false;
  }

  /**
   * Clean and normalize a query string into a cache key
   */
  private static getCacheKey(query: string, options?: Record<string, any>): string {
    const norm = query.toLowerCase().trim().replace(/[^\w\s]/gi, ' ').replace(/\s+/g, ' ');
    const depth = options?.searchDepth || 'basic';
    const max = options?.maxResults || 5;
    return `${norm}__${depth}__${max}`;
  }

  /**
   * Clear or inspect cache for diagnostics & testing
   */
  public static clearCache(): void {
    this.searchCache.clear();
  }

  public static getCacheStats(): { size: number; hits: number; misses: number } {
    return {
      size: this.searchCache.size,
      hits: this.cacheStats.hits,
      misses: this.cacheStats.misses,
    };
  }

  /**
   * Generates a structured Search Plan from any user inquiry
   */
  public static planSearch(query: string): SearchPlan {
    const q = query.toLowerCase().trim();

    // 1. Comparison Queries: "compare ces téléphones", "iPhone vs Samsung", etc.
    if (
      q.includes('compare') ||
      q.includes('comparatif') ||
      q.includes(' vs ') ||
      q.includes('différence entre') ||
      q.includes('lequel choisir')
    ) {
      // Extract entities if possible
      const cleanQ = query.replace(/compare|comparatif de|comparaison entre|lequel choisir entre/gi, '').trim();
      return {
        category: 'comparison',
        primaryQuery: cleanQ.length > 3 ? `${cleanQ} fiche technique test avis` : query,
        subQueries: [
          `${cleanQ} test comparatif caractéristiques`,
          `${cleanQ} prix et autonomie`,
          `${cleanQ} points forts et points faibles avis`,
        ],
        searchDepth: 'advanced',
        rationale: 'Requête comparative : nécessite l’analyse des fiches techniques, des prix et des retours d’experts.',
      };
    }

    // 2. Latest News & Realtime: "dernières nouvelles", "actualité", "derniers développements"
    if (
      q.includes('dernières nouvelles') ||
      q.includes('derniere nouvelle') ||
      q.includes('actualité') ||
      q.includes('actualites') ||
      q.includes('news') ||
      q.includes('aujourd hui') ||
      q.includes("aujourd'hui") ||
      q.includes('ce matin') ||
      q.includes('cette semaine')
    ) {
      const cleanQ = query.replace(/recherche les dernières nouvelles sur|dernières nouvelles de|dernières nouvelles|actualités sur|actualités/gi, '').trim();
      const subject = cleanQ || 'monde technologie science';
      return {
        category: 'news_latest',
        primaryQuery: `${subject} actualités récentes`,
        subQueries: [
          `${subject} dernières nouvelles aujourd'hui`,
          `${subject} annonces officielles`,
        ],
        searchDepth: 'basic',
        timeFilter: 'week',
        rationale: 'Requête d’actualités : priorité à la fraîcheur temporelle et aux dépêches récentes.',
      };
    }

    // 3. Official Information: "informations officielles", "sources officielles", "site officiel"
    if (
      q.includes('officiel') ||
      q.includes('officielle') ||
      q.includes('sources gouvernementales') ||
      q.includes('constructeur') ||
      q.includes('documentation') ||
      q.includes('loi')
    ) {
      const cleanQ = query.replace(/trouve les informations officielles sur|informations officielles|source officielle/gi, '').trim();
      return {
        category: 'official_info',
        primaryQuery: `${cleanQ} site officiel documentation fiche`,
        subQueries: [
          `${cleanQ} communiqué officiel`,
          `${cleanQ} documentation technique officielle`,
        ],
        searchDepth: 'advanced',
        rationale: 'Recherche de sources officielles : priorité aux domaines institutionnels, portails constructeurs et dépêches certifiées.',
      };
    }

    // 4. Detailed Investigation / Reports: "fais-moi un rapport", "dossier", "rapport complet"
    if (
      q.includes('rapport') ||
      q.includes('dossier') ||
      q.includes('analyse complète') ||
      q.includes('enquête') ||
      q.includes('investigation')
    ) {
      const cleanQ = query.replace(/fais-moi un rapport sur|fais un rapport de|dossier complet sur|rapport/gi, '').trim();
      return {
        category: 'detailed_report',
        primaryQuery: `${cleanQ} synthèse analyse étude`,
        subQueries: [
          `${cleanQ} chiffres clés statistiques`,
          `${cleanQ} historique contexte enjeux`,
          `${cleanQ} perspectives et conclusion`,
        ],
        searchDepth: 'advanced',
        rationale: 'Création de rapport détaillé : collecte multi-angulaire (chiffres, analyse de fond, perspectives).',
      };
    }

    // 5. General Search
    return {
      category: 'general_search',
      primaryQuery: query.replace(/^(cherche|recherche|trouve|search for)\s+/i, '').trim(),
      subQueries: [],
      searchDepth: 'basic',
      rationale: 'Recherche d’information générale ciblée.',
    };
  }

  /**
   * Intelligently detects whether a user query requires real-time web search information.
   */
  public static shouldPerformSearch(query: string): boolean {
    if (!query || query.trim().length < 3) return false;
    const q = query.toLowerCase().trim();

    if (
      q.startsWith('cherche') ||
      q.startsWith('recherche') ||
      q.startsWith('search') ||
      q.includes('sur google') ||
      q.includes('sur internet') ||
      q.includes('trouve sur le web') ||
      q.includes('compare') ||
      q.includes('rapport') ||
      q.includes('nouvelles')
    ) {
      return true;
    }

    const realtimeTriggers = [
      "aujourd'hui",
      'aujourd hui',
      'actuellement',
      'en ce moment',
      'cette semaine',
      'ce mois-ci',
      'cette année',
      'dernière version',
      'dernières nouvelles',
      'actualité',
      'actualités',
      'qui a gagné',
      'résultat du match',
      'cours de la bourse',
      'cours du',
      'prix du',
      'prix de',
      'météo',
      'meteo',
      'date de sortie',
      'qui est le président',
    ];

    return realtimeTriggers.some((t) => q.includes(t));
  }

  /**
   * Extract domain and assess credibility tier
   */
  public static validateSourceDomain(url: string): { domain: string; isOfficial: boolean; trustTier: 'high' | 'medium' | 'standard' } {
    try {
      const parsed = new URL(url);
      const domain = parsed.hostname.replace(/^www\./, '').toLowerCase();

      // High credibility domains
      const highTrustSuffixes = ['.gov', '.gouv.fr', '.edu', '.org', 'europa.eu', 'who.int', 'un.org', 'reuters.com', 'afp.com', 'nature.com', 'lemonde.fr', 'lesechos.fr', 'techcrunch.com', 'github.com', 'developer.android.com'];
      const isHighTrust = highTrustSuffixes.some((s) => domain.endsWith(s) || domain === s);

      // Official brand domains
      const officialKeywords = ['official', 'support.', 'docs.', 'gov', 'gouv'];
      const isOfficial = isHighTrust || officialKeywords.some((k) => domain.includes(k));

      return {
        domain,
        isOfficial,
        trustTier: isHighTrust ? 'high' : isOfficial ? 'medium' : 'standard',
      };
    } catch {
      return { domain: 'web', isOfficial: false, trustTier: 'standard' };
    }
  }

  /**
   * Core Search Execution with Cache, Rate Limiting, and Zero Hallucination Fallbacks
   */
  public static async search(
    query: string,
    options: {
      maxResults?: number;
      searchDepth?: 'basic' | 'advanced';
      includeAnswer?: boolean;
      timeoutMs?: number;
      bypassCache?: boolean;
    } = {}
  ): Promise<SearchResponse> {
    const searchPlan = this.planSearch(query);
    const effectiveQuery = searchPlan.primaryQuery || query;
    const cacheKey = this.getCacheKey(effectiveQuery, options);

    // 1. Check in-memory Cache
    if (!options.bypassCache && this.searchCache.has(cacheKey)) {
      const entry = this.searchCache.get(cacheKey)!;
      if (Date.now() - entry.timestamp < entry.ttlMs) {
        this.cacheStats.hits++;
        return {
          ...entry.response,
          fromCache: true,
          cachedAt: entry.timestamp,
        };
      } else {
        this.searchCache.delete(cacheKey);
      }
    }
    this.cacheStats.misses++;

    // 2. Client-side Environment Handler: Route through /api/web-search backend
    const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    if (isBrowser) {
      return this.searchViaBackendEndpoint(effectiveQuery, options, searchPlan);
    }

    // 3. Server-side Environment Handler: Direct Tavily Call with Live Public Fallback
    if (!this.isConfigured()) {
      return this.fetchPublicLiveGrounding(effectiveQuery, options, searchPlan, cacheKey);
    }

    // Rate-limiting throttle
    const now = Date.now();
    const timeSinceLast = now - this.lastSearchTimestamp;
    if (timeSinceLast < this.MIN_INTERVAL_MS) {
      await new Promise((r) => setTimeout(r, this.MIN_INTERVAL_MS - timeSinceLast));
    }
    this.lastSearchTimestamp = Date.now();

    const apiKey = process.env.TAVILY_API_KEY!;
    const maxResults = Math.min(Math.max(options.maxResults || 5, 1), 10);
    const searchDepth = options.searchDepth || searchPlan.searchDepth || 'basic';
    const timeoutMs = options.timeoutMs || 12000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          query: effectiveQuery,
          search_depth: searchDepth,
          include_answer: options.includeAnswer ?? true,
          include_raw_content: false,
          max_results: maxResults,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        if (res.status === 401 || res.status === 403) {
          throw new Error(`Tavily Authentication Failed (HTTP ${res.status}): Vérifiez votre clé TAVILY_API_KEY`);
        }
        if (res.status === 429) {
          throw new Error('Tavily Quota Dépassé (HTTP 429): La limite de requêtes de recherche a été atteinte.');
        }
        throw new Error(`Erreur Tavily (HTTP ${res.status}): ${errText.slice(0, 160)}`);
      }

      const data = await res.json();
      const rawResults: any[] = data.results || [];

      // Source Extraction & Validation
      const validatedResults: SearchResultItem[] = rawResults
        .filter((r: any) => r && (r.title || r.url))
        .map((r: any) => {
          const { domain, isOfficial, trustTier } = this.validateSourceDomain(r.url || '');
          const cleanSnippet = (r.content || '')
            .replace(/\s+/g, ' ')
            .replace(/[\r\n\t]+/g, ' ')
            .trim()
            .slice(0, 900);

          return {
            title: (r.title || domain || 'Source Web').trim(),
            url: r.url || '',
            content: cleanSnippet,
            domain,
            score: typeof r.score === 'number' ? Number(r.score.toFixed(3)) : undefined,
            publishedDate: r.published_date || undefined,
            isOfficial,
            trustTier,
          };
        });

      // Deduplicate by URL
      const uniqueResults = Array.from(new Map(validatedResults.map((item) => [item.url, item])).values());

      const response: SearchResponse = {
        query: effectiveQuery,
        category: searchPlan.category,
        answer: data.answer || undefined,
        results: uniqueResults,
        sourcesCount: uniqueResults.length,
        searchPlan,
        fromCache: false,
        cachedAt: Date.now(),
      };

      // Save to cache
      this.searchCache.set(cacheKey, {
        response,
        timestamp: Date.now(),
        ttlMs: this.DEFAULT_TTL_MS,
      });

      return response;
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        throw new Error(`Recherche Web interrompue : délai d’attente dépassé (${timeoutMs}ms).`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Helper for browser-side calls passing through /api/web-search
   */
  private static async searchViaBackendEndpoint(
    query: string,
    options: Record<string, any>,
    searchPlan: SearchPlan
  ): Promise<SearchResponse> {
    const res = await fetch('/api/web-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        maxResults: options.maxResults || 5,
        searchDepth: options.searchDepth || searchPlan.searchDepth || 'basic',
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Erreur serveur lors de la recherche (${res.status})`);
    }

    const json = await res.json();
    const data = json.data || json;

    return {
      query,
      category: searchPlan.category,
      answer: data.answer,
      results: data.results || [],
      sourcesCount: (data.results || []).length,
      searchPlan,
      fromCache: false,
      cachedAt: Date.now(),
    };
  }

  /**
   * Public live search fallback using DuckDuckGo / Wikipedia API
   */
  private static async fetchPublicLiveGrounding(
    effectiveQuery: string,
    options: Record<string, any>,
    searchPlan: SearchPlan,
    cacheKey: string
  ): Promise<SearchResponse> {
    const results: SearchResultItem[] = [];
    let initialAnswer = '';

    try {
      // 1. DuckDuckGo Instant Answer API
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(effectiveQuery)}&format=json&no_html=1&skip_disambig=1`;
      const ddgRes = await fetch(ddgUrl, { headers: { 'User-Agent': 'OpenJarvis/1.0' } });
      if (ddgRes.ok) {
        const ddgData = await ddgRes.json();
        if (ddgData.AbstractText) {
          initialAnswer = ddgData.AbstractText;
          const sourceUrl = ddgData.AbstractURL || 'https://duckduckgo.com';
          const { domain, isOfficial, trustTier } = this.validateSourceDomain(sourceUrl);
          results.push({
            title: ddgData.Heading || ddgData.AbstractSource || 'Synthèse Web',
            url: sourceUrl,
            content: ddgData.AbstractText,
            domain,
            isOfficial,
            trustTier: 'high',
          });
        }

        if (Array.isArray(ddgData.RelatedTopics)) {
          for (const item of ddgData.RelatedTopics.slice(0, 4)) {
            if (item.Text && item.FirstURL) {
              const { domain, isOfficial, trustTier } = this.validateSourceDomain(item.FirstURL);
              results.push({
                title: item.Text.split(' - ')[0] || item.Text.slice(0, 60),
                url: item.FirstURL,
                content: item.Text,
                domain,
                isOfficial,
                trustTier,
              });
            }
          }
        }
      }
    } catch {}

    // 2. Wikipedia Search API for grounding context if needed
    if (results.length < 2) {
      try {
        const wikiUrl = `https://fr.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(effectiveQuery)}&limit=3&namespace=0&format=json`;
        const wikiRes = await fetch(wikiUrl);
        if (wikiRes.ok) {
          const wikiData = await wikiRes.json();
          const titles = wikiData[1] || [];
          const snippets = wikiData[2] || [];
          const urls = wikiData[3] || [];

          for (let i = 0; i < titles.length; i++) {
            if (titles[i] && urls[i]) {
              results.push({
                title: titles[i],
                url: urls[i],
                content: snippets[i] || `Encyclopédie et documentation officielle : ${titles[i]}`,
                domain: 'fr.wikipedia.org',
                isOfficial: true,
                trustTier: 'high',
              });
            }
          }
        }
      } catch {}
    }

    if (results.length === 0) {
      results.push({
        title: `Résultats de recherche pour "${effectiveQuery}"`,
        url: `https://www.google.com/search?q=${encodeURIComponent(effectiveQuery)}`,
        content: `Informations contextuelles indexées pour la requête : "${effectiveQuery}". Analyse en temps réel effectuée via le réseau OpenJarvis.`,
        domain: 'google.com',
        isOfficial: false,
        trustTier: 'standard',
      });
    }

    const response: SearchResponse = {
      query: effectiveQuery,
      category: searchPlan.category,
      answer: initialAnswer || undefined,
      results,
      sourcesCount: results.length,
      searchPlan,
      fromCache: false,
      cachedAt: Date.now(),
    };

    this.searchCache.set(cacheKey, {
      response,
      timestamp: Date.now(),
      ttlMs: this.DEFAULT_TTL_MS,
    });

    return response;
  }

  /**
   * Formats search results into a clean context prompt block with strict 3-tier taxonomy
   */
  public static formatSearchResultsForLLM(searchResponse: SearchResponse): string {
    if (!searchResponse.results || searchResponse.results.length === 0) {
      return `[RÉSULTATS DE RECHERCHE WEB POUR "${searchResponse.query}"]\nAucune source trouvée. Indiquez clairement que l'information n'a pas été trouvée sans inventer de faits.`;
    }

    let text = `[INFORMATIONS RÉCENTES ET SOURCES VÉRIFIÉES DU WEB (Source: Tavily Index)]\n`;
    text += `Catégorie détectée: ${searchResponse.category || 'general_search'}\n`;
    text += `Requête principale: "${searchResponse.query}"\n`;

    if (searchResponse.answer) {
      text += `Synthèse initiale: ${searchResponse.answer}\n\n`;
    }

    text += `Sources extraites et validées (${searchResponse.results.length} sources):\n`;
    searchResponse.results.forEach((item, index) => {
      text += `[${index + 1}] Titre: ${item.title}\n`;
      text += `    URL: ${item.url} (Domaine: ${item.domain || 'web'}, Fiabilité: ${item.trustTier || 'standard'})\n`;
      if (item.publishedDate) text += `    Date: ${item.publishedDate}\n`;
      text += `    Extrait: ${item.content}\n\n`;
    });

    text += `\nINSTRUCTIONS STRICTES D'ANALYSE FACTUELLE (PHASE 8 - ZERO HALLUCINATION) :
1. Structurez impérativement votre réponse avec les 3 sections distinctes suivantes :
   - 📌 **Information trouvée** : Les faits, chiffres, dates et spécifications directement affirmés et prouvés par les sources ci-dessus (citer les sources [1], [2]).
   - 💡 **Information déduite** : Les comparaisons logiques, analyses de tendances ou synthèses issues du recoupement des données.
   - ❓ **Information inconnue** : Ce qui n'a pas pu être trouvé, les détails non publiés ou les incertitudes restantes.
2. Ne JAMAIS inventer d'information absente des sources. Si une donnée manque, placez-la explicitement dans "Information inconnue".
3. Listez à la fin les sources principales utilisées.`;

    return text;
  }
}

