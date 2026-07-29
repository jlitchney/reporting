'use client';

import { useMemo } from 'react';
import type { ParsedData, ChartConfig, ChartQuery, DatePreset } from '@/lib/types';
import { processFunnelChart, DATE_PRESET_LABELS } from '@/lib/dataProcessor';
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

export default function FunnelWidget({ data, config, accent, onUpdate, onRemove, canRemove, showDragHandle, onDuplicate, readOnly }: Props) {
  const { tagGroups, leads } = data;
  const { id, title, query } = config;

  const updateQuery = (patch: Partial<ChartQuery>) => onUpdate(id, { query: { ...query, ...patch } });

  const funnelStages = query.funnelStages ?? [];

  const funnelData = useMemo(
    () => processFunnelChart(leads, funnelStages, tagGroups, query),
    [leads, funnelStages, tagGroups, query]
  );

  const maxCount = funnelData[0]?.count ?? 1;
  const overallConversion = funnelData.length >= 2 && funnelData[0].count > 0
    ? ((funnelData[funnelData.length - 1].count / funnelData[0].count) * 100).toFixed(1)
    : null;

  const allTags = tagGroups.flatMap((g) => g.tags);

  const configPanel = (
    <div className="space-y-3">
      <div>
        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-slate-400">Funnel stages (in order)</label>
        {funnelStages.length > 0 && (
          <div className="mb-2 space-y-1">
            {funnelStages.map((tagLabel, idx) => {
              const tagName = allTags.find((t) => t.label === tagLabel)?.tag ?? tagLabel;
              const customLabel = query.funnelStageLabels?.[tagLabel] ?? '';
              return (
                <div key={tagLabel} className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2.5 py-1.5">
                  <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500">{idx + 1}</span>
                  <input
                    type="text"
                    value={customLabel}
                    placeholder={tagName}
                    onChange={(e) => updateQuery({
                      funnelStageLabels: { ...query.funnelStageLabels, [tagLabel]: e.target.value },
                    })}
                    className="flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder-slate-400 focus:bg-slate-50 rounded px-1 -mx-1"
                  />
                  <button
                    onClick={() => updateQuery({ funnelStages: funnelStages.filter((_, i) => i !== idx) })}
                    className="text-slate-300 hover:text-slate-500 text-sm leading-none"
                  >×</button>
                </div>
              );
            })}
          </div>
        )}
        <select
          value=""
          onChange={(e) => {
            const val = e.target.value;
            if (val && !funnelStages.includes(val)) updateQuery({ funnelStages: [...funnelStages, val] });
          }}
          className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">+ Add stage…</option>
          {tagGroups.map((g) => {
            const available = g.tags.filter((t) => !funnelStages.includes(t.label));
            if (!available.length) return null;
            return (
              <optgroup key={g.name} label={g.name}>
                {available.map((t) => <option key={t.label} value={t.label}>{t.tag}</option>)}
              </optgroup>
            );
          })}
        </select>
      </div>

      <div className="flex flex-wrap items-end gap-3">
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
        <label className="flex cursor-pointer items-center gap-1.5 pb-1.5">
          <input type="checkbox" checked={query.excludeRemoved ?? false} onChange={(e) => updateQuery({ excludeRemoved: e.target.checked })} className="h-3.5 w-3.5 accent-[#1e3a6e]" />
          <span className="text-[10px] text-slate-500">Exclude removed</span>
        </label>
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
      colSpan={config.colSpan ?? 4}
      chartHeight={config.chartHeight}
      onColorChange={(c) => onUpdate(id, { color: c })}
      onColSpanChange={(s) => onUpdate(id, { colSpan: s })}
      onHeightChange={(h) => onUpdate(id, { chartHeight: h })}
      configPanel={configPanel}
    >
      <div className="px-4 pb-6 pt-3">
        {funnelData.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-slate-400">
            <span>No stages configured</span>
            <span className="text-xs">Open settings to add funnel stages</span>
          </div>
        ) : (
          <div className="relative">
            {overallConversion && (
              <div className="mb-3 text-right text-[10px] font-medium text-slate-400">
                {overallConversion}% overall conversion
              </div>
            )}
            <div className="flex items-end gap-2">
              {funnelData.map((stage, idx) => {
                const maxBarHeight = config.chartHeight ?? 200;
                const barHeight = maxCount > 0 ? Math.max(Math.round((stage.count / maxCount) * maxBarHeight), 6) : 6;
                const convPct = idx > 0 && funnelData[idx - 1].count > 0
                  ? ((stage.count / funnelData[idx - 1].count) * 100).toFixed(1)
                  : null;
                return (
                  <div key={stage.tagLabel} className="flex flex-1 items-end gap-2">
                    {idx > 0 && (
                      <div className="flex flex-shrink-0 flex-col items-center justify-end pb-8 text-[10px] text-slate-400">
                        {convPct && <span className="font-medium">{convPct}%</span>}
                        <span>→</span>
                      </div>
                    )}
                    <div className="flex flex-1 flex-col items-center">
                      <span className="mb-1 text-xs font-semibold text-slate-700">{stage.count.toLocaleString()}</span>
                      <div
                        className="w-full rounded-t-sm transition-all"
                        style={{ height: barHeight, backgroundColor: accent, opacity: 1 - idx * 0.12 }}
                      />
                      <div className="mt-2 max-w-full px-1 text-center text-[10px] leading-tight text-slate-500 break-words">
                        {stage.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </WidgetShell>
  );
}
