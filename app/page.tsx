'use client';

import { useCallback, useRef, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import ChartPanel, { CHART_ACCENT_COLORS } from '@/components/ChartPanel';
import TotalWidget from '@/components/TotalWidget';
import TabBar from '@/components/TabBar';
import { useClients } from '@/lib/useClients';
import { clientNameFromFilename } from '@/lib/csvParser';
import type { ChartConfig, WidgetType } from '@/lib/types';

function newWidget(
  data: NonNullable<ReturnType<typeof useClients>['parsedData']>,
  type: WidgetType,
  index: number
): ChartConfig {
  const tag = data.tagColumns[index % Math.max(data.tagColumns.length, 1)];
  if (type === 'total') {
    return {
      id: `widget-${Date.now()}-${index}`,
      type: 'total',
      title: tag ? tag.tag : 'Total Leads',
      query: {
        metric: tag?.label ?? null,
        filters: [],
        dateField: tag?.label ?? 'created',
        groupBy: 'week',
        startDate: null,
        endDate: null,
        datePreset: 'all_time',
      },
    };
  }
  return {
    id: `widget-${Date.now()}-${index}`,
    type: 'bar',
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
  } = useClients();

  const refreshInputRef = useRef<HTMLInputElement>(null);

  const handleRefreshFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !activeClientId) return;
      upsertClient(activeClient?.name ?? clientNameFromFilename(file.name), file, activeClientId);
      if (refreshInputRef.current) refreshInputRef.current.value = '';
    },
    [activeClientId, activeClient, upsertClient]
  );

  const handleAddClient = useCallback(
    async (name: string, file: File) => { await upsertClient(name, file); },
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

  const handleRenameClient = useCallback(
    (id: string, name: string) => renameClient(id, name),
    [renameClient]
  );

  const handleUpdateChart = useCallback(
    (chartId: string, updates: Partial<ChartConfig>) => {
      if (!activeClientId || !activeTab) return;
      updateTabCharts(
        activeClientId,
        activeTab.id,
        activeTab.chartConfigs.map((c) => (c.id === chartId ? { ...c, ...updates } : c))
      );
    },
    [activeClientId, activeTab, updateTabCharts]
  );

  const handleRemoveChart = useCallback(
    (chartId: string) => {
      if (!activeClientId || !activeTab) return;
      updateTabCharts(activeClientId, activeTab.id, activeTab.chartConfigs.filter((c) => c.id !== chartId));
    },
    [activeClientId, activeTab, updateTabCharts]
  );

  const handleAddWidget = useCallback(
    (type: WidgetType) => {
      if (!activeClientId || !activeTab || !parsedData) return;
      const next = [...activeTab.chartConfigs, newWidget(parsedData, type, activeTab.chartConfigs.length)];
      updateTabCharts(activeClientId, activeTab.id, next);
    },
    [activeClientId, activeTab, parsedData, updateTabCharts]
  );

  const handleAddTab = useCallback(() => {
    if (!activeClientId) return;
    addTab(activeClientId);
  }, [activeClientId, addTab]);

  const handleRemoveTab = useCallback(
    (tabId: string) => {
      if (!activeClientId || !activeClient) return;
      removeTab(activeClientId, tabId, activeClient.tabs);
    },
    [activeClientId, activeClient, removeTab]
  );

  const handleRenameTab = useCallback(
    (tabId: string, name: string) => {
      if (!activeClientId) return;
      renameTab(activeClientId, tabId, name);
    },
    [activeClientId, renameTab]
  );

  const [addingWidget, setAddingWidget] = useState(false);

  const widgets = activeTab?.chartConfigs ?? [];
  const totalWidgets = widgets.filter((w) => (w.type ?? 'bar') === 'total');
  const barWidgets = widgets.filter((w) => (w.type ?? 'bar') === 'bar');

  // Assign accent colors globally across all widgets in order
  const accentFor = (id: string) => {
    const idx = widgets.findIndex((w) => w.id === id);
    return CHART_ACCENT_COLORS[idx % CHART_ACCENT_COLORS.length];
  };

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
        onRenameClient={handleRenameClient}
        onRemoveClient={handleRemoveClient}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
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

        {activeClient && (
          <TabBar
            tabs={activeClient.tabs}
            activeTabId={activeTabId}
            onSelectTab={selectTab}
            onAddTab={handleAddTab}
            onRemoveTab={handleRemoveTab}
            onRenameTab={handleRenameTab}
          />
        )}

        <main className="flex-1 overflow-y-auto">
          {csvLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-[#1e3a6e]" />
                <p className="text-sm text-slate-500">Loading data…</p>
              </div>
            </div>
          ) : !parsedData ? (
            <div className="flex h-full flex-col items-center justify-center px-4 py-12">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-slate-700">
                  {clients.length === 0 ? 'Get started' : 'Select a client'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {clients.length === 0
                    ? 'Add a client using the sidebar to get started.'
                    : 'Choose a client from the sidebar.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5 px-6 py-6">
              {/* Total count widgets */}
              {totalWidgets.length > 0 && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {totalWidgets.map((w) => (
                    <TotalWidget
                      key={w.id}
                      data={parsedData}
                      config={w}
                      accent={accentFor(w.id)}
                      onUpdate={handleUpdateChart}
                      onRemove={handleRemoveChart}
                    />
                  ))}
                </div>
              )}

              {/* Bar chart widgets */}
              {barWidgets.map((w) => (
                <ChartPanel
                  key={w.id}
                  data={parsedData}
                  config={w}
                  accent={accentFor(w.id)}
                  onUpdate={handleUpdateChart}
                  onRemove={handleRemoveChart}
                  canRemove
                />
              ))}

              {/* Empty state */}
              {widgets.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-sm font-medium text-slate-500">This tab is empty</p>
                  <p className="mt-1 text-xs text-slate-400">Add a total or a bar chart below</p>
                </div>
              )}

              {/* Add widget */}
              {addingWidget ? (
                <div className="rounded-lg border-2 border-dashed border-slate-200 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Choose chart type</p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => { handleAddWidget('total'); setAddingWidget(false); }}
                      className="flex flex-1 min-w-36 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left hover:border-[#1e3a6e] hover:shadow-sm transition-all"
                    >
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Total</p>
                        <p className="text-xs text-slate-400">Single count with date range</p>
                      </div>
                    </button>
                    <button
                      onClick={() => { handleAddWidget('bar'); setAddingWidget(false); }}
                      className="flex flex-1 min-w-36 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left hover:border-[#1e3a6e] hover:shadow-sm transition-all"
                    >
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Bar Chart</p>
                        <p className="text-xs text-slate-400">Counts over time by period</p>
                      </div>
                    </button>
                  </div>
                  <button
                    onClick={() => setAddingWidget(false)}
                    className="mt-3 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingWidget(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 py-4 text-sm font-medium text-slate-400 hover:border-[#1e3a6e] hover:text-[#1e3a6e] transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Chart
                </button>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
