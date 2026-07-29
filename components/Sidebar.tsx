'use client';

import { useState, useRef } from 'react';
import type { StoredClient } from '@/lib/useClients';
import { clientNameFromFilename } from '@/lib/csvParser';

interface SidebarProps {
  clients: StoredClient[];
  activeClientId: string | null;
  onSelectClient: (id: string) => void;
  onAddClient: (name: string, file: File) => Promise<void>;
  onRenameClient: (id: string, name: string) => void;
  onRemoveClient: (id: string) => void;
}

export default function Sidebar({
  clients,
  activeClientId,
  onSelectClient,
  onAddClient,
  onRenameClient,
  onRemoveClient,
}: SidebarProps) {
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = newName.trim() || clientNameFromFilename(file.name);
    setUploading(true);
    setUploadError(null);
    try {
      await onAddClient(name, file);
      setAdding(false);
      setNewName('');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const startRename = (client: StoredClient) => {
    setRenamingId(client.id);
    setRenameValue(client.name);
  };

  const commitRename = (id: string) => {
    if (renameValue.trim()) onRenameClient(id, renameValue.trim());
    setRenamingId(null);
  };

  return (
    <aside className="flex h-screen w-56 flex-shrink-0 flex-col bg-[#1e3a6e] text-white">
      {/* Logo */}
      <div className="flex items-center px-5 py-4 border-b border-white/10">
        <img src="/logo-white.png" alt="All-Star Recruiter" className="h-7 w-auto" />
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
              {renamingId === client.id ? (
                <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-white/20">
                  <span className="h-2 w-2 flex-shrink-0 rounded-full bg-blue-300" />
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(client.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(client.id);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder-white/40 border-b border-white/40"
                  />
                </div>
              ) : (
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
                  <span className="truncate flex-1">{client.name}</span>
                </button>
              )}

              {/* Hover actions: share link + rename + delete */}
              {hoverId === client.id && renamingId !== client.id && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/share/${client.id}`;
                      navigator.clipboard.writeText(url).catch(() => {});
                    }}
                    title="Copy share link"
                    className="rounded p-0.5 text-white/30 hover:text-white/80 transition-colors"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </button>
                  <button
                    onClick={() => startRename(client)}
                    title="Rename client"
                    className="rounded p-0.5 text-white/30 hover:text-white/80 transition-colors"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onRemoveClient(client.id)}
                    title="Remove client"
                    className="rounded p-0.5 text-white/30 hover:text-white/80 transition-colors"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
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
              disabled={uploading}
              className="w-full rounded bg-white/10 px-2.5 py-1.5 text-sm text-white placeholder-white/40 outline-none focus:ring-1 focus:ring-white/40 disabled:opacity-50"
            />
            <label className={`flex cursor-pointer items-center justify-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium text-white transition-colors ${uploading ? 'bg-blue-500/50 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-400'}`}>
              {uploading ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Uploading…
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload CSV
                </>
              )}
              <input ref={fileRef} type="file" accept=".csv" className="hidden" disabled={uploading} onChange={handleFile} />
            </label>
            {uploadError && (
              <p className="text-xs text-red-300 break-words">{uploadError}</p>
            )}
            <button
              onClick={() => { setAdding(false); setNewName(''); setUploadError(null); }}
              disabled={uploading}
              className="w-full text-xs text-white/40 hover:text-white/70 transition-colors disabled:opacity-50"
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

      {/* Dev spec link */}
      <div className="px-3 pb-2">
        <a
          href="/spec.html"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-white/40 hover:bg-white/10 hover:text-white/70 transition-colors"
        >
          <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Developer Spec
        </a>
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 px-5 py-3">
        <p className="text-[10px] text-white/30">AllStar Talent</p>
      </div>
    </aside>
  );
}
