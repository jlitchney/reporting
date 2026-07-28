'use client';

import { useCallback, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import MetricCards from '@/components/MetricCards';
import ChartPanel, { CHART_ACCENT_COLORS } from '@/components/ChartPanel';
import FileUpload from '@/components/FileUpload';
import { useClients } from '@/lib/useClients';
import { clientNameFromFilename } from '@/lib/csvParser';
import type { ChartConfig } from '@/lib/types';

function newChart(data: NonNullable<ReturnType<typeof useClients>['parsedData']>, index: number): ChartConfig {
  const tag = data.tagColumns[index % data.tagColumns.length];
  return {
    id: `chart-${Date.now()}-${index}`,
    title: tag ? `${tag.tag} over time` : 'New Chart',
    query: {
      metric: tag?.label ?? null,
      filters: [],
      dateField: tag?.label ?? 'created',
      groupBy: 'week',
      startDate: null,
      endDate: null,
    },
  };
}

export default function Home() {
  const {
    hydrated,
    clients,
    activeClient,
    activeClientId,
    parsedData,
    upsertClient,
    selectClient,
    updateCharts,
    removeClient,
  } = useClients();

  const refreshInputRef = useRef<HTMLInputElement>(null);

  const handleRefreshFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !activeClientId) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        upsertClient(activeClient?.name ?? clientNameFromFilename(file.name), ev.target?.result as string, activeClientId);
        if (refreshInputRef.current) refreshInputRef.current.value = '';
      };
      reader.readAsText(file);
    },
    [activeClientId, activeClient, upsertClient]
  );

  const handleAddClient = useCallback(
    (name: string, csvText: string) => {
      upsertClient(name, csvText);
    },
    [upsertClient]
  );

  const handleSelectClient = useCallback(
    (id: string) => selectClient(id, clients),
    [selectClient, clients]
  );

  const handleRemoveClient = useCallback(
    (id: string) => removeClient(id, clients),
    [removeClient, clients]
  );

  const handleUpdateChart = useCallback(
    (chartId: string, updates: Partial<ChartConfig>) => {
      if (!activeClientId || !activeClient) return;
      const updated = activeClient.chartConfigs.map((c) =>
        c.id === chartId ? { ...c, ...updates } : c
      );
      updateCharts(activeClientId, updated);
    },
    [activeClientId, activeClient, updateCharts]
  );

  const handleRemoveChart = useCallback(
    (chartId: string) => {
      if (!activeClientId || !activeClient) return;
      updateCharts(activeClientId, activeClient.chartConfigs.filter((c) => c.id !== chartId));
    },
    [activeClientId, activeClient, updateCharts]
  );

  const handleAddChart = useCallback(() => {
    if (!activeClientId || !activeClient || !parsedData) return;
    const next = [...activeClient.chartConfigs, newChart(parsedData, activeClient.chartConfigs.length)];
    updateCharts(activeClientId, next);
  }, [activeClientId, activeClient, parsedData, updateCharts]);

  const charts = activeClient?.chartConfigs ?? [];

  // Loading state
  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-[#1e3a6e]" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar
        clients={clients}
        activeClientId={activeClientId}
        onSelectClient={handleSelectClient}
        onAddClient={handleAddClient}
        onRemoveClient={handleRemoveClient}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">Reports</span>
            {activeClient && (
              <>
                <svg className="h-3 w-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="font-semibold text-slate-700">{activeClient.name}</span>
              </>
            )}
          </div>
          {activeClient && (
            <div className="flex items-center gap-3">
              {activeClient.lastUpdated && (
                <span className="text-xs text-slate-400">
                  Updated {new Date(activeClient.lastUpdated).toLocaleDateString()}
                </span>
              )}
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#1e3a6e] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#16305e] transition-colors">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Refresh Data
                <input ref={refreshInputRef} type="file" accept=".csv" className="hidden" onChange={handleRefreshFile} />
              </label>
            </div>
          )}
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {!parsedData ? (
            /* Empty state */
            <div className="flex h-full flex-col items-center justify-center px-4 py-12">
              <div className="w-full max-w-md space-y-4">
                <div className="text-center">
                  <h2 className="text-lg font-semibold text-slate-700">
                    {clients.length === 0 ? 'Get started' : 'Select or add a client'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {clients.length === 0
                      ? 'Add a client and upload their lead CSV to generate charts.'
                      : 'Choose a client from the sidebar or add a new one.'}
                  </p>
                </div>
                {clients.length === 0 && (
                  <FileUpload
                    onFile={(text, filename) =>
                      upsertClient(clientNameFromFilename(filename), text)
                    }
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5 px-6 py-6">
              {/* Metric cards */}
              <MetricCards data={parsedData} />

              {/* Charts */}
              {charts.map((chart, i) => (
                <ChartPanel
                  key={chart.id}
                  data={parsedData}
                  config={chart}
                  accent={CHART_ACCENT_COLORS[i % CHART_ACCENT_COLORS.length]}
                  onUpdate={handleUpdateChart}
                  onRemove={handleRemoveChart}
                  canRemove={charts.length > 1}
                />
              ))}

              {/* Add chart */}
              <button
                onClick={handleAddChart}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 py-4 text-sm font-medium text-slate-400 hover:border-[#1e3a6e] hover:text-[#1e3a6e] transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Chart
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
