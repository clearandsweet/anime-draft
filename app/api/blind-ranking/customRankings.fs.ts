import fs from "fs/promises";
import os from "os";
import path from "path";
import type { StoredCustomRanking } from "../../lib/customRanking";

const ROOT = path.join(os.tmpdir(), "anime-draft", "custom-rankings");

function rankingPath(id: string) {
  return path.join(ROOT, `${id}.json`);
}

async function allRankings() {
  try {
    const files = (await fs.readdir(ROOT)).filter((name) => name.endsWith(".json"));
    const rankings = await Promise.all(
      files.map(async (file) =>
        JSON.parse(await fs.readFile(path.join(ROOT, file), "utf8")) as StoredCustomRanking
      )
    );
    return rankings.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function saveCustomRanking(ranking: StoredCustomRanking) {
  await fs.mkdir(ROOT, { recursive: true });
  await fs.writeFile(rankingPath(ranking.id), JSON.stringify(ranking, null, 2), "utf8");
  return ranking;
}

export async function loadCustomRanking(slug: string) {
  return (await allRankings()).find((ranking) => ranking.slug === slug) ?? null;
}

export async function listCustomRankings(query: string) {
  const normalized = query.toLowerCase();
  return (await allRankings())
    .filter((ranking) => !normalized || ranking.searchText.includes(normalized))
    .slice(0, 60);
}

export async function deleteCustomRanking(id: string) {
  await fs.rm(rankingPath(id), { force: true });
}

export async function incrementCustomRankingPlays(slug: string) {
  const ranking = await loadCustomRanking(slug);
  if (!ranking) return null;
  ranking.playsCount += 1;
  ranking.updatedAt = new Date().toISOString();
  await saveCustomRanking(ranking);
  return ranking;
}
