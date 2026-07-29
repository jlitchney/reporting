'use client';

import { useState } from 'react';
import { COLOR_PALETTE } from './AppearanceControls';

interface Series {
  id: string;
  name: string;
  color: string;
}

interface Props {
  series: Series[];
  onColorChange: (id: string, color: string) => void;
}

export default function SeriesColorPicker({ series, onColorChange }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Series colors</label>
      <div className="space-y-1">
        {series.map((s) => (
          <div key={s.id}>
            <button
              onClick={() => setActiveId(activeId === s.id ? null : s.id)}
              className="flex items-center gap-2 w-full rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <span
                className="h-3 w-3 flex-shrink-0 rounded-sm ring-1 ring-black/10"
                style={{ backgroundColor: s.color }}
              />
              <span className="truncate">{s.name}</span>
              <span className="ml-auto text-slate-400">{activeId === s.id ? '▲' : '▼'}</span>
            </button>
            {activeId === s.id && (
              <div className="mt-1 ml-2 flex flex-wrap gap-1.5">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => { onColorChange(s.id, c); setActiveId(null); }}
                    className="h-5 w-5 rounded-full transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      boxShadow: s.color === c ? `0 0 0 2px white, 0 0 0 3.5px ${c}` : undefined,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
