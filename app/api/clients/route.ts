import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { listClients, saveClient } from '@/lib/redis';

export async function GET() {
  const clients = await listClients();
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const name = formData.get('name') as string;
  const file = formData.get('csv') as File;

  const id = `client-${Date.now()}`;

  const blob = await put(`clients/${id}/data.csv`, file, {
    access: 'private',
    contentType: 'text/csv',
  });

  const client = {
    id,
    name,
    blobUrl: blob.url,
    chartConfigs: [],
    lastUpdated: new Date().toISOString(),
  };

  await saveClient(client);
  return NextResponse.json(client);
}
