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

  const blob = await put(`clients/${id}/data.csv`, file, {
    access: 'public',
    contentType: 'text/csv',
  });

  const client = {
    id,
    name,
    blobUrl: blob.url,
    tabs: [{ id: 'tab-default', name: 'Overview', chartConfigs: [] }],
    lastUpdated: new Date().toISOString(),
  };

  await saveClient(client);
  return NextResponse.json(sanitize(client));
}
