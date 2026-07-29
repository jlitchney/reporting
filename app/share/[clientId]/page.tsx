'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
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
import type { ParsedData, ChartConfig, ClientTab } from '@/lib/types';

interface ClientData {
  id: string;
  name: string;
  tabs: ClientTab[];
  lastUpdated: string;
}

const noop = () => {};

export default function SharePage() {
  const { clientId } = useParams<{ clientId: string }>();
  const [client, setClient] = useState<ClientData | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
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
        // migrate legacy clients without tabs
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

  const widgets = activeTab?.chartConfigs ?? [];
  const totalWidgets = widgets.filter((w) => (w.type ?? 'bar') === 'total');
  const nonTotalWidgets = widgets.filter((w) => (w.type ?? 'bar') !== 'total');

  const accentFor = (id: string) => {
    const w = widgets.find((w) => w.id === id);
    if (w?.color) return w.color;
    const idx = widgets.findIndex((w) => w.id === id);
    return CHART_ACCENT_COLORS[idx % CHART_ACCENT_COLORS.length];
  };

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

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
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

      {/* Tab bar */}
      {client.tabs.length > 1 && (
        <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-4">
          {client.tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab.id === activeTabId
                  ? 'border-[#1e3a6e] text-[#1e3a6e]'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>
      )}

      {/* Charts */}
      <main className="space-y-5 px-6 py-6">
        {totalWidgets.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {totalWidgets.map((w) => (
              <TotalWidget
                key={w.id}
                data={parsedData}
                config={w}
                accent={accentFor(w.id)}
                onUpdate={noop as any}
                onRemove={noop as any}
                readOnly
              />
            ))}
          </div>
        )}

        {nonTotalWidgets.length > 0 && (
          <div className="grid grid-cols-4 gap-4">
            {nonTotalWidgets.map((w) => {
              const commonProps: any = {
                data: parsedData,
                config: w,
                accent: accentFor(w.id),
                onUpdate: noop,
                onRemove: noop,
                canRemove: false,
                readOnly: true,
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
              const span = w.colSpan ?? 4;
              const spanClass = span === 1 ? 'col-span-1' : span === 2 ? 'col-span-2' : span === 3 ? 'col-span-3' : 'col-span-4';
              return (
                <div key={w.id} className={spanClass}>
                  {widget}
                </div>
              );
            })}
          </div>
        )}

        {widgets.length === 0 && (
          <div className="flex items-center justify-center py-24 text-sm text-slate-400">
            No charts have been added to this report.
          </div>
        )}
      </main>

      <footer className="pb-8 text-center text-[11px] text-slate-400">
        AllStar Talent — Campaign Reports
      </footer>
    </div>
  );
}
