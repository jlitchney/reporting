'use client';

const PALETTE = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
  '#ef4444', '#f97316', '#f59e0b', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#64748b',
];

const HEIGHT_PRESETS = [
  { label: 'S', value: 200 },
  { label: 'M', value: 300 },
  { label: 'L', value: 400 },
  { label: 'XL', value: 500 },
];

interface AppearanceControlsProps {
  color: string;
  colSpan?: 1 | 2 | 3 | 4;
  chartHeight?: number;
  onColorChange: (color: string) => void;
  onColSpanChange?: (span: 1 | 2 | 3 | 4) => void;
  onHeightChange?: (h: number) => void;
  showInReport?: boolean;
  onShowInReportChange?: (v: boolean) => void;
}

export default function AppearanceControls({ color, colSpan, chartHeight, onColorChange, onColSpanChange, onHeightChange, showInReport, onShowInReportChange }: AppearanceControlsProps) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Color</label>
        <div className="flex items-center gap-1.5">
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
          <label
            title="Custom color"
            className="relative h-5 w-5 flex-shrink-0 cursor-pointer rounded-full overflow-hidden transition-transform hover:scale-110"
            style={{
              background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
              boxShadow: !PALETTE.includes(color) ? `0 0 0 2px white, 0 0 0 3.5px ${color}` : undefined,
            }}
          >
            <input
              type="color"
              value={color}
              onChange={(e) => onColorChange(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        </div>
      </div>

      {onColSpanChange && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Width</label>
          <div className="flex overflow-hidden rounded border border-slate-200">
            {([1, 2, 3, 4] as const).map((span) => (
              <button
                key={span}
                onClick={() => onColSpanChange(span)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${colSpan === span ? 'text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                style={colSpan === span ? { backgroundColor: color } : {}}
              >
                {span === 1 ? '¼' : span === 2 ? '½' : span === 3 ? '¾' : 'Full'}
              </button>
            ))}
          </div>
        </div>
      )}

      {onHeightChange && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Height</label>
          <div className="flex overflow-hidden rounded border border-slate-200">
            {HEIGHT_PRESETS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => onHeightChange(value)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${(chartHeight ?? 300) === value ? 'text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                style={(chartHeight ?? 300) === value ? { backgroundColor: color } : {}}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {onShowInReportChange && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Viewers</label>
          <label className="flex cursor-pointer items-center gap-2">
            <div className="relative flex-shrink-0">
              <input
                type="checkbox"
                className="sr-only"
                checked={showInReport ?? true}
                onChange={(e) => onShowInReportChange(e.target.checked)}
              />
              <div className={`h-4 w-7 rounded-full transition-colors ${(showInReport ?? true) ? 'bg-[#1e3a6e]' : 'bg-slate-300'}`} />
              <div className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${(showInReport ?? true) ? 'translate-x-3' : ''}`} />
            </div>
            <span className="text-xs text-slate-600">Show in shared report</span>
          </label>
        </div>
      )}
    </div>
  );
}

export { PALETTE as COLOR_PALETTE };
