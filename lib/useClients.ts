'use client';

import { useState, useEffect, useCallback } from 'react';
import { parseCSV } from './csvParser';
import type { ParsedData, ChartConfig } from './types';

const STORAGE_KEY = 'ast_reporting_clients';

export interface StoredClient {
  id: string;
  name: string;
  csvText: string;
  chartConfigs: ChartConfig[];
  lastUpdated: string;
}

// One default chart per TagGroup (using the first tag as starting metric).
// Skip large groups like "Utm Sources" — those belong in chart filters.
const MAX_TAGS_FOR_DEFAULT_CHART = 8;

function defaultCharts(data: ParsedData): ChartConfig[] {
  const charts: ChartConfig[] = [];
  let i = 0;
  for (const group of data.tagGroups) {
    if (group.tags.length > MAX_TAGS_FOR_DEFAULT_CHART) continue;
    const col = group.tags[0];
    charts.push({
      id: `chart-${Date.now()}-${i++}`,
      title: `${group.name} by week`,
      query: {
        metric: col.label,
        filters: [],
        dateField: col.label,
        groupBy: 'week' as const,
        startDate: null,
        endDate: null,
      },
    });
  }
  if (charts.length === 0 && data.tagColumns.length > 0) {
    const col = data.tagColumns[0];
    charts.push({
      id: `chart-${Date.now()}-0`,
      title: `${col.tag} by week`,
      query: {
        metric: col.label,
        filters: [],
        dateField: col.label,
        groupBy: 'week' as const,
        startDate: null,
        endDate: null,
      },
    });
  }
  return charts;
}

function loadFromStorage(): StoredClient[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(clients: StoredClient[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
  } catch {
    // quota exceeded — silently ignore
  }
}

export function useClients() {
  const [clients, setClients] = useState<StoredClient[]>([]);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = loadFromStorage();
    setClients(stored);
    if (stored.length > 0) {
      const first = stored[0];
      setActiveClientId(first.id);
      setParsedData(parseCSV(first.csvText, first.name));
    }
    setHydrated(true);
  }, []);

  const upsertClient = useCallback(
    (name: string, csvText: string, existingId?: string) => {
      const parsed = parseCSV(csvText, name);
      const id = existingId ?? `client-${Date.now()}`;

      setClients((prev) => {
        const existing = prev.find((c) => c.id === id);
        const chartConfigs =
          existing && existing.chartConfigs.length > 0
            ? existing.chartConfigs
            : defaultCharts(parsed);

        const updated: StoredClient = {
          id,
          name,
          csvText,
          chartConfigs,
          lastUpdated: new Date().toISOString(),
        };

        const next = existingId
          ? prev.map((c) => (c.id === id ? updated : c))
          : [...prev, updated];

        saveToStorage(next);
        return next;
      });

      setActiveClientId(id);
      setParsedData(parsed);
      return id;
    },
    []
  );

  const selectClient = useCallback(
    (id: string, allClients: StoredClient[]) => {
      const client = allClients.find((c) => c.id === id);
      if (!client) return;
      setActiveClientId(id);
      setParsedData(parseCSV(client.csvText, client.name));
    },
    []
  );

  const updateCharts = useCallback((clientId: string, chartConfigs: ChartConfig[]) => {
    setClients((prev) => {
      const next = prev.map((c) =>
        c.id === clientId ? { ...c, chartConfigs } : c
      );
      saveToStorage(next);
      return next;
    });
  }, []);

  const removeClient = useCallback(
    (id: string, allClients: StoredClient[]) => {
      const next = allClients.filter((c) => c.id !== id);
      setClients(next);
      saveToStorage(next);
      if (activeClientId === id) {
        const fallback = next[0] ?? null;
        if (fallback) {
          setActiveClientId(fallback.id);
          setParsedData(parseCSV(fallback.csvText, fallback.name));
        } else {
          setActiveClientId(null);
          setParsedData(null);
        }
      }
    },
    [activeClientId]
  );

  const activeClient = clients.find((c) => c.id === activeClientId) ?? null;

  return {
    hydrated,
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
