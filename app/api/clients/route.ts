import { NextRequest, NextResponse } from 'next/server';
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
  const { name, blobUrl } = await req.json();

  const id = `client-${Date.now()}`;
  const client = {
    id,
    name,
    blobUrl,
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
