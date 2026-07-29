'use client';

import { useMemo } from 'react';
import WidgetShell from './WidgetShell';
import { computeCostMetrics, type CostMetricRow } from '@/lib/dataProcessor';
import { DATE_PRESET_LABELS } from '@/lib/dataProcessor';
import type { ParsedData, ChartConfig, DatePreset } from '@/lib/types';
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
  const allTags = tagGroups.flatMap((g) => g.tags);

  const sourceGroup = config.query.costSourceGroup ?? tagGroups[0]?.name ?? '';
  const sourceGroupObj = tagGroups.find((g) => g.name === sourceGroup);

  const appMetric = config.query.costMetric ?? '';
  const costView = config.query.costView ?? 'applications';
  const costGroupBy = config.query.costGroupBy ?? 'week';
  const datePreset = config.query.datePreset ?? 'all_time';
  const excludeRemoved = config.query.excludeRemoved ?? false;

  const rows = computeCostMetrics(
    data.leads,
    spendData,
    tagGroups,
    sourceGroup,
    appMetric,
    {
      datePreset: config.query.datePreset,
      startDate: config.query.startDate,
      endDate: config.query.endDate,
      excludeRemoved,
    }
  );

  const configPanel = (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Application metric
        </label>
        <select
          value={appMetric}
          onChange={(e) =>
            onUpdate(config.id, { query: { ...config.query, costMetric: e.target.value || undefined } })
          }
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-[#1e3a6e]"
        >
          <option value="">— none —</option>
          {tagGroups.map((g) => (
            <optgroup key={g.name} label={g.name}>
              {g.tags.map((t) => (
                <option key={t.label} value={t.label}>
                  {t.tag}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Source group
        </label>
        <select
          value={sourceGroup}
          onChange={(e) =>
            onUpdate(config.id, { query: { ...config.query, costSourceGroup: e.target.value || undefined } })
          }
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-[#1e3a6e]"
        >
          {tagGroups.map((g) => (
            <option key={g.name} value={g.name}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Show</label>
          <div className="flex overflow-hidden rounded-lg border border-slate-200">
            {(['applications', 'candidates', 'both'] as const).map((v) => (
              <button
                key={v}
                onClick={() => onUpdate(config.id, { query: { ...config.query, costView: v } })}
                className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                  costView === v ? 'bg-[#1e3a6e] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {v === 'applications' ? 'Apps' : v === 'candidates' ? 'Candidates' : 'Both'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Group by</label>
          <div className="flex overflow-hidden rounded-lg border border-slate-200">
            {(['week', 'source'] as const).map((v) => (
              <button
                key={v}
                onClick={() => onUpdate(config.id, { query: { ...config.query, costGroupBy: v } })}
                className={`flex-1 py-1.5 text-xs font-medium transition-colors capitalize ${
                  costGroupBy === v ? 'bg-[#1e3a6e] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {v === 'week' ? 'Weekly' : 'By Source'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Date range</label>
        <div className="flex flex-wrap gap-1">
          {DATE_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => onUpdate(config.id, { query: { ...config.query, datePreset: p } })}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                datePreset === p
                  ? 'bg-[#1e3a6e] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
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
          onChange={(e) =>
            onUpdate(config.id, { query: { ...config.query, excludeRemoved: e.target.checked } })
          }
          className="h-3.5 w-3.5 accent-[#1e3a6e]"
        />
        <span className="text-xs text-slate-500">Exclude removed</span>
      </label>
    </div>
  );

  const showApps = costView === 'applications' || costView === 'both';
  const showCandidates = costView === 'candidates' || costView === 'both';
  const sources = sourceGroupObj?.tags ?? [];

  const sourceAggregates = useMemo(() => {
    const map = new Map<string, { name: string; apps: number; candidates: number; spend: number }>();
    let organicApps = 0, organicCandidates = 0;
    for (const row of rows) {
      for (const src of row.sources) {
        const ex = map.get(src.tagLabel) ?? { name: src.name, apps: 0, candidates: 0, spend: 0 };
        map.set(src.tagLabel, { name: src.name, apps: ex.apps + src.applications, candidates: ex.candidates + src.candidates, spend: ex.spend + src.spend });
      }
      organicApps += row.organic.applications;
      organicCandidates += row.organic.candidates;
    }
    return { sources: Array.from(map.values()), organicApps, organicCandidates };
  }, [rows]);

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
          No data — configure source group, metric, and date range
        </div>
      ) : costGroupBy === 'source' ? (
        <SourceSummaryTable
          aggregates={sourceAggregates}
          showApps={showApps}
          showCandidates={showCandidates}
          fmt={fmt}
        />
      ) : (
        <WeeklyTable
          rows={rows}
          sources={sources}
          showApps={showApps}
          showCandidates={showCandidates}
          fmt={fmt}
        />
      )}
    </WidgetShell>
  );
}

function th(className: string, children: React.ReactNode, key?: string) {
  return <th key={key} className={`px-2 py-1.5 text-right font-medium text-slate-500 border-l border-slate-100 ${className}`}>{children}</th>;
}

function SourceSummaryTable({ aggregates, showApps, showCandidates, fmt }: {
  aggregates: { sources: { name: string; apps: number; candidates: number; spend: number }[]; organicApps: number; organicCandidates: number };
  showApps: boolean; showCandidates: boolean; fmt: (n: number) => string;
}) {
  const { sources, organicApps, organicCandidates } = aggregates;
  const totalApps = sources.reduce((s, r) => s + r.apps, 0) + organicApps;
  const totalCands = sources.reduce((s, r) => s + r.candidates, 0) + organicCandidates;
  const totalSpend = sources.reduce((s, r) => s + r.spend, 0);

  const hdr = 'px-2 py-2 text-right font-semibold text-slate-600 bg-slate-50';
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-2 py-2 text-left font-semibold text-slate-600 bg-slate-50">Source</th>
            {showApps && <th className={hdr}>Applications</th>}
            {showCandidates && <th className={hdr}>Candidates</th>}
            <th className={hdr}>Total Spend</th>
            {showApps && <th className={hdr}>$/Application</th>}
            {showCandidates && <th className={hdr}>$/Candidate</th>}
          </tr>
        </thead>
        <tbody>
          {sources.map((src, i) => {
            const cpa = src.spend > 0 && src.apps > 0 ? src.spend / src.apps : null;
            const cpc = src.spend > 0 && src.candidates > 0 ? src.spend / src.candidates : null;
            return (
              <tr key={src.name} className={`border-b border-slate-100 ${i % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                <td className="px-2 py-1.5 font-medium text-slate-700">{src.name}</td>
                {showApps && <td className="px-2 py-1.5 text-right text-slate-700">{src.apps.toLocaleString()}</td>}
                {showCandidates && <td className="px-2 py-1.5 text-right text-slate-700">{src.candidates.toLocaleString()}</td>}
                <td className="px-2 py-1.5 text-right text-slate-700">{src.spend > 0 ? fmt(src.spend) : '—'}</td>
                {showApps && <td className="px-2 py-1.5 text-right text-slate-700">{cpa != null ? fmt(cpa) : '—'}</td>}
                {showCandidates && <td className="px-2 py-1.5 text-right text-slate-700">{cpc != null ? fmt(cpc) : '—'}</td>}
              </tr>
            );
          })}
          {(organicApps > 0 || organicCandidates > 0) && (
            <tr className="border-b border-slate-100 italic">
              <td className="px-2 py-1.5 text-slate-500">Organic (no source)</td>
              {showApps && <td className="px-2 py-1.5 text-right text-slate-500">{organicApps.toLocaleString()}</td>}
              {showCandidates && <td className="px-2 py-1.5 text-right text-slate-500">{organicCandidates.toLocaleString()}</td>}
              <td className="px-2 py-1.5 text-right text-slate-400">—</td>
              {showApps && <td className="px-2 py-1.5 text-right text-slate-400">—</td>}
              {showCandidates && <td className="px-2 py-1.5 text-right text-slate-400">—</td>}
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
            <td className="px-2 py-2 text-slate-700">Total</td>
            {showApps && <td className="px-2 py-2 text-right text-slate-700">{totalApps.toLocaleString()}</td>}
            {showCandidates && <td className="px-2 py-2 text-right text-slate-700">{totalCands.toLocaleString()}</td>}
            <td className="px-2 py-2 text-right text-slate-700">{totalSpend > 0 ? fmt(totalSpend) : '—'}</td>
            {showApps && <td className="px-2 py-2 text-right text-slate-700">{totalSpend > 0 && totalApps > 0 ? fmt(totalSpend / totalApps) : '—'}</td>}
            {showCandidates && <td className="px-2 py-2 text-right text-slate-700">{totalSpend > 0 && totalCands > 0 ? fmt(totalSpend / totalCands) : '—'}</td>}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function WeeklyTable({ rows, sources, showApps, showCandidates, fmt }: {
  rows: CostMetricRow[]; sources: { label: string; tag: string }[];
  showApps: boolean; showCandidates: boolean; fmt: (n: number) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="sticky left-0 bg-slate-50 px-2 py-2 text-left font-semibold text-slate-600">Week</th>
            {sources.map((src) => (
              <th key={src.label} colSpan={showApps && showCandidates ? 4 : showApps || showCandidates ? 3 : 1} className="px-2 py-2 text-center font-semibold text-slate-600 border-l border-slate-200">{src.tag}</th>
            ))}
            <th colSpan={showApps && showCandidates ? 4 : showApps || showCandidates ? 3 : 1} className="px-2 py-2 text-center font-semibold text-slate-600 border-l border-slate-200">Total</th>
          </tr>
          <tr className="border-b border-slate-200 bg-slate-50/50">
            <th className="sticky left-0 bg-slate-50/50 px-2 py-1" />
            {sources.flatMap((src) => [
              showApps && <th key={`${src.label}-a`} className="px-2 py-1 text-right font-medium text-slate-500 border-l border-slate-100">Apps</th>,
              showCandidates && <th key={`${src.label}-c`} className="px-2 py-1 text-right font-medium text-slate-500 border-l border-slate-100">Cands</th>,
              <th key={`${src.label}-s`} className="px-2 py-1 text-right font-medium text-slate-500 border-l border-slate-100">Spend</th>,
              showApps && <th key={`${src.label}-pa`} className="px-2 py-1 text-right font-medium text-slate-500 border-l border-slate-100">$/App</th>,
              showCandidates && <th key={`${src.label}-pc`} className="px-2 py-1 text-right font-medium text-slate-500 border-l border-slate-100">$/Cand</th>,
            ].filter(Boolean))}
            {showApps && <th className="px-2 py-1 text-right font-medium text-slate-500 border-l border-slate-200">Apps</th>}
            {showCandidates && <th className="px-2 py-1 text-right font-medium text-slate-500 border-l border-slate-100">Cands</th>}
            <th className="px-2 py-1 text-right font-medium text-slate-500 border-l border-slate-100">Spend</th>
            {showApps && <th className="px-2 py-1 text-right font-medium text-slate-500 border-l border-slate-100">$/App</th>}
            {showCandidates && <th className="px-2 py-1 text-right font-medium text-slate-500 border-l border-slate-100">$/Cand</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.weekLabel} className={`border-b border-slate-100 ${i % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
              <td className="sticky left-0 bg-white px-2 py-1.5 font-medium text-slate-700">{row.weekLabel}</td>
              {row.sources.flatMap((src) => [
                showApps && <td key={`${src.tagLabel}-a`} className="px-2 py-1.5 text-right text-slate-700 border-l border-slate-100">{src.applications}</td>,
                showCandidates && <td key={`${src.tagLabel}-c`} className="px-2 py-1.5 text-right text-slate-700 border-l border-slate-100">{src.candidates}</td>,
                <td key={`${src.tagLabel}-s`} className="px-2 py-1.5 text-right text-slate-700 border-l border-slate-100">{src.spend > 0 ? fmt(src.spend) : '—'}</td>,
                showApps && <td key={`${src.tagLabel}-pa`} className="px-2 py-1.5 text-right text-slate-700 border-l border-slate-100">{src.costPerApp != null ? fmt(src.costPerApp) : '—'}</td>,
                showCandidates && <td key={`${src.tagLabel}-pc`} className="px-2 py-1.5 text-right text-slate-700 border-l border-slate-100">{src.costPerCandidate != null ? fmt(src.costPerCandidate) : '—'}</td>,
              ].filter(Boolean))}
              {showApps && <td className="px-2 py-1.5 text-right font-medium text-slate-700 border-l border-slate-200">{row.totals.applications}</td>}
              {showCandidates && <td className="px-2 py-1.5 text-right font-medium text-slate-700 border-l border-slate-100">{row.totals.candidates}</td>}
              <td className="px-2 py-1.5 text-right font-medium text-slate-700 border-l border-slate-100">{row.totals.spend > 0 ? fmt(row.totals.spend) : '—'}</td>
              {showApps && <td className="px-2 py-1.5 text-right font-medium text-slate-700 border-l border-slate-100">{row.totals.costPerApp != null ? fmt(row.totals.costPerApp) : '—'}</td>}
              {showCandidates && <td className="px-2 py-1.5 text-right font-medium text-slate-700 border-l border-slate-100">{row.totals.costPerCandidate != null ? fmt(row.totals.costPerCandidate) : '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
