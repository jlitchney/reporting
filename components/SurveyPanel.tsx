'use client';

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { subMonths } from 'date-fns';
import { MOCK_CANDIDATES, MOCK_SURVEYS, MOCK_SURVEY_RESPONSES, getMockTagGroups } from '@/lib/mockData';
import {
  filterResponses,
  computeSurveyMetrics,
  buildResponseTimeSeries,
  computeQuestionResults,
  exportSurveyToCSV,
  type SurveyFilters,
} from '@/lib/surveyProcessor';

// ─── Color ─────────────────────────────────────────────────────────────────────
const NAVY = '#1e3a6e';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a6e]/30"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

// ─── Question result renderers ────────────────────────────────────────────────

function SingleChoiceResult({ distribution }: { distribution: { label: string; count: number }[] }) {
  const max = Math.max(...distribution.map((d) => d.count), 1);
  return (
    <ResponsiveContainer width="100%" height={distribution.length * 40 + 20}>
      <BarChart
        layout="vertical"
        data={distribution}
        margin={{ top: 0, right: 20, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, max]}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={160}
          tick={{ fontSize: 12, fill: '#475569' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{ border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: 12 }}
          cursor={{ fill: '#f1f5f9' }}
        />
        <Bar dataKey="count" fill={NAVY} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function NumberResult({
  avg,
  min,
  max,
  histogram,
}: {
  avg: number;
  min: number;
  max: number;
  histogram: { label: string; count: number }[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <StatCard label="Average" value={avg} />
        <StatCard label="Minimum" value={min} />
        <StatCard label="Maximum" value={max} />
      </div>
      {histogram.length > 0 && (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={histogram} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: 12 }} />
            <Bar dataKey="count" fill={NAVY} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function TextResult({ samples, long }: { samples: string[]; long?: boolean }) {
  if (samples.length === 0) return <p className="text-sm text-slate-400 italic">No responses yet.</p>;
  return (
    <div className="space-y-2">
      {samples.map((s, i) => (
        <div
          key={i}
          className={`rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700 ${long ? 'leading-relaxed' : ''}`}
        >
          <span className="mr-1 text-slate-400">&ldquo;</span>
          {s}
          <span className="ml-1 text-slate-400">&rdquo;</span>
        </div>
      ))}
    </div>
  );
}

function DateResult({ earliest, latest }: { earliest: string; latest: string }) {
  return (
    <div className="flex gap-3">
      <StatCard label="Earliest" value={earliest} />
      <StatCard label="Latest" value={latest} />
    </div>
  );
}

// ─── Date preset helpers ───────────────────────────────────────────────────────

type DatePreset = 'all' | 'last30' | 'last90' | 'last6m' | 'last12m' | 'custom';

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'last90', label: 'Last 90 Days' },
  { value: 'last6m', label: 'Last 6 Months' },
  { value: 'last12m', label: 'Last 12 Months' },
  { value: 'custom', label: 'Custom' },
];

function presetToDates(preset: DatePreset): { startDate: Date | null; endDate: Date | null } {
  const now = new Date();
  switch (preset) {
    case 'all': return { startDate: null, endDate: null };
    case 'last30': return { startDate: subMonths(now, 1), endDate: now };
    case 'last90': return { startDate: subMonths(now, 3), endDate: now };
    case 'last6m': return { startDate: subMonths(now, 6), endDate: now };
    case 'last12m': return { startDate: subMonths(now, 12), endDate: now };
    case 'custom': return { startDate: null, endDate: null };
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SurveyPanel() {
  const tagGroups = getMockTagGroups();

  // Survey selector
  const [selectedSurveyId, setSelectedSurveyId] = useState(MOCK_SURVEYS[0].id);

  // Date filter
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Tag filters: group -> set of selected tag values (OR within group, AND across groups)
  const [tagFilters, setTagFilters] = useState<Record<string, string[]>>({});

  const toggleTag = (group: string, tag: string) => {
    setTagFilters((prev) => {
      const current = prev[group] ?? [];
      const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
      return { ...prev, [group]: next };
    });
  };

  const isTagSelected = (group: string, tag: string) =>
    (tagFilters[group] ?? []).includes(tag);

  const hasAnyTagFilter = Object.values(tagFilters).some((t) => t.length > 0);

  const clearTagFilters = () => setTagFilters({});

  const selectedSurvey = useMemo(
    () => MOCK_SURVEYS.find((s) => s.id === selectedSurveyId) ?? MOCK_SURVEYS[0],
    [selectedSurveyId]
  );

  // Build filters
  const filters = useMemo((): SurveyFilters => {
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    if (datePreset === 'custom') {
      startDate = customStart ? new Date(customStart) : null;
      endDate = customEnd ? new Date(customEnd) : null;
    } else {
      const d = presetToDates(datePreset);
      startDate = d.startDate;
      endDate = d.endDate;
    }
    return {
      startDate,
      endDate,
      tagFilters,
      surveyId: selectedSurveyId,
    };
  }, [datePreset, customStart, customEnd, tagFilters, selectedSurveyId]);

  // Filtered responses
  const filteredResponses = useMemo(
    () => filterResponses(MOCK_CANDIDATES, MOCK_SURVEY_RESPONSES, filters),
    [filters]
  );

  // Metrics
  const metrics = useMemo(
    () => computeSurveyMetrics(filteredResponses, MOCK_CANDIDATES, filters, MOCK_SURVEYS),
    [filteredResponses, filters]
  );

  // Time series
  const timeSeries = useMemo(
    () => buildResponseTimeSeries(filteredResponses),
    [filteredResponses]
  );

  // Question results
  const questionResults = useMemo(
    () => computeQuestionResults(filteredResponses, selectedSurvey),
    [filteredResponses, selectedSurvey]
  );

  const handleExport = () => {
    const csv = exportSurveyToCSV(filteredResponses, selectedSurvey, MOCK_CANDIDATES);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSurvey.name.replace(/[^a-z0-9]/gi, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Type distribution for info card
  const questionTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const q of selectedSurvey.questions) {
      counts[q.type] = (counts[q.type] ?? 0) + 1;
    }
    return counts;
  }, [selectedSurvey]);

  return (
    <div className="space-y-6 px-6 py-6">
      {/* Survey selector */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Survey</p>
        <div className="flex flex-wrap gap-2">
          {MOCK_SURVEYS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSurveyId(s.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                selectedSurveyId === s.id
                  ? 'bg-[#1e3a6e] text-white'
                  : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-4">
          <FilterSelect
            label="Date Range"
            value={datePreset}
            onChange={(v) => setDatePreset(v as DatePreset)}
            options={DATE_PRESETS}
          />

          {datePreset === 'custom' && (
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Start</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a6e]/30"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">End</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a6e]/30"
                />
              </div>
            </div>
          )}

          <div className="ml-auto flex items-end">
            <button
              onClick={handleExport}
              disabled={filteredResponses.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-[#1e3a6e] bg-[#1e3a6e] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#16305e] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Export CSV
            </button>
          </div>
        </div>

        {/* Multi-select tag filters */}
        <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Filter by Tags
              <span className="ml-1 font-normal normal-case text-slate-300">(OR within group · AND across groups)</span>
            </p>
            {hasAnyTagFilter && (
              <button
                onClick={clearTagFilters}
                className="text-xs text-slate-400 hover:text-slate-600 underline"
              >
                Clear all
              </button>
            )}
          </div>
          {tagGroups.map((group) => (
            <div key={group.name} className="flex items-start gap-3">
              <span className="w-20 flex-shrink-0 pt-1 text-xs font-semibold text-slate-500">
                {group.name}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {group.tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(group.name, tag)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      isTagSelected(group.name, tag)
                        ? 'bg-[#1e3a6e] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Responses</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">{metrics.totalResponses.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Eligible Candidates</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">{metrics.eligibleCandidates.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Completion Rate</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">{metrics.completionRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* Response time series + survey info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Responses Over Time</h3>
          {timeSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={timeSeries} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip contentStyle={{ border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: 12 }} />
                <Line type="monotone" dataKey="count" stroke={NAVY} strokeWidth={2} dot={false} name="Responses" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-slate-400">
              No response data in this date range.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Survey Info</h3>
          <p className="text-base font-semibold text-slate-800">{selectedSurvey.name}</p>
          <p className="mt-1 text-sm text-slate-500">
            {selectedSurvey.questions.length} question{selectedSurvey.questions.length !== 1 ? 's' : ''}
          </p>
          <div className="mt-4 space-y-2">
            {Object.entries(questionTypeCounts).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between text-sm">
                <span className="capitalize text-slate-600">{type.replace(/_/g, ' ')}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  {count}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">
              Questions include:{' '}
              {selectedSurvey.questions
                .slice(0, 3)
                .map((q) => q.text)
                .join(', ')}
              {selectedSurvey.questions.length > 3 ? '…' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Per-question results */}
      {filteredResponses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-base font-medium text-slate-500">No responses match your current filters.</p>
          <p className="mt-1 text-sm text-slate-400">Try adjusting the date range or tag filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">Question Results</h3>
          {questionResults.map((qr, idx) => (
            <div key={qr.questionId} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-start gap-3">
                <span className="flex-shrink-0 rounded-full bg-[#1e3a6e]/10 px-2.5 py-0.5 text-xs font-semibold text-[#1e3a6e]">
                  Q{idx + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{qr.text}</p>
                  {(qr.type === 'multiple_choice') && (
                    <p className="mt-0.5 text-xs text-slate-400">Select all that apply</p>
                  )}
                </div>
              </div>

              {(qr.type === 'single_choice' || qr.type === 'multiple_choice') && qr.distribution && (
                <SingleChoiceResult distribution={qr.distribution} />
              )}

              {qr.type === 'number' && qr.histogram && (
                <NumberResult
                  avg={qr.avg ?? 0}
                  min={qr.min ?? 0}
                  max={qr.max ?? 0}
                  histogram={qr.histogram}
                />
              )}

              {qr.type === 'short_text' && qr.samples && (
                <TextResult samples={qr.samples} />
              )}

              {qr.type === 'long_text' && qr.samples && (
                <TextResult samples={qr.samples} long />
              )}

              {qr.type === 'date' && qr.earliest !== undefined && (
                <DateResult earliest={qr.earliest} latest={qr.latest ?? '—'} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
