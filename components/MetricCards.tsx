'use client';

import type { ParsedData } from '@/lib/types';
import { countLeadsWithTag } from '@/lib/dataProcessor';

// Only show metric cards for TagGroups with few enough tags to be meaningful at a glance.
// Large groups like "Utm Sources" have 80+ tags and belong in chart filters, not summary cards.
const MAX_TAGS_PER_GROUP = 8;

const ACCENT_COLORS = [
  '#1e3a6e', '#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#14b8a6', '#f97316',
];

interface StatCardProps {
  label: string;
  sublabel?: string;
  value: number;
  accent: string;
  note?: string;
}

function StatCard({ label, sublabel, value, accent, note }: StatCardProps) {
  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200/80">
      <div className="h-1 w-full" style={{ backgroundColor: accent }} />
      <div className="px-4 py-4">
        <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500" title={label}>
          {label}
        </p>
        {sublabel && (
          <p className="truncate text-[10px] text-slate-400" title={sublabel}>
            {sublabel}
          </p>
        )}
        <p className="mt-2 text-3xl font-bold text-slate-800">{value.toLocaleString()}</p>
        {note && <p className="mt-1 text-xs text-slate-400">{note}</p>}
      </div>
    </div>
  );
}

interface MetricCardsProps {
  data: ParsedData;
}

export default function MetricCards({ data }: MetricCardsProps) {
  const { leads, tagGroups } = data;

  // Filter to groups small enough to be useful as summary cards
  const displayGroups = tagGroups.filter((g) => g.tags.length <= MAX_TAGS_PER_GROUP);

  let colorIndex = 0;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      <StatCard
        label="Total Candidates"
        value={leads.length}
        accent={ACCENT_COLORS[colorIndex++]}
      />
      {displayGroups.flatMap((group) =>
        group.tags.map((col) => {
          const count = countLeadsWithTag(leads, col.label);
          const pct = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
          const accent = ACCENT_COLORS[colorIndex++ % ACCENT_COLORS.length];
          return (
            <StatCard
              key={col.label}
              label={col.tag}
              sublabel={col.tagGroup}
              value={count}
              accent={accent}
              note={`${pct}% of total`}
            />
          );
        })
      )}
    </div>
  );
}
