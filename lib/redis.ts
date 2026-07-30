import { Redis } from '@upstash/redis';
import type { ChartConfig, ClientTab, ReportConfig } from './types';

export interface SpendEntry {
  source: string;
  startDate: string;  // 'YYYY-MM-DD'
  endDate: string;    // 'YYYY-MM-DD'
  amount: number;
  weekOf?: string;    // legacy — kept for backward compat
}

export interface ClientRecord {
  id: string;
  name: string;
  blobUrl: string;
  tabs?: ClientTab[];
  chartConfigs?: ChartConfig[]; // legacy
  lastUpdated: string;
  spendData?: SpendEntry[];
  reportConfig?: ReportConfig;
}

function getRedis() {
  return new Redis({
    url: (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL)!,
    token: (process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN)!,
  });
}

export async function listClients(): Promise<ClientRecord[]> {
  const redis = getRedis();
  const ids = (await redis.get<string[]>('client_ids')) ?? [];
  if (!ids.length) return [];
  const records = await Promise.all(ids.map((id) => redis.get<ClientRecord>(`client:${id}`)));
  return records.filter(Boolean) as ClientRecord[];
}

export async function getClient(id: string): Promise<ClientRecord | null> {
  return getRedis().get<ClientRecord>(`client:${id}`);
}

export async function saveClient(client: ClientRecord): Promise<void> {
  const redis = getRedis();
  await redis.set(`client:${client.id}`, client);
  const ids = (await redis.get<string[]>('client_ids')) ?? [];
  if (!ids.includes(client.id)) {
    await redis.set('client_ids', [...ids, client.id]);
  }
}

export async function deleteClient(id: string): Promise<void> {
  const redis = getRedis();
  await redis.del(`client:${id}`);
  const ids = (await redis.get<string[]>('client_ids')) ?? [];
  await redis.set('client_ids', ids.filter((i) => i !== id));
}
