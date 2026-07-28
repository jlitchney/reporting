import { NextRequest, NextResponse } from 'next/server';
import { put, del, head } from '@vercel/blob';
import { getClient, saveClient } from '@/lib/redis';

// Proxy the private CSV through the server — never exposes the raw Blob URL to the browser
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const blob = await head(client.blobUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });
  const res = await fetch(blob.downloadUrl);
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
    access: 'private',
    contentType: 'text/csv',
    allowOverwrite: true,
  });

  const updated = { ...existing, blobUrl: blob.url, lastUpdated: new Date().toISOString() };
  await saveClient(updated);
  return NextResponse.json(updated);
}
