import { getCloudflareDb } from "../runtimeStorage";
import { BlindRankingConfig } from "../../lib/blindRanking";
import {
  BlindRankingParticipant,
  BlindRankingRoomState,
  createBlindRankingRoomState,
} from "../../lib/blindRankingRoom";
import { generateBlindRankingRoomCode } from "./roomCode";

type RoomRow = {
  code: string;
  state_json: string;
  version: number;
};

let schemaPromise: Promise<void> | null = null;

function ensureSchema() {
  if (!schemaPromise) {
    const db = getCloudflareDb();
    schemaPromise = db
      .batch([
        db.prepare(`CREATE TABLE IF NOT EXISTS blind_ranking_rooms (
          code TEXT PRIMARY KEY NOT NULL,
          state_json TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'lobby',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 0
        )`),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS blind_ranking_rooms_updated_at_idx ON blind_ranking_rooms (updated_at)"
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

function parseRoom(row: RoomRow) {
  const room = JSON.parse(row.state_json) as BlindRankingRoomState;
  room.version = row.version;
  return room;
}

export async function loadBlindRankingRoom(code: string) {
  await ensureSchema();
  const row = await getCloudflareDb()
    .prepare(
      "SELECT code, state_json, version FROM blind_ranking_rooms WHERE code = ?"
    )
    .bind(code)
    .first<RoomRow>();
  return row ? parseRoom(row) : null;
}

export async function createBlindRankingRoom(
  config: BlindRankingConfig,
  host: BlindRankingParticipant
) {
  await ensureSchema();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateBlindRankingRoomCode();
    const room = createBlindRankingRoomState(code, config, host);
    try {
      await getCloudflareDb()
        .prepare(
          `INSERT INTO blind_ranking_rooms (
            code, state_json, status, created_at, updated_at, version
          ) VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(
          code,
          JSON.stringify(room),
          room.status,
          room.createdAt,
          room.updatedAt,
          room.version
        )
        .run();
      return room;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/unique|constraint/i.test(message)) throw error;
    }
  }
  throw new Error("Could not create a unique room code.");
}

export async function saveBlindRankingRoom(
  room: BlindRankingRoomState,
  expectedVersion?: number
) {
  await ensureSchema();
  const currentVersion = expectedVersion ?? room.version;
  room.version = currentVersion + 1;
  room.updatedAt = new Date().toISOString();
  const result = await getCloudflareDb()
    .prepare(
      `UPDATE blind_ranking_rooms
          SET state_json = ?, status = ?, updated_at = ?, version = ?
        WHERE code = ? AND version = ?`
    )
    .bind(
      JSON.stringify(room),
      room.status,
      room.updatedAt,
      room.version,
      room.code,
      currentVersion
    )
    .run();
  if (result.meta.changes === 0) {
    throw new Error("Optimistic lock failed: The room changed.");
  }
}

export async function withBlindRankingRoom(
  code: string,
  mutate: (room: BlindRankingRoomState) => void | Promise<void>
) {
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
