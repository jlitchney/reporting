'use client';

import { useState, type ReactNode } from 'react';
import AppearanceControls from './AppearanceControls';

interface WidgetShellProps {
  accent: string;
  title: string;
  canRemove: boolean;
  showDragHandle?: boolean;
  readOnly?: boolean;
  badge?: string | number;
  onTitleSave: (t: string) => void;
  onDuplicate?: () => void;
  onRemove: () => void;
  configPanel?: ReactNode;
  children: ReactNode;
  colSpan?: 1 | 2 | 3 | 4;
  chartHeight?: number;
  onColorChange?: (color: string) => void;
  onColSpanChange?: (span: 1 | 2 | 3 | 4) => void;
  onHeightChange?: (h: number) => void;
}

export default function WidgetShell({
  accent,
  title,
  canRemove,
  showDragHandle,
  readOnly,
  badge,
  onTitleSave,
  onDuplicate,
  onRemove,
  configPanel,
  children,
  colSpan,
  chartHeight,
  onColorChange,
  onColSpanChange,
  onHeightChange,
}: WidgetShellProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [configOpen, setConfigOpen] = useState(false);

  const commitTitle = () => { onTitleSave(titleDraft); setEditingTitle(false); };
  const hasConfig = configPanel !== undefined || onColorChange !== undefined;

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200/80">
      <div className="h-1 w-full" style={{ backgroundColor: accent }} />

      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        {showDragHandle && !readOnly && (
          <div className="flex-shrink-0 cursor-grab text-slate-300 hover:text-slate-400 active:cursor-grabbing">
            <GripIcon />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {!readOnly && editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTitle();
                if (e.key === 'Escape') setEditingTitle(false);
              }}
              className="w-full rounded border border-slate-300 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600 outline-none focus:ring-2 focus:ring-blue-200"
            />
          ) : readOnly ? (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 truncate block">
              {title}
            </span>
          ) : (
            <button
              onClick={() => { setTitleDraft(title); setEditingTitle(true); }}
              className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors text-left truncate block w-full"
              title="Click to rename"
            >
              {title}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {badge != null && (
            <span className="mr-1 text-xs font-semibold text-slate-700">{badge}</span>
          )}
          {onDuplicate && !readOnly && (
            <button
              onClick={onDuplicate}
              title="Duplicate chart"
              className="rounded p-1 text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          )}
          {hasConfig && !readOnly && (
            <button
              onClick={() => setConfigOpen((v) => !v)}
              title="Configure"
              className={`rounded p-1 transition-colors ${configOpen ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </button>
          )}
          {canRemove && !readOnly && (
            <button
              onClick={onRemove}
              title="Remove chart"
              className="rounded p-1 text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {configOpen && hasConfig && (
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          {configPanel && <div>{configPanel}</div>}
          {onColorChange && (
            <div className={configPanel ? 'mt-3 pt-3 border-t border-slate-100' : undefined}>
              <AppearanceControls
                color={accent}
                colSpan={colSpan ?? 4}
                chartHeight={chartHeight}
                onColorChange={onColorChange}
                onColSpanChange={onColSpanChange}
                onHeightChange={onHeightChange}
              />
            </div>
          )}
        </div>
      )}

      {children}
    </div>
  );
}

function GripIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="5" cy="4" r="1.5" /><circle cx="11" cy="4" r="1.5" />
      <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
      <circle cx="5" cy="12" r="1.5" /><circle cx="11" cy="12" r="1.5" />
    </svg>
  );
}
