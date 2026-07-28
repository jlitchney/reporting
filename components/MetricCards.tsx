'use client';

import type { ParsedData } from '@/lib/types';
import { countLeadsWithTag } from '@/lib/dataProcessor';

const ACCENT_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#14b8a6',
];

interface MetricCardsProps {
  data: ParsedData;
}

interface StatCardProps {
  label: string;
  sublabel?: string;
  value: number | string;
  accent: string;
  note?: string;
}

function StatCard({ label, sublabel, value, accent, note }: StatCardProps) {
  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200/80">
      <div className="h-1 w-full" style={{ backgroundColor: accent }} />
      <div className="px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        {sublabel && <p className="text-[10px] text-slate-400 truncate">{sublabel}</p>}
        <p className="mt-2 text-3xl font-bold text-slate-800">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {note && <p className="mt-1 text-xs text-slate-400">{note}</p>}
      </div>
    </div>
  );
}

export default function MetricCards({ data }: MetricCardsProps) {
  const { leads, tagColumns } = data;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      <StatCard
        label="Total Leads"
        value={leads.length}
        accent="#1e3a6e"
      />
      {tagColumns.map((col, i) => {
        const count = countLeadsWithTag(leads, col.label);
        const pct = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
        return (
          <StatCard
            key={col.label}
            label={col.tag}
            sublabel={col.tagGroup}
            value={count}
            accent={ACCENT_COLORS[i % ACCENT_COLORS.length]}
            note={`${pct}% of total`}
          />
        );
      })}
    </div>
  );
}
