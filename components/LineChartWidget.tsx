'use client';

import { useMemo } from 'react';
import type { ParsedData, ChartConfig, ChartQuery, GroupBy, DatePreset } from '@/lib/types';
import { processChartData, DATE_PRESET_LABELS } from '@/lib/dataProcessor';
import ReportLineChart from './ReportLineChart';
import WidgetShell from './WidgetShell';

const DATE_PRESETS: DatePreset[] = ['all_time', 'this_year', 'this_month', 'last_30_days', 'last_90_days', 'custom'];
const GROUP_OPTIONS: { label: string; value: GroupBy }[] = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Quarter', value: 'quarter' },
];

interface Props {
  data: ParsedData;
  config: ChartConfig;
  accent: string;
  onUpdate: (id: string, updates: Partial<ChartConfig>) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
  showDragHandle?: boolean;
}

export default function LineChartWidget({ data, config, accent, onUpdate, onRemove, canRemove, showDragHandle }: Props) {
  const { tagGroups, leads } = data;
  const { id, title, query } = config;

  const updateQuery = (patch: Partial<ChartQuery>) => onUpdate(id, { query: { ...query, ...patch } });

  const chartData = useMemo(() => processChartData(leads, query), [leads, query]);

  const configPanel = (
    <div className="flex flex-wrap items-end gap-3">
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
              {g.tags.map((t) => <option key={t.label} value={t.label}>{t.tag}</option>)}
            </optgroup>
          ))}
        </select>
        {query.metric && (
          <label className="mt-1 flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={query.excludeRemoved ?? false} onChange={(e) => updateQuery({ excludeRemoved: e.target.checked })} className="h-3.5 w-3.5 accent-[#1e3a6e]" />
            <span className="text-[10px] text-slate-500">Exclude removed</span>
          </label>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Time grouping</label>
        <div className="flex overflow-hidden rounded border border-slate-200">
          {GROUP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateQuery({ groupBy: opt.value })}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${query.groupBy === opt.value ? 'text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              style={query.groupBy === opt.value ? { backgroundColor: accent } : {}}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Date range</label>
        <div className="flex flex-wrap gap-1">
          {DATE_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => updateQuery({ datePreset: p, startDate: p !== 'custom' ? null : query.startDate, endDate: p !== 'custom' ? null : query.endDate })}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${(query.datePreset ?? 'all_time') === p ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
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

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Filter by</label>
        <select
          value=""
          onChange={(e) => {
            const val = e.target.value;
            if (val && !query.filters.includes(val)) updateQuery({ filters: [...query.filters, val] });
          }}
          className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">+ Add filter</option>
          {tagGroups.map((g) => {
            const available = g.tags.filter((t) => t.label !== query.metric && !query.filters.includes(t.label));
            if (!available.length) return null;
            return (
              <optgroup key={g.name} label={g.name}>
                {available.map((t) => <option key={t.label} value={t.label}>{t.tag}</option>)}
              </optgroup>
            );
          })}
        </select>
      </div>

      {query.filters.length > 0 && (
        <div className="w-full flex flex-wrap gap-1.5 mt-1">
          {query.filters.map((f) => (
            <span key={f} className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: accent }}>
              {f}
              <button onClick={() => updateQuery({ filters: query.filters.filter((x) => x !== f) })} className="opacity-70 hover:opacity-100">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <WidgetShell
      accent={accent}
      title={title}
      canRemove={canRemove}
      showDragHandle={showDragHandle}
      onTitleSave={(t) => onUpdate(id, { title: t })}
      onRemove={() => onRemove(id)}
      configPanel={configPanel}
    >
      <div className="px-4 pb-4 pt-2">
        <ReportLineChart data={chartData} color={accent} />
      </div>
    </WidgetShell>
  );
}
