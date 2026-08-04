'use client';

import { useState, useMemo } from 'react';
import type { ParsedData, ChartConfig, ChartQuery, DatePreset, CostMetricDef } from '@/lib/types';
import { computeCostTotals, DATE_PRESET_LABELS } from '@/lib/dataProcessor';
import type { SpendEntry } from '@/lib/redis';
import AppearanceControls from './AppearanceControls';

const DATE_PRESETS: DatePreset[] = ['today', 'this_month', 'last_30_days', 'last_90_days', 'this_year', 'all_time', 'custom'];

function GripIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="5" cy="4" r="1.5" /><circle cx="11" cy="4" r="1.5" />
      <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
      <circle cx="5" cy="12" r="1.5" /><circle cx="11" cy="12" r="1.5" />
    </svg>
  );
}

function fmtCurrency(n: number): string {
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return '$' + n.toFixed(2);
}

interface Props {
  data: ParsedData;
  config: ChartConfig;
  spendData: SpendEntry[];
  accent: string;
  onUpdate: (id: string, updates: Partial<ChartConfig>) => void;
  onRemove: (id: string) => void;
  onDuplicate?: (id: string) => void;
  showDragHandle?: boolean;
  readOnly?: boolean;
}

export default function CostTotalWidget({ data, config, spendData, accent, onUpdate, onRemove, onDuplicate, showDragHandle, readOnly }: Props) {
  const { tagGroups } = data;
  const { id, title, query } = config;

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [configOpen, setConfigOpen] = useState(false);

  const updateQuery = (patch: Partial<ChartQuery>) => onUpdate(id, { query: { ...query, ...patch } });

  const sourceGroup = query.costSourceGroup ?? tagGroups[0]?.name ?? '';
  const datePreset: DatePreset = query.datePreset ?? 'all_time';

  // Single metric def for this widget
  const metricDef: CostMetricDef = query.costMetricDefs?.[0] ?? { tagLabel: '', name: 'All Candidates' };
  // What to display: '__spend__' = total spend, otherwise = costPer[metricDef.name]
  const displayMode: string = query.costSelectedMetric ?? '__spend__';

  const totals = useMemo(
    () => computeCostTotals(data.leads, spendData, tagGroups, sourceGroup, [metricDef], query),
    [data.leads, spendData, tagGroups, sourceGroup, metricDef, query]
  );

  const displayValue: number | null = displayMode === '__spend__'
    ? totals.totalSpend
    : (totals.costPer[metricDef.name] ?? null);

  const commitTitle = () => {
    if (titleDraft.trim()) onUpdate(id, { title: titleDraft.trim() });
    setEditingTitle(false);
  };

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200/80">
      <div className="h-1 w-full" style={{ backgroundColor: accent }} />
      <div className="px-4 py-4">
        {/* Header row */}
        <div className="flex items-start gap-2">
          {showDragHandle && !readOnly && (
            <div className="mt-0.5 flex-shrink-0 cursor-grab text-slate-300 hover:text-slate-400 active:cursor-grabbing">
              <GripIcon />
            </div>
          )}
          <div className="min-w-0 flex-1">
            {!readOnly && editingTitle ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitTitle();
                  if (e.key === 'Escape') setEditingTitle(false);
                }}
                className="w-full bg-transparent text-[11px] font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-300 outline-none"
              />
            ) : readOnly ? (
              <span className="block truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</span>
            ) : (
              <button
                onClick={() => { setTitleDraft(title); setEditingTitle(true); }}
                className="block truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors text-left"
                title="Click to rename"
              >
                {title}
              </button>
            )}
            <p className="mt-0.5 text-[10px] text-slate-400">{DATE_PRESET_LABELS[datePreset]}</p>
          </div>
          {!readOnly && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {onDuplicate && (
                <button onClick={() => onDuplicate(id)} title="Duplicate" className="rounded p-1 text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </button>
              )}
              <button onClick={() => setConfigOpen((v) => !v)} title="Configure" className={`rounded p-1 transition-colors ${configOpen ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
              </button>
              <button onClick={() => { if (window.confirm('Remove this chart?')) onRemove(id); }} title="Remove" className="rounded p-1 text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}
        </div>

        {/* Value */}
        <p className="mt-2 text-3xl font-bold text-slate-800">
          {displayValue !== null ? fmtCurrency(displayValue) : '—'}
        </p>

        {/* Config panel */}
        {configOpen && (
          <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">

            {/* What to show */}
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">Show</label>
              <div className="flex overflow-hidden rounded border border-slate-200">
                <button
                  onClick={() => updateQuery({ costSelectedMetric: '__spend__' })}
                  className={`flex-1 py-1.5 text-xs font-medium transition-colors ${displayMode === '__spend__' ? 'text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                  style={displayMode === '__spend__' ? { backgroundColor: accent } : {}}
                >
                  Total Spend
                </button>
                <button
                  onClick={() => updateQuery({ costSelectedMetric: metricDef.name })}
                  className={`flex-1 py-1.5 text-xs font-medium transition-colors ${displayMode !== '__spend__' ? 'text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                  style={displayMode !== '__spend__' ? { backgroundColor: accent } : {}}
                >
                  $ / {metricDef.name}
                </button>
              </div>
            </div>

            {/* Count metric */}
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">Count</label>
              <div className="flex gap-2">
                <select
                  value={metricDef.tagLabel}
                  onChange={(e) => {
                    const tagLabel = e.target.value;
                    const name = tagLabel === ''
                      ? 'All Candidates'
                      : (tagGroups.flatMap((g) => g.tags).find((t) => t.label === tagLabel)?.tag ?? tagLabel);
                    const newDef: CostMetricDef = { tagLabel, name };
                    updateQuery({ costMetricDefs: [newDef], costSelectedMetric: displayMode === '__spend__' ? '__spend__' : name });
                  }}
                  className="flex-1 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">All Candidates</option>
                  {tagGroups.map((g) => (
                    <optgroup key={g.name} label={g.name}>
                      {g.tags.map((t) => <option key={t.label} value={t.label}>{t.tag}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            {/* Source group */}
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">Source group</label>
              <select
                value={sourceGroup}
                onChange={(e) => updateQuery({ costSourceGroup: e.target.value })}
                className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
              >
                {tagGroups.map((g) => <option key={g.name} value={g.name}>{g.name}</option>)}
              </select>
            </div>

            {/* Date range */}
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">Date range</label>
              <div className="flex flex-wrap gap-1">
                {DATE_PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => updateQuery({ datePreset: p, startDate: p !== 'custom' ? null : query.startDate, endDate: p !== 'custom' ? null : query.endDate })}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${datePreset === p ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    style={datePreset === p ? { backgroundColor: accent } : {}}
                  >
                    {DATE_PRESET_LABELS[p]}
                  </button>
                ))}
              </div>
              {datePreset === 'custom' && (
                <div className="mt-2 flex items-center gap-1.5">
                  <input
                    type="date"
                    value={query.startDate ? query.startDate.toISOString().slice(0, 10) : ''}
                    onChange={(e) => updateQuery({ startDate: e.target.value ? new Date(e.target.value + 'T00:00:00') : null })}
                    className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <span className="text-[10px] text-slate-400">to</span>
                  <input
                    type="date"
                    value={query.endDate ? query.endDate.toISOString().slice(0, 10) : ''}
                    onChange={(e) => updateQuery({ endDate: e.target.value ? new Date(e.target.value + 'T23:59:59') : null })}
                    className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100">
              <AppearanceControls
                color={accent}
                onColorChange={(c) => onUpdate(id, { color: c })}
                showInReport={config.showInReport}
                onShowInReportChange={(v) => onUpdate(id, { showInReport: v })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
