import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { getClient, saveClient } from '@/lib/redis';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await getClient(id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get('csv') as File;

  // Replace old blob
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
  return NextResponse.json(updated);
}
