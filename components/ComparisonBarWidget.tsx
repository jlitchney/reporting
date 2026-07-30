'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LabelList, Cell } from 'recharts';
import { isBefore, isAfter, startOfYear, startOfMonth, subDays } from 'date-fns';
import WidgetShell from './WidgetShell';
import { DATE_PRESET_LABELS } from '@/lib/dataProcessor';
import type { ParsedData, ChartConfig, ChartQuery, DatePreset } from '@/lib/types';

const DATE_PRESETS: DatePreset[] = ['all_time', 'this_year', 'this_month', 'last_30_days', 'last_90_days'];
const DEFAULT_NOT_COLOR = '#f59e0b';

function fmtK(n: number): string {
  if (n >= 1000) {
    const v = n / 1000;
    return `${v % 1 === 0 ? v : v.toFixed(1)}K`;
  }
  return String(n);
}

function presetStart(preset: DatePreset): Date | null {
  const now = new Date();
  switch (preset) {
    case 'this_year':    return startOfYear(now);
    case 'this_month':   return startOfMonth(now);
    case 'last_30_days': return subDays(now, 30);
    case 'last_90_days': return subDays(now, 90);
    default:             return null;
  }
}

interface SectionProps {
  tagName: string;
  applied: number;
  notApplied: number;
  appliedLabel: string;
  notAppliedLabel: string;
  appliedColor: string;
  notAppliedColor: string;
}

function TagSection({ tagName, applied, notApplied, appliedLabel, notAppliedLabel, appliedColor, notAppliedColor }: SectionProps) {
  const chartData = [
    { name: appliedLabel,    value: applied,    color: appliedColor },
    { name: notAppliedLabel, value: notApplied, color: notAppliedColor },
  ];

  return (
    <div className="flex items-stretch border-b border-slate-100 pb-1 last:border-0">
      {/* Section label */}
      <div className="flex w-24 flex-shrink-0 items-center justify-end pr-3 text-right text-xs font-medium text-slate-600">
        {tagName}
      </div>
      {/* Chart */}
      <div className="flex-1">
        <ResponsiveContainer width="100%" height={88}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 56, left: 0, bottom: 20 }}>
            <XAxis
              type="number"
              domain={[0, 'auto']}
              tickFormatter={fmtK}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis type="category" dataKey="name" hide />
            <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={22} isAnimationActive={false}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                style={{ fontSize: 11, fill: '#374151', fontWeight: 500 }}
                formatter={(v: unknown) => fmtK(Number(v))}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

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

export default function ComparisonBarWidget({
  data,
  config,
  accent,
  onUpdate,
  onRemove,
  canRemove,
  showDragHandle,
  onDuplicate,
  readOnly,
}: Props) {
  const { tagGroups, leads } = data;
  const { id, title, query } = config;

  const updateQuery = (patch: Partial<ChartQuery>) => onUpdate(id, { query: { ...query, ...patch } });

  const selectedGroup = query.tagGroupAxis ?? tagGroups[0]?.name ?? '';
  const groupObj = tagGroups.find((g) => g.name === selectedGroup);
  const datePreset = query.datePreset ?? 'all_time';
  const notAppliedColor = config.seriesColors?.['Not Applied'] ?? DEFAULT_NOT_COLOR;

  // Label customization via seriesColors keys (re-purposed as label store)
  const appliedLabel    = config.seriesColors?.['__label_applied']    ?? 'Applied';
  const notAppliedLabel = config.seriesColors?.['__label_not_applied'] ?? 'Not Applied';

  const sectionData = useMemo(() => {
    if (!groupObj) return [];

    const effectiveStart =
      datePreset !== 'all_time' && datePreset !== 'custom'
        ? presetStart(datePreset)
        : query.startDate ?? null;
    const effectiveEnd = datePreset === 'custom' ? (query.endDate ?? null) : null;

    const baseLeads = leads.filter((lead) => {
      const d = lead.createdDate;
      if (!d) return false;
      if (effectiveStart && isBefore(d, effectiveStart)) return false;
      if (effectiveEnd && isAfter(d, effectiveEnd)) return false;
      // Optional prerequisite tag filter
      if (query.metric && query.metric !== '__all__') {
        if (!lead.tags.get(query.metric)?.applied) return false;
      }
      return true;
    });

    return groupObj.tags.map((tag) => {
      const applied = baseLeads.filter((l) => l.tags.get(tag.label)?.applied != null).length;
      return {
        tagLabel: tag.label,
        tagName:  tag.tag,
        applied,
        notApplied: baseLeads.length - applied,
      };
    });
  }, [leads, groupObj, datePreset, query.startDate, query.endDate, query.metric]);

  const configPanel = (
    <div className="space-y-3">
      {/* Tag group */}
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tag group</label>
        <select
          value={selectedGroup}
          onChange={(e) => updateQuery({ tagGroupAxis: e.target.value })}
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-[#1e3a6e]"
        >
          {tagGroups.map((g) => <option key={g.name} value={g.name}>{g.name}</option>)}
        </select>
      </div>

      {/* Filter base population */}
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Only leads with</label>
        <select
          value={query.metric ?? ''}
          onChange={(e) => updateQuery({ metric: e.target.value || null })}
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-[#1e3a6e]"
        >
          <option value="">All leads</option>
          {tagGroups.map((g) => (
            <optgroup key={g.name} label={g.name}>
              {g.tags.map((t) => <option key={t.label} value={t.label}>{t.tag}</option>)}
            </optgroup>
          ))}
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
        {/* Legend */}
        <div className="mb-3 flex items-center gap-4 pl-24">
          <span className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
            {appliedLabel}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: notAppliedColor }} />
            {notAppliedLabel}
          </span>
        </div>

        {sectionData.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-slate-400">
            Select a tag group in settings
          </div>
        ) : (
          <div>
            {sectionData.map(({ tagLabel, tagName, applied, notApplied }) => (
              <TagSection
                key={tagLabel}
                tagName={tagName}
                applied={applied}
                notApplied={notApplied}
                appliedLabel={appliedLabel}
                notAppliedLabel={notAppliedLabel}
                appliedColor={accent}
                notAppliedColor={notAppliedColor}
              />
            ))}
          </div>
        )}
      </div>
    </WidgetShell>
  );
}
