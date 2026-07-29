'use client';

import { useCallback, useRef, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import ChartPanel, { CHART_ACCENT_COLORS } from '@/components/ChartPanel';
import TotalWidget from '@/components/TotalWidget';
import TabBar from '@/components/TabBar';
import AddChartModal from '@/components/AddChartModal';
import PieChartWidget from '@/components/PieChartWidget';
import LineChartWidget from '@/components/LineChartWidget';
import ColumnChartWidget from '@/components/ColumnChartWidget';
import StackedBarWidget from '@/components/StackedBarWidget';
import TableWidget from '@/components/TableWidget';
import FunnelWidget from '@/components/FunnelWidget';
import { useClients } from '@/lib/useClients';
import { clientNameFromFilename } from '@/lib/csvParser';
import type { ChartConfig } from '@/lib/types';

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

  const handleAddFromModal = useCallback(
    (config: Omit<ChartConfig, 'id'>) => {
      if (!activeClientId || !activeTab) return;
      const defaultColor = config.color ?? CHART_ACCENT_COLORS[activeTab.chartConfigs.length % CHART_ACCENT_COLORS.length];
      const newConfig: ChartConfig = { ...config, id: `widget-${Date.now()}`, color: defaultColor };
      updateTabCharts(activeClientId, activeTab.id, [...activeTab.chartConfigs, newConfig]);
    },
    [activeClientId, activeTab, updateTabCharts]
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

  const [showAddModal, setShowAddModal] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const widgets = activeTab?.chartConfigs ?? [];
  const totalWidgets = widgets.filter((w) => (w.type ?? 'bar') === 'total');
  const nonTotalWidgets = widgets.filter((w) => (w.type ?? 'bar') !== 'total');

  const accentFor = (id: string) => {
    const w = widgets.find((w) => w.id === id);
    if (w?.color) return w.color;
    const idx = widgets.findIndex((w) => w.id === id);
    return CHART_ACCENT_COLORS[idx % CHART_ACCENT_COLORS.length];
  };

  const handleDrop = useCallback(
    (targetId: string) => {
      if (!dragId || dragId === targetId || !activeClientId || !activeTab) return;
      const configs = activeTab.chartConfigs;
      const fromIdx = configs.findIndex((c) => c.id === dragId);
      const toIdx = configs.findIndex((c) => c.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return;
      const next = [...configs];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      updateTabCharts(activeClientId, activeTab.id, next);
      setDragId(null);
      setDragOverId(null);
    },
    [dragId, activeClientId, activeTab, updateTabCharts]
  );

  const draggableProps = (id: string) => ({
    draggable: true as const,
    onDragStart: () => setDragId(id),
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); if (id !== dragId) setDragOverId(id); },
    onDrop: () => handleDrop(id),
    onDragEnd: () => { setDragId(null); setDragOverId(null); },
  });

  const dragClass = (id: string) =>
    `${dragId === id ? 'opacity-40' : ''} ${dragOverId === id && dragId !== id ? 'ring-2 ring-[#1e3a6e]/40 rounded-lg' : ''}`;

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
                    <div key={w.id} {...draggableProps(w.id)} className={dragClass(w.id)}>
                      <TotalWidget
                        data={parsedData}
                        config={w}
                        accent={accentFor(w.id)}
                        onUpdate={handleUpdateChart}
                        onRemove={handleRemoveChart}
                        showDragHandle
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Non-total widgets rendered in their original order */}
              {nonTotalWidgets.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  {nonTotalWidgets.map((w) => {
                    const commonProps = {
                      data: parsedData,
                      config: w,
                      accent: accentFor(w.id),
                      onUpdate: handleUpdateChart,
                      onRemove: handleRemoveChart,
                      canRemove: true as const,
                      showDragHandle: true as const,
                    };
                    let widget: React.ReactNode;
                    switch (w.type ?? 'bar') {
                      case 'line':        widget = <LineChartWidget {...commonProps} />; break;
                      case 'pie':         widget = <PieChartWidget {...commonProps} />; break;
                      case 'column':      widget = <ColumnChartWidget {...commonProps} />; break;
                      case 'stacked_bar': widget = <StackedBarWidget {...commonProps} />; break;
                      case 'table':       widget = <TableWidget {...commonProps} />; break;
                      case 'funnel':      widget = <FunnelWidget {...commonProps} />; break;
                      default:            widget = <ChartPanel {...commonProps} />;
                    }
                    const span = w.colSpan ?? 3;
                    const spanClass = span === 1 ? 'col-span-1' : span === 2 ? 'col-span-2' : 'col-span-3';
                    return (
                      <div key={w.id} {...draggableProps(w.id)} className={`${spanClass} ${dragClass(w.id)}`}>
                        {widget}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Empty state */}
              {widgets.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-sm font-medium text-slate-500">This tab is empty</p>
                  <p className="mt-1 text-xs text-slate-400">Add a chart below to get started</p>
                </div>
              )}

              {/* Add chart button */}
              <button
                onClick={() => setShowAddModal(true)}
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

      {showAddModal && parsedData && (
        <AddChartModal
          data={parsedData}
          onAdd={handleAddFromModal}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
