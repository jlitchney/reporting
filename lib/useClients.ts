'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { upload } from '@vercel/blob/client';
import { parseCSV } from './csvParser';
import type { ParsedData, ChartConfig, ClientTab } from './types';
import type { SpendEntry } from './redis';

export type { SpendEntry };

export interface StoredClient {
  id: string;
  name: string;
  blobUrl: string;
  tabs: ClientTab[];
  lastUpdated: string;
  spendData?: SpendEntry[];
}

function migrateClient(raw: Record<string, unknown>): StoredClient {
  if (raw.tabs) return raw as unknown as StoredClient;
  return {
    ...(raw as unknown as StoredClient),
    tabs: [{ id: 'tab-default', name: 'Overview', chartConfigs: (raw.chartConfigs as ChartConfig[]) ?? [] }],
  };
}

function patchClient(clientId: string, body: Record<string, unknown>) {
  fetch(`/api/clients/${clientId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export function useClients() {
  const [clients, setClients] = useState<StoredClient[]>([]);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);

  const csvCache = useRef(new Map<string, ParsedData>());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const loadCSV = useCallback(async (client: StoredClient) => {
    if (csvCache.current.has(client.id)) {
      setParsedData(csvCache.current.get(client.id)!);
      return;
    }
    setCsvLoading(true);
    try {
      const res = await fetch(`/api/clients/${client.id}/csv`);
      if (!res.ok) throw new Error(`CSV load failed: ${res.status}`);
      const text = await res.text();
      const parsed = parseCSV(text, client.name);
      csvCache.current.set(client.id, parsed);
      setParsedData(parsed);
    } finally {
      setCsvLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch('/api/clients')
      .then((r) => r.json())
      .then(async (list: Record<string, unknown>[]) => {
        const migrated = list.map(migrateClient);
        setClients(migrated);
        if (migrated.length > 0) {
          setActiveClientId(migrated[0].id);
          setActiveTabId(migrated[0].tabs[0]?.id ?? null);
          await loadCSV(migrated[0]);
        }
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, [loadCSV]);

  const upsertClient = useCallback(
    async (name: string, file: File, existingId?: string) => {
      const blob = await upload(`clients/${existingId ?? `new-${Date.now()}`}/${file.name}`, file, {
        access: 'private',
        handleUploadUrl: '/api/upload-token',
      });

      let client: StoredClient;
      if (existingId) {
        const res = await fetch(`/api/clients/${existingId}/csv`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blobUrl: blob.url }),
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.status} ${await res.text()}`);
        client = migrateClient(await res.json());
        setClients((prev) => prev.map((c) => (c.id === existingId ? client : c)));
      } else {
        const res = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, blobUrl: blob.url }),
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.status} ${await res.text()}`);
        client = migrateClient(await res.json());
        setClients((prev) => [...prev, client]);
      }

      csvCache.current.delete(client.id);
      setActiveClientId(client.id);
      setActiveTabId(client.tabs[0]?.id ?? null);
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
      setActiveTabId(client.tabs[0]?.id ?? null);
      loadCSV(client);
    },
    [loadCSV]
  );

  const renameClient = useCallback((id: string, name: string) => {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
    patchClient(id, { name });
  }, []);

  const updateTabCharts = useCallback((clientId: string, tabId: string, chartConfigs: ChartConfig[]) => {
    let savedTabs: ClientTab[] = [];
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;
        savedTabs = c.tabs.map((t) => (t.id === tabId ? { ...t, chartConfigs } : t));
        return { ...c, tabs: savedTabs };
      })
    );
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => patchClient(clientId, { tabs: savedTabs }), 800);
  }, []);

  const addTab = useCallback((clientId: string) => {
    const newTab: ClientTab = { id: `tab-${Date.now()}`, name: 'New Tab', chartConfigs: [] };
    let savedTabs: ClientTab[] = [];
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;
        savedTabs = [...c.tabs, newTab];
        return { ...c, tabs: savedTabs };
      })
    );
    setActiveTabId(newTab.id);
    setTimeout(() => patchClient(clientId, { tabs: savedTabs }), 0);
  }, []);

  const removeTab = useCallback((clientId: string, tabId: string, currentTabs: ClientTab[]) => {
    const tabIndex = currentTabs.findIndex((t) => t.id === tabId);
    const newTabs = currentTabs.filter((t) => t.id !== tabId);
    setClients((prev) => prev.map((c) => (c.id !== clientId ? c : { ...c, tabs: newTabs })));
    setActiveTabId((cur) => {
      if (cur !== tabId) return cur;
      return (newTabs[Math.max(0, tabIndex - 1)] ?? newTabs[0])?.id ?? null;
    });
    patchClient(clientId, { tabs: newTabs });
  }, []);

  const renameTab = useCallback((clientId: string, tabId: string, name: string) => {
    let savedTabs: ClientTab[] = [];
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;
        savedTabs = c.tabs.map((t) => (t.id === tabId ? { ...t, name } : t));
        return { ...c, tabs: savedTabs };
      })
    );
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => patchClient(clientId, { tabs: savedTabs }), 800);
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
          setActiveTabId(next[0].tabs[0]?.id ?? null);
          loadCSV(next[0]);
        } else {
          setActiveClientId(null);
          setActiveTabId(null);
          setParsedData(null);
        }
      }
    },
    [activeClientId, loadCSV]
  );

  const selectTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const updateSpend = useCallback((clientId: string, spendData: SpendEntry[]) => {
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, spendData } : c)));
    patchClient(clientId, { spendData });
  }, []);

  const activeClient = clients.find((c) => c.id === activeClientId) ?? null;
  const activeTab = activeClient?.tabs.find((t) => t.id === activeTabId) ?? activeClient?.tabs[0] ?? null;

  return {
    hydrated,
    csvLoading,
    clients,
    activeClient,
    activeClientId,
    activeTab,
    activeTabId,
    parsedData,
    upsertClient,
    selectClient,
    selectTab,
    renameClient,
    updateTabCharts,
    addTab,
    removeTab,
    renameTab,
    removeClient,
    updateSpend,
  };
}
