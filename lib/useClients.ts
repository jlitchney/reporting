'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { parseCSV } from './csvParser';
import type { ParsedData, ChartConfig } from './types';

export interface StoredClient {
  id: string;
  name: string;
  blobUrl: string;
  chartConfigs: ChartConfig[];
  lastUpdated: string;
}

export function useClients() {
  const [clients, setClients] = useState<StoredClient[]>([]);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);

  // In-memory CSV cache so switching clients is instant after first load
  const csvCache = useRef(new Map<string, ParsedData>());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const loadCSV = useCallback(async (client: StoredClient) => {
    if (csvCache.current.has(client.id)) {
      setParsedData(csvCache.current.get(client.id)!);
      return;
    }
    setCsvLoading(true);
    try {
      const text = await fetch(client.blobUrl).then((r) => r.text());
      const parsed = parseCSV(text, client.name);
      csvCache.current.set(client.id, parsed);
      setParsedData(parsed);
    } finally {
      setCsvLoading(false);
    }
  }, []);

  // Load client list on mount
  useEffect(() => {
    fetch('/api/clients')
      .then((r) => r.json())
      .then(async (list: StoredClient[]) => {
        setClients(list);
        if (list.length > 0) {
          setActiveClientId(list[0].id);
          await loadCSV(list[0]);
        }
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, [loadCSV]);

  const upsertClient = useCallback(
    async (name: string, file: File, existingId?: string) => {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('csv', file);

      let client: StoredClient;
      if (existingId) {
        const res = await fetch(`/api/clients/${existingId}/csv`, {
          method: 'PUT',
          body: formData,
        });
        client = await res.json();
        setClients((prev) => prev.map((c) => (c.id === existingId ? client : c)));
      } else {
        const res = await fetch('/api/clients', { method: 'POST', body: formData });
        client = await res.json();
        setClients((prev) => [...prev, client]);
      }

      // Invalidate cache so fresh data is fetched
      csvCache.current.delete(client.id);
      setActiveClientId(client.id);
      await loadCSV(client);
      return client.id;
    },
    [loadCSV]
  );

  const selectClient = useCallback(
    (id: string, allClients: StoredClient[]) => {
      const client = allClients.find((c) => c.id === id);
      if (!client) return;
      setActiveClientId(id);
      loadCSV(client);
    },
    [loadCSV]
  );

  const updateCharts = useCallback((clientId: string, chartConfigs: ChartConfig[]) => {
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, chartConfigs } : c))
    );
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chartConfigs }),
      }).catch(() => {});
    }, 800);
  }, []);

  const removeClient = useCallback(
    (id: string, allClients: StoredClient[]) => {
      fetch(`/api/clients/${id}`, { method: 'DELETE' }).catch(() => {});
      const next = allClients.filter((c) => c.id !== id);
      setClients(next);
      csvCache.current.delete(id);
      if (activeClientId === id) {
        if (next.length > 0) {
          setActiveClientId(next[0].id);
          loadCSV(next[0]);
        } else {
          setActiveClientId(null);
          setParsedData(null);
        }
      }
    },
    [activeClientId, loadCSV]
  );

  const activeClient = clients.find((c) => c.id === activeClientId) ?? null;

  return {
    hydrated,
    csvLoading,
    clients,
    activeClient,
    activeClientId,
    parsedData,
    upsertClient,
    selectClient,
    updateCharts,
    removeClient,
  };
}
