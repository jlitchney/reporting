'use client';

import { useState } from 'react';
import type { ParsedData, ChartConfig, WidgetType, DatePreset, GroupBy, CriteriaFilter } from '@/lib/types';
import { DATE_PRESET_LABELS } from '@/lib/dataProcessor';
import CriteriaBuilder from './CriteriaBuilder';

const DATE_PRESETS: DatePreset[] = ['today', 'this_month', 'last_30_days', 'last_90_days', 'this_year', 'all_time', 'custom'];
const GROUP_OPTIONS: { label: string; value: GroupBy }[] = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Quarter', value: 'quarter' },
];

const TYPE_META: { type: WidgetType; label: string; description: string; icon: React.ReactNode }[] = [
  { type: 'total', label: 'Total', description: 'Single KPI count', icon: <HashIcon /> },
  { type: 'bar', label: 'Bar Chart', description: 'Over time or by tag group', icon: <BarIcon /> },
  { type: 'line', label: 'Line Chart', description: 'Trend over time', icon: <LineIcon /> },
  { type: 'column', label: 'Column Chart', description: 'Horizontal bar breakdown', icon: <ColumnIcon /> },
  { type: 'stacked_bar', label: 'Stacked Bar', description: 'Multiple series over time', icon: <StackedBarIcon /> },
  { type: 'pie', label: 'Pie Chart', description: 'Distribution breakdown', icon: <PieIcon /> },
  { type: 'table', label: 'Table', description: 'Ranked tag group data', icon: <TableIcon /> },
  { type: 'funnel', label: 'Candidate Funnel', description: 'Stage-by-stage conversion', icon: <FunnelIcon /> },
  { type: 'cost', label: 'Cost Table', description: 'Spend + cost/app by source', icon: <CostIcon /> },
  { type: 'cost_bar', label: 'Cost Bar Chart', description: '$/candidate or $/app by week', icon: <CostBarIcon /> },
  { type: 'comparison_bar', label: 'Comparison Bars', description: 'Applied vs Not Applied by tag', icon: <ComparisonBarIcon /> },
];

const TYPE_STEP_LABEL: Record<WidgetType, string> = {
  total: 'Add Total',
  bar: 'Add Bar Chart',
  line: 'Add Line Chart',
  column: 'Add Column Chart',
  stacked_bar: 'Add Stacked Bar',
  pie: 'Add Pie Chart',
  table: 'Add Table',
  funnel: 'Add Candidate Funnel',
  cost: 'Add Cost Table',
  cost_bar: 'Add Cost Bar Chart',
  comparison_bar: 'Add Comparison Bars',
};

// tag-group-based types (no metric, uses tagGroupAxis)
const TAG_GROUP_TYPES: WidgetType[] = ['pie', 'column', 'table', 'stacked_bar', 'comparison_bar'];
// time-series types (uses metric + groupBy)
const TIME_SERIES_TYPES: WidgetType[] = ['bar', 'line'];

function autoTitle(type: WidgetType, metric: string | null, data: ParsedData, tagGroupAxis: string | null, funnelStages: string[]): string {
  const tagName = metric
    ? data.tagGroups.flatMap((g) => g.tags).find((t) => t.label === metric)?.tag ?? metric
    : null;
  if (type === 'total') return tagName ?? 'Total Candidates';
  if (type === 'pie') return tagGroupAxis ? `${tagGroupAxis} Breakdown` : 'Pie Chart';
  if (type === 'line') return tagName ? `${tagName} over time` : 'Line Chart';
  if (type === 'column') return tagGroupAxis ?? 'Column Chart';
  if (type === 'stacked_bar') return tagGroupAxis ? `${tagGroupAxis} over time` : 'Stacked Bar Chart';
  if (type === 'table') return tagGroupAxis ? `${tagGroupAxis} Table` : 'Table';
  if (type === 'funnel') return 'Candidate Funnel';
  if (type === 'cost') return 'Cost by Source';
  if (type === 'cost_bar') return 'Cost per Week';
  if (type === 'comparison_bar') return tagGroupAxis ? `${tagGroupAxis} — Applied vs Not Applied` : 'Comparison Bars';
  // bar
  if (tagGroupAxis) return tagName ? `${tagName} by ${tagGroupAxis}` : `Candidates by ${tagGroupAxis}`;
  return tagName ? `${tagName} over time` : 'New Chart';
}

interface AddChartModalProps {
  data: ParsedData;
  onAdd: (config: Omit<ChartConfig, 'id'>) => void;
  onClose: () => void;
}

export default function AddChartModal({ data, onAdd, onClose }: AddChartModalProps) {
  const { tagGroups } = data;
  const [step, setStep] = useState<'type' | 'config'>('type');
  const [type, setType] = useState<WidgetType>('total');
  const [metric, setMetric] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>('all_time');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [criteria, setCriteria] = useState<CriteriaFilter>({ conditions: [], logic: [] });
  const [groupBy, setGroupBy] = useState<GroupBy>('week');
  const [tagGroupAxis, setTagGroupAxis] = useState<string | null>(null);
  const [excludeRemoved, setExcludeRemoved] = useState(false);
  const [funnelStages, setFunnelStages] = useState<string[]>([]);
  const [titleOverride, setTitleOverride] = useState('');

  const derivedTitle = autoTitle(type, metric, data, tagGroupAxis, funnelStages);
  const displayTitle = titleOverride || derivedTitle;

  const pickType = (t: WidgetType) => {
    setType(t);
    setMetric(null);
    setTitleOverride('');
    setDatePreset('all_time');
    setCustomStart('');
    setCustomEnd('');
    setCriteria({ conditions: [], logic: [] });
    setTagGroupAxis(TAG_GROUP_TYPES.includes(t) ? (tagGroups[0]?.name ?? null) : null);
    setExcludeRemoved(false);
    setFunnelStages([]);
    setStep('config');
  };

  const handleAdd = () => {
    const startDate = datePreset === 'custom' && customStart ? new Date(customStart + 'T00:00:00') : null;
    const endDate = datePreset === 'custom' && customEnd ? new Date(customEnd + 'T23:59:59') : null;

    const effectiveTagGroupAxis =
      TAG_GROUP_TYPES.includes(type)
        ? (tagGroupAxis ?? tagGroups[0]?.name ?? undefined)
        : type === 'bar' && tagGroupAxis
        ? tagGroupAxis
        : undefined;

    onAdd({
      type,
      title: displayTitle,
      query: {
        metric: type === 'pie' ? null : metric,
        filters: [],
        criteria: type === 'total' ? criteria : undefined,
        dateField: metric ?? 'created',
        groupBy,
        tagGroupAxis: effectiveTagGroupAxis,
        excludeRemoved: type !== 'total' ? excludeRemoved : undefined,
        startDate,
        endDate,
        datePreset,
        funnelStages: type === 'funnel' ? funnelStages : undefined,
        costMetricDefs: type === 'cost_bar' ? [{ tagLabel: '', name: 'All Candidates' }] : undefined,
        comparisonSeries: type === 'comparison_bar'
          ? [{ id: 'default', label: 'Total', tagLabel: '' }]
          : undefined,
      },
    });
    onClose();
  };

  const allTags = tagGroups.flatMap((g) => g.tags);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md mx-4 rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/80 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            {step === 'config' && (
              <button onClick={() => setStep('type')} className="rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title="Back">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
            )}
            <h2 className="text-sm font-semibold text-slate-800">
              {step === 'type' ? 'Add Chart' : TYPE_STEP_LABEL[type]}
            </h2>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="overflow-y-auto px-6 py-5">
          {step === 'type' ? (
            <div>
              <p className="mb-4 text-sm text-slate-500">Choose a chart type</p>
              <div className="grid grid-cols-3 gap-3">
                {TYPE_META.map(({ type: t, label, description, icon }) => (
                  <TypeCard key={t} title={label} description={description} onClick={() => pickType(t)}>{icon}</TypeCard>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Tag group (pie, column, table, stacked_bar) */}
              {TAG_GROUP_TYPES.includes(type) && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tag group</label>
                  <select
                    value={tagGroupAxis ?? ''}
                    onChange={(e) => { setTagGroupAxis(e.target.value); setTitleOverride(''); }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#1e3a6e] focus:ring-2 focus:ring-[#1e3a6e]/20"
                  >
                    {tagGroups.map((g) => <option key={g.name} value={g.name}>{g.name}</option>)}
                  </select>
                  {type !== 'stacked_bar' && (
                    <label className="mt-2 flex cursor-pointer items-center gap-2">
                      <input type="checkbox" checked={excludeRemoved} onChange={(e) => setExcludeRemoved(e.target.checked)} className="h-3.5 w-3.5 accent-[#1e3a6e]" />
                      <span className="text-xs text-slate-500">Exclude removed</span>
                    </label>
                  )}
                </div>
              )}

              {/* Metric (total, bar, line) */}
              {(TIME_SERIES_TYPES.includes(type) || type === 'total') && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    What are you counting?
                  </label>
                  <select
                    value={metric ?? ''}
                    onChange={(e) => { setMetric(e.target.value || null); setTitleOverride(''); }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#1e3a6e] focus:ring-2 focus:ring-[#1e3a6e]/20"
                  >
                    <option value="">All Candidates</option>
                    {tagGroups.map((g) => (
                      <optgroup key={g.name} label={g.name}>
                        {g.tags.map((t) => <option key={t.label} value={t.label}>{t.tag}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  {TIME_SERIES_TYPES.includes(type) && metric && (
                    <label className="mt-2 flex cursor-pointer items-center gap-2">
                      <input type="checkbox" checked={excludeRemoved} onChange={(e) => setExcludeRemoved(e.target.checked)} className="h-3.5 w-3.5 accent-[#1e3a6e]" />
                      <span className="text-xs text-slate-500">Exclude removed</span>
                    </label>
                  )}
                </div>
              )}

              {/* Funnel stages */}
              {type === 'funnel' && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Funnel stages (in order)</label>
                  {funnelStages.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {funnelStages.map((tagLabel, idx) => {
                        const isNot = tagLabel.startsWith('!');
                      const baseLabel = isNot ? tagLabel.slice(1) : tagLabel;
                      const tagName = tagLabel === '__all__' ? 'All Candidates' : (isNot ? `NOT ${allTags.find((t) => t.label === baseLabel)?.tag ?? baseLabel}` : (allTags.find((t) => t.label === tagLabel)?.tag ?? tagLabel));
                        return (
                          <div key={tagLabel} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">{idx + 1}</span>
                            <span className="flex-1 text-slate-700">{tagName}</span>
                            <button onClick={() => setFunnelStages(funnelStages.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-slate-500">×</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <select
                    value=""
                    onChange={(e) => { const val = e.target.value; if (val && !funnelStages.includes(val)) setFunnelStages([...funnelStages, val]); }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#1e3a6e] focus:ring-2 focus:ring-[#1e3a6e]/20"
                  >
                    <option value="">+ Add stage…</option>
                    {!funnelStages.includes('__all__') && <option value="__all__">All Candidates</option>}
                    {tagGroups.map((g) => {
                      const available = g.tags.filter((t) => !funnelStages.includes(t.label) && !funnelStages.includes('!' + t.label));
                      if (!available.length) return null;
                      return <optgroup key={g.name} label={g.name}>{available.map((t) => <option key={t.label} value={t.label}>{t.tag}</option>)}</optgroup>;
                    })}
                    {tagGroups.map((g) => {
                      const available = g.tags.filter((t) => !funnelStages.includes(t.label) && !funnelStages.includes('!' + t.label));
                      if (!available.length) return null;
                      return <optgroup key={'not-' + g.name} label={`NOT — ${g.name}`}>{available.map((t) => <option key={'!' + t.label} value={'!' + t.label}>NOT {t.tag}</option>)}</optgroup>;
                    })}
                  </select>
                  <label className="mt-2 flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={excludeRemoved} onChange={(e) => setExcludeRemoved(e.target.checked)} className="h-3.5 w-3.5 accent-[#1e3a6e]" />
                    <span className="text-xs text-slate-500">Exclude removed</span>
                  </label>
                </div>
              )}

              {/* Date range (all types) */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Date range</label>
                <div className="flex flex-wrap gap-1.5">
                  {DATE_PRESETS.map((p) => (
                    <button key={p} onClick={() => setDatePreset(p)} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${datePreset === p ? 'bg-[#1e3a6e] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      {DATE_PRESET_LABELS[p]}
                    </button>
                  ))}
                </div>
                {datePreset === 'custom' && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#1e3a6e] focus:ring-2 focus:ring-[#1e3a6e]/20" />
                    <span className="text-xs text-slate-400">to</span>
                    <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#1e3a6e] focus:ring-2 focus:ring-[#1e3a6e]/20" />
                  </div>
                )}
              </div>

              {/* Time grouping (bar time mode, line, stacked_bar) */}
              {(type === 'line' || type === 'stacked_bar' || (type === 'bar' && !tagGroupAxis)) && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Time grouping</label>
                  <div className="flex overflow-hidden rounded-lg border border-slate-200">
                    {GROUP_OPTIONS.map((opt) => (
                      <button key={opt.value} onClick={() => setGroupBy(opt.value)} className={`flex-1 py-2 text-sm font-medium transition-colors ${groupBy === opt.value ? 'bg-[#1e3a6e] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* X axis mode (bar only) */}
              {type === 'bar' && (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">X Axis</label>
                    <div className="flex overflow-hidden rounded-lg border border-slate-200">
                      <button onClick={() => setTagGroupAxis(null)} className={`flex-1 py-2 text-sm font-medium transition-colors ${!tagGroupAxis ? 'bg-[#1e3a6e] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Over time</button>
                      <button onClick={() => setTagGroupAxis(tagGroups[0]?.name ?? '')} className={`flex-1 py-2 text-sm font-medium transition-colors ${tagGroupAxis ? 'bg-[#1e3a6e] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>By tag group</button>
                    </div>
                  </div>
                  {tagGroupAxis && (
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tag group</label>
                      <select value={tagGroupAxis} onChange={(e) => setTagGroupAxis(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#1e3a6e] focus:ring-2 focus:ring-[#1e3a6e]/20">
                        {tagGroups.map((g) => <option key={g.name} value={g.name}>{g.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Criteria (total only) */}
              {type === 'total' && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Criteria</label>
                  <CriteriaBuilder criteria={criteria} onChange={setCriteria} tagGroups={tagGroups} excludeTag={metric} />
                </div>
              )}

              {/* Title */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Title</label>
                <input
                  type="text"
                  value={titleOverride}
                  placeholder={derivedTitle}
                  onChange={(e) => setTitleOverride(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-300 outline-none focus:border-[#1e3a6e] focus:ring-2 focus:ring-[#1e3a6e]/20"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'config' && (
          <div className="flex flex-shrink-0 items-center justify-between border-t border-slate-100 px-6 py-4">
            <p className="text-xs text-slate-400 italic truncate mr-4">{displayTitle}</p>
            <button onClick={handleAdd} className="flex-shrink-0 rounded-lg bg-[#1e3a6e] px-5 py-2 text-sm font-medium text-white hover:bg-[#16305e] transition-colors">
              Add Chart
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TypeCard({ title, description, children, onClick }: { title: string; description: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-start gap-2 rounded-xl border border-slate-200 p-3 text-left transition-all hover:border-[#1e3a6e] hover:shadow-sm active:scale-[0.98]">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">{children}</div>
      <div>
        <p className="text-xs font-semibold text-slate-700">{title}</p>
        <p className="mt-0.5 text-[10px] text-slate-400 leading-snug">{description}</p>
      </div>
    </button>
  );
}

function HashIcon() {
  return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>;
}
function BarIcon() {
  return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
}
function LineIcon() {
  return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l4-8 4 6 2-4" /><circle cx="7" cy="17" r="1.5" fill="currentColor" stroke="none" /><circle cx="11" cy="9" r="1.5" fill="currentColor" stroke="none" /><circle cx="15" cy="15" r="1.5" fill="currentColor" stroke="none" /><circle cx="17" cy="11" r="1.5" fill="currentColor" stroke="none" /></svg>;
}
function ColumnIcon() {
  return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h6M4 10h10M4 14h8M4 18h4" /></svg>;
}
function StackedBarIcon() {
  return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="3" y="12" width="4" height="9" rx="1" strokeWidth={2} /><rect x="10" y="7" width="4" height="14" rx="1" strokeWidth={2} /><rect x="17" y="3" width="4" height="18" rx="1" strokeWidth={2} /></svg>;
}
function PieIcon() {
  return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>;
}
function TableIcon() {
  return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M10 3v18M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z" /></svg>;
}
function FunnelIcon() {
  return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>;
}
function CostIcon() {
  return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}
function CostBarIcon() {
  return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h18" /></svg>;
}
function ComparisonBarIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8h11M3 12h7M3 16h13" />
    </svg>
  );
}
