'use client';

import { useMemo } from 'react';
import WidgetShell from './WidgetShell';
import { computeCostMetrics, type CostMetricRow } from '@/lib/dataProcessor';
import { DATE_PRESET_LABELS } from '@/lib/dataProcessor';
import type { ParsedData, ChartConfig, DatePreset, CostMetricDef } from '@/lib/types';
import type { SpendEntry } from '@/lib/redis';

interface Props {
  data: ParsedData;
  config: ChartConfig;
  spendData: SpendEntry[];
  accent: string;
  onUpdate: (id: string, updates: Partial<ChartConfig>) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
  showDragHandle?: boolean;
  onDuplicate?: () => void;
  readOnly?: boolean;
}

const DATE_PRESETS: DatePreset[] = ['all_time', 'this_year', 'this_month', 'last_30_days', 'last_90_days'];

function fmt(n: number) {
  return '$' + n.toFixed(2);
}

function getEffectiveMetricDefs(config: ChartConfig): CostMetricDef[] {
  if (config.query.costMetricDefs && config.query.costMetricDefs.length > 0) {
    return config.query.costMetricDefs;
  }
  // Backward compat: derive from legacy costMetric field
  if (config.query.costMetric) {
    return [{ tagLabel: config.query.costMetric, name: 'Applications' }];
  }
  return [];
}

export default function CostTableWidget({
  data,
  config,
  spendData,
  accent,
  onUpdate,
  onRemove,
  canRemove,
  showDragHandle,
  onDuplicate,
  readOnly,
}: Props) {
  const { tagGroups } = data;

  const sourceGroup = config.query.costSourceGroup ?? tagGroups[0]?.name ?? '';
  const sourceGroupObj = tagGroups.find((g) => g.name === sourceGroup);
  const costGroupBy = config.query.costGroupBy ?? 'week';
  const datePreset = config.query.datePreset ?? 'all_time';
  const excludeRemoved = config.query.excludeRemoved ?? false;
  const metricDefs = getEffectiveMetricDefs(config);

  const updateMetricDefs = (defs: CostMetricDef[]) =>
    onUpdate(config.id, { query: { ...config.query, costMetricDefs: defs, costMetric: undefined } });

  const moveMetric = (i: number, dir: -1 | 1) => {
    const nd = [...metricDefs];
    const j = i + dir;
    [nd[i], nd[j]] = [nd[j], nd[i]];
    updateMetricDefs(nd);
  };

  const rows = useMemo(() => computeCostMetrics(
    data.leads,
    spendData,
    tagGroups,
    sourceGroup,
    metricDefs,
    { datePreset: config.query.datePreset, startDate: config.query.startDate, endDate: config.query.endDate, excludeRemoved, dateField: config.query.dateField }
  ), [data.leads, spendData, tagGroups, sourceGroup, metricDefs, config.query.datePreset, config.query.startDate, config.query.endDate, excludeRemoved, config.query.dateField]);

  const sourceAggregates = useMemo(() => {
    const map = new Map<string, { name: string; spend: number; counts: Record<string, number> }>();
    const organicCounts: Record<string, number> = {};
    for (const row of rows) {
      for (const src of row.sources) {
        const ex = map.get(src.tagLabel) ?? { name: src.name, spend: 0, counts: {} };
        const newCounts = { ...ex.counts };
        for (const [m, c] of Object.entries(src.counts)) newCounts[m] = (newCounts[m] ?? 0) + c;
        map.set(src.tagLabel, { name: src.name, spend: ex.spend + src.spend, counts: newCounts });
      }
      for (const [m, c] of Object.entries(row.organicCounts)) {
        organicCounts[m] = (organicCounts[m] ?? 0) + c;
      }
    }
    return { sources: Array.from(map.values()), organicCounts };
  }, [rows]);

  const configPanel = (
    <div className="space-y-3">
      {/* Metrics editor */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Metrics</label>
        <div className="space-y-1.5">
          {metricDefs.map((def, i) => (
            <div key={i} className="rounded border border-slate-200 bg-slate-50/50 p-1.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <div className="flex flex-col">
                  <button
                    onClick={() => moveMetric(i, -1)}
                    disabled={i === 0}
                    className="rounded p-0.5 text-slate-300 transition-colors hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30"
                    title="Move up"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => moveMetric(i, 1)}
                    disabled={i === metricDefs.length - 1}
                    className="rounded p-0.5 text-slate-300 transition-colors hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30"
                    title="Move down"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                <input
                  type="text"
                  value={def.name}
                  onChange={(e) => {
                    const nd = [...metricDefs];
                    nd[i] = { ...def, name: e.target.value };
                    updateMetricDefs(nd);
                  }}
                  placeholder="Label"
                  className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-[#1e3a6e]"
                />
                <button
                  onClick={() => updateMetricDefs(metricDefs.filter((_, j) => j !== i))}
                  className="rounded p-0.5 text-slate-300 transition-colors hover:text-red-400"
                  title="Remove metric"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex gap-1.5">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Metric</p>
                  <select
                    value={def.tagLabel}
                    onChange={(e) => {
                      const nd = [...metricDefs];
                      nd[i] = { ...def, tagLabel: e.target.value };
                      updateMetricDefs(nd);
                    }}
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-[#1e3a6e]"
                  >
                    <option value="">All Candidates</option>
                    {tagGroups.map((g) => (
                      <optgroup key={g.name} label={g.name}>
                        {g.tags.map((t) => (
                          <option key={t.label} value={t.label}>{t.tag}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Date by</p>
                  <select
                    value={def.dateField ?? ''}
                    onChange={(e) => {
                      const nd = [...metricDefs];
                      nd[i] = { ...def, dateField: e.target.value || undefined };
                      updateMetricDefs(nd);
                    }}
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-[#1e3a6e]"
                  >
                    <option value="">Creation date</option>
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
            </div>
          ))}
          <button
            onClick={() => {
              const firstTag = tagGroups[0]?.tags[0];
              updateMetricDefs([...metricDefs, { tagLabel: firstTag?.label ?? '', name: firstTag?.tag ?? 'All Candidates' }]);
            }}
            className="flex items-center gap-1 rounded border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add metric
          </button>
        </div>
      </div>

      {/* Source group */}
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Source group</label>
        <select
          value={sourceGroup}
          onChange={(e) => onUpdate(config.id, { query: { ...config.query, costSourceGroup: e.target.value || undefined } })}
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-[#1e3a6e]"
        >
          {tagGroups.map((g) => <option key={g.name} value={g.name}>{g.name}</option>)}
        </select>
      </div>

      {/* Group by */}
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Group by</label>
        <div className="flex overflow-hidden rounded-lg border border-slate-200">
          {(['week', 'source'] as const).map((v) => (
            <button
              key={v}
              onClick={() => onUpdate(config.id, { query: { ...config.query, costGroupBy: v } })}
              className={`flex-1 py-1.5 text-xs font-medium transition-colors ${costGroupBy === v ? 'bg-[#1e3a6e] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              {v === 'week' ? 'Weekly' : 'By Source'}
            </button>
          ))}
        </div>
      </div>

      {/* Date range */}
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Date range</label>
        <div className="flex flex-wrap gap-1">
          {DATE_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => onUpdate(config.id, { query: { ...config.query, datePreset: p } })}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${datePreset === p ? 'bg-[#1e3a6e] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {DATE_PRESET_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={excludeRemoved}
          onChange={(e) => onUpdate(config.id, { query: { ...config.query, excludeRemoved: e.target.checked } })}
          className="h-3.5 w-3.5 accent-[#1e3a6e]"
        />
        <span className="text-xs text-slate-500">Exclude removed</span>
      </label>
    </div>
  );

  const sources = sourceGroupObj?.tags ?? [];

  return (
    <WidgetShell
      accent={accent}
      title={config.title}
      canRemove={canRemove}
      showDragHandle={showDragHandle}
      readOnly={readOnly}
      onTitleSave={(t) => onUpdate(config.id, { title: t })}
      onDuplicate={onDuplicate}
      onRemove={() => onRemove(config.id)}
      configPanel={configPanel}
      colSpan={config.colSpan}
      onColSpanChange={(span) => onUpdate(config.id, { colSpan: span })}
    >
      {rows.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-xs text-slate-400">
          {metricDefs.length === 0
            ? 'Add at least one metric in settings'
            : 'No data — configure source group and date range'}
        </div>
      ) : costGroupBy === 'source' ? (
        <SourceSummaryTable
          aggregates={sourceAggregates}
          metricDefs={metricDefs}
          fmt={fmt}
        />
      ) : (
        <WeeklyTable
          rows={rows}
          sources={sources}
          metricDefs={metricDefs}
          fmt={fmt}
        />
      )}
    </WidgetShell>
  );
}

function SourceSummaryTable({
  aggregates,
  metricDefs,
  fmt,
}: {
  aggregates: { sources: { name: string; spend: number; counts: Record<string, number> }[]; organicCounts: Record<string, number> };
  metricDefs: CostMetricDef[];
  fmt: (n: number) => string;
}) {
  const { sources, organicCounts } = aggregates;
  const hdr = 'px-2 py-2 text-right font-semibold text-slate-600 bg-slate-50';
  const totalSpend = sources.reduce((s, r) => s + r.spend, 0);
  const totalCounts: Record<string, number> = {};
  for (const def of metricDefs) {
    totalCounts[def.name] = sources.reduce((s, r) => s + (r.counts[def.name] ?? 0), 0) + (organicCounts[def.name] ?? 0);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-2 py-2 text-left font-semibold text-slate-600 bg-slate-50">Source</th>
            {metricDefs.map((def) => (
              <th key={def.name} className={hdr}>{def.name}</th>
            ))}
            <th className={hdr}>Total Spend</th>
            {metricDefs.map((def) => (
              <th key={`cpa-${def.name}`} className={hdr}>$/{def.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sources.map((src, i) => {
            const costPer: Record<string, number | null> = {};
            for (const def of metricDefs) {
              const c = src.counts[def.name] ?? 0;
              costPer[def.name] = src.spend > 0 && c > 0 ? src.spend / c : null;
            }
            return (
              <tr key={src.name} className={`border-b border-slate-100 ${i % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                <td className="px-2 py-1.5 font-medium text-slate-700">{src.name}</td>
                {metricDefs.map((def) => (
                  <td key={def.name} className="px-2 py-1.5 text-right text-slate-700">
                    {(src.counts[def.name] ?? 0).toLocaleString()}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-right text-slate-700">{src.spend > 0 ? fmt(src.spend) : '—'}</td>
                {metricDefs.map((def) => (
                  <td key={`cpa-${def.name}`} className="px-2 py-1.5 text-right text-slate-700">
                    {costPer[def.name] != null ? fmt(costPer[def.name]!) : '—'}
                  </td>
                ))}
              </tr>
            );
          })}
          {Object.values(organicCounts).some((c) => c > 0) && (
            <tr className="border-b border-slate-100 italic">
              <td className="px-2 py-1.5 text-slate-500">Organic (no source)</td>
              {metricDefs.map((def) => (
                <td key={def.name} className="px-2 py-1.5 text-right text-slate-500">
                  {(organicCounts[def.name] ?? 0).toLocaleString()}
                </td>
              ))}
              <td className="px-2 py-1.5 text-right text-slate-400">—</td>
              {metricDefs.map((def) => (
                <td key={`cpa-${def.name}`} className="px-2 py-1.5 text-right text-slate-400">—</td>
              ))}
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
            <td className="px-2 py-2 text-slate-700">Total</td>
            {metricDefs.map((def) => (
              <td key={def.name} className="px-2 py-2 text-right text-slate-700">
                {totalCounts[def.name]?.toLocaleString() ?? '0'}
              </td>
            ))}
            <td className="px-2 py-2 text-right text-slate-700">{totalSpend > 0 ? fmt(totalSpend) : '—'}</td>
            {metricDefs.map((def) => {
              const c = totalCounts[def.name] ?? 0;
              return (
                <td key={`cpa-${def.name}`} className="px-2 py-2 text-right text-slate-700">
                  {totalSpend > 0 && c > 0 ? fmt(totalSpend / c) : '—'}
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function WeeklyTable({
  rows,
  sources,
  metricDefs,
  fmt,
}: {
  rows: CostMetricRow[];
  sources: { label: string; tag: string }[];
  metricDefs: CostMetricDef[];
  fmt: (n: number) => string;
}) {
  // Per source: Spend + (Count + $/metric) per metric def
  const srcColSpan = 1 + metricDefs.length * 2;
  const totalColSpan = 1 + metricDefs.length * 2;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="sticky left-0 bg-slate-50 px-2 py-2 text-left font-semibold text-slate-600">Week</th>
            {sources.map((src) => (
              <th key={src.label} colSpan={srcColSpan} className="px-2 py-2 text-center font-semibold text-slate-600 border-l border-slate-200">
                {src.tag}
              </th>
            ))}
            <th colSpan={totalColSpan} className="px-2 py-2 text-center font-semibold text-slate-600 border-l border-slate-200">Total</th>
          </tr>
          <tr className="border-b border-slate-200 bg-slate-50/50">
            <th className="sticky left-0 bg-slate-50/50 px-2 py-1" />
            {sources.flatMap((src) => [
              <th key={`${src.label}-sp`} className="px-2 py-1 text-right font-medium text-slate-500 border-l border-slate-100">Spend</th>,
              ...metricDefs.flatMap((def) => [
                <th key={`${src.label}-${def.name}-n`} className="px-2 py-1 text-right font-medium text-slate-500 border-l border-slate-100">{def.name}</th>,
                <th key={`${src.label}-${def.name}-c`} className="px-2 py-1 text-right font-medium text-slate-500 border-l border-slate-100">${def.name.slice(0, 6)}</th>,
              ]),
            ])}
            <th className="px-2 py-1 text-right font-medium text-slate-500 border-l border-slate-200">Spend</th>
            {metricDefs.flatMap((def) => [
              <th key={`tot-${def.name}-n`} className="px-2 py-1 text-right font-medium text-slate-500 border-l border-slate-100">{def.name}</th>,
              <th key={`tot-${def.name}-c`} className="px-2 py-1 text-right font-medium text-slate-500 border-l border-slate-100">${def.name.slice(0, 6)}</th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.weekLabel} className={`border-b border-slate-100 ${i % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
              <td className="sticky left-0 bg-white px-2 py-1.5 font-medium text-slate-700">{row.weekLabel}</td>
              {row.sources.flatMap((src) => [
                <td key={`${src.tagLabel}-sp`} className="px-2 py-1.5 text-right text-slate-700 border-l border-slate-100">
                  {src.spend > 0 ? fmt(src.spend) : '—'}
                </td>,
                ...metricDefs.flatMap((def) => [
                  <td key={`${src.tagLabel}-${def.name}-n`} className="px-2 py-1.5 text-right text-slate-700 border-l border-slate-100">
                    {src.counts[def.name] ?? 0}
                  </td>,
                  <td key={`${src.tagLabel}-${def.name}-c`} className="px-2 py-1.5 text-right text-slate-700 border-l border-slate-100">
                    {src.costPer[def.name] != null ? fmt(src.costPer[def.name]!) : '—'}
                  </td>,
                ]),
              ])}
              <td className="px-2 py-1.5 text-right font-medium text-slate-700 border-l border-slate-200">
                {row.totals.spend > 0 ? fmt(row.totals.spend) : '—'}
              </td>
              {metricDefs.flatMap((def) => [
                <td key={`tot-${def.name}-n`} className="px-2 py-1.5 text-right font-medium text-slate-700 border-l border-slate-100">
                  {row.totals.counts[def.name] ?? 0}
                </td>,
                <td key={`tot-${def.name}-c`} className="px-2 py-1.5 text-right font-medium text-slate-700 border-l border-slate-100">
                  {row.totals.costPer[def.name] != null ? fmt(row.totals.costPer[def.name]!) : '—'}
                </td>,
              ])}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
