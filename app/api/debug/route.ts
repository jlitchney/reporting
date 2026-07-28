import { NextResponse } from 'next/server';

export async function GET() {
  const vars = [
    'BLOB_READ_WRITE_TOKEN',
    'BLOB_STORE_ID',
    'KV_REST_API_URL',
    'KV_REST_API_TOKEN',
    'KV_REST_API_READ_ONLY_TOKEN',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
  ];

  const result: Record<string, boolean> = {};
  for (const v of vars) {
    result[v] = Boolean(process.env[v]);
  }

  // Also try a Redis ping
  let redisPing: string;
  try {
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({
      url: (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL)!,
      token: (process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN)!,
    });
    const pong = await redis.ping();
    redisPing = String(pong);
  } catch (e) {
    redisPing = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json({ env: result, redisPing });
}
