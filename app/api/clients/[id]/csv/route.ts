import { NextRequest, NextResponse } from 'next/server';
import { del, get } from '@vercel/blob';
import { getClient, saveClient } from '@/lib/redis';

// Proxy CSV through server — blobUrl is never sent to the browser
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const result = await get(client.blobUrl, {
      access: 'private',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return NextResponse.json({ error: 'Blob not found' }, { status: 404 });
    }
    const text = await new Response(result.stream).text();
    return new NextResponse(text, {
      headers: { 'Content-Type': 'text/csv; charset=utf-8' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Blob read failed: ${msg}` }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await getClient(id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { blobUrl: newBlobUrl } = await req.json();

  if (existing.blobUrl) {
    await del(existing.blobUrl).catch(() => {});
  }

  const updated = { ...existing, blobUrl: newBlobUrl, lastUpdated: new Date().toISOString() };
  await saveClient(updated);
  const { blobUrl: _url, ...sanitized } = updated;
  void _url;
  return NextResponse.json(sanitized);
}
