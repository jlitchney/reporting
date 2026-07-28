'use client';

import { useState, useCallback } from 'react';
import FileUpload from '@/components/FileUpload';
import MetricCards from '@/components/MetricCards';
import ChartPanel, { CHART_COLORS } from '@/components/ChartPanel';
import { parseCSV, clientNameFromFilename } from '@/lib/csvParser';
import type { ParsedData, ChartConfig, ChartQuery } from '@/lib/types';

function newChart(data: ParsedData, index: number): ChartConfig {
  const id = `chart-${Date.now()}-${index}`;
  const tag = data.tagColumns[index % data.tagColumns.length];
  const label = tag?.label ?? null;
  return {
    id,
    title: label ? `${tag!.tag} by ${tag!.tagGroup}` : 'New Chart',
    query: {
      metric: label,
      filters: [],
      dateField: label ?? 'created',
      groupBy: 'week',
      startDate: null,
      endDate: null,
    },
  };
}

export default function Home() {
  const [data, setData] = useState<ParsedData | null>(null);
  const [clientName, setClientName] = useState('');
  const [editingClient, setEditingClient] = useState(false);
  const [charts, setCharts] = useState<ChartConfig[]>([]);

  const handleFile = useCallback((text: string, filename: string) => {
    const name = clientNameFromFilename(filename);
    const parsed = parseCSV(text, name);
    setData(parsed);
    setClientName(name);
    setCharts(parsed.tagColumns.map((_, i) => newChart(parsed, i)));
  }, []);

  const updateChart = useCallback((id: string, updates: Partial<ChartConfig>) => {
    setCharts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  }, []);

  const removeChart = useCallback((id: string) => {
    setCharts((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addChart = useCallback(() => {
    if (!data) return;
    setCharts((prev) => [...prev, newChart(data, prev.length)]);
  }, [data]);

  if (!data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-slate-800">Campaign Reporting</h1>
            <p className="mt-1 text-sm text-slate-500">Upload a lead CSV to generate your report</p>
          </div>
          <FileUpload onFile={handleFile} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-slate-400">Campaign Report</h1>
            <span className="text-slate-300">/</span>
            {editingClient ? (
              <input
                autoFocus
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                onBlur={() => setEditingClient(false)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingClient(false)}
                className="rounded border border-blue-300 px-2 py-0.5 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
              />
            ) : (
              <button
                onClick={() => setEditingClient(true)}
                className="text-sm font-bold text-slate-800 hover:text-blue-600 transition-colors"
              >
                {clientName}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              {data.leads.length.toLocaleString()} leads
            </span>
            <label className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Upload new CSV
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => handleFile(ev.target?.result as string, file.name);
                  reader.readAsText(file);
                }}
              />
            </label>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <MetricCards data={data} />

        {charts.map((chart, i) => (
          <ChartPanel
            key={chart.id}
            data={data}
            config={chart}
            onUpdate={updateChart}
            onRemove={removeChart}
            canRemove={charts.length > 1}
            color={CHART_COLORS[i % CHART_COLORS.length]}
          />
        ))}

        <button
          onClick={addChart}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-4 text-sm font-medium text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Chart
        </button>
      </div>
    </main>
  );
}
