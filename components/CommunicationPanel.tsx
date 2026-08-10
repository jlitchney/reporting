'use client';

import { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { subMonths } from 'date-fns';
import { MOCK_CANDIDATES, MOCK_MESSAGES, getMockTagGroups, filterCandidatesByMultiTag } from '@/lib/mockData';
import {
  filterMessages,
  computeCommMetrics,
  buildTimeSeries,
  buildCampaignStats,
  buildUserStats,
  getCampaigns,
  type CommFilters,
} from '@/lib/commProcessor';

// ─── Color palette ────────────────────────────────────────────────────────────
const COLORS = {
  navy: '#1e3a6e',
  blue: '#3b82f6',
  green: '#10b981',
  teal: '#6ee7b7',
};

// ─── Small reusable components ─────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-800">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

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

// ─── Main component ───────────────────────────────────────────────────────────

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

export default function CommunicationPanel() {
  const tagGroups = getMockTagGroups();
  const allCampaigns = useMemo(() => getCampaigns(MOCK_MESSAGES), []);

  // Filter state
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [tagFilters, setTagFilters] = useState<Record<string, string[]>>({});
  const [campaign, setCampaign] = useState<string>('__all__');
  const [type, setType] = useState<'all' | 'email' | 'sms'>('all');
  const [direction, setDirection] = useState<'all' | 'outbound' | 'inbound'>('all');
  const [groupBy, setGroupBy] = useState<'week' | 'month'>('month');

  const toggleTag = (group: string, tag: string) => {
    setTagFilters((prev) => {
      const current = prev[group] ?? [];
      const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
      return { ...prev, [group]: next };
    });
  };
  const isTagSelected = (group: string, tag: string) => (tagFilters[group] ?? []).includes(tag);
  const hasAnyTagFilter = Object.values(tagFilters).some((t) => t.length > 0);
  const clearTagFilters = () => setTagFilters({});

  // Build filters
  const filters = useMemo((): CommFilters => {
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

    let campaignFilter: string | null = null;
    if (campaign === '__individual__') campaignFilter = 'individual';
    else if (campaign !== '__all__') campaignFilter = campaign;

    return {
      startDate,
      endDate,
      tagFilters,
      campaign: campaignFilter,
      type,
      direction,
      groupBy,
    };
  }, [datePreset, customStart, customEnd, tagFilters, campaign, type, direction, groupBy]);

  // Filtered messages
  const filteredMessages = useMemo(
    () => filterMessages(MOCK_CANDIDATES, MOCK_MESSAGES, filters),
    [filters]
  );

  // Candidate IDs of filtered candidates
  const filteredCandidateIds = useMemo(
    () => new Set(filterCandidatesByMultiTag(MOCK_CANDIDATES, filters.tagFilters).map((c) => c.id)),
    [filters.tagFilters]
  );

  // Metrics
  const metrics = useMemo(
    () => computeCommMetrics(filteredMessages, filteredCandidateIds),
    [filteredMessages, filteredCandidateIds]
  );

  // Time series
  const timeSeries = useMemo(
    () => buildTimeSeries(filteredMessages, groupBy),
    [filteredMessages, groupBy]
  );

  // Campaign stats
  const campaignStats = useMemo(
    () => buildCampaignStats(filteredMessages),
    [filteredMessages]
  );

  // User stats (individual outbound only)
  const userStats = useMemo(
    () => buildUserStats(filteredMessages),
    [filteredMessages]
  );

  // Pie data
  const emailVsSms = useMemo(() => {
    const emailCount = filteredMessages.filter((m) => m.type === 'email').length;
    const smsCount = filteredMessages.filter((m) => m.type === 'sms').length;
    return [
      { name: 'Email', value: emailCount },
      { name: 'SMS', value: smsCount },
    ];
  }, [filteredMessages]);

  const outVsIn = useMemo(() => {
    const out = filteredMessages.filter((m) => m.direction === 'outbound').length;
    const inb = filteredMessages.filter((m) => m.direction === 'inbound').length;
    return [
      { name: 'Outbound', value: out },
      { name: 'Inbound', value: inb },
    ];
  }, [filteredMessages]);

  const isEmpty = filteredMessages.length === 0;

  return (
    <div className="space-y-6 px-6 py-6">
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

          <FilterSelect
            label="Campaign"
            value={campaign}
            onChange={setCampaign}
            options={[
              { value: '__all__', label: 'All' },
              { value: '__individual__', label: 'Individual' },
              ...allCampaigns.map((c) => ({ value: c, label: c })),
            ]}
          />

          <FilterSelect
            label="Type"
            value={type}
            onChange={(v) => setType(v as 'all' | 'email' | 'sms')}
            options={[
              { value: 'all', label: 'All' },
              { value: 'email', label: 'Email' },
              { value: 'sms', label: 'SMS' },
            ]}
          />

          <FilterSelect
            label="Direction"
            value={direction}
            onChange={(v) => setDirection(v as 'all' | 'outbound' | 'inbound')}
            options={[
              { value: 'all', label: 'All' },
              { value: 'outbound', label: 'Outbound' },
              { value: 'inbound', label: 'Inbound' },
            ]}
          />

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Group By</label>
            <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
              {(['week', 'month'] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGroupBy(g)}
                  className={`px-4 py-2 text-sm font-medium transition-colors capitalize ${
                    groupBy === g
                      ? 'bg-[#1e3a6e] text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
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
              <button onClick={clearTagFilters} className="text-xs text-slate-400 hover:text-slate-600 underline">
                Clear all
              </button>
            )}
          </div>
          {tagGroups.map((group) => (
            <div key={group.name} className="flex items-start gap-3">
              <span className="w-20 flex-shrink-0 pt-1 text-xs font-semibold text-slate-500">{group.name}</span>
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

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-base font-medium text-slate-500">No messages match your current filters.</p>
          <p className="mt-1 text-sm text-slate-400">Try adjusting the date range or removing filters.</p>
        </div>
      ) : (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <MetricCard label="Total Messages" value={metrics.total.toLocaleString()} />
            <MetricCard label="Outbound" value={metrics.outbound.toLocaleString()} />
            <MetricCard label="Inbound" value={metrics.inbound.toLocaleString()} />
            <MetricCard
              label="Open Rate"
              value={`${metrics.openRate.toFixed(1)}%`}
              sub="of outbound email"
            />
            <MetricCard
              label="Reply Rate"
              value={`${metrics.replyRate.toFixed(1)}%`}
              sub="of outbound email"
            />
            <MetricCard
              label="Candidates Reached"
              value={metrics.candidatesReached.toLocaleString()}
            />
          </div>

          {/* Line chart */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Messages Over Time</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={timeSeries} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="emailOut" name="Email Out" stroke={COLORS.navy} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="smsOut" name="SMS Out" stroke={COLORS.blue} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="emailIn" name="Email In" stroke={COLORS.green} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="smsIn" name="SMS In" stroke={COLORS.teal} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Pie charts */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="mb-4 text-sm font-semibold text-slate-700">Email vs SMS</h3>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={emailVsSms}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      <Cell fill={COLORS.navy} />
                      <Cell fill={COLORS.blue} />
                    </Pie>
                    <Tooltip contentStyle={{ border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="mb-4 text-sm font-semibold text-slate-700">Outbound vs Inbound</h3>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={outVsIn}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      <Cell fill={COLORS.navy} />
                      <Cell fill={COLORS.green} />
                    </Pie>
                    <Tooltip contentStyle={{ border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* User Activity */}
          {userStats.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4">
                <h3 className="text-sm font-semibold text-slate-700">User Activity</h3>
                <p className="mt-0.5 text-xs text-slate-400">Individual outbound messages sent by each user (excludes campaigns)</p>
              </div>
              <div className="grid grid-cols-2 divide-x divide-slate-100">
                {/* Bar chart */}
                <div className="p-5">
                  <ResponsiveContainer width="100%" height={Math.max(120, userStats.length * 44)}>
                    <BarChart
                      data={userStats}
                      layout="vertical"
                      margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} tickLine={false} axisLine={false} width={120} />
                      <Tooltip
                        contentStyle={{ border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: 12 }}
                        formatter={(value, name) => [value, name === 'email' ? 'Email' : name === 'sms' ? 'SMS' : name]}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="email" name="Email" stackId="a" fill={COLORS.navy} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="sms" name="SMS" stackId="a" fill={COLORS.blue} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Stats table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">User</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Sent</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Email</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">SMS</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Open Rate</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Reply Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userStats.map((row, i) => (
                        <tr
                          key={row.name}
                          className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-slate-50 transition-colors`}
                        >
                          <td className="px-5 py-3 font-medium text-slate-700">{row.name}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{row.sent}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{row.email}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{row.sms}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-700">{row.openRate}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-700">{row.replyRate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Campaign performance table */}
          {campaignStats.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4">
                <h3 className="text-sm font-semibold text-slate-700">Campaign Performance</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Campaign</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Sent</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Delivered</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Opened</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Replied</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Bounced</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Open Rate</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Reply Rate</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Bounce Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignStats.map((row, i) => (
                      <tr
                        key={row.name}
                        className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-slate-50 transition-colors`}
                      >
                        <td className="px-5 py-3 font-medium text-slate-700">{row.name}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{row.sent.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{row.delivered.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{row.opened.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{row.replied.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{row.bounced.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">{row.openRate}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">{row.replyRate}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{row.bounceRate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
