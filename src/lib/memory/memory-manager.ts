/**
 * MEMORY MANAGER (Phase 7 - Long-Term Memory System)
 * 
 * Orchestrator & Life Cycle Controller for JARVIS Memory:
 * - Direct intent handling:
 *   - "JARVIS, retiens ceci" -> Explicit storage in preferred tier
 *   - "JARVIS, oublie ceci" -> Targeted forgetting with semantic search
 *   - "Qu'est-ce que tu sais sur mon projet ?" -> Project & semantic recall
 *   - "Supprime ce souvenir" -> Granular deletion
 * - Temporary memory TTL garbage collection
 * - Strict non-automatic privacy guarantee (does NOT invasively log conversations)
 */

import { MemoryEntry, MemoryTier, MemoryCategory, ProjectMemoryContext } from './types.js';
import { memoryStore } from './memory-store.js';
import { memoryRetriever } from './memory-retriever.js';
import { redactSecrets } from '../services/security-redactor.js';

export interface MemoryCommandResult {
  action: 'remember' | 'forget' | 'recall' | 'delete' | 'project_overview' | 'unknown';
  success: boolean;
  message: string;
  spokenSummary: string;
  affectedEntries?: MemoryEntry[];
  projectContext?: ProjectMemoryContext | null;
}

export class MemoryManager {
  /**
   * Evaluates if a query is a memory command and executes the corresponding lifecycle action
   */
  public async handleCommand(query: string): Promise<MemoryCommandResult> {
    const q = query.trim();
    const lower = q.toLowerCase();

    // 1. "JARVIS, retiens ceci / Retiens que / Souviens-toi de"
    if (
      lower.startsWith('retiens que') ||
      lower.startsWith('retiens ceci') ||
      lower.startsWith('souviens-toi de') ||
      lower.startsWith('souviens-toi que') ||
      lower.startsWith('enregistre dans ma mémoire') ||
      lower.startsWith('mémorise que') ||
      lower.startsWith('mémorise ceci') ||
      lower.includes('retiens ceci') ||
      lower.includes('souviens-toi que') ||
      lower.includes('enregistre que')
    ) {
      return this.executeRemember(q);
    }

    // 2. "JARVIS, oublie ceci / Oublie que / Ne retiens plus"
    if (
      lower.startsWith('oublie que') ||
      lower.startsWith('oublie ceci') ||
      lower.startsWith('ne retiens plus') ||
      lower.startsWith('efface de ta mémoire') ||
      lower.includes('oublie ceci') ||
      lower.includes('supprime ce souvenir') ||
      lower.includes('supprime de ma mémoire')
    ) {
      return this.executeForget(q);
    }

    // 3. "Qu'est-ce que tu sais sur mon projet ?" / "Que sais-tu sur..."
    if (
      lower.includes('que sais-tu sur mon projet') ||
      lower.includes('qu\'est-ce que tu sais sur mon projet') ||
      lower.includes('que sais-tu sur le projet') ||
      lower.includes('parle-moi de mon projet')
    ) {
      return this.executeProjectRecall(q);
    }

    // 4. "Qu'est-ce que tu sais sur moi ?" / "Quelles sont mes préférences ?"
    if (
      lower.includes('que sais-tu sur moi') ||
      lower.includes('qu\'est-ce que tu sais sur moi') ||
      lower.includes('mes préférences') ||
      lower.includes('quelles sont mes habitudes')
    ) {
      return this.executeGeneralRecall(q);
    }

    // Fallback general semantic recall
    return this.executeSemanticSearch(q);
  }

  /**
   * Action: "JARVIS, retiens ceci"
   */
  public async executeRemember(query: string): Promise<MemoryCommandResult> {
    // Extract raw payload
    let rawContent = query
      .replace(/^jarvis,?\s*/i, '')
      .replace(/^(retiens ceci\s*[:,-]?|retiens que|souviens-toi de|souviens-toi que|mémorise que|mémorise ceci|enregistre dans ma mémoire|enregistre que)\s*/i, '')
      .trim();

    if (!rawContent) {
      return {
        action: 'remember',
        success: false,
        message: "Précisez l'information que vous souhaitez consigner dans ma mémoire à long terme, Monsieur.",
        spokenSummary: "Précisez ce que vous souhaitez que je retienne, Monsieur.",
      };
    }

    // Determine category & tier intelligently
    let tier: MemoryTier = 'long_term';
    let category: MemoryCategory = 'IMPORTANT_FACT';
    const lowerContent = rawContent.toLowerCase();

    if (lowerContent.includes('je préfère') || lowerContent.includes('j\'aime') || lowerContent.includes('mon format préféré') || lowerContent.includes('mode')) {
      tier = 'user_preferences';
      category = 'PREFERENCE';
    } else if (lowerContent.includes('tous les jours') || lowerContent.includes('habitude') || lowerContent.includes('chaque matin') || lowerContent.includes('à 8h')) {
      tier = 'user_preferences';
      category = 'HABIT';
    } else if (lowerContent.includes('projet') || lowerContent.includes('openjarvis') || lowerContent.includes('architecture') || lowerContent.includes('repo')) {
      tier = 'project';
      category = 'PROJECT';
    } else if (lowerContent.includes('mot de passe') || lowerContent.includes('secret') || lowerContent.includes('code pin')) {
      tier = 'long_term';
      category = 'USER_PROFILE';
    }

    const isSensitive = category === 'USER_PROFILE' || lowerContent.includes('pin') || lowerContent.includes('code');

    const entry = await memoryStore.addEntry({
      content: rawContent,
      tier,
      category,
      source: 'Consigne Vocale Explicite ("Retiens ceci")',
      importanceScore: 0.95,
      isExplicit: true,
      isEncrypted: isSensitive,
    });

    const categoryLabel = category === 'PREFERENCE' ? 'préférence' : category === 'PROJECT' ? 'détail de projet' : category === 'HABIT' ? 'habitude' : 'information importante';

    return {
      action: 'remember',
      success: true,
      message: `### 🧠 Souvenir Mémorisé avec Succès\n\n- **Contenu** : « ${entry.content} »\n- **Catégorie** : ${entry.category}\n- **Niveau de Mémoire** : \`${entry.tier}\`\n- **Chiffrement de Sécurité** : ${entry.isEncrypted ? '🛡️ Chiffré matériellement' : 'Standard'}\n\n*Cette information est désormais intégrée à mon graphe sémantique pour vos futures requêtes.*`,
      spokenSummary: `C'est enregistré dans ma mémoire à long terme comme ${categoryLabel}, Monsieur.`,
      affectedEntries: [entry],
    };
  }

  /**
   * Action: "JARVIS, oublie ceci" / "Supprime ce souvenir"
   */
  public async executeForget(query: string): Promise<MemoryCommandResult> {
    const rawTarget = query
      .replace(/^jarvis,?\s*/i, '')
      .replace(/^(oublie que|oublie ceci\s*[:,-]?|ne retiens plus|efface de ta mémoire|supprime ce souvenir\s*[:,-]?|supprime de ma mémoire)\s*/i, '')
      .trim();

    if (!rawTarget) {
      return {
        action: 'forget',
        success: false,
        message: "Veuillez préciser le souvenir ou le sujet que vous souhaitez que j'efface de ma mémoire, Monsieur.",
        spokenSummary: "Précisez l'information à effacer, Monsieur.",
      };
    }

    // Search for closest matches
    const matches = await memoryRetriever.search({ query: rawTarget, topK: 3, minScore: 0.2 });

    if (matches.length === 0) {
      return {
        action: 'forget',
        success: false,
        message: `Aucun souvenir correspondant à « ${rawTarget} » n'a été trouvé dans mon registre mémoriel.`,
        spokenSummary: `Je n'ai trouvé aucun souvenir correspondant dans ma mémoire, Monsieur.`,
      };
    }

    // Delete top match
    const targetToDelete = matches[0].entry;
    await memoryStore.deleteEntry(targetToDelete.id);

    return {
      action: 'forget',
      success: true,
      message: `### 🗑️ Souvenir Effacé de la Mémoire\n\n- **Souvenir supprimé** : « ${targetToDelete.content} »\n- **Catégorie** : ${targetToDelete.category}\n- **ID** : \`${targetToDelete.id}\`\n\n*Toutes les traces et vecteurs d'indexation associés ont été purgés.*`,
      spokenSummary: `C'est oublié, Monsieur. Le souvenir a été définitivement effacé de ma mémoire.`,
      affectedEntries: [targetToDelete],
    };
  }

  /**
   * Action: "Qu'est-ce que tu sais sur mon projet ?"
   */
  public async executeProjectRecall(query: string): Promise<MemoryCommandResult> {
    const projects = memoryStore.getProjects();
    const projectMemories = memoryStore.getEntriesByTier('project');
    const project = projects[0] || null;

    let message = `### 🚀 Mémoire du Projet OpenJarvis\n\n`;
    if (project) {
      message += `**${project.projectName}**\n`;
      message += `> ${project.description}\n\n`;
      message += `**Points d'Architecture Clés :**\n`;
      project.architectureHighlights.forEach(h => { message += `- ${h}\n`; });
      message += `\n**Jalons & Phases Actives :**\n`;
      project.activeMilestones.forEach(m => { message += `- ${m}\n`; });
      message += `\n**Stack Technologique :** ${project.techStack.join(', ')}\n`;
    }

    if (projectMemories.length > 0) {
      message += `\n**Notes & Faits de Projets Mémorisés (${projectMemories.length}) :**\n`;
      projectMemories.forEach(pm => {
        message += `- ${pm.content}\n`;
      });
    }

    return {
      action: 'project_overview',
      success: true,
      message,
      spokenSummary: `Voici la synthèse de votre projet OpenJarvis et de son architecture multi-agents, Monsieur.`,
      projectContext: project,
      affectedEntries: projectMemories,
    };
  }

  /**
   * General User Profile & Preferences Recall
   */
  public async executeGeneralRecall(query: string): Promise<MemoryCommandResult> {
    const prefs = memoryStore.getEntriesByTier('user_preferences');
    const longTerm = memoryStore.getEntriesByTier('long_term');
    const all = [...prefs, ...longTerm];

    let message = `### 👤 Connaissances & Préférences Utilisateur\n\n`;
    message += `Voici les consignes et éléments enregistrés explicitement à votre sujet, Monsieur :\n\n`;

    if (prefs.length > 0) {
      message += `**Préférences & Habitudes :**\n`;
      prefs.forEach(p => {
        message += `- **[${p.category}]** ${p.content}\n`;
      });
      message += `\n`;
    }

    if (longTerm.length > 0) {
      message += `**Profil & Faits Importants :**\n`;
      longTerm.forEach(l => {
        message += `- ${l.content} ${l.isEncrypted ? '*(Protégé)*' : ''}\n`;
      });
    }

    return {
      action: 'recall',
      success: true,
      message,
      spokenSummary: `Voici ce qui est consigné dans votre profil mémoriel, Monsieur.`,
      affectedEntries: all,
    };
  }

  /**
   * Fallback Semantic Search across all tiers
   */
  public async executeSemanticSearch(query: string): Promise<MemoryCommandResult> {
    const matches = await memoryRetriever.search({ query, topK: 4, minScore: 0.25 });

    if (matches.length === 0) {
      return {
        action: 'recall',
        success: true,
        message: `Je n'ai pas trouvé d'information mémorisée correspondant exactement à votre recherche : « ${query} ». Vous pouvez me demander *« JARVIS, retiens ceci »* pour en ajouter.`,
        spokenSummary: `Aucun souvenir trouvé sur ce sujet, Monsieur.`,
      };
    }

    let message = `### 🔍 Résultats de Recherche Mémorielle Sémantique\n\n`;
    message += `Voici les connaissances associées dans votre mémoire à long terme :\n\n`;

    matches.forEach((m, idx) => {
      message += `${idx + 1}. **${m.entry.category}** (Pertinence : ${(m.similarity * 100).toFixed(0)}%)\n`;
      message += `   > ${m.entry.content}\n`;
      message += `   *Source : ${m.entry.source} | Palier : \`${m.entry.tier}\`*\n\n`;
    });

    return {
      action: 'recall',
      success: true,
      message,
      spokenSummary: `J'ai retrouvé ${matches.length} élément(s) pertinent(s) dans votre mémoire sémantique, Monsieur.`,
      affectedEntries: matches.map(m => m.entry),
    };
  }
}

export const memoryManager = new MemoryManager();
