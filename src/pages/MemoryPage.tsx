import React, { useState, useEffect } from 'react';
import {
  Brain,
  Search,
  Plus,
  Trash2,
  Edit2,
  Shield,
  Clock,
  Sparkles,
  CheckCircle2,
  User,
  Heart,
  Cpu,
  FolderGit2,
  Activity,
  Layers,
  Terminal,
  Zap,
  Tag,
  KeyRound,
  Filter,
  RefreshCw,
  Sliders,
  FileCode,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import {
  MemoryEntry,
  MemoryTier,
  MemoryCategory,
  MemoryStats,
  SemanticSearchResult,
  ProjectMemoryContext,
} from '../lib/memory/types';
import { memoryStore } from '../lib/memory/memory-store';
import { memoryRetriever } from '../lib/memory/memory-retriever';
import { memoryManager } from '../lib/memory/memory-manager';

const TIERS: { id: MemoryTier | 'ALL'; label: string; icon: React.ComponentType<{ className?: string; size?: number }> }[] = [
  { id: 'ALL', label: 'Tous les Paliers', icon: Layers },
  { id: 'user_preferences', label: 'Préférences & Habitudes', icon: Heart },
  { id: 'project', label: 'Mémoire Projets', icon: FolderGit2 },
  { id: 'long_term', label: 'Long-Term Memory', icon: Brain },
  { id: 'semantic', label: 'Mémoire Sémantique', icon: Sparkles },
  { id: 'short_term', label: 'Short-Term / Session', icon: Clock },
  { id: 'temporary', label: 'Mémoire Temporaire', icon: Zap },
];

const CATEGORIES: { id: MemoryCategory | 'ALL'; label: string }[] = [
  { id: 'ALL', label: 'Toutes Catégories' },
  { id: 'PREFERENCE', label: 'Préférence' },
  { id: 'PROJECT', label: 'Projet' },
  { id: 'HABIT', label: 'Habitude' },
  { id: 'IMPORTANT_FACT', label: 'Fait Important' },
  { id: 'USER_PROFILE', label: 'Profil Utilisateur' },
  { id: 'CONVERSATION_CONTEXT', label: 'Contexte' },
  { id: 'AUTOMATION_NOTE', label: 'Automatisation' },
  { id: 'TEMPORARY_SCRATCHPAD', label: 'Scratchpad' },
];

export function MemoryPage() {
  const [activeTab, setActiveTab] = useState<'memories' | 'projects' | 'tester' | 'stats'>('memories');
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [selectedTier, setSelectedTier] = useState<MemoryTier | 'ALL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<MemoryCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [semanticResults, setSemanticResults] = useState<SemanticSearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [projects, setProjects] = useState<ProjectMemoryContext[]>([]);
  const [systemEnabled, setSystemEnabled] = useState(true);

  // Modals & UI States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MemoryEntry | null>(null);
  const [modalContent, setModalContent] = useState('');
  const [modalTitle, setModalTitle] = useState('');
  const [modalTier, setModalTier] = useState<MemoryTier>('user_preferences');
  const [modalCategory, setModalCategory] = useState<MemoryCategory>('PREFERENCE');
  const [modalEncrypted, setModalEncrypted] = useState(false);
  const [modalTags, setModalTags] = useState('');

  // Interactive Voice Simulator in Tester Tab
  const [testVoiceQuery, setTestVoiceQuery] = useState('');
  const [testVoiceResponse, setTestVoiceResponse] = useState<any | null>(null);
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);

  // Status message
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const reloadData = () => {
    const all = memoryStore.getAllEntries();
    setMemories(all);
    setProjects(memoryStore.getProjects());
    setStats(memoryStore.getStats());
    setSystemEnabled(memoryStore.isSystemEnabled());
  };

  useEffect(() => {
    reloadData();
  }, []);

  // Semantic search trigger
  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim()) {
        setSemanticResults(null);
        return;
      }
      setIsSearching(true);
      try {
        const results = await memoryRetriever.search({
          query: searchQuery,
          tier: selectedTier === 'ALL' ? undefined : selectedTier,
          category: selectedCategory === 'ALL' ? undefined : selectedCategory,
          topK: 12,
          minScore: 0.15,
        });
        setSemanticResults(results);
      } catch (err) {
        console.error('Semantic search error:', err);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(performSearch, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedTier, selectedCategory]);

  const showToast = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleToggleSystem = () => {
    const newState = !systemEnabled;
    memoryStore.setSystemEnabled(newState);
    setSystemEnabled(newState);
    reloadData();
    showToast(newState ? 'Système de mémoire globale réactivé' : 'Système de mémoire suspendu');
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalContent.trim()) return;

    const tagsArray = modalTags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (editingEntry) {
      await memoryStore.updateEntry(editingEntry.id, {
        title: modalTitle.trim() || undefined,
        content: modalContent.trim(),
        tier: modalTier,
        category: modalCategory,
        isEncrypted: modalEncrypted,
        tags: tagsArray.length > 0 ? tagsArray : undefined,
      });
      showToast('Souvenir mis à jour avec succès');
    } else {
      await memoryStore.addEntry({
        title: modalTitle.trim() || undefined,
        content: modalContent.trim(),
        tier: modalTier,
        category: modalCategory,
        isEncrypted: modalEncrypted,
        tags: tagsArray,
        source: 'Console Studio Mémoire',
        isExplicit: true,
      });
      showToast('Nouveau souvenir consigné et indexé sémantiquement');
    }

    setShowAddModal(false);
    setEditingEntry(null);
    setModalContent('');
    setModalTitle('');
    setModalTags('');
    reloadData();
  };

  const handleDelete = async (id: string) => {
    await memoryStore.deleteEntry(id);
    showToast('Souvenir purgé de la base et désindexé du vecteur');
    reloadData();
  };

  const handleClearAll = async () => {
    await memoryStore.clearAll();
    setShowClearConfirm(false);
    showToast('Toutes les mémoires ont été effacées');
    reloadData();
  };

  const handleExecuteVoiceCommand = async (preset?: string) => {
    const query = preset || testVoiceQuery;
    if (!query.trim()) return;

    setIsExecutingCommand(true);
    try {
      const result = await memoryManager.handleCommand(query);
      setTestVoiceResponse(result);
      if (result.success) {
        showToast(`Commande exécutée : ${result.action}`);
        reloadData();
      }
    } catch (err: any) {
      setTestVoiceResponse({
        success: false,
        message: err?.message || 'Erreur d’exécution',
        spokenSummary: 'Erreur mémoire',
        action: 'unknown',
      });
    } finally {
      setIsExecutingCommand(false);
    }
  };

  // Filtered displayed items
  const displayedEntries = semanticResults
    ? semanticResults.map((r) => r.entry)
    : memories.filter((m) => {
        const matchesTier = selectedTier === 'ALL' || m.tier === selectedTier;
        const matchesCategory = selectedCategory === 'ALL' || m.category === selectedCategory;
        return matchesTier && matchesCategory;
      });

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {statusMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-cyan-950 border border-cyan-500/50 text-cyan-200 rounded-xl shadow-2xl animate-fade-in text-sm font-medium">
          <CheckCircle2 size={16} className="text-cyan-400" />
          {statusMessage}
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 border border-cyan-500/20 p-6 rounded-2xl backdrop-blur-xl shadow-xl shadow-cyan-950/20">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-inner">
            <Brain size={30} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                JARVIS Long-Term Memory System
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono border border-cyan-500/30">
                Phase 7 • Multi-Layer Memory Engine
              </span>
            </div>
            <p className="text-sm text-neutral-400 mt-1">
              Mémoire sémantique locale, rétention des préférences, contexte projet et autorité explicite sans enregistrement automatique intrusif.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleSystem}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              systemEnabled
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30'
                : 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
            }`}
          >
            <Activity size={16} />
            {systemEnabled ? 'Mémoire Active' : 'Mémoire En Pause'}
          </button>

          <button
            onClick={() => {
              setEditingEntry(null);
              setModalTitle('');
              setModalContent('');
              setModalTags('');
              setModalTier('user_preferences');
              setModalCategory('PREFERENCE');
              setModalEncrypted(false);
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-sm transition-all shadow-lg shadow-cyan-500/25"
          >
            <Plus size={16} />
            Ajouter un Souvenir
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-neutral-800 gap-2">
        <button
          onClick={() => setActiveTab('memories')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === 'memories'
              ? 'border-cyan-400 text-cyan-300 bg-cyan-500/5'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Brain size={16} />
          Registre Mémoriel ({memories.length})
        </button>

        <button
          onClick={() => setActiveTab('projects')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === 'projects'
              ? 'border-cyan-400 text-cyan-300 bg-cyan-500/5'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <FolderGit2 size={16} />
          Mémoire Projets ({projects.length})
        </button>

        <button
          onClick={() => setActiveTab('tester')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === 'tester'
              ? 'border-cyan-400 text-cyan-300 bg-cyan-500/5'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Terminal size={16} />
          Simulateur Vocal & Commandes Clés
        </button>

        <button
          onClick={() => setActiveTab('stats')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === 'stats'
              ? 'border-cyan-400 text-cyan-300 bg-cyan-500/5'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Cpu size={16} />
          Télémétrie & Architecture Vectorielle
        </button>
      </div>

      {/* TAB 1: MEMORIES EXPLORER */}
      {activeTab === 'memories' && (
        <div className="space-y-6">
          {/* Controls: Tiers & Categories Filter */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Search Input */}
            <div className="md:col-span-6 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Recherche sémantique vectorielle (ex: 'café', 'code', 'sécurité', 'briefing')..."
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-800 focus:border-cyan-500 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none transition-colors"
              />
              {isSearching && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                  <RefreshCw size={16} className="animate-spin text-cyan-400" />
                </div>
              )}
            </div>

            {/* Tier Selector */}
            <div className="md:col-span-3">
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-neutral-900 border border-neutral-800 focus:border-cyan-500 rounded-xl text-sm text-white focus:outline-none"
              >
                {TIERS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Selector */}
            <div className="md:col-span-3">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-neutral-900 border border-neutral-800 focus:border-cyan-500 rounded-xl text-sm text-white focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Semantic Results Indicator */}
          {semanticResults && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-cyan-950/40 border border-cyan-500/30 rounded-xl text-xs text-cyan-300">
              <span className="flex items-center gap-2">
                <Sparkles size={14} className="text-cyan-400" />
                Index Sémantique : {semanticResults.length} souvenir(s) corrélé(s) pour « {searchQuery} »
              </span>
              <button
                onClick={() => setSearchQuery('')}
                className="text-cyan-400 hover:text-cyan-200 underline font-medium"
              >
                Réinitialiser la recherche
              </button>
            </div>
          )}

          {/* Memories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedEntries.length === 0 ? (
              <div className="md:col-span-2 text-center py-16 bg-neutral-900/50 border border-neutral-800 rounded-2xl">
                <Brain className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-neutral-300">Aucun souvenir trouvé</h3>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                  Demandez à JARVIS vocalement <span className="text-cyan-400">« JARVIS, retiens ceci »</span> ou ajoutez-en manuellement.
                </p>
              </div>
            ) : (
              displayedEntries.map((entry) => {
                const semanticScore = semanticResults?.find((r) => r.entry.id === entry.id)?.similarity;
                return (
                  <div
                    key={entry.id}
                    className="p-5 bg-neutral-900/70 border border-neutral-800 hover:border-cyan-500/40 transition-all rounded-2xl space-y-3 relative group shadow-md"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            {entry.category}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-400 font-mono">
                            {entry.tier}
                          </span>
                          {entry.isEncrypted && (
                            <span className="text-xs flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <Shield size={11} /> Chiffré
                            </span>
                          )}
                          {semanticScore !== undefined && (
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              Score: {(semanticScore * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                        {entry.title && (
                          <h4 className="text-sm font-semibold text-white mt-1.5">{entry.title}</h4>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingEntry(entry);
                            setModalTitle(entry.title || '');
                            setModalContent(entry.content);
                            setModalTier(entry.tier);
                            setModalCategory(entry.category);
                            setModalEncrypted(entry.isEncrypted);
                            setModalTags(entry.tags.join(', '));
                            setShowAddModal(true);
                          }}
                          className="p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-cyan-300 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="p-1.5 hover:bg-red-500/10 text-neutral-400 hover:text-red-400 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Content */}
                    <p className="text-sm text-neutral-300 leading-relaxed bg-black/20 p-3 rounded-xl border border-white/5 font-sans">
                      {entry.content}
                    </p>

                    {/* Footer & Meta */}
                    <div className="flex items-center justify-between text-xs text-neutral-500 pt-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {entry.tags.map((tag) => (
                          <span key={tag} className="text-neutral-400 hover:text-cyan-400">
                            #{tag}
                          </span>
                        ))}
                      </div>
                      <span>
                        {new Date(entry.createdAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Clear Zone */}
          <div className="flex justify-end pt-4">
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-xs text-red-400/80 hover:text-red-400 flex items-center gap-1.5 transition-colors"
            >
              <Trash2 size={13} />
              Purger l'ensemble de la mémoire locale
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: PROJECTS MEMORY */}
      {activeTab === 'projects' && (
        <div className="space-y-6">
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FolderGit2 className="text-cyan-400" size={20} />
                  Mémoire de Contexte Projet
                </h2>
                <p className="text-xs text-neutral-400 mt-1">
                  Synthèse structurée des objectifs, choix d'architecture et décisions clés retenues par JARVIS pour vos projets.
                </p>
              </div>
            </div>

            {projects.map((proj) => (
              <div key={proj.projectId} className="space-y-5 border-t border-neutral-800 pt-5">
                <div>
                  <h3 className="text-base font-semibold text-cyan-300">{proj.projectName}</h3>
                  <p className="text-sm text-neutral-300 mt-1 italic">{proj.description}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Highlights */}
                  <div className="p-4 bg-neutral-950/60 border border-neutral-800 rounded-xl space-y-2">
                    <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Cpu size={14} /> Piliers d'Architecture
                    </h4>
                    <ul className="space-y-1.5 text-xs text-neutral-300">
                      {proj.architectureHighlights.map((h, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-cyan-400">•</span>
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Milestones */}
                  <div className="p-4 bg-neutral-950/60 border border-neutral-800 rounded-xl space-y-2">
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Activity size={14} /> Jalons & Progression
                    </h4>
                    <ul className="space-y-1.5 text-xs text-neutral-300">
                      {proj.activeMilestones.map((m, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-amber-400">•</span>
                          <span>{m}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Key Decisions */}
                <div className="p-4 bg-neutral-950/60 border border-neutral-800 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck size={14} /> Décisions Clés & Règles Invariables
                  </h4>
                  <ul className="space-y-1.5 text-xs text-neutral-300">
                    {proj.keyDecisions.map((d, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-400">•</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Stack */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-neutral-400 font-semibold">Technologies :</span>
                  {proj.techStack.map((tech) => (
                    <span
                      key={tech}
                      className="px-2.5 py-1 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: VOICE COMMANDS SIMULATOR & TESTER */}
      {activeTab === 'tester' && (
        <div className="space-y-6">
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Terminal className="text-cyan-400" size={20} />
                Simulateur de Commandes Mémorielles Explicites
              </h2>
              <p className="text-xs text-neutral-400 mt-1">
                Testez les commandes vocales de mémorisation, d'oubli sélectif et de rappel de connaissances.
              </p>
            </div>

            {/* Presets */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Exemples de commandes supportées :
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <button
                  onClick={() => handleExecuteVoiceCommand('JARVIS, retiens ceci : je préfère coder en TypeScript strict')}
                  className="p-3 bg-neutral-950 border border-neutral-800 hover:border-cyan-500/50 rounded-xl text-left text-xs text-cyan-300 hover:text-cyan-200 transition-colors"
                >
                  <span className="font-bold block mb-1">« Retiens ceci »</span>
                  « JARVIS, retiens ceci : je préfère coder en TypeScript strict »
                </button>

                <button
                  onClick={() => handleExecuteVoiceCommand('Qu\'est-ce que tu sais sur mon projet ?')}
                  className="p-3 bg-neutral-950 border border-neutral-800 hover:border-cyan-500/50 rounded-xl text-left text-xs text-cyan-300 hover:text-cyan-200 transition-colors"
                >
                  <span className="font-bold block mb-1">« Mon projet »</span>
                  « Qu'est-ce que tu sais sur mon projet ? »
                </button>

                <button
                  onClick={() => handleExecuteVoiceCommand('Quelles sont mes préférences ?')}
                  className="p-3 bg-neutral-950 border border-neutral-800 hover:border-cyan-500/50 rounded-xl text-left text-xs text-cyan-300 hover:text-cyan-200 transition-colors"
                >
                  <span className="font-bold block mb-1">« Mes préférences »</span>
                  « Quelles sont mes préférences et habitudes ? »
                </button>

                <button
                  onClick={() => handleExecuteVoiceCommand('JARVIS, oublie ceci : TypeScript strict')}
                  className="p-3 bg-neutral-950 border border-neutral-800 hover:border-red-500/50 rounded-xl text-left text-xs text-red-300 hover:text-red-200 transition-colors"
                >
                  <span className="font-bold block mb-1">« Oublie ceci »</span>
                  « JARVIS, oublie ceci : TypeScript strict »
                </button>
              </div>
            </div>

            {/* Custom Input */}
            <div className="flex gap-3">
              <input
                type="text"
                value={testVoiceQuery}
                onChange={(e) => setTestVoiceQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleExecuteVoiceCommand()}
                placeholder="Entrez une commande vocale (ex: 'JARVIS, retiens que mon mot de passe wifi est Secur3...')"
                className="flex-1 px-4 py-3 bg-neutral-950 border border-neutral-800 focus:border-cyan-500 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none font-mono"
              />
              <button
                onClick={() => handleExecuteVoiceCommand()}
                disabled={isExecutingCommand || !testVoiceQuery.trim()}
                className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-semibold text-sm rounded-xl transition-all flex items-center gap-2"
              >
                {isExecutingCommand ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
                Exécuter
              </button>
            </div>

            {/* Response Preview */}
            {testVoiceResponse && (
              <div className="p-5 bg-neutral-950 border border-cyan-500/30 rounded-2xl space-y-4 animate-fade-in">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        testVoiceResponse.success ? 'bg-emerald-400' : 'bg-red-400'
                      }`}
                    />
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                      Action Résolue : <span className="text-cyan-400">{testVoiceResponse.action}</span>
                    </span>
                  </div>
                  <span className="text-xs text-neutral-500 font-mono">
                    Spoken: « {testVoiceResponse.spokenSummary} »
                  </span>
                </div>

                <div className="prose prose-invert max-w-none text-sm text-neutral-200 whitespace-pre-wrap font-sans">
                  {testVoiceResponse.message}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: ARCHITECTURE & STATS */}
      {activeTab === 'stats' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-5 bg-neutral-900/60 border border-neutral-800 rounded-2xl space-y-1">
              <span className="text-xs text-neutral-400">Total Souvenirs</span>
              <p className="text-2xl font-bold text-white font-mono">{stats.totalCount}</p>
            </div>
            <div className="p-5 bg-neutral-900/60 border border-neutral-800 rounded-2xl space-y-1">
              <span className="text-xs text-neutral-400">Mémorisés Explicitement</span>
              <p className="text-2xl font-bold text-cyan-400 font-mono">{stats.explicitCount}</p>
            </div>
            <div className="p-5 bg-neutral-900/60 border border-neutral-800 rounded-2xl space-y-1">
              <span className="text-xs text-neutral-400">Chiffrés Sécurisés</span>
              <p className="text-2xl font-bold text-emerald-400 font-mono">{stats.encryptedCount}</p>
            </div>
            <div className="p-5 bg-neutral-900/60 border border-neutral-800 rounded-2xl space-y-1">
              <span className="text-xs text-neutral-400">Utilisation Stockage</span>
              <p className="text-2xl font-bold text-indigo-400 font-mono">{stats.storageUsageKb} Ko</p>
            </div>
          </div>

          {/* Architecture Breakdown */}
          <div className="p-6 bg-neutral-900/60 border border-neutral-800 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="text-cyan-400" size={16} />
              Paliers de Mémoire JARVIS (Memory Tiers)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(stats.byTier).map(([tier, count]) => (
                <div key={tier} className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl flex items-center justify-between">
                  <span className="text-xs font-mono text-neutral-300">{tier}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 bg-neutral-900/60 border border-neutral-800 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Cpu className="text-cyan-400" size={16} />
              Moteur Vectoriel Sémantique
            </h3>
            <div className="text-xs text-neutral-300 space-y-2">
              <p>
                - <strong>Backend Actif</strong> : <code className="text-cyan-400">{stats.vectorBackend}</code>
              </p>
              <p>
                - <strong>Algorithme</strong> : Vecteurs denses 64D unit-normalized, hachage trigrammes contextuels + Similarité Cosinus instantanée.
              </p>
              <p>
                - <strong>Garantie de Confidentialité</strong> : Zéro exfiltration cloud sans consentement. Indexation et purge en temps réel sur l'appareil.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT MEMORY */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Brain size={20} className="text-cyan-400" />
              {editingEntry ? 'Modifier le Souvenir' : 'Nouveau Souvenir Explicite'}
            </h2>

            <form onSubmit={handleSaveEntry} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Titre (Optionnel)</label>
                <input
                  type="text"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="Ex : Préférence de synthèse vocale"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">Palier Mémoriel</label>
                  <select
                    value={modalTier}
                    onChange={(e) => setModalTier(e.target.value as any)}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    {TIERS.filter((t) => t.id !== 'ALL').map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">Catégorie</label>
                  <select
                    value={modalCategory}
                    onChange={(e) => setModalCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    {CATEGORIES.filter((c) => c.id !== 'ALL').map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Contenu à Retenir</label>
                <textarea
                  value={modalContent}
                  onChange={(e) => setModalContent(e.target.value)}
                  placeholder="Ex : L'utilisateur préfère recevoir des synthèses sous forme de puces avec les métriques essentielles..."
                  rows={4}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500 placeholder-neutral-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Tags (Séparés par des virgules)</label>
                <input
                  type="text"
                  value={modalTags}
                  onChange={(e) => setModalTags(e.target.value)}
                  placeholder="style, vocal, priorite"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="modal-encrypted-check"
                  checked={modalEncrypted}
                  onChange={(e) => setModalEncrypted(e.target.checked)}
                  className="rounded border-neutral-700 bg-neutral-800 text-cyan-500 focus:ring-cyan-500"
                />
                <label
                  htmlFor="modal-encrypted-check"
                  className="text-xs text-neutral-300 flex items-center gap-1 cursor-pointer"
                >
                  <Shield size={13} className="text-emerald-400" />
                  Activer le chiffrement renforcé (Secret / Identifiant sensible)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-sm text-neutral-400 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-sm transition-colors shadow-lg shadow-cyan-500/20"
                >
                  {editingEntry ? 'Mettre à Jour' : 'Consigner le Souvenir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLEAR CONFIRM MODAL */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-red-500/40 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle size={24} />
              <h2 className="text-base font-bold text-white">Effacer toute la mémoire ?</h2>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Cette action supprimera irréversiblement tous les souvenirs, préférences et vecteurs sémantiques.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs text-neutral-400 hover:text-white"
              >
                Annuler
              </button>
              <button
                onClick={handleClearAll}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors"
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
