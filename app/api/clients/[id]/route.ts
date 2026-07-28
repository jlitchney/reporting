import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { getClient, saveClient, deleteClient } from '@/lib/redis';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await getClient(id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  // Prevent overwriting blobUrl from the client side
  const { blobUrl: _b, ...safeBody } = body;
  void _b;
  const updated = { ...existing, ...safeBody, lastUpdated: new Date().toISOString() };
  await saveClient(updated);
  const { blobUrl: _url, ...sanitized } = updated;
  void _url;
  return NextResponse.json(sanitized);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await getClient(id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await del(existing.blobUrl);
  await deleteClient(id);
  return NextResponse.json({ success: true });
}
