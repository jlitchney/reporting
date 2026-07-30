'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import type { ParsedData, ChartConfig, ChartQuery, GroupBy, DatePreset, TagGroup } from '@/lib/types';
import { processStackedBarChart, DATE_PRESET_LABELS } from '@/lib/dataProcessor';
import WidgetShell from './WidgetShell';
import SeriesColorPicker from './SeriesColorPicker';

const DATE_PRESETS: DatePreset[] = ['all_time', 'this_year', 'this_month', 'last_30_days', 'last_90_days', 'custom'];
const GROUP_OPTIONS: { label: string; value: GroupBy }[] = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Quarter', value: 'quarter' },
];
const STACK_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#14b8a6', '#f97316', '#ec4899', '#06b6d4', '#84cc16'];

const StackedTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const visible = payload.filter((p: any) => p.dataKey !== '__phantom');
  const total = visible.reduce((s: number, p: any) => s + (p.value || 0), 0);
  return (
    <div className="rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-lg">
      <p className="font-medium mb-1">{label}</p>
      {[...visible].reverse().map((p: any) => (
        <p key={p.dataKey} style={{ color: p.fill }}>{p.name}: {Number(p.value).toLocaleString()}</p>
      ))}
      <p className="mt-1 border-t border-slate-600 pt-1 text-slate-300">Total: {total.toLocaleString()}</p>
    </div>
  );
};

interface Props {
  data: ParsedData;
  config: ChartConfig;
  accent: string;
  onUpdate: (id: string, updates: Partial<ChartConfig>) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
  showDragHandle?: boolean;
  onDuplicate?: () => void;
  readOnly?: boolean;
}

export default function StackedBarWidget({ data, config, accent, onUpdate, onRemove, canRemove, showDragHandle, onDuplicate, readOnly }: Props) {
  const { tagGroups, leads } = data;
  const { id, title, query } = config;

  const updateQuery = (patch: Partial<ChartQuery>) => onUpdate(id, { query: { ...query, ...patch } });

  const stackGroupName = query.tagGroupAxis ?? tagGroups[0]?.name ?? '';
  const stackGroup: TagGroup | undefined = tagGroups.find((g) => g.name === stackGroupName);

  const chartData = useMemo(
    () => stackGroupName ? processStackedBarChart(leads, tagGroups, stackGroupName, query) : [],
    [leads, tagGroups, stackGroupName, query]
  );

  const rotateLabels = chartData.length > 8;
  const chartHeight = config.chartHeight ?? 300;

  const chartDataWithTotals = useMemo(
    () => chartData.map((d) => {
      const total = stackGroup?.tags.reduce((sum, tag) => sum + ((d[tag.label] as number) ?? 0), 0) ?? 0;
      return { ...d, __total: total, __phantom: total > 0 ? 0.001 : 0 };
    }),
    [chartData, stackGroup]
  );

  const seriesColor = (tagLabel: string, idx: number) =>
    config.seriesColors?.[tagLabel] ?? STACK_COLORS[idx % STACK_COLORS.length];

  const configPanel = (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Stack group</label>
        <select value={stackGroupName} onChange={(e) => updateQuery({ tagGroupAxis: e.target.value })} className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-200">
          {tagGroups.map((g) => <option key={g.name} value={g.name}>{g.name}</option>)}
        </select>
        <label className="mt-1 flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={query.excludeRemoved ?? false} onChange={(e) => updateQuery({ excludeRemoved: e.target.checked })} className="h-3.5 w-3.5 accent-[#1e3a6e]" />
          <span className="text-[10px] text-slate-500">Exclude removed</span>
        </label>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Time grouping</label>
        <div className="flex overflow-hidden rounded border border-slate-200">
          {GROUP_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => updateQuery({ groupBy: opt.value })} className={`px-3 py-1.5 text-sm font-medium transition-colors ${query.groupBy === opt.value ? 'text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`} style={query.groupBy === opt.value ? { backgroundColor: accent } : {}}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Date range</label>
        <div className="flex flex-wrap gap-1">
          {DATE_PRESETS.map((p) => (
            <button key={p} onClick={() => updateQuery({ datePreset: p, startDate: p !== 'custom' ? null : query.startDate, endDate: p !== 'custom' ? null : query.endDate })} className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${(query.datePreset ?? 'all_time') === p ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} style={(query.datePreset ?? 'all_time') === p ? { backgroundColor: accent } : {}}>
              {DATE_PRESET_LABELS[p]}
            </button>
          ))}
        </div>
        {query.datePreset === 'custom' && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <input type="date" value={query.startDate instanceof Date ? query.startDate.toISOString().slice(0, 10) : (query.startDate as unknown as string ?? '')} onChange={(e) => updateQuery({ startDate: e.target.value ? new Date(e.target.value + 'T00:00:00') : null })} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none" />
            <span className="text-[10px] text-slate-400">to</span>
            <input type="date" value={query.endDate instanceof Date ? query.endDate.toISOString().slice(0, 10) : (query.endDate as unknown as string ?? '')} onChange={(e) => updateQuery({ endDate: e.target.value ? new Date(e.target.value + 'T23:59:59') : null })} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Date by</label>
        <select
          value={query.dateField ?? 'created'}
          onChange={(e) => updateQuery({ dateField: e.target.value })}
          className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="created">Creation date</option>
          {tagGroups.map((g) => (
            <optgroup key={g.name} label={g.name}>
              {g.tags.map((t) => <option key={t.label} value={t.label}>{t.tag} — Applied date</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Filter by</label>
        <select value="" onChange={(e) => { const val = e.target.value; if (val && !query.filters.includes(val)) updateQuery({ filters: [...query.filters, val] }); }} className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-200">
          <option value="">+ Add filter</option>
          {tagGroups.map((g) => { const available = g.tags.filter((t) => !query.filters.includes(t.label)); if (!available.length) return null; return (<optgroup key={g.name} label={g.name}>{available.map((t) => <option key={t.label} value={t.label}>{t.tag}</option>)}</optgroup>); })}
        </select>
      </div>

      {query.filters.length > 0 && (
        <div className="w-full flex flex-wrap gap-1.5 mt-1">
          {query.filters.map((f) => (
            <span key={f} className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: accent }}>
              {f}<button onClick={() => updateQuery({ filters: query.filters.filter((x) => x !== f) })} className="opacity-70 hover:opacity-100">×</button>
            </span>
          ))}
        </div>
      )}

      {stackGroup && stackGroup.tags.length > 0 && (
        <div className="w-full pt-2 border-t border-slate-100">
          <SeriesColorPicker
            series={stackGroup.tags.map((tag, idx) => ({
              id: tag.label,
              name: tag.tag,
              color: seriesColor(tag.label, idx),
            }))}
            onColorChange={(tagLabel, color) =>
              onUpdate(id, { seriesColors: { ...config.seriesColors, [tagLabel]: color } })
            }
          />
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
      onDuplicate={onDuplicate}
      readOnly={readOnly}
      onTitleSave={(t) => onUpdate(id, { title: t })}
      onRemove={() => onRemove(id)}
      colSpan={config.colSpan ?? 4}
      chartHeight={config.chartHeight}
      onColorChange={(c) => onUpdate(id, { color: c })}
      onColSpanChange={(s) => onUpdate(id, { colSpan: s })}
      onHeightChange={(h) => onUpdate(id, { chartHeight: h })}
      showInReport={config.showInReport}
      onShowInReportChange={(v) => onUpdate(id, { showInReport: v })}
      configPanel={configPanel}
    >
      <div className="px-4 pb-4 pt-2">
        {chartData.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-slate-400">No data for the selected criteria</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={rotateLabels ? chartHeight + 40 : chartHeight}>
              <BarChart data={chartDataWithTotals} margin={{ top: 20, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#94a3b8', textAnchor: rotateLabels ? 'end' : 'middle' }} axisLine={false} tickLine={false} angle={rotateLabels ? -45 : 0} interval={rotateLabels ? 0 : 'preserveStartEnd'} height={rotateLabels ? 72 : 30} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<StackedTooltip />} cursor={{ fill: '#f1f5f9' }} />
                {stackGroup?.tags.map((tag, idx) => {
                  const isTop = idx === stackGroup.tags.length - 1;
                  return (
                    <Bar key={tag.label} dataKey={tag.label} name={tag.tag} stackId="s" fill={seriesColor(tag.label, idx)} maxBarSize={48} radius={isTop ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                  );
                })}
                {/* Phantom bar: always non-zero so LabelList fires for every column */}
                <Bar dataKey="__phantom" name="" stackId="s" fill="transparent" stroke="none" maxBarSize={48} isAnimationActive={false} legendType="none">
                  <LabelList
                    dataKey="__total"
                    content={(props: any) => {
                      const { x, y, width, value } = props;
                      if (!value) return null;
                      return (
                        <text
                          x={(x ?? 0) + (width ?? 0) / 2}
                          y={(y ?? 0) - 4}
                          textAnchor="middle"
                          fill="#64748b"
                          fontSize="10"
                          fontWeight="500"
                        >
                          {Number(value).toLocaleString()}
                        </text>
                      );
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {stackGroup && (
              <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
                {stackGroup.tags.map((tag, idx) => (
                  <div key={tag.label} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ backgroundColor: seriesColor(tag.label, idx) }} />
                    {tag.tag}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </WidgetShell>
  );
}
