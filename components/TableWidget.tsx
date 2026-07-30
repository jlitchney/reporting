'use client';

import { useMemo } from 'react';
import type { ParsedData, ChartConfig, ChartQuery, DatePreset } from '@/lib/types';
import { processTagGroupChart, DATE_PRESET_LABELS } from '@/lib/dataProcessor';
import WidgetShell from './WidgetShell';

const DATE_PRESETS: DatePreset[] = ['all_time', 'this_year', 'this_month', 'last_30_days', 'last_90_days', 'custom'];

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

export default function TableWidget({ data, config, accent, onUpdate, onRemove, canRemove, showDragHandle, onDuplicate, readOnly }: Props) {
  const { tagGroups, leads } = data;
  const { id, title, query } = config;

  const updateQuery = (patch: Partial<ChartQuery>) => onUpdate(id, { query: { ...query, ...patch } });

  const tagGroupName = query.tagGroupAxis ?? tagGroups[0]?.name ?? '';

  const rawData = useMemo(
    () => tagGroupName ? processTagGroupChart(leads, tagGroups, tagGroupName, query) : [],
    [leads, tagGroups, tagGroupName, query]
  );

  const tableData = useMemo(
    () => [...rawData].sort((a, b) => b.count - a.count).filter((d) => d.count > 0),
    [rawData]
  );

  const total = useMemo(() => tableData.reduce((s, d) => s + d.count, 0), [tableData]);
  const maxCount = tableData[0]?.count ?? 1;

  const configPanel = (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Tag group</label>
        <select
          value={tagGroupName}
          onChange={(e) => updateQuery({ tagGroupAxis: e.target.value })}
          className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
        >
          {tagGroups.map((g) => <option key={g.name} value={g.name}>{g.name}</option>)}
        </select>
        <label className="mt-1 flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={query.excludeRemoved ?? false} onChange={(e) => updateQuery({ excludeRemoved: e.target.checked })} className="h-3.5 w-3.5 accent-[#1e3a6e]" />
          <span className="text-[10px] text-slate-500">Exclude removed</span>
        </label>
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
            <input type="date" value={query.startDate instanceof Date ? query.startDate.toISOString().slice(0, 10) : (query.startDate as unknown as string ?? '')} onChange={(e) => updateQuery({ startDate: e.target.value ? new Date(e.target.value + 'T00:00:00') : null })} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-200" />
            <span className="text-[10px] text-slate-400">to</span>
            <input type="date" value={query.endDate instanceof Date ? query.endDate.toISOString().slice(0, 10) : (query.endDate as unknown as string ?? '')} onChange={(e) => updateQuery({ endDate: e.target.value ? new Date(e.target.value + 'T23:59:59') : null })} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
        )}
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
      badge={total > 0 ? total.toLocaleString() : undefined}
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
        {tableData.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-slate-400">No data for the selected criteria</div>
        ) : (
          <div style={config.chartHeight ? { maxHeight: config.chartHeight, overflowY: 'auto' } : undefined}>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-2 text-left font-medium text-slate-400 w-6">#</th>
                <th className="pb-2 text-left font-medium text-slate-400">Name</th>
                <th className="pb-2 text-right font-medium text-slate-400">Count</th>
                <th className="pb-2 text-right font-medium text-slate-400">Share</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((d, idx) => (
                <tr key={d.period} className="border-b border-slate-50">
                  <td className="py-1.5 text-slate-400 font-medium">{idx + 1}</td>
                  <td className="py-1.5 pr-3">
                    <div className="font-medium text-slate-700 truncate max-w-[200px]">{d.period}</div>
                    <div className="mt-0.5 h-1 rounded-full bg-slate-100">
                      <div className="h-1 rounded-full transition-all" style={{ width: `${(d.count / maxCount) * 100}%`, backgroundColor: accent }} />
                    </div>
                  </td>
                  <td className="py-1.5 text-right font-semibold text-slate-700">{d.count.toLocaleString()}</td>
                  <td className="py-1.5 text-right text-slate-500">{total > 0 ? `${((d.count / total) * 100).toFixed(1)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td />
                <td className="pt-2 font-semibold text-slate-700">Total</td>
                <td className="pt-2 text-right font-semibold text-slate-700">{total.toLocaleString()}</td>
                <td className="pt-2 text-right text-slate-500">100%</td>
              </tr>
            </tfoot>
          </table>
          </div>
        )}
      </div>
    </WidgetShell>
  );
}
