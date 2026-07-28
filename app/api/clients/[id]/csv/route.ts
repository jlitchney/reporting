import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { getClient, saveClient } from '@/lib/redis';

// Proxy CSV through server — blobUrl is never sent to the browser
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const res = await fetch(client.blobUrl);
  if (!res.ok) return NextResponse.json({ error: 'Blob fetch failed' }, { status: 502 });
  const text = await res.text();

  return new NextResponse(text, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8' },
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await getClient(id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get('csv') as File;

  if (existing.blobUrl) {
    await del(existing.blobUrl).catch(() => {});
  }

  const blob = await put(`clients/${id}/data.csv`, file, {
    access: 'public',
    contentType: 'text/csv',
    allowOverwrite: true,
  });

  const updated = { ...existing, blobUrl: blob.url, lastUpdated: new Date().toISOString() };
  await saveClient(updated);
  const { blobUrl: _url, ...sanitized } = updated;
  void _url;
  return NextResponse.json(sanitized);
}
