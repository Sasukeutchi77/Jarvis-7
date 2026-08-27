import { useState, useEffect } from 'react';
import { Cpu, ShieldCheck, Zap, RefreshCw, Layers, Globe } from 'lucide-react';

interface RouterConfig {
  primaryProvider: string;
  secondaryProvider: string;
  fallbackProvider: string;
  timeoutMs: number;
  maxRetries: number;
  preferredModels?: Record<string, string>;
}

interface ProviderInfo {
  id: string;
  name: string;
  configured: boolean;
  models: string[];
  speed: string;
}

export function AiProviderRouterSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [activeConfig, setActiveConfig] = useState<RouterConfig>({
    primaryProvider: 'groq',
    secondaryProvider: 'gemini',
    fallbackProvider: 'anthropic',
    timeoutMs: 20000,
    maxRetries: 2,
  });

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/ai-providers/status');
      if (res.ok) {
        const data = await res.json();
        if (data.providers) setProviders(data.providers);
        if (data.activeConfig) setActiveConfig(data.activeConfig);
      }
    } catch (e) {
      console.warn('Failed to fetch AI router status:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/ai-providers/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeConfig),
      });
      if (res.ok) {
        setSavedMessage('Configuration du Router sauvegardée avec succès');
        setTimeout(() => setSavedMessage(''), 3500);
      }
    } catch (e) {
      console.error('Failed to save AI router config:', e);
    } finally {
      setSaving(false);
    }
  };

  const providerOptions = [
    { id: 'groq', name: 'Groq AI (LPU Ultra-Rapide)' },
    { id: 'gemini', name: 'Google Gemini Neural Core' },
    { id: 'anthropic', name: 'Anthropic Claude (Sonnet / Haiku)' },
    { id: 'openrouter', name: 'OpenRouter (Passerelle Multi-Modèles)' },
    { id: 'openai', name: 'OpenAI GPT' },
    { id: 'local', name: 'Moteur Neuronal On-Device' },
  ];

  return (
    <div
      className="rounded-xl p-5 mb-5"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers size={18} className="text-cyan-400" />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            JARVIS AI Provider Router (Cascading Fallback)
          </h3>
        </div>
        <button
          onClick={fetchStatus}
          className="p-1 rounded text-xs flex items-center gap-1 opacity-70 hover:opacity-100 cursor-pointer"
          style={{ color: 'var(--color-text-secondary)' }}
          title="Rafraîchir les statuts"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Actualiser</span>
        </button>
      </div>

      <p className="text-xs mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
        Sélection dynamique et cascade automatique en cas d'indisponibilité ou d'erreur réseau / quota.
      </p>

      {/* Provider Status Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        {providers.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between p-2 rounded-lg text-xs"
            style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-subtle)' }}
          >
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  display: 'inline-block',
                  background: p.configured ? 'var(--color-success)' : 'var(--color-text-tertiary)',
                  boxShadow: p.configured ? '0 0 6px var(--color-success)' : 'none',
                }}
              />
              <span className="font-medium truncate" style={{ color: 'var(--color-text)' }}>
                {p.name.split(' ')[0]}
              </span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
              {p.configured ? 'Actif' : 'Non configuré'}
            </span>
          </div>
        ))}
      </div>

      {/* Router Routing Selection */}
      <div className="space-y-3 pt-2" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
        {/* Primary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
              1. Fournisseur Principal (Priorité 1)
            </div>
            <div className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
              Sollicité en premier pour toutes les requêtes utilisateur.
            </div>
          </div>
          <select
            value={activeConfig.primaryProvider}
            onChange={(e) => setActiveConfig({ ...activeConfig, primaryProvider: e.target.value })}
            className="text-xs px-2.5 py-1.5 rounded-lg outline-none cursor-pointer"
            style={{
              background: 'var(--color-bg-tertiary)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
            }}
          >
            {providerOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
        </div>

        {/* Secondary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
              2. Fournisseur Secondaire (Priorité 2)
            </div>
            <div className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
              Prend le relais si le fournisseur principal échoue ou atteint un quota.
            </div>
          </div>
          <select
            value={activeConfig.secondaryProvider}
            onChange={(e) => setActiveConfig({ ...activeConfig, secondaryProvider: e.target.value })}
            className="text-xs px-2.5 py-1.5 rounded-lg outline-none cursor-pointer"
            style={{
              background: 'var(--color-bg-tertiary)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
            }}
          >
            {providerOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
        </div>

        {/* Fallback */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
              3. Fournisseur de Secours (Fallback Ultime)
            </div>
            <div className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
              Dernière ligne de défense cloud avant le moteur local JARVIS.
            </div>
          </div>
          <select
            value={activeConfig.fallbackProvider}
            onChange={(e) => setActiveConfig({ ...activeConfig, fallbackProvider: e.target.value })}
            className="text-xs px-2.5 py-1.5 rounded-lg outline-none cursor-pointer"
            style={{
              background: 'var(--color-bg-tertiary)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
            }}
          >
            {providerOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
        </div>

        {/* Preferred Groq Model */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
          <div>
            <div className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
              Modèle Groq configuré (GROQ_MODEL)
            </div>
            <div className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
              LPU haute performance pour inférence ultra-rapide (~500 t/s).
            </div>
          </div>
          <select
            value={activeConfig.preferredModels?.groq || 'llama-3.3-70b-versatile'}
            onChange={(e) =>
              setActiveConfig({
                ...activeConfig,
                preferredModels: {
                  ...(activeConfig.preferredModels || {}),
                  groq: e.target.value,
                },
              })
            }
            className="text-xs px-2.5 py-1.5 rounded-lg outline-none cursor-pointer font-mono"
            style={{
              background: 'var(--color-bg-tertiary)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
            }}
          >
            <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Recommandé)</option>
            <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (Ultra-Rapide)</option>
            <option value="mixtral-8x7b-32768">mixtral-8x7b-32768 (32k Contexte)</option>
            <option value="gemma2-9b-it">gemma2-9b-it (Google Gemma 2)</option>
          </select>
        </div>

        {/* Preferred Gemini Model */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
          <div>
            <div className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
              Modèle Gemini configuré (GEMINI_MODEL)
            </div>
            <div className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
              Raisonnement multimodal, vision et contexte étendu 1M+ tokens.
            </div>
          </div>
          <select
            value={activeConfig.preferredModels?.gemini || 'gemini-2.5-flash'}
            onChange={(e) =>
              setActiveConfig({
                ...activeConfig,
                preferredModels: {
                  ...(activeConfig.preferredModels || {}),
                  gemini: e.target.value,
                },
              })
            }
            className="text-xs px-2.5 py-1.5 rounded-lg outline-none cursor-pointer font-mono"
            style={{
              background: 'var(--color-bg-tertiary)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
            }}
          >
            <option value="gemini-2.5-flash">gemini-2.5-flash (Ultra-rapide & Multimodal)</option>
            <option value="gemini-2.5-pro">gemini-2.5-pro (Raisonnement Complexe & Vision)</option>
            <option value="gemini-2.0-flash">gemini-2.0-flash (Flash 2.0)</option>
          </select>
        </div>

        {/* Preferred Anthropic Model */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
          <div>
            <div className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
              Modèle Anthropic configuré (ANTHROPIC_MODEL)
            </div>
            <div className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
              Raisonnement logique structuré, analyse de code et vision.
            </div>
          </div>
          <select
            value={activeConfig.preferredModels?.anthropic || 'claude-3-7-sonnet-20250219'}
            onChange={(e) =>
              setActiveConfig({
                ...activeConfig,
                preferredModels: {
                  ...(activeConfig.preferredModels || {}),
                  anthropic: e.target.value,
                },
              })
            }
            className="text-xs px-2.5 py-1.5 rounded-lg outline-none cursor-pointer font-mono"
            style={{
              background: 'var(--color-bg-tertiary)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
            }}
          >
            <option value="claude-3-7-sonnet-20250219">claude-3-7-sonnet (Hybrid Reasoning)</option>
            <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet (Code & Vision)</option>
            <option value="claude-3-5-haiku-20241022">claude-3-5-haiku (Rapide & Précis)</option>
          </select>
        </div>

        {/* Preferred OpenRouter Model */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
          <div>
            <div className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
              Modèle OpenRouter configuré (OPENROUTER_MODEL)
            </div>
            <div className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
              Passerelle universelle multi-modèles (DeepSeek R1, Llama 3.3, Claude, Mistral).
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <select
              value={activeConfig.preferredModels?.openrouter || 'anthropic/claude-3.5-sonnet'}
              onChange={(e) =>
                setActiveConfig({
                  ...activeConfig,
                  preferredModels: {
                    ...(activeConfig.preferredModels || {}),
                    openrouter: e.target.value,
                  },
                })
              }
              className="text-xs px-2.5 py-1.5 rounded-lg outline-none cursor-pointer font-mono"
              style={{
                background: 'var(--color-bg-tertiary)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
            >
              <option value="anthropic/claude-3.5-sonnet">anthropic/claude-3.5-sonnet</option>
              <option value="meta-llama/llama-3.3-70b-instruct">meta-llama/llama-3.3-70b-instruct</option>
              <option value="deepseek/deepseek-r1">deepseek/deepseek-r1</option>
              <option value="google/gemini-2.5-flash">google/gemini-2.5-flash</option>
              <option value="mistralai/mistral-large-2411">mistralai/mistral-large-2411</option>
              <option value="openai/gpt-4o">openai/gpt-4o</option>
            </select>
          </div>
        </div>

        {/* Tavily Web Search Status */}
        <div
          className="p-3 rounded-lg flex items-center justify-between gap-3 mt-2"
          style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-subtle)' }}
        >
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-emerald-400" />
            <div>
              <div className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                Recherche Web en Direct (Tavily AI Search)
              </div>
              <div className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                Déclenchement contextuel automatique pour les questions d'actualités, cours et événements récents.
              </div>
            </div>
          </div>
          <span
            className="text-[10px] px-2 py-0.5 rounded font-mono font-medium"
            style={{
              background: providers.find((p) => p.id === 'tavily_search')?.configured
                ? 'rgba(16, 185, 129, 0.15)'
                : 'rgba(239, 68, 68, 0.15)',
              color: providers.find((p) => p.id === 'tavily_search')?.configured
                ? '#10b981'
                : '#ef4444',
            }}
          >
            {providers.find((p) => p.id === 'tavily_search')?.configured ? 'TAVILY ACTIF' : 'CLÉ NON DÉFINIE'}
          </span>
        </div>

        {/* Timeout & Retries */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div>
            <label className="text-[11px] block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Timeout de requête (ms)
            </label>
            <input
              type="number"
              value={activeConfig.timeoutMs}
              onChange={(e) => setActiveConfig({ ...activeConfig, timeoutMs: parseInt(e.target.value, 10) || 15000 })}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg outline-none"
              style={{
                background: 'var(--color-bg-tertiary)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
            />
          </div>

          <div>
            <label className="text-[11px] block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Nombre de tentatives max
            </label>
            <input
              type="number"
              value={activeConfig.maxRetries}
              onChange={(e) => setActiveConfig({ ...activeConfig, maxRetries: parseInt(e.target.value, 10) || 2 })}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg outline-none"
              style={{
                background: 'var(--color-bg-tertiary)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
            />
          </div>
        </div>

        {/* Save button & status */}
        <div className="flex items-center justify-between pt-3">
          <div className="text-xs">
            {savedMessage && <span style={{ color: 'var(--color-success)' }}>{savedMessage}</span>}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-xs px-4 py-1.5 rounded-lg font-medium outline-none cursor-pointer flex items-center gap-1.5"
            style={{
              background: 'var(--color-accent, #3b82f6)',
              color: '#ffffff',
            }}
          >
            <Zap size={13} />
            <span>{saving ? 'Enregistrement...' : 'Appliquer le routage'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
