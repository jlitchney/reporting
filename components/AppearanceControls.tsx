'use client';

const PALETTE = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
  '#ef4444', '#f97316', '#f59e0b', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#64748b',
];

interface AppearanceControlsProps {
  color: string;
  colSpan?: 1 | 2 | 3;
  onColorChange: (color: string) => void;
  onColSpanChange?: (span: 1 | 2 | 3) => void;
}

export default function AppearanceControls({ color, colSpan, onColorChange, onColSpanChange }: AppearanceControlsProps) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Color</label>
        <div className="grid grid-cols-6 gap-1.5">
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => onColorChange(c)}
              title={c}
              className="h-5 w-5 rounded-full transition-transform hover:scale-110"
              style={{
                backgroundColor: c,
                boxShadow: color === c ? `0 0 0 2px white, 0 0 0 3.5px ${c}` : undefined,
              }}
            />
          ))}
        </div>
      </div>

      {onColSpanChange && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Width</label>
          <div className="flex overflow-hidden rounded border border-slate-200">
            {([3, 2, 1] as const).map((span) => (
              <button
                key={span}
                onClick={() => onColSpanChange(span)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${colSpan === span ? 'text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                style={colSpan === span ? { backgroundColor: color } : {}}
              >
                {span === 3 ? 'Full' : span === 2 ? '½' : '⅓'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export { PALETTE as COLOR_PALETTE };
