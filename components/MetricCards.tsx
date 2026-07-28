'use client';

import type { ParsedData } from '@/lib/types';
import { countLeadsWithTag } from '@/lib/dataProcessor';

interface MetricCardsProps {
  data: ParsedData;
}

export default function MetricCards({ data }: MetricCardsProps) {
  const { leads, tagColumns } = data;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Leads</p>
        <p className="mt-1 text-3xl font-bold text-slate-800">{leads.length.toLocaleString()}</p>
      </div>
      {tagColumns.map((col) => {
        const count = countLeadsWithTag(leads, col.label);
        const pct = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
        return (
          <div key={col.label} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 truncate" title={col.label}>
              {col.tag}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400 truncate">{col.tagGroup}</p>
            <p className="mt-1 text-3xl font-bold text-slate-800">{count.toLocaleString()}</p>
            <p className="mt-0.5 text-xs text-slate-400">{pct}% of total</p>
          </div>
        );
      })}
    </div>
  );
}
