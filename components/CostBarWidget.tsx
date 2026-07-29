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
import WidgetShell from './WidgetShell';
import { processCostBarData, DATE_PRESET_LABELS } from '@/lib/dataProcessor';
import type { ParsedData, ChartConfig, ChartQuery, DatePreset, CostMetricDef } from '@/lib/types';
import type { SpendEntry } from '@/lib/redis';

const DATE_PRESETS: DatePreset[] = ['all_time', 'this_year', 'this_month', 'last_30_days', 'last_90_days'];

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
  return [];
}

const CustomTooltip = ({ active, payload, label, metricName }: any) => {
  if (!active || !payload?.length) return null;
  const val: number = payload[0].value;
  return (
    <div className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white shadow-lg">
      <p className="font-medium">{label}</p>
      <p className="text-blue-300">
        {val > 0 ? `$${val.toFixed(2)}` : '—'} / {metricName}
      </p>
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
  const selectedMetricName = query.costSelectedMetric ?? metricDefs[0]?.name ?? '';

  const updateMetricDefs = (defs: CostMetricDef[]) =>
    updateQuery({ costMetricDefs: defs, costMetric: undefined });

  const chartData = useMemo(() => {
    if (metricDefs.length === 0 || !selectedMetricName) return [];
    return processCostBarData(
      data.leads,
      spendData,
      tagGroups,
      sourceGroup,
      metricDefs,
      selectedMetricName,
      { datePreset: query.datePreset, startDate: query.startDate, endDate: query.endDate, excludeRemoved: query.excludeRemoved },
    );
  }, [data.leads, spendData, tagGroups, sourceGroup, metricDefs, selectedMetricName, query]);

  const chartHeight = config.chartHeight ?? 300;
  const rotateLabels = chartData.length > 8;

  const configPanel = (
    <div className="space-y-3">
      {/* Metrics editor */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Metrics</label>
        <div className="space-y-1.5">
          {metricDefs.map((def, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <select
                value={def.tagLabel}
                onChange={(e) => {
                  const nd = [...metricDefs];
                  nd[i] = { ...def, tagLabel: e.target.value };
                  updateMetricDefs(nd);
                }}
                className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-[#1e3a6e]"
              >
                {tagGroups.map((g) => (
                  <optgroup key={g.name} label={g.name}>
                    {g.tags.map((t) => (
                      <option key={t.label} value={t.label}>{t.tag}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <input
                type="text"
                value={def.name}
                onChange={(e) => {
                  const nd = [...metricDefs];
                  nd[i] = { ...def, name: e.target.value };
                  updateMetricDefs(nd);
                }}
                placeholder="Label"
                className="w-20 rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-[#1e3a6e]"
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
          ))}
          <button
            onClick={() => {
              const firstTag = tagGroups[0]?.tags[0];
              if (!firstTag) return;
              updateMetricDefs([...metricDefs, { tagLabel: firstTag.label, name: firstTag.tag }]);
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

      {/* Display metric picker (when multiple defined) */}
      {metricDefs.length > 1 && (
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Display metric</label>
          <div className="flex flex-wrap gap-1">
            {metricDefs.map((def) => (
              <button
                key={def.name}
                onClick={() => updateQuery({ costSelectedMetric: def.name })}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${selectedMetricName === def.name ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                style={selectedMetricName === def.name ? { backgroundColor: accent } : {}}
              >
                {def.name}
              </button>
            ))}
          </div>
        </div>
      )}

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
        {metricDefs.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-slate-400">
            Add at least one metric in settings
          </div>
        ) : chartData.length === 0 ? (
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
              <Tooltip content={<CustomTooltip metricName={selectedMetricName} />} />
              <Bar dataKey="count" fill={accent} radius={[4, 4, 0, 0]} maxBarSize={48}>
                <LabelList
                  dataKey="count"
                  position="top"
                  style={{ fontSize: 10, fill: '#64748b' }}
                  formatter={(v: unknown) => (Number(v) > 0 ? `$${Number(v).toFixed(0)}` : '')}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </WidgetShell>
  );
}
