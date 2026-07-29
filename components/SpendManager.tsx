'use client';

import { useState, useMemo } from 'react';
import { startOfWeek, addWeeks, isAfter, format } from 'date-fns';
import type { ParsedData, TagGroup } from '@/lib/types';
import type { SpendEntry } from '@/lib/redis';

interface Props {
  parsedData: ParsedData;
  tagGroups: TagGroup[];
  spendData: SpendEntry[];
  onSave: (data: SpendEntry[]) => void;
  onClose: () => void;
}

export default function SpendManager({ parsedData, tagGroups, spendData, onSave, onClose }: Props) {
  const defaultGroupName = tagGroups.find((g) => g.name === 'UTM_Source')?.name ?? tagGroups[0]?.name ?? '';
  const [selectedGroup, setSelectedGroup] = useState(defaultGroupName);

  const sourceGroup = tagGroups.find((g) => g.name === selectedGroup);

  const weeks = useMemo(() => {
    const { min, max } = parsedData.dateRange;
    const start = startOfWeek(min, { weekStartsOn: 1 });
    const end = startOfWeek(max, { weekStartsOn: 1 });
    const result: Date[] = [];
    let cur = start;
    let count = 0;
    while (!isAfter(cur, end) && count < 104) {
      result.push(cur);
      cur = addWeeks(cur, 1);
      count++;
    }
    return result.slice().reverse();
  }, [parsedData.dateRange]);

  const [draft, setDraft] = useState<Record<string, Record<string, string>>>(() => {
    const init: Record<string, Record<string, string>> = {};
    for (const entry of spendData) {
      if (!init[entry.weekOf]) init[entry.weekOf] = {};
      init[entry.weekOf][entry.source] = String(entry.amount);
    }
    return init;
  });

  const setValue = (weekOf: string, tagLabel: string, val: string) => {
    setDraft((prev) => ({
      ...prev,
      [weekOf]: { ...(prev[weekOf] ?? {}), [tagLabel]: val },
    }));
  };

  const handleSave = () => {
    const result: SpendEntry[] = [];
    for (const [weekOf, sources] of Object.entries(draft)) {
      for (const [source, amtStr] of Object.entries(sources)) {
        const amount = parseFloat(amtStr);
        if (!isNaN(amount) && amount !== 0) {
          result.push({ source, weekOf, amount });
        }
      }
    }
    onSave(result);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-4xl mx-4 rounded-xl bg-white shadow-2xl ring-1 ring-slate-200/80 flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-800">Manage Ad Spend</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 border-b border-slate-100">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Source group
          </label>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#1e3a6e] focus:ring-2 focus:ring-[#1e3a6e]/20"
          >
            {tagGroups.map((g) => (
              <option key={g.name} value={g.name}>{g.name}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto px-6 py-4">
          {!sourceGroup || sourceGroup.tags.length === 0 ? (
            <p className="text-sm text-slate-400">No tags in this group.</p>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left px-2 py-2 font-semibold text-slate-600 bg-slate-50 sticky left-0">Week</th>
                  {sourceGroup.tags.map((tag) => (
                    <th key={tag.label} className="px-2 py-2 font-semibold text-slate-600 bg-slate-50 text-right min-w-[100px]">
                      {tag.tag}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week) => {
                  const weekOf = format(week, 'yyyy-MM-dd');
                  const weekLabel = format(week, 'M/d/yy');
                  return (
                    <tr key={weekOf} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-2 py-1.5 font-medium text-slate-600 sticky left-0 bg-white">{weekLabel}</td>
                      {sourceGroup.tags.map((tag) => (
                        <td key={tag.label} className="px-2 py-1.5 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={draft[weekOf]?.[tag.label] ?? ''}
                            placeholder="0"
                            onChange={(e) => setValue(weekOf, tag.label, e.target.value)}
                            className="w-24 rounded border border-slate-200 px-2 py-1 text-right text-xs text-slate-700 outline-none focus:border-[#1e3a6e] focus:ring-1 focus:ring-[#1e3a6e]/20"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-[#1e3a6e] px-5 py-2 text-sm font-medium text-white hover:bg-[#16305e] transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
