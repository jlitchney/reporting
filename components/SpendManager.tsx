'use client';

import { useState } from 'react';
import type { ParsedData, TagGroup } from '@/lib/types';
import type { SpendEntry } from '@/lib/redis';

interface PeriodRow {
  id: string;
  startDate: string;
  endDate: string;
  amounts: Record<string, string>;
}

interface Props {
  parsedData: ParsedData;
  tagGroups: TagGroup[];
  spendData: SpendEntry[];
  onSave: (data: SpendEntry[]) => void;
  onClose: () => void;
}

function spendToRows(spendData: SpendEntry[]): PeriodRow[] {
  const map = new Map<string, PeriodRow>();
  for (const entry of spendData) {
    const start = entry.startDate ?? entry.weekOf ?? '';
    const end = entry.endDate ?? entry.weekOf ?? '';
    const key = `${start}|${end}`;
    if (!map.has(key)) map.set(key, { id: key, startDate: start, endDate: end, amounts: {} });
    map.get(key)!.amounts[entry.source] = String(entry.amount);
  }
  const rows = Array.from(map.values());
  rows.sort((a, b) => a.startDate.localeCompare(b.startDate));
  return rows;
}

export default function SpendManager({ parsedData, tagGroups, spendData, onSave, onClose }: Props) {
  const defaultGroupName = tagGroups.find((g) => g.name === 'UTM_Source')?.name ?? tagGroups[0]?.name ?? '';
  const [selectedGroup, setSelectedGroup] = useState(defaultGroupName);
  const sourceGroup = tagGroups.find((g) => g.name === selectedGroup);
  const sources = sourceGroup?.tags ?? [];

  const [rows, setRows] = useState<PeriodRow[]>(() => spendToRows(spendData));

  const addRow = () => {
    const today = new Date().toISOString().slice(0, 10);
    setRows((prev) => [...prev, { id: `new-${Date.now()}`, startDate: today, endDate: today, amounts: {} }]);
  };

  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const updateRow = (id: string, field: 'startDate' | 'endDate', value: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  const updateAmount = (id: string, tagLabel: string, value: string) =>
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, amounts: { ...r.amounts, [tagLabel]: value } } : r))
    );

  const handleSave = () => {
    const result: SpendEntry[] = [];
    for (const row of rows) {
      if (!row.startDate || !row.endDate) continue;
      for (const src of sources) {
        const amt = parseFloat(row.amounts[src.label] ?? '');
        if (!isNaN(amt) && amt > 0) {
          result.push({ source: src.label, startDate: row.startDate, endDate: row.endDate, amount: amt });
        }
      }
    }
    onSave(result);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 py-8"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="mx-4 flex w-full max-w-5xl flex-col rounded-xl bg-white shadow-2xl ring-1 ring-slate-200/80">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Manage Ad Spend</h2>
            <p className="mt-0.5 text-xs text-slate-400">Enter spend per source for each campaign period. Costs are prorated across weeks automatically.</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Source group selector */}
        <div className="border-b border-slate-100 px-6 py-3">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Source group</label>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
          >
            {tagGroups.map((g) => <option key={g.name} value={g.name}>{g.name}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto px-6 py-4">
          {sources.length === 0 ? (
            <p className="text-sm text-slate-400">No tags in this group.</p>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="bg-slate-50 px-2 py-2 text-left font-semibold text-slate-600">Start Date</th>
                  <th className="bg-slate-50 px-2 py-2 text-left font-semibold text-slate-600">End Date</th>
                  {sources.map((src) => (
                    <th key={src.label} className="bg-slate-50 px-2 py-2 text-right font-semibold text-slate-600">
                      {src.tag}
                    </th>
                  ))}
                  <th className="bg-slate-50 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={2 + sources.length + 1} className="py-8 text-center text-slate-400">
                      No periods yet — click "Add Period" to get started
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-2 py-1.5">
                      <input
                        type="date"
                        value={row.startDate}
                        onChange={(e) => updateRow(row.id, 'startDate', e.target.value)}
                        className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-blue-200"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="date"
                        value={row.endDate}
                        onChange={(e) => updateRow(row.id, 'endDate', e.target.value)}
                        className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-blue-200"
                      />
                    </td>
                    {sources.map((src) => (
                      <td key={src.label} className="px-2 py-1.5 text-right">
                        <div className="relative inline-flex items-center">
                          <span className="pointer-events-none absolute left-2 text-slate-400">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.amounts[src.label] ?? ''}
                            placeholder="0.00"
                            onChange={(e) => updateAmount(row.id, src.label, e.target.value)}
                            className="w-24 rounded border border-slate-200 py-1 pl-5 pr-2 text-right text-xs text-slate-700 outline-none focus:ring-1 focus:ring-blue-200"
                          />
                        </div>
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-center">
                      <button
                        onClick={() => removeRow(row.id)}
                        className="rounded p-1 text-slate-300 transition-colors hover:text-red-400"
                        title="Remove period"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button
            onClick={addRow}
            className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-xs font-medium text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Period
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={handleSave} className="rounded-lg bg-[#1e3a6e] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#16305e]">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
