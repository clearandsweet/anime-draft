import { kv } from "@vercel/kv";
import { BlindRankingConfig } from "../../lib/blindRanking";
import {
  BlindRankingParticipant,
  BlindRankingRoomState,
  createBlindRankingRoomState,
} from "../../lib/blindRankingRoom";
import { generateBlindRankingRoomCode } from "./roomCode";
import * as fsStore from "./rooms.fs";

function hasKvEnvironment() {
  return Boolean(
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) ||
      (process.env.UPSTASH_REDIS_REST_URL &&
        process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}

function roomKey(code: string) {
  return `blind-ranking:room:${code}`;
}

export async function loadBlindRankingRoom(code: string) {
  if (!hasKvEnvironment()) return fsStore.loadBlindRankingRoom(code);
  return (await kv.get<BlindRankingRoomState>(roomKey(code))) ?? null;
}

export async function createBlindRankingRoom(
  config: BlindRankingConfig,
  host: BlindRankingParticipant
) {
  if (!hasKvEnvironment()) return fsStore.createBlindRankingRoom(config, host);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateBlindRankingRoomCode();
    if (await kv.exists(roomKey(code))) continue;
    const room = createBlindRankingRoomState(code, config, host);
    await kv.set(roomKey(code), room);
    return room;
  }
  throw new Error("Could not create a unique room code.");
}

export async function saveBlindRankingRoom(
  room: BlindRankingRoomState,
  expectedVersion?: number
) {
  if (!hasKvEnvironment()) {
    return fsStore.saveBlindRankingRoom(room, expectedVersion);
  }
  const current = await loadBlindRankingRoom(room.code);
  if (!current) throw new Error("Room not found.");
  if (expectedVersion !== undefined && current.version !== expectedVersion) {
    throw new Error("Optimistic lock failed: The room changed.");
  }
  room.version = current.version + 1;
  room.updatedAt = new Date().toISOString();
  await kv.set(roomKey(room.code), room);
}

export async function withBlindRankingRoom(
  code: string,
  mutate: (room: BlindRankingRoomState) => void | Promise<void>
) {
  if (!hasKvEnvironment()) return fsStore.withBlindRankingRoom(code, mutate);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const room = await loadBlindRankingRoom(code);
    if (!room) throw new Error("Room not found.");
    const versionBefore = room.version;
    await mutate(room);
    try {
      await saveBlindRankingRoom(room, versionBefore);
      return room;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === 0 && message.includes("Optimistic lock failed")) continue;
      throw error;
    }
  }
  throw new Error("Unable to update the room.");
}
