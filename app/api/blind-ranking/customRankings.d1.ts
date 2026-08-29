import type { StoredCustomRanking } from "../../lib/customRanking";
import { getCloudflareDb } from "../runtimeStorage";

type RankingRow = {
  state_json: string;
  search_text: string;
  manage_key_hash: string;
  plays_count: number;
};

let schemaPromise: Promise<void> | null = null;

function ensureSchema() {
  if (!schemaPromise) {
    const db = getCloudflareDb();
    schemaPromise = db
      .batch([
        db.prepare(`CREATE TABLE IF NOT EXISTS custom_rankings (
          id TEXT PRIMARY KEY NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          state_json TEXT NOT NULL,
          search_text TEXT NOT NULL,
          manage_key_hash TEXT NOT NULL,
          plays_count INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`),
        db.prepare(
          "CREATE UNIQUE INDEX IF NOT EXISTS custom_rankings_slug_idx ON custom_rankings (slug)"
        ),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS custom_rankings_created_at_idx ON custom_rankings (created_at)"
        ),
      ])
      .then(() => undefined)
      .catch((error) => {
        schemaPromise = null;
        throw error;
      });
  }
  return schemaPromise;
}

function parseRanking(row: RankingRow) {
  return {
    ...(JSON.parse(row.state_json) as StoredCustomRanking),
    searchText: row.search_text,
    manageKeyHash: row.manage_key_hash,
    playsCount: row.plays_count,
  };
}

export async function saveCustomRanking(ranking: StoredCustomRanking) {
  await ensureSchema();
  await getCloudflareDb()
    .prepare(`INSERT INTO custom_rankings (
      id, slug, state_json, search_text, manage_key_hash, plays_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      ranking.id,
      ranking.slug,
      JSON.stringify(ranking),
      ranking.searchText,
      ranking.manageKeyHash,
      ranking.playsCount,
      ranking.createdAt,
      ranking.updatedAt
    )
    .run();
  return ranking;
}

export async function loadCustomRanking(slug: string) {
  await ensureSchema();
  const row = await getCloudflareDb()
    .prepare(`SELECT state_json, search_text, manage_key_hash, plays_count
      FROM custom_rankings WHERE slug = ?`)
    .bind(slug)
    .first<RankingRow>();
  return row ? parseRanking(row) : null;
}

export async function listCustomRankings(query: string) {
  await ensureSchema();
  const prepared = query
    ? getCloudflareDb()
        .prepare(`SELECT state_json, search_text, manage_key_hash, plays_count
          FROM custom_rankings WHERE search_text LIKE ?
          ORDER BY created_at DESC LIMIT 60`)
        .bind(`%${query.toLowerCase()}%`)
    : getCloudflareDb().prepare(`SELECT state_json, search_text, manage_key_hash, plays_count
        FROM custom_rankings ORDER BY created_at DESC LIMIT 60`);
  const result = await prepared.all<RankingRow>();
  return result.results.map(parseRanking);
}

export async function deleteCustomRanking(id: string) {
  await ensureSchema();
  await getCloudflareDb()
    .prepare("DELETE FROM custom_rankings WHERE id = ?")
    .bind(id)
    .run();
}

export async function incrementCustomRankingPlays(slug: string) {
  await ensureSchema();
  await getCloudflareDb()
    .prepare("UPDATE custom_rankings SET plays_count = plays_count + 1 WHERE slug = ?")
    .bind(slug)
    .run();
  return loadCustomRanking(slug);
}
