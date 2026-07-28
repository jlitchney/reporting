import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { listClients, saveClient } from '@/lib/redis';

function sanitize<T extends { blobUrl?: unknown }>(client: T) {
  const { blobUrl: _b, ...rest } = client;
  void _b;
  return rest;
}

export async function GET() {
  const clients = await listClients();
  return NextResponse.json(clients.map(sanitize));
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const name = formData.get('name') as string;
  const file = formData.get('csv') as File;

  const id = `client-${Date.now()}`;

  let blob: Awaited<ReturnType<typeof put>>;
  try {
    blob = await put(`clients/${id}/data.csv`, file, {
      access: 'public',
      contentType: 'text/csv',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Blob upload failed: ${msg}` }, { status: 500 });
  }

  const client = {
    id,
    name,
    blobUrl: blob.url,
    tabs: [{ id: 'tab-default', name: 'Overview', chartConfigs: [] }],
    lastUpdated: new Date().toISOString(),
  };

  try {
    await saveClient(client);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Redis save failed: ${msg}` }, { status: 500 });
  }

  return NextResponse.json(sanitize(client));
}
