import { apiFetch } from './api';

export interface ConnectorInfo {
  id: string;
  connector_id: string;
  name: string;
  description: string;
  category: string;
  connected: boolean;
  item_count: number;
  last_synced_at?: string;
  sync_status: 'idle' | 'syncing' | 'synced' | 'error';
  auth_type: string;
}

export async function listConnectors(): Promise<ConnectorInfo[]> {
  try {
    const res = await apiFetch('/v1/connectors');
    if (!res.ok) return [];
    const data = await res.json();
    return (data.connectors || []).map((c: any) => ({
      ...c,
      connector_id: c.id || c.connector_id,
    }));
  } catch {
    return [];
  }
}

export async function connectConnector(connectorId: string): Promise<any> {
  const res = await apiFetch(`/v1/connectors/${connectorId}/connect`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to connect connector');
  return res.json();
}

export async function disconnectConnector(connectorId: string): Promise<any> {
  const res = await apiFetch(`/v1/connectors/${connectorId}/disconnect`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to disconnect connector');
  return res.json();
}

export async function triggerSync(connectorId: string): Promise<any> {
  const res = await apiFetch(`/v1/connectors/${connectorId}/sync`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to sync connector');
  return res.json();
}

export async function getSyncStatus(connectorId: string): Promise<any> {
  const res = await apiFetch(`/v1/connectors/${connectorId}/sync`);
  if (!res.ok) return { status: 'idle', progress: 0 };
  return res.json();
}
