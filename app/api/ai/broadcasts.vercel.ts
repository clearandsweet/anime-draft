import { kv } from "@vercel/kv";
import type { SavedBroadcast } from "./broadcasts";

function hasKVEnv() {
  const vercelKV =
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
  const upstash =
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(vercelKV || upstash);
}

function broadcastKey(lobbyId: string, competition: string) {
  return `lobby:broadcast:${lobbyId}:${encodeURIComponent(competition)}`;
}

export async function getSavedBroadcast(
  lobbyId: string,
  competition: string
): Promise<SavedBroadcast | null> {
  if (!hasKVEnv()) return null;
  return (
    (await kv.get<SavedBroadcast>(broadcastKey(lobbyId, competition))) ?? null
  );
}

export async function saveBroadcast(
  lobbyId: string,
  competition: string,
  draftType: "anime" | "pokemon",
  resultText: string,
  createdAt: string
): Promise<SavedBroadcast> {
  const existing = await getSavedBroadcast(lobbyId, competition);
  if (existing) return existing;

  const saved: SavedBroadcast = {
    lobbyId,
    competition,
    draftType,
    resultText,
    createdAt,
  };
  if (hasKVEnv()) {
    await kv.set(broadcastKey(lobbyId, competition), saved);
  }
  return saved;
}
