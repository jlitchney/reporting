'use client';

import { useState, useMemo } from 'react';
import type { ParsedData, ChartConfig, ChartQuery, GroupBy } from '@/lib/types';
import { processChartData, countLeadsWithFilters } from '@/lib/dataProcessor';
import ReportBarChart from './ReportBarChart';

interface ChartPanelProps {
  data: ParsedData;
  config: ChartConfig;
  onUpdate: (id: string, updates: Partial<ChartConfig>) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
  color?: string;
}

const GROUP_OPTIONS: { label: string; value: GroupBy }[] = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Quarter', value: 'quarter' },
];

const CHART_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2'];

export default function ChartPanel({ data, config, onUpdate, onRemove, canRemove, color = '#2563eb' }: ChartPanelProps) {
  const { tagColumns, leads, dateRange } = data;
  const { id, title, query } = config;
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);

  const updateQuery = (patch: Partial<ChartQuery>) =>
    onUpdate(id, { query: { ...query, ...patch } });

  const chartData = useMemo(
    () => processChartData(leads, query),
    [leads, query]
  );

  const totalCount = useMemo(() => {
    if (!query.metric) return 0;
    return countLeadsWithFilters(leads, query.metric, query.filters);
  }, [leads, query.metric, query.filters]);

  const tagLabels = tagColumns.map((c) => c.label);

  const defaultDateMin = dateRange.min.toISOString().slice(0, 10);
  const defaultDateMax = dateRange.max.toISOString().slice(0, 10);

  const formatDate = (d: Date | null) => d?.toISOString().slice(0, 10) ?? '';

  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
      {/* Panel header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => { onUpdate(id, { title: titleDraft }); setEditingTitle(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { onUpdate(id, { title: titleDraft }); setEditingTitle(false); } }}
            className="flex-1 rounded border border-blue-300 px-2 py-0.5 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
          />
        ) : (
          <button
            onClick={() => { setTitleDraft(title); setEditingTitle(true); }}
            className="flex-1 text-left text-sm font-semibold text-slate-800 hover:text-blue-600 transition-colors"
          >
            {title}
          </button>
        )}
        <div className="flex items-center gap-3">
          {query.metric && (
            <span className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{totalCount.toLocaleString()}</span> total
            </span>
          )}
          {canRemove && (
            <button
              onClick={() => onRemove(id)}
              className="text-slate-300 hover:text-slate-500 transition-colors"
              title="Remove chart"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3 px-5 py-3 border-b border-slate-50">
        {/* Metric */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Count</label>
          <select
            value={query.metric ?? ''}
            onChange={(e) => {
              const metric = e.target.value || null;
              updateQuery({ metric, dateField: metric ?? 'created', filters: [] });
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="">Select a tag…</option>
            {tagLabels.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        {/* Filter by */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Filter by</label>
          <select
            value=""
            onChange={(e) => {
              const val = e.target.value;
              if (val && !query.filters.includes(val)) {
                updateQuery({ filters: [...query.filters, val] });
              }
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="">+ Add filter</option>
            {tagLabels
              .filter((l) => l !== query.metric && !query.filters.includes(l))
              .map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
          </select>
        </div>

        {/* Group by */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Group by</label>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {GROUP_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateQuery({ groupBy: opt.value })}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  query.groupBy === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Date range</label>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              defaultValue={defaultDateMin}
              onChange={(e) => updateQuery({ startDate: e.target.value ? new Date(e.target.value + 'T00:00:00') : null })}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              defaultValue={defaultDateMax}
              onChange={(e) => updateQuery({ endDate: e.target.value ? new Date(e.target.value + 'T23:59:59') : null })}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>
      </div>

      {/* Active filters */}
      {query.filters.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 py-2 border-b border-slate-50">
          {query.filters.map((f) => (
            <span
              key={f}
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700"
            >
              {f}
              <button
                onClick={() => updateQuery({ filters: query.filters.filter((x) => x !== f) })}
                className="ml-0.5 text-blue-400 hover:text-blue-600"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="px-4 py-4">
        <ReportBarChart data={chartData} color={color} />
      </div>
    </div>
  );
}

export { CHART_COLORS };
