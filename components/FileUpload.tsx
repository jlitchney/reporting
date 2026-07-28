'use client';

import { useCallback, useState } from 'react';

interface FileUploadProps {
  onFile: (text: string, filename: string) => void;
}

export default function FileUpload({ onFile }: FileUploadProps) {
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        onFile(text, file.name);
      };
      reader.readAsText(file);
    },
    [onFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file?.name.endsWith('.csv')) handleFile(file);
    },
    [handleFile]
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-8 py-12 text-center transition-colors ${
        dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-white hover:border-slate-400'
      }`}
    >
      <svg className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <div>
        <p className="text-sm font-medium text-slate-700">Drop a CSV file here</p>
        <p className="mt-0.5 text-xs text-slate-500">or click to browse</p>
      </div>
      <label className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
        Choose File
        <input type="file" accept=".csv" className="hidden" onChange={onInputChange} />
      </label>
    </div>
  );
}
