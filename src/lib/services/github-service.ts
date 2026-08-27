/**
 * GITHUB SERVICE & REPOSITORY INTROSPECTION ENGINE (Phase 9: Coding Agent)
 * 
 * Secure GitHub integration for JARVIS:
 * - Read-only operations allowed by default (analyze repo, read files, dependencies, issues).
 * - Mutating operations (modification, commit, push, deletion, create issue) REQUIRE explicit confirmation.
 * - GITHUB_TOKEN is kept strictly server-side (process.env) and NEVER exposed in APK or client bundle.
 */

export type GitHubOperationType =
  | 'repo_read'
  | 'file_read'
  | 'issues_read'
  | 'dependency_read'
  | 'code_explain'
  | 'bug_analyze'
  | 'file_write'
  | 'git_commit'
  | 'git_push'
  | 'file_delete'
  | 'branch_delete'
  | 'issue_create';

export interface GitHubPermissionRule {
  operation: GitHubOperationType;
  requiresConfirmation: boolean;
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export const GITHUB_PERMISSION_RULES: Record<GitHubOperationType, GitHubPermissionRule> = {
  repo_read: {
    operation: 'repo_read',
    requiresConfirmation: false,
    riskLevel: 'safe',
    description: 'Lecture et analyse de la structure du dépôt',
  },
  file_read: {
    operation: 'file_read',
    requiresConfirmation: false,
    riskLevel: 'safe',
    description: 'Lecture du contenu de fichiers ou dossiers',
  },
  issues_read: {
    operation: 'issues_read',
    requiresConfirmation: false,
    riskLevel: 'safe',
    description: 'Lecture et synthèse des issues ouvertes/fermées',
  },
  dependency_read: {
    operation: 'dependency_read',
    requiresConfirmation: false,
    riskLevel: 'safe',
    description: 'Analyse des manifestes de dépendances (package.json, gradle, etc.)',
  },
  code_explain: {
    operation: 'code_explain',
    requiresConfirmation: false,
    riskLevel: 'safe',
    description: 'Explication algorithmique et analyse d’architecture',
  },
  bug_analyze: {
    operation: 'bug_analyze',
    requiresConfirmation: false,
    riskLevel: 'safe',
    description: 'Recherche et détection d’erreurs ou vulnérabilités dans le code',
  },
  file_write: {
    operation: 'file_write',
    requiresConfirmation: true,
    riskLevel: 'medium',
    description: 'Modification du contenu d’un fichier dans le dépôt',
  },
  git_commit: {
    operation: 'git_commit',
    requiresConfirmation: true,
    riskLevel: 'medium',
    description: 'Création d’un nouveau commit de modifications',
  },
  git_push: {
    operation: 'git_push',
    requiresConfirmation: true,
    riskLevel: 'high',
    description: 'Push des modifications vers la branche distante',
  },
  file_delete: {
    operation: 'file_delete',
    requiresConfirmation: true,
    riskLevel: 'high',
    description: 'Suppression définitive d’un fichier sur le dépôt',
  },
  branch_delete: {
    operation: 'branch_delete',
    requiresConfirmation: true,
    riskLevel: 'critical',
    description: 'Suppression d’une branche distante',
  },
  issue_create: {
    operation: 'issue_create',
    requiresConfirmation: true,
    riskLevel: 'low',
    description: 'Création d’une nouvelle issue publique sur le dépôt',
  },
};

export interface RepositorySummary {
  owner: string;
  repo: string;
  fullName: string;
  description: string;
  defaultBranch: string;
  starsCount: number;
  forksCount: number;
  openIssuesCount: number;
  isPrivate: boolean;
  language: string;
  languages: Record<string, number>;
  topics: string[];
  updatedAt: string;
  htmlUrl: string;
  recentCommits?: Array<{ sha: string; message: string; author: string; date: string }>;
}

export interface FileContentResult {
  path: string;
  name: string;
  type: 'file' | 'dir';
  size: number;
  content?: string;
  entries?: Array<{ name: string; path: string; type: 'file' | 'dir'; size?: number }>;
  downloadUrl?: string;
  sha?: string;
}

export interface IssueSummary {
  number: number;
  title: string;
  state: 'open' | 'closed';
  author: string;
  createdAt: string;
  updatedAt: string;
  commentsCount: number;
  labels: string[];
  body: string;
  htmlUrl: string;
  category?: 'bug' | 'feature' | 'security' | 'question' | 'documentation';
}

export interface DependencyAnalysis {
  manifestType: 'npm' | 'gradle' | 'python' | 'cargo' | 'unknown';
  filePath: string;
  dependenciesCount: number;
  devDependenciesCount: number;
  dependencies: Array<{ name: string; version: string; type: 'prod' | 'dev' | 'peer' }>;
  outdatedOrRisky?: Array<{ name: string; reason: string }>;
  frameworksDetected: string[];
}

export interface PendingConfirmationRequest {
  id: string;
  operation: GitHubOperationType;
  owner: string;
  repo: string;
  summary: string;
  details: Record<string, any>;
  expiresAt: number;
}

export class GitHubService {
  private static pendingConfirmations: Map<string, PendingConfirmationRequest> = new Map();

  /**
   * Check if GITHUB_TOKEN is configured in server environment
   */
  public static isConfigured(): boolean {
    if (typeof process !== 'undefined' && process.env && process.env.GITHUB_TOKEN) {
      return process.env.GITHUB_TOKEN.trim().length > 0;
    }
    return false;
  }

  /**
   * Get headers for GitHub REST API (Strict server-side only)
   */
  private static getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'OpenJarvis-Coding-Agent-v1.0',
    };
    if (typeof process !== 'undefined' && process.env && process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN.trim()}`;
    }
    return headers;
  }

  /**
   * Verify if an operation requires user confirmation
   */
  public static checkPermission(operation: GitHubOperationType): GitHubPermissionRule {
    return GITHUB_PERMISSION_RULES[operation] || {
      operation,
      requiresConfirmation: true,
      riskLevel: 'high',
      description: 'Opération inconnue nécessitant une validation manuelle',
    };
  }

  /**
   * Register a pending confirmation for mutating/privileged operations
   */
  public static createConfirmationRequest(
    operation: GitHubOperationType,
    owner: string,
    repo: string,
    summary: string,
    details: Record<string, any>
  ): PendingConfirmationRequest {
    const id = `auth_gh_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const request: PendingConfirmationRequest = {
      id,
      operation,
      owner,
      repo,
      summary,
      details,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes validity
    };
    this.pendingConfirmations.set(id, request);
    return request;
  }

  /**
   * Validate and consume a confirmation token
   */
  public static validateConfirmationToken(tokenId: string, expectedOperation?: GitHubOperationType): boolean {
    const request = this.pendingConfirmations.get(tokenId);
    if (!request) return false;
    if (Date.now() > request.expiresAt) {
      this.pendingConfirmations.delete(tokenId);
      return false;
    }
    if (expectedOperation && request.operation !== expectedOperation) {
      return false;
    }
    this.pendingConfirmations.delete(tokenId);
    return true;
  }

  /**
   * Parse repository string: "owner/repo" or URL "https://github.com/owner/repo"
   */
  public static parseRepoTarget(input: string): { owner: string; repo: string } {
    let clean = input.trim();
    if (clean.startsWith('https://github.com/')) {
      clean = clean.replace('https://github.com/', '');
    } else if (clean.startsWith('github.com/')) {
      clean = clean.replace('github.com/', '');
    }
    clean = clean.replace(/\.git$/, '').replace(/\/$/, '');

    const parts = clean.split('/');
    if (parts.length >= 2) {
      return { owner: parts[0], repo: parts[1] };
    }
    // Default fallback to OpenJarvis core repository if target is omitted
    return { owner: 'Sasukeutchi77', repo: 'Jarvis-3' };
  }

  /**
   * 1. ANALYSE D'UN DÉPÔT (Repository Analysis)
   */
  public static async analyzeRepository(owner: string, repo: string): Promise<RepositorySummary> {
    const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    if (isBrowser) {
      const res = await fetch('/api/github/repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Échec d’analyse du dépôt ${owner}/${repo}`);
      }
      const data = await res.json();
      return data.data || data;
    }

    // Direct server-side GitHub API execution
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (res.status === 404) throw new Error(`Dépôt GitHub introuvable : ${owner}/${repo}`);
      if (res.status === 401 || res.status === 403) throw new Error(`Accès refusé par GitHub API (${res.status}). Vérifiez le GITHUB_TOKEN.`);
      throw new Error(`Erreur GitHub API (${res.status}): ${errText.slice(0, 150)}`);
    }

    const data = await res.json();

    // Fetch languages in parallel
    let languages: Record<string, number> = {};
    try {
      const langRes = await fetch(`${url}/languages`, { headers: this.getHeaders() });
      if (langRes.ok) languages = await langRes.json();
    } catch {
      // non-blocking
    }

    // Fetch recent commits
    let recentCommits: RepositorySummary['recentCommits'] = [];
    try {
      const commitsRes = await fetch(`${url}/commits?per_page=5`, { headers: this.getHeaders() });
      if (commitsRes.ok) {
        const commitsData = await commitsRes.json();
        recentCommits = (commitsData || []).map((c: any) => ({
          sha: c.sha?.substring(0, 7) || '',
          message: (c.commit?.message || '').split('\n')[0],
          author: c.commit?.author?.name || 'Inconnu',
          date: c.commit?.author?.date || '',
        }));
      }
    } catch {
      // non-blocking
    }

    return {
      owner: data.owner?.login || owner,
      repo: data.name || repo,
      fullName: data.full_name || `${owner}/${repo}`,
      description: data.description || 'Aucune description fournie.',
      defaultBranch: data.default_branch || 'main',
      starsCount: data.stargazers_count || 0,
      forksCount: data.forks_count || 0,
      openIssuesCount: data.open_issues_count || 0,
      isPrivate: !!data.private,
      language: data.language || 'Multi-langages',
      languages,
      topics: data.topics || [],
      updatedAt: data.updated_at || new Date().toISOString(),
      htmlUrl: data.html_url || `https://github.com/${owner}/${repo}`,
      recentCommits,
    };
  }

  /**
   * 2. LECTURE DE FICHIERS OU DOSSIERS (Read Files)
   */
  public static async readFile(
    owner: string,
    repo: string,
    path: string = '',
    ref?: string
  ): Promise<FileContentResult> {
    const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    if (isBrowser) {
      const res = await fetch('/api/github/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, path, ref }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Impossible de lire ${path || 'racine'}`);
      }
      const data = await res.json();
      return data.data || data;
    }

    const cleanPath = path.replace(/^\//, '');
    let url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(cleanPath)}`;
    if (ref) url += `?ref=${encodeURIComponent(ref)}`;

    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) {
      if (res.status === 404) throw new Error(`Fichier ou dossier introuvable : ${cleanPath || 'racine'} sur ${owner}/${repo}`);
      throw new Error(`Erreur lors de la lecture du fichier (${res.status})`);
    }

    const data = await res.json();

    // If directory, return file list
    if (Array.isArray(data)) {
      return {
        path: cleanPath || '/',
        name: cleanPath ? cleanPath.split('/').pop() || '' : 'root',
        type: 'dir',
        size: data.length,
        entries: data.map((item: any) => ({
          name: item.name,
          path: item.path,
          type: item.type === 'dir' ? 'dir' : 'file',
          size: item.size,
        })),
      };
    }

    // If single file, decode content
    let decodedContent = '';
    if (data.content && data.encoding === 'base64') {
      try {
        decodedContent = Buffer.from(data.content, 'base64').toString('utf-8');
      } catch {
        decodedContent = 'Impossible de décoder le contenu binaire.';
      }
    }

    return {
      path: data.path || cleanPath,
      name: data.name || '',
      type: 'file',
      size: data.size || 0,
      content: decodedContent,
      downloadUrl: data.download_url,
      sha: data.sha,
    };
  }

  /**
   * 3. ANALYSE DES DÉPENDANCES (Dependency Analysis)
   */
  public static async analyzeDependencies(owner: string, repo: string, ref?: string): Promise<DependencyAnalysis> {
    const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    if (isBrowser) {
      const res = await fetch('/api/github/dependencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, ref }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Impossible d’analyser les dépendances de ${owner}/${repo}`);
      }
      const data = await res.json();
      return data.data || data;
    }

    // Try detecting Node package.json
    try {
      const pkgFile = await this.readFile(owner, repo, 'package.json', ref);
      if (pkgFile.content) {
        const pkg = JSON.parse(pkgFile.content);
        const deps = Object.entries(pkg.dependencies || {}).map(([name, ver]) => ({
          name,
          version: String(ver),
          type: 'prod' as const,
        }));
        const devDeps = Object.entries(pkg.devDependencies || {}).map(([name, ver]) => ({
          name,
          version: String(ver),
          type: 'dev' as const,
        }));

        const frameworks: string[] = [];
        if (pkg.dependencies?.react || pkg.devDependencies?.react) frameworks.push('React');
        if (pkg.dependencies?.express) frameworks.push('Express');
        if (pkg.dependencies?.['@google/genai']) frameworks.push('Google GenAI');
        if (pkg.dependencies?.tailwindcss || pkg.devDependencies?.tailwindcss) frameworks.push('Tailwind CSS');
        if (pkg.dependencies?.vite || pkg.devDependencies?.vite) frameworks.push('Vite');
        if (pkg.dependencies?.['@anthropic-ai/sdk']) frameworks.push('Anthropic SDK');

        return {
          manifestType: 'npm',
          filePath: 'package.json',
          dependenciesCount: deps.length,
          devDependenciesCount: devDeps.length,
          dependencies: [...deps, ...devDeps],
          frameworksDetected: frameworks,
          outdatedOrRisky: [],
        };
      }
    } catch {
      // Continue to next check
    }

    // Try Android build.gradle / build.gradle.kts
    try {
      const gradleFile = await this.readFile(owner, repo, 'android/app/build.gradle.kts', ref)
        .catch(() => this.readFile(owner, repo, 'app/build.gradle.kts', ref))
        .catch(() => this.readFile(owner, repo, 'build.gradle.kts', ref));

      if (gradleFile.content) {
        const lines = gradleFile.content.split('\n');
        const deps: Array<{ name: string; version: string; type: 'prod' | 'dev' | 'peer' }> = [];
        const frameworks: string[] = ['Kotlin / Jetpack Compose', 'Android SDK'];

        lines.forEach((l) => {
          const trimmed = l.trim();
          if (trimmed.startsWith('implementation(') || trimmed.startsWith('implementation "')) {
            deps.push({ name: trimmed.slice(0, 60), version: 'gradle-managed', type: 'prod' });
          }
        });

        return {
          manifestType: 'gradle',
          filePath: gradleFile.path,
          dependenciesCount: deps.length,
          devDependenciesCount: 0,
          dependencies: deps,
          frameworksDetected: frameworks,
        };
      }
    } catch {
      // Fallback
    }

    return {
      manifestType: 'unknown',
      filePath: 'N/A',
      dependenciesCount: 0,
      devDependenciesCount: 0,
      dependencies: [],
      frameworksDetected: ['Dépôt standard'],
    };
  }

  /**
   * 4. ANALYSE DES ISSUES (Issue Analysis)
   */
  public static async listAndAnalyzeIssues(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open',
    limit: number = 10
  ): Promise<IssueSummary[]> {
    const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    if (isBrowser) {
      const res = await fetch('/api/github/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, state, limit }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Impossible de récupérer les issues de ${owner}/${repo}`);
      }
      const data = await res.json();
      return data.data || data;
    }

    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=${state}&per_page=${Math.min(limit, 30)}`;
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) {
      throw new Error(`Erreur lors de la récupération des issues (${res.status})`);
    }

    const rawIssues = await res.json();
    return (rawIssues || []).map((issue: any) => {
      const labels = (issue.labels || []).map((l: any) => l.name || String(l));
      let category: IssueSummary['category'] = 'question';

      const titleAndBody = `${issue.title} ${issue.body || ''}`.toLowerCase();
      if (labels.some((l: string) => l.includes('bug')) || titleAndBody.includes('bug') || titleAndBody.includes('crash') || titleAndBody.includes('error')) {
        category = 'bug';
      } else if (labels.some((l: string) => l.includes('feature')) || titleAndBody.includes('feature') || titleAndBody.includes('enhancement')) {
        category = 'feature';
      } else if (labels.some((l: string) => l.includes('security')) || titleAndBody.includes('vulnerability') || titleAndBody.includes('cve')) {
        category = 'security';
      } else if (labels.some((l: string) => l.includes('documentation')) || titleAndBody.includes('readme') || titleAndBody.includes('docs')) {
        category = 'documentation';
      }

      return {
        number: issue.number,
        title: issue.title,
        state: issue.state,
        author: issue.user?.login || 'Inconnu',
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        commentsCount: issue.comments || 0,
        labels,
        body: (issue.body || '').slice(0, 1000),
        htmlUrl: issue.html_url || `https://github.com/${owner}/${repo}/issues/${issue.number}`,
        category,
      };
    });
  }

  /**
   * 5. CRÉATION D'UNE ISSUE (Gated by Permission & Confirmation Token)
   */
  public static async createIssue(
    owner: string,
    repo: string,
    title: string,
    body: string,
    labels: string[] = ['jarvis-agent', 'automated-diagnostic'],
    confirmationToken?: string
  ): Promise<{ success: boolean; issueUrl?: string; issueNumber?: number; requiresConfirmation?: boolean; confirmationRequest?: PendingConfirmationRequest }> {
    // If confirmation is missing or invalid, generate confirmation request
    if (!confirmationToken || !this.validateConfirmationToken(confirmationToken, 'issue_create')) {
      const confirmationReq = this.createConfirmationRequest(
        'issue_create',
        owner,
        repo,
        `Création d’une issue GitHub : "${title}" sur ${owner}/${repo}`,
        { title, body, labels }
      );
      return {
        success: false,
        requiresConfirmation: true,
        confirmationRequest: confirmationReq,
      };
    }

    // Execute creation via GitHub API (Server-side)
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, body, labels }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Échec de création de l'issue (${res.status}): ${errText.slice(0, 150)}`);
    }

    const data = await res.json();
    return {
      success: true,
      issueUrl: data.html_url,
      issueNumber: data.number,
      requiresConfirmation: false,
    };
  }
}
