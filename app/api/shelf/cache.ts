import { kv } from "@vercel/kv";

/** Shop searches are shared by everyone, so results are kept in KV (when configured) as well as in memory. */
const memory = new Map<string, { expires: number; value: unknown }>();
const MEMORY_LIMIT = 400;

function hasKvEnvironment() {
  return Boolean(
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) ||
      (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}

function remember(key: string, value: unknown, seconds: number) {
  if (memory.size >= MEMORY_LIMIT) memory.delete(memory.keys().next().value!);
  memory.set(key, { expires: Date.now() + seconds * 1000, value });
}

/** Failures are never cached; a broken cache only costs a fresh lookup. */
export async function cached<T>(key: string, seconds: number, load: () => Promise<T>): Promise<T> {
  const hit = memory.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  if (hasKvEnvironment()) {
    try {
      const stored = await kv.get<T>(key);
      if (stored !== null && stored !== undefined) {
        remember(key, stored, seconds);
        return stored;
      }
    } catch {}
  }
  const value = await load();
  remember(key, value, seconds);
  if (hasKvEnvironment()) {
    try { await kv.set(key, value, { ex: seconds }); } catch {}
  }
  return value;
}
