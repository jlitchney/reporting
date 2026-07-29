'use client';

import type { CriteriaFilter, FilterCondition, FilterOperator, TagGroup } from '@/lib/types';

interface CriteriaBuilderProps {
  criteria: CriteriaFilter;
  onChange: (criteria: CriteriaFilter) => void;
  tagGroups: TagGroup[];
  excludeTag?: string | null;
  size?: 'sm' | 'md';
}

function newCondition(): FilterCondition {
  return { id: `c-${Date.now()}-${Math.random().toString(36).slice(2)}`, tag: '', operator: 'is_applied' };
}

export default function CriteriaBuilder({
  criteria,
  onChange,
  tagGroups,
  excludeTag,
  size = 'md',
}: CriteriaBuilderProps) {
  const { conditions, logic } = criteria;

  const updateCondition = (idx: number, patch: Partial<FilterCondition>) => {
    onChange({ ...criteria, conditions: conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c)) });
  };

  const removeCondition = (idx: number) => {
    const nextConditions = conditions.filter((_, i) => i !== idx);
    const logicIdx = idx === 0 ? 0 : idx - 1;
    const nextLogic = conditions.length > 1 ? logic.filter((_, i) => i !== logicIdx) : [];
    onChange({ conditions: nextConditions, logic: nextLogic });
  };

  const addCondition = () => {
    onChange({
      conditions: [...conditions, newCondition()],
      logic: conditions.length === 0 ? [] : [...logic, 'AND'],
    });
  };

  const toggleLogic = (idx: number) => {
    onChange({ ...criteria, logic: logic.map((l, i) => (i === idx ? (l === 'AND' ? 'OR' : 'AND') : l)) });
  };

  const sm = size === 'sm';
  const selectCls = sm
    ? 'rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-[#1e3a6e]/30'
    : 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#1e3a6e] focus:ring-2 focus:ring-[#1e3a6e]/20';

  return (
    <div className="space-y-1.5">
      {conditions.length === 0 && (
        <p className={`text-slate-400 ${sm ? 'text-[10px]' : 'text-xs'}`}>
          No criteria — all leads count.
        </p>
      )}

      {conditions.map((cond, idx) => (
        <div key={cond.id}>
          {/* AND / OR connector */}
          {idx > 0 && (
            <div className="flex items-center gap-2 py-1">
              <div className="h-px flex-1 bg-slate-100" />
              <button
                onClick={() => toggleLogic(idx - 1)}
                className={`rounded px-2.5 py-0.5 text-[10px] font-bold tracking-wide transition-colors ${
                  logic[idx - 1] === 'AND'
                    ? 'bg-[#1e3a6e] text-white'
                    : 'bg-amber-500 text-white'
                }`}
              >
                {logic[idx - 1]}
              </button>
              <div className="h-px flex-1 bg-slate-100" />
            </div>
          )}

          {/* Condition row */}
          <div className="flex items-center gap-1.5">
            <select
              value={cond.tag}
              onChange={(e) => updateCondition(idx, { tag: e.target.value })}
              className={`flex-1 min-w-0 ${selectCls}`}
            >
              <option value="">Select tag…</option>
              {tagGroups.map((g) => (
                <optgroup key={g.name} label={g.name}>
                  {g.tags
                    .filter((t) => t.label !== excludeTag)
                    .map((t) => (
                      <option key={t.label} value={t.label}>{t.tag}</option>
                    ))}
                </optgroup>
              ))}
            </select>

            <select
              value={cond.operator}
              onChange={(e) => updateCondition(idx, { operator: e.target.value as FilterOperator })}
              className={`flex-shrink-0 ${selectCls}`}
            >
              <option value="is_applied">is applied</option>
              <option value="is_not_applied">is not applied</option>
            </select>

            <button
              onClick={() => removeCondition(idx)}
              className="flex-shrink-0 rounded p-1 text-slate-300 hover:text-red-400 hover:bg-slate-50 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={addCondition}
        className={`flex items-center gap-1 font-medium text-[#1e3a6e] hover:underline transition-colors mt-1 ${sm ? 'text-[10px]' : 'text-xs'}`}
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
        Add condition
      </button>
    </div>
  );
}
