import { MessageSquare, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAppStore } from '../../lib/store';

interface Props {
  searchQuery?: string;
}

export function ConversationList({ searchQuery = '' }: Props) {
  const navigate = useNavigate();
  const conversations = useAppStore((s) => s.conversations);
  const activeId = useAppStore((s) => s.activeId);
  const selectConversation = useAppStore((s) => s.selectConversation);
  const deleteConversation = useAppStore((s) => s.deleteConversation);

  const filtered = conversations.filter((c) =>
    (c.title || 'Nouvelle conversation').toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (filtered.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-xs text-slate-500">
        {searchQuery ? 'Aucune conversation trouvée' : 'Aucun historique'}
      </div>
    );
  }

  return (
    <div className="space-y-1 px-2 py-1">
      {filtered.map((conv) => {
        const isActive = conv.id === activeId;
        return (
          <div
            key={conv.id}
            onClick={() => {
              selectConversation(conv.id);
              navigate('/');
            }}
            className={`group flex items-center justify-between px-2.5 py-2 rounded-xl text-xs cursor-pointer transition-all ${
              isActive
                ? 'bg-cyan-500/15 text-cyan-300 font-medium border border-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
              <span className="truncate">{conv.title || 'Discussion JARVIS'}</span>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteConversation(conv.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 transition-opacity"
              title="Supprimer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
