import React, { useState, useEffect } from 'react';
import {
  Brain,
  Search,
  Plus,
  Trash2,
  X,
  Shield,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

interface MemoryItem {
  id: string;
  category: string;
  content: string;
  source: string;
  importanceScore: number;
  isEncrypted: boolean;
  createdAt: number;
  updatedAt: number;
}

interface JarvisMemoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const JarvisMemoryDrawer: React.FC<JarvisMemoryDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const navigate = useNavigate();
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [newContent, setNewContent] = useState('');

  const fetchMemories = async () => {
    try {
      setLoading(true);
      const res = await fetch('/v1/memory/items');
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memories || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMemories();
    }
  }, [isOpen]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    try {
      const res = await fetch('/v1/memory/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newContent,
          category: 'IMPORTANT_FACT',
          source: 'Assistant HUD Glance',
          isEncrypted: false,
        }),
      });
      if (res.ok) {
        toast.success('Souvenir mémorisé avec succès !');
        setNewContent('');
        fetchMemories();
      }
    } catch {
      toast.error('Erreur de sauvegarde mémoire');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/v1/memory/items/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Souvenir effacé');
        fetchMemories();
      }
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  if (!isOpen) return null;

  const filtered = memories.filter((m) =>
    m.content.toLowerCase().includes(search.toLowerCase()) ||
    m.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md h-full bg-slate-900 border-l border-cyan-500/20 p-5 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Mémoire Sécurisée FTS5
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                  {memories.length} faits
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Indexation vectorielle et préférences locales</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Add Form */}
        <form onSubmit={handleAdd} className="my-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ajouter un fait à retenir..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-xs text-slate-200 outline-none placeholder:text-slate-600"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Retenir</span>
            </button>
          </div>
        </form>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Filtrer les souvenirs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 outline-none placeholder:text-slate-600"
          />
        </div>

        {/* Memories List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">Chargement de la mémoire...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Aucun souvenir correspondant.
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-cyan-500/30 transition-all text-xs group"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-cyan-950/50 text-cyan-400 border border-cyan-500/20">
                    {item.category}
                  </span>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-opacity"
                    title="Oublier ce fait"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-slate-200 font-normal leading-relaxed">{item.content}</p>
                <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between">
                  <span>Source: {item.source}</span>
                  <span>{new Date(item.updatedAt).toLocaleDateString('fr-FR')}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Link to Full Memory Studio */}
        <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
          <span className="text-[11px] text-slate-500">Persistance RAG active</span>
          <button
            onClick={() => {
              onClose();
              navigate('/memory');
            }}
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
          >
            <span>Ouvrir Studio Mémoire</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
