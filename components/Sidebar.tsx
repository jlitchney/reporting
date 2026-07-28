'use client';

import { useState, useRef } from 'react';
import type { StoredClient } from '@/lib/useClients';
import { clientNameFromFilename } from '@/lib/csvParser';

interface SidebarProps {
  clients: StoredClient[];
  activeClientId: string | null;
  onSelectClient: (id: string) => void;
  onAddClient: (name: string, file: File) => void;
  onRemoveClient: (id: string) => void;
}

export default function Sidebar({
  clients,
  activeClientId,
  onSelectClient,
  onAddClient,
  onRemoveClient,
}: SidebarProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [hoverId, setHoverId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = newName.trim() || clientNameFromFilename(file.name);
    onAddClient(name, file);
    setAdding(false);
    setNewName('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <aside className="flex h-screen w-56 flex-shrink-0 flex-col bg-[#1e3a6e] text-white">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-white/10">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-white/15 text-xs font-bold">
          CR
        </div>
        <span className="text-sm font-semibold tracking-wide">Campaign Reports</span>
      </div>

      {/* Clients list */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">
          Clients
        </p>

        <nav className="space-y-0.5">
          {clients.map((client) => (
            <div
              key={client.id}
              className="group relative"
              onMouseEnter={() => setHoverId(client.id)}
              onMouseLeave={() => setHoverId(null)}
            >
              <button
                onClick={() => onSelectClient(client.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  activeClientId === client.id
                    ? 'bg-white/20 font-semibold text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span
                  className={`h-2 w-2 flex-shrink-0 rounded-full ${
                    activeClientId === client.id ? 'bg-blue-300' : 'bg-white/30'
                  }`}
                />
                <span className="truncate">{client.name}</span>
              </button>
              {hoverId === client.id && clients.length > 1 && (
                <button
                  onClick={() => onRemoveClient(client.id)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-white/30 hover:text-white/80 transition-colors"
                  title="Remove client"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </nav>

        {/* Add client form */}
        {adding ? (
          <div className="mt-3 rounded-lg bg-white/10 p-3 space-y-2">
            <input
              autoFocus
              placeholder="Client name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded bg-white/10 px-2.5 py-1.5 text-sm text-white placeholder-white/40 outline-none focus:ring-1 focus:ring-white/40"
            />
            <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded bg-blue-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-400 transition-colors">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload CSV
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            </label>
            <button
              onClick={() => { setAdding(false); setNewName(''); }}
              className="w-full text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-3 flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Client
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 px-5 py-3">
        <p className="text-[10px] text-white/30">AllStar Talent</p>
      </div>
    </aside>
  );
}
