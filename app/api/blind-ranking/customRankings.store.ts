import type { StoredCustomRanking } from "../../lib/customRanking";
import { hasCloudflareDb } from "../runtimeStorage";

async function backend() {
  return hasCloudflareDb()
    ? import("./customRankings.d1")
    : import("./customRankings.vercel");
}

export async function saveCustomRanking(ranking: StoredCustomRanking) {
  return (await backend()).saveCustomRanking(ranking);
}

export async function loadCustomRanking(slug: string) {
  return (await backend()).loadCustomRanking(slug);
}

export async function listCustomRankings(query: string) {
  return (await backend()).listCustomRankings(query);
}

export async function deleteCustomRanking(id: string) {
  return (await backend()).deleteCustomRanking(id);
}

export async function incrementCustomRankingPlays(slug: string) {
  return (await backend()).incrementCustomRankingPlays(slug);
}
