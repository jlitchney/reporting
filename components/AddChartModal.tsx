'use client';

import { useState } from 'react';
import type { ParsedData, ChartConfig, WidgetType, DatePreset, GroupBy } from '@/lib/types';
import { DATE_PRESET_LABELS } from '@/lib/dataProcessor';

interface AddChartModalProps {
  data: ParsedData;
  onAdd: (config: Omit<ChartConfig, 'id'>) => void;
  onClose: () => void;
}

const DATE_PRESETS: DatePreset[] = ['all_time', 'this_year', 'this_month', 'last_30_days', 'last_90_days', 'custom'];
const GROUP_OPTIONS: { label: string; value: GroupBy }[] = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Quarter', value: 'quarter' },
];

function autoTitle(type: WidgetType, metric: string | null, data: ParsedData): string {
  const tagName = metric
    ? data.tagGroups.flatMap((g) => g.tags).find((t) => t.label === metric)?.tag ?? metric
    : null;
  if (type === 'total') return tagName ?? 'Total Leads';
  return tagName ? `${tagName} over time` : 'New Chart';
}

export default function AddChartModal({ data, onAdd, onClose }: AddChartModalProps) {
  const { tagGroups } = data;
  const [step, setStep] = useState<'type' | 'config'>('type');
  const [type, setType] = useState<WidgetType>('total');
  const [metric, setMetric] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>('all_time');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [filters, setFilters] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<GroupBy>('week');
  const [titleOverride, setTitleOverride] = useState('');

  const derivedTitle = autoTitle(type, metric, data);
  const displayTitle = titleOverride || derivedTitle;

  const pickType = (t: WidgetType) => {
    setType(t);
    setMetric(null);
    setTitleOverride('');
    setDatePreset('all_time');
    setCustomStart('');
    setCustomEnd('');
    setFilters([]);
    setStep('config');
  };

  const handleAdd = () => {
    const startDate = datePreset === 'custom' && customStart ? new Date(customStart + 'T00:00:00') : null;
    const endDate = datePreset === 'custom' && customEnd ? new Date(customEnd + 'T23:59:59') : null;
    onAdd({
      type,
      title: displayTitle,
      query: {
        metric,
        filters,
        dateField: metric ?? 'created',
        groupBy,
        startDate,
        endDate,
        ...(type === 'total' ? { datePreset } : {}),
      },
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md mx-4 rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/80">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            {step === 'config' && (
              <button
                onClick={() => setStep('type')}
                className="rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                title="Back"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-sm font-semibold text-slate-800">
              {step === 'type' ? 'Add Chart' : type === 'total' ? 'Add Total' : 'Add Bar Chart'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {step === 'type' ? (
            <div>
              <p className="mb-4 text-sm text-slate-500">Choose a chart type</p>
              <div className="grid grid-cols-2 gap-3">
                <TypeCard
                  title="Total"
                  description="A single count with date range filter"
                  onClick={() => pickType('total')}
                >
                  <HashIcon />
                </TypeCard>
                <TypeCard
                  title="Bar Chart"
                  description="Counts over time grouped by period"
                  onClick={() => pickType('bar')}
                >
                  <BarIcon />
                </TypeCard>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Metric */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  What are you counting?
                </label>
                <select
                  value={metric ?? ''}
                  onChange={(e) => {
                    setMetric(e.target.value || null);
                    setTitleOverride('');
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#1e3a6e] focus:ring-2 focus:ring-[#1e3a6e]/20"
                >
                  <option value="">All Leads</option>
                  {tagGroups.map((g) => (
                    <optgroup key={g.name} label={g.name}>
                      {g.tags.map((t) => (
                        <option key={t.label} value={t.label}>{t.tag}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Date range (Total only) */}
              {type === 'total' && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Date range
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {DATE_PRESETS.map((p) => (
                      <button
                        key={p}
                        onClick={() => setDatePreset(p)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          datePreset === p
                            ? 'bg-[#1e3a6e] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {DATE_PRESET_LABELS[p]}
                      </button>
                    ))}
                  </div>
                  {datePreset === 'custom' && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#1e3a6e] focus:ring-2 focus:ring-[#1e3a6e]/20"
                      />
                      <span className="text-xs text-slate-400">to</span>
                      <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#1e3a6e] focus:ring-2 focus:ring-[#1e3a6e]/20"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Filters (Total only) */}
              {type === 'total' && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Filter by
                  </label>
                  <select
                    value=""
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && !filters.includes(val)) setFilters([...filters, val]);
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#1e3a6e] focus:ring-2 focus:ring-[#1e3a6e]/20"
                  >
                    <option value="">+ Add dimension</option>
                    {tagGroups.map((g) => {
                      const available = g.tags.filter((t) => t.label !== metric && !filters.includes(t.label));
                      if (!available.length) return null;
                      return (
                        <optgroup key={g.name} label={g.name}>
                          {available.map((t) => (
                            <option key={t.label} value={t.label}>{t.tag}</option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                  {filters.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {filters.map((f) => {
                        const tagName = tagGroups.flatMap((g) => g.tags).find((t) => t.label === f)?.tag ?? f;
                        return (
                          <span
                            key={f}
                            className="inline-flex items-center gap-1 rounded-full bg-[#1e3a6e] px-3 py-1 text-xs font-medium text-white"
                          >
                            {tagName}
                            <button
                              onClick={() => setFilters(filters.filter((x) => x !== f))}
                              className="ml-0.5 opacity-70 hover:opacity-100"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Group by (Bar only) */}
              {type === 'bar' && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Group by
                  </label>
                  <div className="flex overflow-hidden rounded-lg border border-slate-200">
                    {GROUP_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setGroupBy(opt.value)}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${
                          groupBy === opt.value
                            ? 'bg-[#1e3a6e] text-white'
                            : 'bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Title
                </label>
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
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
            <p className="text-xs text-slate-400 italic">{displayTitle}</p>
            <button
              onClick={handleAdd}
              className="rounded-lg bg-[#1e3a6e] px-5 py-2 text-sm font-medium text-white hover:bg-[#16305e] transition-colors"
            >
              Add Chart
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TypeCard({
  title,
  description,
  children,
  onClick,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-3 rounded-xl border border-slate-200 p-4 text-left transition-all hover:border-[#1e3a6e] hover:shadow-sm active:scale-[0.98]"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        {children}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        <p className="mt-0.5 text-xs text-slate-400 leading-snug">{description}</p>
      </div>
    </button>
  );
}

function HashIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
    </svg>
  );
}

function BarIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}
