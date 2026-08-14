'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { parseCSV } from '@/lib/csvParser';
import { CHART_ACCENT_COLORS } from '@/components/ChartPanel';
import ChartPanel from '@/components/ChartPanel';
import TotalWidget from '@/components/TotalWidget';
import PieChartWidget from '@/components/PieChartWidget';
import LineChartWidget from '@/components/LineChartWidget';
import ColumnChartWidget from '@/components/ColumnChartWidget';
import StackedBarWidget from '@/components/StackedBarWidget';
import TableWidget from '@/components/TableWidget';
import FunnelWidget from '@/components/FunnelWidget';
import CostBarWidget from '@/components/CostBarWidget';
import CostTableWidget from '@/components/CostTableWidget';
import CostTotalWidget from '@/components/CostTotalWidget';
import ComparisonBarWidget from '@/components/ComparisonBarWidget';
import TabBar from '@/components/TabBar';
import AddChartModal from '@/components/AddChartModal';
import type { ParsedData, ChartConfig, ClientTab } from '@/lib/types';
import type { SpendEntry } from '@/lib/redis';

interface ClientData {
  id: string;
  name: string;
  tabs: ClientTab[];
  lastUpdated: string;
  spendData?: SpendEntry[];
}

function patchClient(clientId: string, body: Record<string, unknown>) {
  fetch(`/api/clients/${clientId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export default function PartnerView({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<ClientData | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const [metaRes, csvRes] = await Promise.all([
          fetch(`/api/clients/${clientId}`),
          fetch(`/api/clients/${clientId}/csv`),
        ]);
        if (metaRes.status === 404) { setNotFound(true); return; }
        if (!metaRes.ok || !csvRes.ok) throw new Error('Failed to load report');
        const meta: ClientData = await metaRes.json();
        const csvText = await csvRes.text();
        const parsed = parseCSV(csvText, meta.name);
        if (!meta.tabs) {
          (meta as any).tabs = [{ id: 'tab-default', name: 'Overview', chartConfigs: (meta as any).chartConfigs ?? [] }];
        }
        setClient(meta);
        setActiveTabId(meta.tabs[0]?.id ?? null);
        setParsedData(parsed);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [clientId]);

  const activeTab = useMemo(
    () => client?.tabs.find((t) => t.id === activeTabId) ?? client?.tabs[0] ?? null,
    [client, activeTabId]
  );

  const updateTabCharts = useCallback((tabId: string, chartConfigs: ChartConfig[]) => {
    setClient((prev) => {
      if (!prev) return prev;
      const tabs = prev.tabs.map((t) => (t.id === tabId ? { ...t, chartConfigs } : t));
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => patchClient(clientId, { tabs }), 800);
      return { ...prev, tabs };
    });
  }, [clientId]);

  const handleUpdateChart = useCallback((chartId: string, updates: Partial<ChartConfig>) => {
    if (!activeTab) return;
    updateTabCharts(activeTab.id, activeTab.chartConfigs.map((c) => (c.id === chartId ? { ...c, ...updates } : c)));
  }, [activeTab, updateTabCharts]);

  const handleRemoveChart = useCallback((chartId: string) => {
    if (!activeTab) return;
    updateTabCharts(activeTab.id, activeTab.chartConfigs.filter((c) => c.id !== chartId));
  }, [activeTab, updateTabCharts]);

  const handleDuplicateChart = useCallback((chartId: string) => {
    if (!activeTab) return;
    const configs = activeTab.chartConfigs;
    const idx = configs.findIndex((c) => c.id === chartId);
    if (idx === -1) return;
    const copy = { ...configs[idx], id: `widget-${Date.now()}`, title: `${configs[idx].title} (copy)` };
    const next = [...configs];
    next.splice(idx + 1, 0, copy);
    updateTabCharts(activeTab.id, next);
  }, [activeTab, updateTabCharts]);

  const handleAddFromModal = useCallback((config: Omit<ChartConfig, 'id'>) => {
    if (!activeTab) return;
    const defaultColor = config.color ?? CHART_ACCENT_COLORS[activeTab.chartConfigs.length % CHART_ACCENT_COLORS.length];
    const newConfig: ChartConfig = { ...config, id: `widget-${Date.now()}`, color: defaultColor };
    updateTabCharts(activeTab.id, [...activeTab.chartConfigs, newConfig]);
  }, [activeTab, updateTabCharts]);

  const handleAddTab = useCallback(() => {
    if (!client) return;
    const newTab: ClientTab = { id: `tab-${Date.now()}`, name: 'New Tab', chartConfigs: [] };
    const tabs = [...client.tabs, newTab];
    setClient((prev) => prev ? { ...prev, tabs } : prev);
    setActiveTabId(newTab.id);
    patchClient(clientId, { tabs });
  }, [client, clientId]);

  const handleRemoveTab = useCallback((tabId: string) => {
    if (!client) return;
    const tabIndex = client.tabs.findIndex((t) => t.id === tabId);
    const tabs = client.tabs.filter((t) => t.id !== tabId);
    setClient((prev) => prev ? { ...prev, tabs } : prev);
    setActiveTabId((cur) => {
      if (cur !== tabId) return cur;
      return (tabs[Math.max(0, tabIndex - 1)] ?? tabs[0])?.id ?? null;
    });
    patchClient(clientId, { tabs });
  }, [client, clientId]);

  const handleRenameTab = useCallback((tabId: string, name: string) => {
    if (!client) return;
    const tabs = client.tabs.map((t) => (t.id === tabId ? { ...t, name } : t));
    setClient((prev) => prev ? { ...prev, tabs } : prev);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => patchClient(clientId, { tabs }), 800);
  }, [client, clientId]);

  const handleDrop = useCallback((targetId: string) => {
    if (!dragId || dragId === targetId || !activeTab) return;
    const configs = activeTab.chartConfigs;
    const fromIdx = configs.findIndex((c) => c.id === dragId);
    const toIdx = configs.findIndex((c) => c.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...configs];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    updateTabCharts(activeTab.id, next);
    setDragId(null);
    setDragOverId(null);
  }, [dragId, activeTab, updateTabCharts]);

  const draggableProps = (id: string) => ({
    draggable: true as const,
    onDragStart: () => setDragId(id),
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); if (id !== dragId) setDragOverId(id); },
    onDrop: () => handleDrop(id),
    onDragEnd: () => { setDragId(null); setDragOverId(null); },
  });

  const dragClass = (id: string) =>
    `${dragId === id ? 'opacity-40' : ''} ${dragOverId === id && dragId !== id ? 'ring-2 ring-[#1e3a6e]/40 rounded-lg' : ''}`;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-[#1e3a6e]" />
      </div>
    );
  }

  if (notFound || !client || !parsedData) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 text-center px-4">
        <p className="text-lg font-semibold text-slate-700">Report not found</p>
        <p className="mt-1 text-sm text-slate-500">This link may be invalid or the report has been removed.</p>
      </div>
    );
  }

  const widgets = activeTab?.chartConfigs ?? [];
  const totalWidgets = widgets.filter((w) => (w.type ?? 'bar') === 'total' || w.type === 'cost_total');
  const nonTotalWidgets = widgets.filter((w) => (w.type ?? 'bar') !== 'total' && w.type !== 'cost_total');

  const accentFor = (id: string) => {
    const w = widgets.find((w) => w.id === id);
    if (w?.color) return w.color;
    const idx = widgets.findIndex((w) => w.id === id);
    return CHART_ACCENT_COLORS[idx % CHART_ACCENT_COLORS.length];
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <img src="/logo-black.png" alt="All-Star Recruiter" className="h-7 w-auto" />
          <svg className="h-3 w-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-semibold text-slate-700 text-sm">{client.name}</span>
        </div>
        {client.lastUpdated && (
          <span className="text-xs text-slate-400">
            Updated {new Date(client.lastUpdated).toLocaleDateString()}
          </span>
        )}
      </header>

      <TabBar
        tabs={client.tabs}
        activeTabId={activeTabId}
        onSelectTab={setActiveTabId}
        onAddTab={handleAddTab}
        onRemoveTab={handleRemoveTab}
        onRenameTab={handleRenameTab}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="space-y-5 px-6 py-6">
          {totalWidgets.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {totalWidgets.map((w) => (
                <div key={w.id} {...draggableProps(w.id)} className={dragClass(w.id)}>
                  {w.type === 'cost_total' ? (
                    <CostTotalWidget
                      data={parsedData}
                      config={w}
                      spendData={client.spendData ?? []}
                      accent={accentFor(w.id)}
                      onUpdate={handleUpdateChart}
                      onRemove={handleRemoveChart}
                      onDuplicate={handleDuplicateChart}
                      showDragHandle
                    />
                  ) : (
                    <TotalWidget
                      data={parsedData}
                      config={w}
                      accent={accentFor(w.id)}
                      onUpdate={handleUpdateChart}
                      onRemove={handleRemoveChart}
                      onDuplicate={handleDuplicateChart}
                      showDragHandle
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {nonTotalWidgets.length > 0 && (
            <div className="grid grid-cols-4 gap-4">
              {nonTotalWidgets.map((w) => {
                const commonProps = {
                  data: parsedData,
                  config: w,
                  accent: accentFor(w.id),
                  onUpdate: handleUpdateChart,
                  onRemove: handleRemoveChart,
                  onDuplicate: () => handleDuplicateChart(w.id),
                  canRemove: true as const,
                  showDragHandle: true as const,
                };
                let widget: React.ReactNode;
                switch (w.type ?? 'bar') {
                  case 'line':           widget = <LineChartWidget {...commonProps} />; break;
                  case 'pie':            widget = <PieChartWidget {...commonProps} />; break;
                  case 'column':         widget = <ColumnChartWidget {...commonProps} />; break;
                  case 'stacked_bar':    widget = <StackedBarWidget {...commonProps} />; break;
                  case 'table':          widget = <TableWidget {...commonProps} />; break;
                  case 'funnel':         widget = <FunnelWidget {...commonProps} />; break;
                  case 'cost':           widget = <CostTableWidget {...commonProps} spendData={client.spendData ?? []} />; break;
                  case 'cost_bar':       widget = <CostBarWidget {...commonProps} spendData={client.spendData ?? []} />; break;
                  case 'cost_total':     widget = <CostTotalWidget {...commonProps} spendData={client.spendData ?? []} />; break;
                  case 'comparison_bar': widget = <ComparisonBarWidget {...commonProps} />; break;
                  default:               widget = <ChartPanel {...commonProps} />;
                }
                const span = w.colSpan ?? 4;
                const spanClass = span === 1 ? 'col-span-1' : span === 2 ? 'col-span-2' : span === 3 ? 'col-span-3' : 'col-span-4';
                return (
                  <div key={w.id} {...draggableProps(w.id)} className={`${spanClass} ${dragClass(w.id)}`}>
                    {widget}
                  </div>
                );
              })}
            </div>
          )}

          {widgets.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm font-medium text-slate-500">This tab is empty</p>
              <p className="mt-1 text-xs text-slate-400">Add a chart below to get started</p>
            </div>
          )}

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
      </main>

      {showAddModal && (
        <AddChartModal
          data={parsedData}
          onAdd={handleAddFromModal}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
