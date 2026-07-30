'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LabelList, Cell } from 'recharts';
import { isBefore, isAfter, startOfYear, startOfMonth, subDays } from 'date-fns';
import WidgetShell from './WidgetShell';
import { DATE_PRESET_LABELS } from '@/lib/dataProcessor';
import type { ParsedData, ChartConfig, ChartQuery, DatePreset, ComparisonSeries } from '@/lib/types';

const DATE_PRESETS: DatePreset[] = ['all_time', 'this_year', 'this_month', 'last_30_days', 'last_90_days'];
const FALLBACK_COLORS = ['#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#3b82f6'];

function fmtK(n: number): string {
  if (n >= 1000) {
    const v = n / 1000;
    return `${v % 1 === 0 ? v : v.toFixed(1)}K`;
  }
  return String(n);
}

function presetStart(preset: DatePreset): Date | null {
  const now = new Date();
  switch (preset) {
    case 'this_year':    return startOfYear(now);
    case 'this_month':   return startOfMonth(now);
    case 'last_30_days': return subDays(now, 30);
    case 'last_90_days': return subDays(now, 90);
    default:             return null;
  }
}

function resolveColor(s: ComparisonSeries, index: number, accent: string): string {
  return s.color ?? (index === 0 ? accent : FALLBACK_COLORS[(index - 1) % FALLBACK_COLORS.length]);
}

function TagSection({
  tagName,
  bars,
}: {
  tagName: string;
  bars: { label: string; value: number; color: string }[];
}) {
  const chartData = bars.map((b) => ({ name: b.label, value: b.value, color: b.color }));
  const height = Math.max(60, bars.length * 32 + 28);

  return (
    <div className="flex items-stretch border-b border-slate-100 pb-1 last:border-0">
      <div className="flex w-28 flex-shrink-0 items-center justify-end pr-3 text-right text-xs font-medium text-slate-600">
        {tagName}
      </div>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 60, left: 0, bottom: 20 }}>
            <XAxis
              type="number"
              domain={[0, 'auto']}
              tickFormatter={fmtK}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis type="category" dataKey="name" hide />
            <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={22} isAnimationActive={false}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                style={{ fontSize: 11, fill: '#374151', fontWeight: 500 }}
                formatter={(v: unknown) => Number(v).toLocaleString()}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

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

export default function ComparisonBarWidget({
  data,
  config,
  accent,
  onUpdate,
  onRemove,
  canRemove,
  showDragHandle,
  onDuplicate,
  readOnly,
}: Props) {
  const { tagGroups, leads } = data;
  const { id, title, query } = config;

  const updateQuery = (patch: Partial<ChartQuery>) => onUpdate(id, { query: { ...query, ...patch } });

  const selectedGroup = query.tagGroupAxis ?? tagGroups[0]?.name ?? '';
  const groupObj = tagGroups.find((g) => g.name === selectedGroup);
  const datePreset = query.datePreset ?? 'all_time';

  const series: ComparisonSeries[] = query.comparisonSeries?.length
    ? query.comparisonSeries
    : [{ id: 'default', label: 'Total', tagLabel: '' }];

  const updateSeries = (s: ComparisonSeries[]) => updateQuery({ comparisonSeries: s });

  const moveSeries = (i: number, dir: -1 | 1) => {
    const ns = [...series];
    const j = i + dir;
    [ns[i], ns[j]] = [ns[j], ns[i]];
    updateSeries(ns);
  };

  const sectionData = useMemo(() => {
    if (!groupObj) return [];

    const effectiveStart =
      datePreset !== 'all_time' && datePreset !== 'custom' ? presetStart(datePreset) : (query.startDate ?? null);
    const effectiveEnd = datePreset === 'custom' ? (query.endDate ?? null) : null;

    const baseLeads = leads.filter((lead) => {
      const d = lead.createdDate;
      if (!d) return false;
      if (effectiveStart && isBefore(d, effectiveStart)) return false;
      if (effectiveEnd && isAfter(d, effectiveEnd)) return false;
      return true;
    });

    return groupObj.tags.map((tag) => {
      const bars = series.map((s, i) => ({
        label: s.label,
        color: resolveColor(s, i, accent),
        value: baseLeads.filter((lead) => {
          if (!lead.tags.get(tag.label)?.applied) return false;
          if (s.tagLabel && !lead.tags.get(s.tagLabel)?.applied) return false;
          return true;
        }).length,
      }));
      return { tagLabel: tag.label, tagName: tag.tag, bars };
    });
  }, [leads, groupObj, series, datePreset, query.startDate, query.endDate, accent]);

  const configPanel = (
    <div className="space-y-3">
      {/* Tag group */}
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tag group (facets)</label>
        <select
          value={selectedGroup}
          onChange={(e) => updateQuery({ tagGroupAxis: e.target.value })}
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-[#1e3a6e]"
        >
          {tagGroups.map((g) => <option key={g.name} value={g.name}>{g.name}</option>)}
        </select>
      </div>

      {/* Series editor */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Series</label>
        <div className="space-y-1.5">
          {series.map((s, i) => (
            <div key={s.id} className="rounded border border-slate-200 bg-slate-50/50 p-1.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <div className="flex flex-col">
                  <button
                    onClick={() => moveSeries(i, -1)}
                    disabled={i === 0}
                    className="rounded p-0.5 text-slate-300 transition-colors hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => moveSeries(i, 1)}
                    disabled={i === series.length - 1}
                    className="rounded p-0.5 text-slate-300 transition-colors hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                <input
                  type="color"
                  value={resolveColor(s, i, accent)}
                  onChange={(e) => {
                    const ns = [...series];
                    ns[i] = { ...s, color: e.target.value };
                    updateSeries(ns);
                  }}
                  className="h-6 w-6 flex-shrink-0 cursor-pointer rounded border border-slate-200 p-0.5"
                  title="Pick color"
                />
                <input
                  type="text"
                  value={s.label}
                  onChange={(e) => {
                    const ns = [...series];
                    ns[i] = { ...s, label: e.target.value };
                    updateSeries(ns);
                  }}
                  placeholder="Label"
                  className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-[#1e3a6e]"
                />
                <button
                  onClick={() => updateSeries(series.filter((_, j) => j !== i))}
                  className="rounded p-0.5 text-slate-300 transition-colors hover:text-red-400"
                  title="Remove series"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Filter tag</p>
                <select
                  value={s.tagLabel}
                  onChange={(e) => {
                    const ns = [...series];
                    ns[i] = { ...s, tagLabel: e.target.value };
                    updateSeries(ns);
                  }}
                  className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-[#1e3a6e]"
                >
                  <option value="">None — all leads with position tag</option>
                  {tagGroups.map((g) => (
                    <optgroup key={g.name} label={g.name}>
                      {g.tags.map((t) => (
                        <option key={t.label} value={t.label}>{t.tag}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
          ))}
          <button
            onClick={() =>
              updateSeries([
                ...series,
                { id: `s-${Date.now()}`, label: 'New Series', tagLabel: '' },
              ])
            }
            className="flex items-center gap-1 rounded border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add series
          </button>
        </div>
      </div>

      {/* Date range */}
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Date range</label>
        <div className="flex flex-wrap gap-1">
          {DATE_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => updateQuery({ datePreset: p, startDate: null, endDate: null })}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                datePreset === p ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              style={datePreset === p ? { backgroundColor: accent } : {}}
            >
              {DATE_PRESET_LABELS[p]}
            </button>
          ))}
        </div>
      </div>
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
      colSpan={config.colSpan ?? 2}
      chartHeight={config.chartHeight}
      onColorChange={(c) => onUpdate(id, { color: c })}
      onColSpanChange={(s) => onUpdate(id, { colSpan: s })}
      onHeightChange={(h) => onUpdate(id, { chartHeight: h })}
      configPanel={configPanel}
    >
      <div className="px-4 pb-4 pt-2">
        {/* Legend */}
        <div className="mb-3 flex flex-wrap items-center gap-4 pl-28">
          {series.map((s, i) => (
            <span key={s.id} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: resolveColor(s, i, accent) }}
              />
              {s.label}
            </span>
          ))}
        </div>

        {sectionData.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-slate-400">
            Select a tag group in settings
          </div>
        ) : (
          <div>
            {sectionData.map(({ tagLabel, tagName, bars }) => (
              <TagSection key={tagLabel} tagName={tagName} bars={bars} />
            ))}
          </div>
        )}
      </div>
    </WidgetShell>
  );
}
