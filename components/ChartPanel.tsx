'use client';

import { useState, useMemo } from 'react';
import type { ParsedData, ChartConfig, ChartQuery, GroupBy, TagGroup, DatePreset } from '@/lib/types';
import { processChartData, processTagGroupChart, countLeadsWithFilters, DATE_PRESET_LABELS } from '@/lib/dataProcessor';
import ReportBarChart from './ReportBarChart';

interface ChartPanelProps {
  data: ParsedData;
  config: ChartConfig;
  accent: string;
  onUpdate: (id: string, updates: Partial<ChartConfig>) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
  showDragHandle?: boolean;
}

const GROUP_OPTIONS: { label: string; value: GroupBy }[] = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Quarter', value: 'quarter' },
];

const DATE_PRESETS: DatePreset[] = ['all_time', 'this_year', 'this_month', 'last_30_days', 'last_90_days', 'custom'];

export default function ChartPanel({
  data,
  config,
  accent,
  onUpdate,
  onRemove,
  canRemove,
  showDragHandle,
}: ChartPanelProps) {
  const { tagGroups, leads, dateRange } = data;
  const { id, title, query } = config;
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [configOpen, setConfigOpen] = useState(false);

  const updateQuery = (patch: Partial<ChartQuery>) =>
    onUpdate(id, { query: { ...query, ...patch } });

  const chartData = useMemo(
    () => query.tagGroupAxis
      ? processTagGroupChart(leads, tagGroups, query.tagGroupAxis, query)
      : processChartData(leads, query),
    [leads, tagGroups, query]
  );

  const totalCount = useMemo(() => {
    if (!query.metric) return 0;
    return countLeadsWithFilters(leads, query.metric, query.filters);
  }, [leads, query.metric, query.filters]);

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200/80">
      {/* Accent strip */}
      <div className="h-1 w-full" style={{ backgroundColor: accent }} />

      {/* Card header */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        {showDragHandle && (
          <div className="flex-shrink-0 cursor-grab text-slate-300 hover:text-slate-400 active:cursor-grabbing">
            <GripIcon />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => { onUpdate(id, { title: titleDraft }); setEditingTitle(false); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { onUpdate(id, { title: titleDraft }); setEditingTitle(false); }
                if (e.key === 'Escape') setEditingTitle(false);
              }}
              className="w-full rounded border border-slate-300 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600 outline-none focus:ring-2 focus:ring-blue-200"
            />
          ) : (
            <button
              onClick={() => { setTitleDraft(title); setEditingTitle(true); }}
              className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors text-left truncate block w-full"
              title="Click to rename"
            >
              {title}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {query.metric && (
            <span className="mr-1 text-xs font-semibold text-slate-700">
              {totalCount.toLocaleString()}
            </span>
          )}
          <button
            onClick={() => setConfigOpen((v) => !v)}
            title="Configure"
            className={`rounded p-1 transition-colors ${configOpen ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </button>
          {canRemove && (
            <button
              onClick={() => onRemove(id)}
              title="Remove chart"
              className="rounded p-1 text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Config panel (collapsible) */}
      {configOpen && (
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-end gap-3">
            {/* Metric (time mode only) */}
            {!query.tagGroupAxis && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Count</label>
                <select
                  value={query.metric ?? ''}
                  onChange={(e) => {
                    const metric = e.target.value || null;
                    updateQuery({ metric, dateField: metric ?? 'created', filters: [] });
                  }}
                  className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">Select a tag…</option>
                  {tagGroups.map((g) => (
                    <optgroup key={g.name} label={g.name}>
                      {g.tags.map((t) => (
                        <option key={t.label} value={t.label}>{t.tag}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {query.metric && (
                  <label className="mt-1 flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={query.excludeRemoved ?? false}
                      onChange={(e) => updateQuery({ excludeRemoved: e.target.checked })}
                      className="h-3.5 w-3.5 accent-[#1e3a6e]"
                    />
                    <span className="text-[10px] text-slate-500">Exclude removed</span>
                  </label>
                )}
              </div>
            )}

            {/* X axis mode */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">X Axis</label>
              <div className="flex overflow-hidden rounded border border-slate-200">
                <button
                  onClick={() => updateQuery({ tagGroupAxis: undefined })}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    !query.tagGroupAxis ? 'text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                  style={!query.tagGroupAxis ? { backgroundColor: accent } : {}}
                >
                  Over time
                </button>
                <button
                  onClick={() => {
                    const firstGroup = tagGroups[0]?.name;
                    if (firstGroup) updateQuery({ tagGroupAxis: firstGroup, metric: null, dateField: 'created' });
                  }}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    query.tagGroupAxis ? 'text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                  style={query.tagGroupAxis ? { backgroundColor: accent } : {}}
                >
                  By tag group
                </button>
              </div>
            </div>

            {/* Tag group selector (tag group mode) */}
            {query.tagGroupAxis && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Tag group</label>
                <select
                  value={query.tagGroupAxis}
                  onChange={(e) => updateQuery({ tagGroupAxis: e.target.value })}
                  className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {tagGroups.map((g) => (
                    <option key={g.name} value={g.name}>{g.name}</option>
                  ))}
                </select>
                <label className="mt-1 flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={query.excludeRemoved ?? false}
                    onChange={(e) => updateQuery({ excludeRemoved: e.target.checked })}
                    className="h-3.5 w-3.5 accent-[#1e3a6e]"
                  />
                  <span className="text-[10px] text-slate-500">Exclude removed</span>
                </label>
              </div>
            )}

            {/* Time grouping (time mode only) */}
            {!query.tagGroupAxis && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Time grouping</label>
                <div className="flex overflow-hidden rounded border border-slate-200">
                  {GROUP_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateQuery({ groupBy: opt.value })}
                      className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                        query.groupBy === opt.value
                          ? 'text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                      style={query.groupBy === opt.value ? { backgroundColor: accent } : {}}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Filter */}
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
                className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">+ Add filter</option>
                {tagGroups.map((g) => {
                  const available = g.tags.filter(
                    (t) => t.label !== query.metric && !query.filters.includes(t.label)
                  );
                  if (!available.length) return null;
                  return (
                    <optgroup key={g.name} label={g.name}>
                      {available.map((t) => (
                        <option key={t.label} value={t.label}>{t.tag}</option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>

            {/* Date range */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Date range</label>
              <div className="flex flex-wrap gap-1">
                {DATE_PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => updateQuery({ datePreset: p, startDate: p !== 'custom' ? null : query.startDate, endDate: p !== 'custom' ? null : query.endDate })}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                      (query.datePreset ?? 'all_time') === p ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    style={(query.datePreset ?? 'all_time') === p ? { backgroundColor: accent } : {}}
                  >
                    {DATE_PRESET_LABELS[p]}
                  </button>
                ))}
              </div>
              {query.datePreset === 'custom' && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <input
                    type="date"
                    value={query.startDate instanceof Date ? query.startDate.toISOString().slice(0, 10) : (query.startDate as unknown as string ?? '')}
                    onChange={(e) => updateQuery({ startDate: e.target.value ? new Date(e.target.value + 'T00:00:00') : null })}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <span className="text-[10px] text-slate-400">to</span>
                  <input
                    type="date"
                    value={query.endDate instanceof Date ? query.endDate.toISOString().slice(0, 10) : (query.endDate as unknown as string ?? '')}
                    onChange={(e) => updateQuery({ endDate: e.target.value ? new Date(e.target.value + 'T23:59:59') : null })}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Active filters */}
          {query.filters.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {query.filters.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: accent }}
                >
                  {f}
                  <button
                    onClick={() => updateQuery({ filters: query.filters.filter((x) => x !== f) })}
                    className="ml-0.5 opacity-70 hover:opacity-100"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      <div className="px-4 pb-4 pt-2">
        <ReportBarChart data={chartData} color={accent} />
      </div>
    </div>
  );
}

function GripIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="5" cy="4" r="1.5" /><circle cx="11" cy="4" r="1.5" />
      <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
      <circle cx="5" cy="12" r="1.5" /><circle cx="11" cy="12" r="1.5" />
    </svg>
  );
}

export const CHART_ACCENT_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#14b8a6',
];
