import { useState, useEffect } from 'react';
import { Database, RefreshCw, CheckCircle2, AlertCircle, Link, Unlink, HardDrive, Mail, FolderGit2, FileText, Smartphone } from 'lucide-react';
import { listConnectors, connectConnector, disconnectConnector, triggerSync, type ConnectorInfo } from '../lib/connectors-api';
import { toast } from 'sonner';

export function DataSourcesPage() {
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConnectors = async () => {
    setLoading(true);
    try {
      const data = await listConnectors();
      setConnectors(data);
    } catch (e) {
      console.warn('Failed to load connectors', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConnectors();
  }, []);

  const handleToggleConnect = async (c: ConnectorInfo) => {
    try {
      if (c.connected) {
        await disconnectConnector(c.connector_id);
        toast.info(`${c.name} déconnecté`);
      } else {
        await connectConnector(c.connector_id);
        toast.success(`${c.name} connecté avec succès`);
      }
      loadConnectors();
    } catch (e: any) {
      toast.error(e.message || 'Action impossible');
    }
  };

  const handleSync = async (c: ConnectorInfo) => {
    try {
      await triggerSync(c.connector_id);
      toast.success(`Synchronisation de ${c.name} effectuée`);
      loadConnectors();
    } catch (e: any) {
      toast.error(e.message || 'Erreur de synchronisation');
    }
  };

  const getSourceIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('mail') || lower.includes('gmail')) return <Mail className="w-5 h-5 text-red-400" />;
    if (lower.includes('github')) return <FolderGit2 className="w-5 h-5 text-slate-200" />;
    if (lower.includes('notes') || lower.includes('obsidian')) return <FileText className="w-5 h-5 text-purple-400" />;
    if (lower.includes('android')) return <Smartphone className="w-5 h-5 text-green-400" />;
    return <HardDrive className="w-5 h-5 text-cyan-400" />;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <Database className="w-6 h-6 text-cyan-400" />
            Connecteurs & Sources de Données Locales
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Connectez vos données personnelles (Apple Notes, Obsidian, Gmail, GitHub, Android) pour nourrir la mémoire hybride d'OpenJarvis sans fuite vers le cloud.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {connectors.map((c) => (
            <div
              key={c.connector_id}
              className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      {getSourceIcon(c.name)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-slate-100">{c.name}</h3>
                      <span className="text-[11px] text-slate-400 capitalize">{c.category}</span>
                    </div>
                  </div>

                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-mono flex items-center gap-1.5 ${
                      c.connected
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${c.connected ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                    {c.connected ? 'Connecté' : 'Inactif'}
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  {c.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <div className="text-[11px] text-slate-500 font-mono">
                  {c.connected ? `${c.item_count || 0} éléments indexés` : 'Non indexé'}
                </div>

                <div className="flex items-center gap-2">
                  {c.connected && (
                    <button
                      onClick={() => handleSync(c)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-colors"
                      title="Forcer la synchronisation"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Sync</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleToggleConnect(c)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      c.connected
                        ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                        : 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30'
                    }`}
                  >
                    {c.connected ? <Unlink className="w-3.5 h-3.5" /> : <Link className="w-3.5 h-3.5" />}
                    <span>{c.connected ? 'Déconnecter' : 'Connecter'}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
