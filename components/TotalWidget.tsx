'use client';

import { useState, useMemo } from 'react';
import type { ParsedData, ChartConfig, DatePreset, CriteriaFilter } from '@/lib/types';
import { countLeadsForTotal, DATE_PRESET_LABELS } from '@/lib/dataProcessor';
import CriteriaBuilder from './CriteriaBuilder';
import AppearanceControls from './AppearanceControls';

const PRESETS: DatePreset[] = ['all_time', 'this_year', 'this_month', 'last_30_days', 'last_90_days', 'custom'];

function GripIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="5" cy="4" r="1.5" /><circle cx="11" cy="4" r="1.5" />
      <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
      <circle cx="5" cy="12" r="1.5" /><circle cx="11" cy="12" r="1.5" />
    </svg>
  );
}

interface TotalWidgetProps {
  data: ParsedData;
  config: ChartConfig;
  accent: string;
  onUpdate: (id: string, updates: Partial<ChartConfig>) => void;
  onRemove: (id: string) => void;
  showDragHandle?: boolean;
  readOnly?: boolean;
}

export default function TotalWidget({ data, config, accent, onUpdate, onRemove, showDragHandle, readOnly }: TotalWidgetProps) {
  const { leads, tagGroups } = data;
  const { id, title, query } = config;
  const datePreset: DatePreset = query.datePreset ?? 'all_time';

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [configOpen, setConfigOpen] = useState(!query.metric && !readOnly);

  const criteria: CriteriaFilter = query.criteria ?? { conditions: [], logic: [] };

  const count = useMemo(
    () => countLeadsForTotal(leads, query.metric, datePreset, query.startDate, query.endDate, query.filters, query.criteria),
    [leads, query.metric, datePreset, query.startDate, query.endDate, query.filters, query.criteria]
  );

  const updateQuery = (patch: Partial<typeof query>) =>
    onUpdate(id, { query: { ...query, ...patch } });

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
              <span className="block truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {title}
              </span>
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
              <button
                onClick={() => setConfigOpen((v) => !v)}
                title="Configure"
                className={`rounded p-1 transition-colors ${configOpen ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </button>
              <button
                onClick={() => onRemove(id)}
                title="Remove"
                className="rounded p-1 text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Count */}
        <p className="mt-2 text-3xl font-bold text-slate-800">{count.toLocaleString()}</p>

        {/* Config panel */}
        {configOpen && (
          <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">Count</label>
              <select
                value={query.metric ?? ''}
                onChange={(e) => {
                  const metric = e.target.value || null;
                  const autoTitle = metric
                    ? (tagGroups.flatMap((g) => g.tags).find((t) => t.label === metric)?.tag ?? title)
                    : 'Total Candidates';
                  onUpdate(id, { title: autoTitle, query: { ...query, metric } });
                }}
                className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
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

            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">Date range</label>
              <div className="flex flex-wrap gap-1">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => updateQuery({ datePreset: p, startDate: p !== 'custom' ? null : query.startDate, endDate: p !== 'custom' ? null : query.endDate })}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                      datePreset === p ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
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

            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">Criteria</label>
              <CriteriaBuilder
                criteria={criteria}
                onChange={(c) => updateQuery({ criteria: c })}
                tagGroups={tagGroups}
                excludeTag={query.metric}
                size="sm"
              />
            </div>

            <div className="pt-3 border-t border-slate-100">
              <AppearanceControls
                color={accent}
                onColorChange={(c) => onUpdate(id, { color: c })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
