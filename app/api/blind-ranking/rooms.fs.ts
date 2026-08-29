import fs from "fs/promises";
import os from "os";
import path from "path";
import { BlindRankingConfig } from "../../lib/blindRanking";
import {
  BlindRankingParticipant,
  BlindRankingRoomState,
  createBlindRankingRoomState,
} from "../../lib/blindRankingRoom";
import { generateBlindRankingRoomCode } from "./roomCode";

const ROOT = path.join(os.tmpdir(), "anime-draft", "blind-ranking");

function roomPath(code: string) {
  return path.join(ROOT, `${code}.json`);
}

async function roomExists(code: string) {
  try {
    await fs.access(roomPath(code));
    return true;
  } catch {
    return false;
  }
}

export async function loadBlindRankingRoom(code: string) {
  try {
    const json = await fs.readFile(roomPath(code), "utf8");
    return JSON.parse(json) as BlindRankingRoomState;
  } catch {
    return null;
  }
}

export async function createBlindRankingRoom(
  config: BlindRankingConfig,
  host: BlindRankingParticipant
) {
  await fs.mkdir(ROOT, { recursive: true });
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateBlindRankingRoomCode();
    if (await roomExists(code)) continue;
    const room = createBlindRankingRoomState(code, config, host);
    await fs.writeFile(roomPath(code), JSON.stringify(room, null, 2), "utf8");
    return room;
  }
  throw new Error("Could not create a unique room code.");
}

export async function saveBlindRankingRoom(
  room: BlindRankingRoomState,
  expectedVersion?: number
) {
  if (expectedVersion !== undefined && room.version !== expectedVersion) {
    throw new Error("Optimistic lock failed: The room changed.");
  }
  room.version += 1;
  room.updatedAt = new Date().toISOString();
  await fs.writeFile(roomPath(room.code), JSON.stringify(room, null, 2), "utf8");
}

export async function withBlindRankingRoom(
  code: string,
  mutate: (room: BlindRankingRoomState) => void | Promise<void>
) {
  const room = await loadBlindRankingRoom(code);
  if (!room) throw new Error("Room not found.");
  const versionBefore = room.version;
  await mutate(room);
  await saveBlindRankingRoom(room, versionBefore);
  return room;
}
