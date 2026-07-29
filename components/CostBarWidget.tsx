'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import WidgetShell from './WidgetShell';
import { computeCostMetrics, DATE_PRESET_LABELS } from '@/lib/dataProcessor';
import type { ParsedData, ChartConfig, ChartQuery, DatePreset, CostMetricDef } from '@/lib/types';
import type { SpendEntry } from '@/lib/redis';

const DATE_PRESETS: DatePreset[] = ['all_time', 'this_year', 'this_month', 'last_30_days', 'last_90_days'];

// Colors for additional metrics beyond the first (which uses accent)
const EXTRA_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

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

function getEffectiveMetricDefs(config: ChartConfig): CostMetricDef[] {
  if (config.query.costMetricDefs && config.query.costMetricDefs.length > 0) {
    return config.query.costMetricDefs;
  }
  if (config.query.costMetric) {
    return [{ tagLabel: config.query.costMetric, name: 'Applications' }];
  }
  // Default: All Candidates
  return [{ tagLabel: '', name: 'All Candidates' }];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white shadow-lg">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.fill }}>
          {Number(p.value) > 0 ? `$${Number(p.value).toFixed(2)}` : '—'} / {p.name}
        </p>
      ))}
    </div>
  );
};

export default function CostBarWidget({
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
  const { id, title, query } = config;

  const updateQuery = (patch: Partial<ChartQuery>) => onUpdate(id, { query: { ...query, ...patch } });

  const sourceGroup = query.costSourceGroup ?? tagGroups[0]?.name ?? '';
  const datePreset = query.datePreset ?? 'all_time';
  const metricDefs = getEffectiveMetricDefs(config);

  const updateMetricDefs = (defs: CostMetricDef[]) =>
    updateQuery({ costMetricDefs: defs, costMetric: undefined });

  const moveMetric = (i: number, dir: -1 | 1) => {
    const nd = [...metricDefs];
    const j = i + dir;
    [nd[i], nd[j]] = [nd[j], nd[i]];
    updateMetricDefs(nd);
  };

  const barColor = (i: number) => i === 0 ? accent : EXTRA_COLORS[(i - 1) % EXTRA_COLORS.length];

  // Build one data point per week with a key per metric
  const chartData = useMemo(() => {
    if (metricDefs.length === 0) return [];
    const rows = computeCostMetrics(
      data.leads,
      spendData,
      tagGroups,
      sourceGroup,
      metricDefs,
      { datePreset: query.datePreset, startDate: query.startDate, endDate: query.endDate, excludeRemoved: query.excludeRemoved, dateField: query.dateField },
    );
    return rows
      .map((row) => {
        const point: Record<string, number | string> = { period: row.weekLabel };
        for (const def of metricDefs) {
          point[def.name] = row.totals.costPer[def.name] ?? 0;
        }
        return point;
      })
      .filter((point) => metricDefs.some((def) => Number(point[def.name]) > 0));
  }, [data.leads, spendData, tagGroups, sourceGroup, metricDefs, query]);

  const chartHeight = config.chartHeight ?? 300;
  const rotateLabels = chartData.length > 8;
  const showLegend = metricDefs.length > 1;

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
                <div className="h-3 w-3 flex-shrink-0 rounded-sm" style={{ background: barColor(i) }} />
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
                <select
                  value={def.tagLabel}
                  onChange={(e) => {
                    const nd = [...metricDefs];
                    nd[i] = { ...def, tagLabel: e.target.value };
                    updateMetricDefs(nd);
                  }}
                  className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-[#1e3a6e]"
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
                <select
                  value={def.dateField ?? ''}
                  onChange={(e) => {
                    const nd = [...metricDefs];
                    nd[i] = { ...def, dateField: e.target.value || undefined };
                    updateMetricDefs(nd);
                  }}
                  className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-[#1e3a6e]"
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
          onChange={(e) => updateQuery({ costSourceGroup: e.target.value || undefined })}
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-[#1e3a6e]"
        >
          {tagGroups.map((g) => <option key={g.name} value={g.name}>{g.name}</option>)}
        </select>
      </div>

      {/* Date range */}
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Date range</label>
        <div className="flex flex-wrap gap-1">
          {DATE_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => updateQuery({ datePreset: p, startDate: null, endDate: null })}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${datePreset === p ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              style={datePreset === p ? { backgroundColor: accent } : {}}
            >
              {DATE_PRESET_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-1.5">
        <input
          type="checkbox"
          checked={query.excludeRemoved ?? false}
          onChange={(e) => updateQuery({ excludeRemoved: e.target.checked })}
          className="h-3.5 w-3.5 accent-[#1e3a6e]"
        />
        <span className="text-xs text-slate-500">Exclude removed</span>
      </label>
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
        {chartData.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-slate-400">
            No cost data — configure spend in Manage Spend
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={rotateLabels ? chartHeight + 40 : chartHeight}>
            <BarChart data={chartData} margin={{ top: 20, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 11, fill: '#94a3b8', textAnchor: rotateLabels ? 'end' : 'middle' }}
                axisLine={false}
                tickLine={false}
                angle={rotateLabels ? -45 : 0}
                height={rotateLabels ? 72 : 30}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${Number(v).toFixed(0)}`}
                width={52}
              />
              <Tooltip content={<CustomTooltip />} />
              {showLegend && (
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  formatter={(value) => <span style={{ color: '#64748b' }}>{value}</span>}
                />
              )}
              {metricDefs.map((def, i) => (
                <Bar
                  key={def.name}
                  dataKey={def.name}
                  fill={barColor(i)}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={metricDefs.length > 1 ? 28 : 48}
                >
                  <LabelList
                    dataKey={def.name}
                    position="top"
                    style={{ fontSize: 10, fill: '#64748b' }}
                    formatter={(v: unknown) => (Number(v) > 0 ? `$${Number(v).toFixed(2)}` : '')}
                  />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </WidgetShell>
  );
}
