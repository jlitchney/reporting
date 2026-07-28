'use client';

import { useState, useRef, useEffect } from 'react';
import type { ClientTab } from '@/lib/types';

interface TabBarProps {
  tabs: ClientTab[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onAddTab: () => void;
  onRemoveTab: (tabId: string) => void;
  onRenameTab: (tabId: string, name: string) => void;
}

export default function TabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onAddTab,
  onRemoveTab,
  onRenameTab,
}: TabBarProps) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTabId]);

  const startEdit = (tab: ClientTab, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTabId(tab.id);
    setEditValue(tab.name);
  };

  const commitEdit = () => {
    if (editingTabId && editValue.trim()) {
      onRenameTab(editingTabId, editValue.trim());
    }
    setEditingTabId(null);
  };

  return (
    <div className="flex items-end border-b border-slate-200 bg-white px-6 gap-0.5">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const isEditing = editingTabId === tab.id;
        return (
          <div key={tab.id} className="group relative flex items-center">
            <button
              onClick={() => !isEditing && onSelectTab(tab.id)}
              onDoubleClick={(e) => startEdit(tab, e)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? 'border-[#1e3a6e] text-[#1e3a6e] bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {isEditing ? (
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                    if (e.key === 'Escape') setEditingTabId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-24 bg-transparent outline-none border-b border-[#1e3a6e] text-sm font-medium"
                />
              ) : (
                <span>{tab.name}</span>
              )}
            </button>
            {tabs.length > 1 && !isEditing && (
              <button
                onClick={(e) => { e.stopPropagation(); onRemoveTab(tab.id); }}
                title="Remove tab"
                className="absolute right-0 top-1/2 -translate-y-1/2 invisible group-hover:visible flex h-4 w-4 items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 text-xs leading-none"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      <button
        onClick={onAddTab}
        title="Add tab"
        className="flex items-center justify-center mb-1 ml-1 h-6 w-6 rounded text-slate-400 hover:text-[#1e3a6e] hover:bg-slate-100 transition-colors text-base"
      >
        +
      </button>
    </div>
  );
}
