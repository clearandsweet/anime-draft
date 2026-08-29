import { kv } from "@vercel/kv";
import type { StoredCustomRanking } from "../../lib/customRanking";
import * as fsStore from "./customRankings.fs";

const INDEX_KEY = "custom-ranking:index";

function hasKvEnvironment() {
  return Boolean(
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) ||
      (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}

function idKey(id: string) {
  return `custom-ranking:id:${id}`;
}

function slugKey(slug: string) {
  return `custom-ranking:slug:${slug}`;
}

async function indexedIds() {
  return (await kv.get<string[]>(INDEX_KEY)) ?? [];
}

export async function saveCustomRanking(ranking: StoredCustomRanking) {
  if (!hasKvEnvironment()) return fsStore.saveCustomRanking(ranking);
  const ids = (await indexedIds()).filter((id) => id !== ranking.id);
  await Promise.all([
    kv.set(idKey(ranking.id), ranking),
    kv.set(slugKey(ranking.slug), ranking.id),
    kv.set(INDEX_KEY, [ranking.id, ...ids].slice(0, 500)),
  ]);
  return ranking;
}

export async function loadCustomRanking(slug: string) {
  if (!hasKvEnvironment()) return fsStore.loadCustomRanking(slug);
  const id = await kv.get<string>(slugKey(slug));
  return id ? (await kv.get<StoredCustomRanking>(idKey(id))) ?? null : null;
}

export async function listCustomRankings(query: string) {
  if (!hasKvEnvironment()) return fsStore.listCustomRankings(query);
  const ids = (await indexedIds()).slice(0, 200);
  const values = ids.length
    ? await kv.mget<(StoredCustomRanking | null)[]>(...ids.map(idKey))
    : [];
  const normalized = query.toLowerCase();
  return values
    .filter((ranking): ranking is StoredCustomRanking => Boolean(ranking))
    .filter((ranking) => !normalized || ranking.searchText.includes(normalized))
    .slice(0, 60);
}

export async function deleteCustomRanking(id: string) {
  if (!hasKvEnvironment()) return fsStore.deleteCustomRanking(id);
  const ranking = await kv.get<StoredCustomRanking>(idKey(id));
  const ids = (await indexedIds()).filter((entry) => entry !== id);
  await Promise.all([
    kv.del(idKey(id)),
    ranking ? kv.del(slugKey(ranking.slug)) : Promise.resolve(0),
    kv.set(INDEX_KEY, ids),
  ]);
}

export async function incrementCustomRankingPlays(slug: string) {
  if (!hasKvEnvironment()) return fsStore.incrementCustomRankingPlays(slug);
  const ranking = await loadCustomRanking(slug);
  if (!ranking) return null;
  ranking.playsCount += 1;
  ranking.updatedAt = new Date().toISOString();
  await kv.set(idKey(ranking.id), ranking);
  return ranking;
}
