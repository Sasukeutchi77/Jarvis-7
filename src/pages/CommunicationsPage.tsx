import { useState, useEffect, useMemo } from 'react';
import {
  MessageSquare,
  MessageCircle,
  Send,
  Shield,
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Lock,
  Search,
  Filter,
  Check,
  RefreshCw,
  ExternalLink,
  Brain,
  Sliders,
  Smartphone,
  ChevronRight,
  SendHorizonal,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  IncomingMessage,
  CommunicationSettings,
  CommunicationSummary,
  CommunicationSourceType,
  MessageCategory,
  AutoReplyRule,
} from '../types';
import { CommunicationAgent, DEFAULT_COMMUNICATION_SETTINGS } from '../lib/services/communication-agent';
import { COMMUNICATION_SOURCES } from '../lib/services/communication-sources';
import { AndroidBridge } from '../lib/android-bridge';
import { useJarvisVoice } from '../hooks/useJarvisVoice';
import { apiFetch } from '../lib/api';

export function CommunicationsPage() {
  const [messages, setMessages] = useState<IncomingMessage[]>([]);
  const [settings, setSettings] = useState<CommunicationSettings>(DEFAULT_COMMUNICATION_SETTINGS);
  const [summary, setSummary] = useState<CommunicationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'inbox' | 'rules' | 'settings'>('inbox');
  const [categoryFilter, setCategoryFilter] = useState<'all' | MessageCategory | CommunicationSourceType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Reply Composer State
  const [selectedMessage, setSelectedMessage] = useState<IncomingMessage | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [replyInstruction, setReplyInstruction] = useState('');
  const [replyTone, setReplyTone] = useState<'polite' | 'casual' | 'short' | 'direct'>('polite');
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replySuccessModal, setReplySuccessModal] = useState<string | null>(null);

  // New Rule Modal
  const [newRuleContact, setNewRuleContact] = useState('');
  const [newRuleCondition, setNewRuleCondition] = useState('');
  const [newRuleTemplate, setNewRuleTemplate] = useState('');
  const [newRuleSource, setNewRuleSource] = useState<CommunicationSourceType | 'all'>('all');
  const [showAddRule, setShowAddRule] = useState(false);

  // New Protected Contact
  const [newProtectedContact, setNewProtectedContact] = useState('');

  // Voice Engine
  const { speak, isSpeaking, stopSpeaking } = useJarvisVoice();

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [msgs, stgs, sum] = await Promise.all([
        CommunicationAgent.getMessages(),
        CommunicationAgent.getSettings(),
        CommunicationAgent.getSummary(),
      ]);
      setMessages(msgs);
      setSettings(stgs);
      setSummary(sum);
    } catch (e) {
      toast.error('Erreur lors du chargement des communications.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateSettings = async (partial: Partial<CommunicationSettings>) => {
    try {
      const updated = await CommunicationAgent.saveSettings(partial);
      setSettings(updated);
      toast.success('Paramètres de communication mis à jour.');
    } catch {
      toast.error('Échec de la sauvegarde des paramètres.');
    }
  };

  const handleSpeakSummary = () => {
    if (summary?.spokenSummary) {
      speak(summary.spokenSummary);
    } else {
      speak('Aucun nouveau message pour le moment, Monsieur.');
    }
  };

  const handleReadMessageVoice = (msg: IncomingMessage) => {
    AndroidBridge.vibrate('light');
    const isProt = CommunicationAgent.isProtected(msg, settings);
    const spokenText = CommunicationAgent.formatVocalReading(msg, isProt);
    speak(spokenText);
    CommunicationAgent.markAsRead(msg.id);
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isRead: true } : m)));
  };

  const handleOpenReplyModal = async (msg: IncomingMessage) => {
    AndroidBridge.vibrate('light');
    setSelectedMessage(msg);
    setReplyInstruction('');
    setIsGeneratingDraft(true);

    try {
      const res = await CommunicationAgent.generateReplyDraft(msg, undefined, replyTone);
      setReplyDraft(res.suggestedReply);
    } catch {
      setReplyDraft(`Bonjour ${msg.sender}, bien reçu !`);
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleRegenerateDraft = async (tone = replyTone, customInstruction = replyInstruction) => {
    if (!selectedMessage) return;
    setIsGeneratingDraft(true);
    try {
      const res = await CommunicationAgent.generateReplyDraft(selectedMessage, customInstruction, tone);
      setReplyDraft(res.suggestedReply);
    } catch {
      toast.error('Erreur lors de la génération du brouillon.');
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedMessage || !replyDraft.trim()) return;
    setIsSendingReply(true);

    try {
      const res = await CommunicationAgent.sendReply(selectedMessage, replyDraft.trim());
      toast.success(res.message);
      setReplySuccessModal(`Réponse transmise à ${selectedMessage.sender}`);
      setSelectedMessage(null);
      await loadData();
    } catch (e: any) {
      toast.error('Échec de l\'envoi de la réponse.');
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleMemorize = async (msg: IncomingMessage) => {
    AndroidBridge.vibrate('medium');
    try {
      const res = await CommunicationAgent.memorizeMessage(msg);
      toast.success(res.message);
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isMemorized: true } : m)));
    } catch {
      toast.error('Impossible d\'enregistrer dans la mémoire.');
    }
  };

  const handleTriggerTest = async (source: CommunicationSourceType, sender: string, content: string, category: MessageCategory) => {
    AndroidBridge.vibrate('medium');
    try {
      const res = await apiFetch('/api/communications/test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, sender, content, category }),
      });
      if (res.ok) {
        toast.success(`Notification de test ${source.toUpperCase()} reçue !`);
        await loadData();
      }
    } catch {
      toast.error('Échec du test de notification.');
    }
  };

  const handleAddRule = () => {
    if (!newRuleCondition.trim() || !newRuleTemplate.trim()) {
      toast.error('Veuillez remplir la condition et le modèle de réponse.');
      return;
    }

    const rule: AutoReplyRule = {
      id: `rule_${Date.now()}`,
      contact: newRuleContact.trim() || '*',
      source: newRuleSource,
      conditionText: newRuleCondition.trim(),
      replyTemplate: newRuleTemplate.trim(),
      isEnabled: true,
      safetyGuard: true,
    };

    const updatedRules = [...settings.autoReplyRules, rule];
    handleUpdateSettings({ autoReplyRules: updatedRules });
    setShowAddRule(false);
    setNewRuleContact('');
    setNewRuleCondition('');
    setNewRuleTemplate('');
  };

  const handleDeleteRule = (id: string) => {
    const updated = settings.autoReplyRules.filter((r) => r.id !== id);
    handleUpdateSettings({ autoReplyRules: updated });
  };

  const handleAddProtectedContact = () => {
    if (!newProtectedContact.trim()) return;
    const updated = [...settings.protectedContacts, newProtectedContact.trim()];
    handleUpdateSettings({ protectedContacts: updated });
    setNewProtectedContact('');
  };

  const handleRemoveProtectedContact = (name: string) => {
    const updated = settings.protectedContacts.filter((c) => c !== name);
    handleUpdateSettings({ protectedContacts: updated });
  };

  // Filter messages
  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      // Category / Source filter
      if (categoryFilter !== 'all') {
        const isCat = ['urgent', 'important', 'to_reply', 'info', 'other'].includes(categoryFilter);
        if (isCat && msg.category !== categoryFilter) return false;
        const isSrc = ['whatsapp', 'sms', 'telegram', 'messenger', 'signal', 'generic'].includes(categoryFilter);
        if (isSrc && msg.source !== categoryFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          msg.sender.toLowerCase().includes(q) ||
          msg.content.toLowerCase().includes(q) ||
          msg.appName.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [messages, categoryFilter, searchQuery]);

  return (
    <div className="min-h-full p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in text-slate-100">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-cyan-500/20 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Assistant Communication & Notifications
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono">
                  Phase 9
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                Écoute des notifications Android, analyse sémantique, lecture vocale et réponses sécurisées
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Voice Summary */}
          <button
            onClick={handleSpeakSummary}
            disabled={isSpeaking}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-sm font-medium transition-all cursor-pointer shadow-sm shadow-cyan-500/10"
          >
            <Volume2 className={`w-4 h-4 ${isSpeaking ? 'animate-pulse text-cyan-200' : ''}`} />
            <span>{isSpeaking ? 'Lecture en cours...' : 'Résumer vocalement'}</span>
          </button>

          {/* Private Mode Toggle */}
          <button
            onClick={() => handleUpdateSettings({ privateMode: !settings.privateMode })}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border transition-all cursor-pointer ${
              settings.privateMode
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            {settings.privateMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>Mode Privé : {settings.privateMode ? 'ON' : 'OFF'}</span>
          </button>

          {/* Refresh */}
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 transition-all cursor-pointer"
            title="Actualiser les messages"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Non Lus */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">Messages non lus</span>
            <div className="text-2xl font-bold text-white mt-0.5">
              {summary?.totalCount || 0}
            </div>
            <span className="text-[11px] text-cyan-400">Écoute active en arrière-plan</span>
          </div>
          <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Bell className="w-5 h-5" />
          </div>
        </div>

        {/* Urgents */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">🔴 Urgents</span>
            <div className="text-2xl font-bold text-red-400 mt-0.5">
              {summary?.urgentCount || 0}
            </div>
            <span className="text-[11px] text-red-400/80">Priorité haute détectée</span>
          </div>
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        {/* À Répondre */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">🟡 À répondre</span>
            <div className="text-2xl font-bold text-amber-400 mt-0.5">
              {summary?.toReplyCount || 0}
            </div>
            <span className="text-[11px] text-amber-400/80">Brouillon IA disponible</span>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        {/* Service Listener State */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">Notification Listener</span>
            <div className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              🟢 Opérationnel
            </div>
            <span className="text-[11px] text-slate-400">RemoteInput prêt</span>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Shield className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'inbox'
                ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            Boîte de réception ({messages.length})
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'rules'
                ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            Règles & Auto-Réponses ({settings.autoReplyRules.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            Paramètres & Confidentialité
          </button>
        </div>

        {/* Test Notification Simulator Button */}
        <div className="hidden sm:flex items-center gap-1.5">
          <span className="text-xs text-slate-500">Tester :</span>
          <button
            onClick={() => handleTriggerTest('whatsapp', 'Sophie Durand', 'Tu viens au point de synchronisation à 14h30 ?', 'to_reply')}
            className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-mono transition-all cursor-pointer"
          >
            + WhatsApp
          </button>
          <button
            onClick={() => handleTriggerTest('sms', 'Alexandre Martin', 'URGENT : Valide le déploiement sur le cluster !', 'urgent')}
            className="px-2 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-mono transition-all cursor-pointer"
          >
            + SMS
          </button>
          <button
            onClick={() => handleTriggerTest('telegram', 'DevOps Alert', 'Sauvegarde nocturne terminée avec succès.', 'info')}
            className="px-2 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-400 text-xs font-mono transition-all cursor-pointer"
          >
            + Telegram
          </button>
        </div>
      </div>

      {/* TAB 1: INBOX */}
      {activeTab === 'inbox' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
            {/* Search Bar */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher contact, message, app..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
              {[
                { id: 'all', label: 'Tous' },
                { id: 'urgent', label: '🔴 Urgents' },
                { id: 'to_reply', label: '🟡 À répondre' },
                { id: 'important', label: '🟠 Importants' },
                { id: 'whatsapp', label: 'WhatsApp' },
                { id: 'sms', label: 'SMS' },
                { id: 'telegram', label: 'Telegram' },
                { id: 'signal', label: 'Signal' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setCategoryFilter(pill.id as any)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    categoryFilter === pill.id
                      ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300'
                      : 'bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-slate-400'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Messages Stream */}
          {filteredMessages.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
              <MessageSquare className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-base font-semibold text-slate-300">Aucun message trouvé</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Vos notifications reçues sur WhatsApp, SMS, Telegram, Signal et Messenger apparaîtront ici en temps réel.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMessages.map((msg) => {
                const sourceConfig = COMMUNICATION_SOURCES[msg.source] || COMMUNICATION_SOURCES.generic;
                const isProt = CommunicationAgent.isProtected(msg, settings);

                return (
                  <div
                    key={msg.id}
                    className={`p-4 rounded-xl border transition-all ${
                      !msg.isRead
                        ? 'bg-slate-900/80 border-cyan-500/30 shadow-sm shadow-cyan-500/5'
                        : 'bg-slate-900/40 border-slate-800/80'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      {/* Left: Contact Info & Message */}
                      <div className="flex items-start gap-3">
                        {/* Avatar Initial */}
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border"
                          style={{
                            backgroundColor: `${sourceConfig.color}20`,
                            borderColor: `${sourceConfig.color}40`,
                            color: sourceConfig.color,
                          }}
                        >
                          {msg.sender.charAt(0).toUpperCase()}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-white">{msg.sender}</span>

                            {/* App Badge */}
                            <span className={`text-[11px] px-2 py-0.5 rounded-md border font-mono ${sourceConfig.badgeBg}`}>
                              {sourceConfig.name}
                            </span>

                            {/* Category Badge */}
                            {msg.category === 'urgent' && (
                              <span className="text-[11px] px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 font-medium">
                                🔴 Urgent
                              </span>
                            )}
                            {msg.category === 'to_reply' && (
                              <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium">
                                🟡 À répondre
                              </span>
                            )}
                            {msg.category === 'important' && (
                              <span className="text-[11px] px-2 py-0.5 rounded-md bg-orange-500/10 border border-orange-500/20 text-orange-400 font-medium">
                                🟠 Important
                              </span>
                            )}

                            {isProt && (
                              <span className="text-[11px] px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center gap-1 font-mono">
                                <Lock className="w-3 h-3" /> Protégé
                              </span>
                            )}

                            {/* Group indicator */}
                            {msg.isGroup && msg.groupTitle && (
                              <span className="text-[11px] text-slate-400 italic">
                                ({msg.groupTitle})
                              </span>
                            )}
                          </div>

                          {/* Message Content */}
                          <div className="text-sm text-slate-200 mt-1 leading-relaxed">
                            {isProt ? (
                              <span className="text-slate-400 italic">
                                [ Contenu confidentiel masqué en mode protégé ]
                              </span>
                            ) : (
                              msg.content
                            )}
                          </div>

                          {/* Timestamp & Meta */}
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-2">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(msg.timestamp).toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>

                            {msg.repliedAt && (
                              <span className="text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Répondu : "{msg.sentReplyText}"
                              </span>
                            )}

                            {msg.isMemorized && (
                              <span className="text-cyan-400 flex items-center gap-1 font-mono">
                                <Brain className="w-3 h-3" />
                                Mémorisé
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Actions */}
                      <div className="flex items-center gap-1.5 self-end sm:self-start shrink-0">
                        {/* Vocalize */}
                        <button
                          onClick={() => handleReadMessageVoice(msg)}
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                          title="Lire le message à voix haute"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>

                        {/* Reply Button */}
                        {msg.replyAvailable && (
                          <button
                            onClick={() => handleOpenReplyModal(msg)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-semibold transition-all cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Répondre</span>
                          </button>
                        )}

                        {/* Memorize Button */}
                        <button
                          onClick={() => handleMemorize(msg)}
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 transition-all cursor-pointer"
                          title="Enregistrer dans la mémoire personnelle de JARVIS"
                        >
                          <Brain className="w-4 h-4" />
                        </button>

                        {/* Open App Fallback */}
                        <button
                          onClick={() => AndroidBridge.openApp(msg.appName)}
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                          title={`Ouvrir dans l'application ${msg.appName}`}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AUTO-REPLY RULES */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Règles de Réponse Automatique & Sécurité</h2>
              <p className="text-xs text-slate-400">
                Par défaut, JARVIS demande TOUJOURS confirmation. Les réponses automatiques s'appliquent uniquement aux règles explicitement configurées.
              </p>
            </div>

            <button
              onClick={() => setShowAddRule(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-semibold transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle Règle</span>
            </button>
          </div>

          {/* Rules List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settings.autoReplyRules.map((rule) => (
              <div
                key={rule.id}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                    {rule.source === 'all' ? 'Toutes les applications' : rule.source.toUpperCase()}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const updated = settings.autoReplyRules.map((r) =>
                          r.id === rule.id ? { ...r, isEnabled: !r.isEnabled } : r
                        );
                        handleUpdateSettings({ autoReplyRules: updated });
                      }}
                      className={`text-xs px-2.5 py-0.5 rounded-full border transition-all cursor-pointer ${
                        rule.isEnabled
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {rule.isEnabled ? 'Active' : 'Désactivée'}
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-slate-400">
                    Condition déclenchante : <strong className="text-slate-200">"{rule.conditionText}"</strong>
                  </div>
                  <div className="text-xs text-slate-400">
                    Contact ciblé : <strong className="text-slate-200">{rule.contact === '*' ? 'Tous les contacts' : rule.contact}</strong>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300 italic">
                  "{rule.replyTemplate}"
                </div>
              </div>
            ))}
          </div>

          {/* Add Rule Form Modal */}
          {showAddRule && (
            <div className="p-5 rounded-2xl bg-slate-900 border border-cyan-500/40 shadow-xl space-y-4 animate-scale-in">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                Ajouter une règle de réponse conditionnelle
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Application source</label>
                  <select
                    value={newRuleSource}
                    onChange={(e) => setNewRuleSource(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="all">Toutes les applications</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">SMS</option>
                    <option value="telegram">Telegram</option>
                    <option value="signal">Signal</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Contact ciblé (* pour tous)</label>
                  <input
                    type="text"
                    placeholder="Ex: Sophie ou *"
                    value={newRuleContact}
                    onChange={(e) => setNewRuleContact(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Mot-clé ou condition dans le message</label>
                <input
                  type="text"
                  placeholder="Ex: es-tu disponible, en réunion, rdv"
                  value={newRuleCondition}
                  onChange={(e) => setNewRuleCondition(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Message de réponse automatique</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Bonjour, je suis en réunion et je vous recontacte dès que possible."
                  value={newRuleTemplate}
                  onChange={(e) => setNewRuleTemplate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowAddRule(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddRule}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-sm font-semibold text-slate-950 transition-colors cursor-pointer"
                >
                  Enregistrer la règle
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SETTINGS & PRIVACY */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Audio & Vocal Settings */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-cyan-400" />
              Options de Vocalisation & Écoute
            </h3>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 cursor-pointer">
                <div>
                  <span className="text-sm font-medium text-white block">Lecture vocale automatique</span>
                  <span className="text-xs text-slate-400">Vocalise les messages dès leur réception sans attendre d'ordre</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoRead}
                  onChange={(e) => handleUpdateSettings({ autoRead: e.target.checked })}
                  className="w-4 h-4 accent-cyan-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 cursor-pointer">
                <div>
                  <span className="text-sm font-medium text-white block">Lire uniquement les messages importants</span>
                  <span className="text-xs text-slate-400">Ignore les messages d'information ou non urgents en vocal</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.readOnlyImportant}
                  onChange={(e) => handleUpdateSettings({ readOnlyImportant: e.target.checked })}
                  className="w-4 h-4 accent-cyan-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 cursor-pointer">
                <div>
                  <span className="text-sm font-medium text-white block">Toujours demander confirmation avant envoi</span>
                  <span className="text-xs text-slate-400">Sécurité 3 niveaux : JARVIS ne transmet aucune réponse sans votre accord</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.confirmBeforeSend}
                  onChange={(e) => handleUpdateSettings({ confirmBeforeSend: e.target.checked })}
                  className="w-4 h-4 accent-cyan-500 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Protected Contacts & Privacy Mode */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" />
              Contacts & Applications Protégés
            </h3>

            <p className="text-xs text-slate-400">
              Les messages provenant de ces contacts ne seront jamais lus à voix haute et ne seront stockés dans aucune mémoire permanente.
            </p>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Nom du contact (ex: Banquier, RH, Dr Dupont)..."
                value={newProtectedContact}
                onChange={(e) => setNewProtectedContact(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddProtectedContact()}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={handleAddProtectedContact}
                className="px-3.5 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 text-white font-medium text-sm transition-colors cursor-pointer"
              >
                Ajouter
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-2">
              {settings.protectedContacts.map((contact) => (
                <span
                  key={contact}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-medium"
                >
                  <Lock className="w-3 h-3" />
                  {contact}
                  <button
                    onClick={() => handleRemoveProtectedContact(contact)}
                    className="hover:text-red-400 ml-1 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* QUICK REPLY COMPOSER MODAL (3 LEVELS CONFIRMATION) */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-cyan-500/40 shadow-2xl p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  Préparation de réponse pour {selectedMessage.sender}
                </h3>
              </div>
              <button
                onClick={() => setSelectedMessage(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Level 1: Original Message */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
              <span className="text-slate-500 font-mono">Message reçu sur {selectedMessage.appName} :</span>
              <p className="text-slate-200 italic font-medium">"{selectedMessage.content}"</p>
            </div>

            {/* Tone Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Ton :</span>
              {[
                { id: 'polite', label: 'Poli' },
                { id: 'short', label: 'Court' },
                { id: 'casual', label: 'Décontracté' },
                { id: 'direct', label: 'Direct' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setReplyTone(t.id as any);
                    handleRegenerateDraft(t.id as any);
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                    replyTone === t.id
                      ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Instruction input */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400 block">Consigne optionnelle (ex: dis que je serai en retard de 10 min)</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ex: confirme pour 14h30..."
                  value={replyInstruction}
                  onChange={(e) => setReplyInstruction(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRegenerateDraft(replyTone, replyInstruction)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={() => handleRegenerateDraft(replyTone, replyInstruction)}
                  disabled={isGeneratingDraft}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-cyan-300 font-medium transition-colors cursor-pointer"
                >
                  Régénérer
                </button>
              </div>
            </div>

            {/* Level 2: Draft Output */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-medium block">Texte de la réponse à envoyer :</label>
              <textarea
                rows={3}
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-950 border border-cyan-500/30 text-sm text-white focus:outline-none focus:border-cyan-400 font-sans"
              />
            </div>

            {/* Level 3: Confirm and Dispatch */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedMessage(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 transition-colors cursor-pointer"
              >
                Annuler
              </button>

              <button
                onClick={handleSendReply}
                disabled={isSendingReply || !replyDraft.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
              >
                <SendHorizonal className="w-4 h-4" />
                <span>{isSendingReply ? 'Envoi en cours...' : 'Confirmer & Envoyer'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
