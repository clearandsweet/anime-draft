import { env } from "cloudflare:workers";
import {
  DraftPreset,
  LobbyState,
  finishDraft,
  isDraftPreset,
  makeFreshLobby,
  recomputeDraftedIds,
} from "./logic";
import {
  VoteRecord,
  VotesState,
  normalizeVotesState,
  tallyVotes,
} from "./votesLogic";
import { generateManageKey, hashManageKey, verifyManageKey } from "./manageKey";

type LobbyMeta = {
  id: string;
  createdAt: string;
  updatedAt: string;
  hostName: string | null;
  status: "active" | "completed";
  playersCount: number;
  lastPickAt: string | null;
  manageKeyHash?: string;
  draftType?: "anime" | "pokemon";
  preset?: DraftPreset;
};

type LobbyRow = {
  id: number;
  state_json: string;
  created_at: string;
  updated_at: string;
  host_name: string | null;
  status: "active" | "completed";
  players_count: number;
  last_pick_at: string | null;
  manage_key_hash: string | null;
  draft_type: "anime" | "pokemon";
  version: number;
};

type LobbyListRow = Omit<LobbyRow, "state_json" | "manage_key_hash" | "version"> & {
  preset: string | null;
};

type VoteRow = {
  id: string;
  ip_hash: string;
  first: string | null;
  second: string | null;
  third: string | null;
  created_at: string;
};

export type PublicLobbyMeta = Omit<LobbyMeta, "manageKeyHash"> & {
  draftType?: "anime" | "pokemon";
  preset?: DraftPreset;
};

const ACTIVE_LOBBY_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

function getDb(): D1Database {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB`."
    );
  }
  return env.DB;
}

function toNumericLobbyId(id: string): number {
  const numericId = Number(id);
  if (!Number.isSafeInteger(numericId) || numericId <= 0) {
    throw new Error("Invalid lobby ID.");
  }
  return numericId;
}

function computeStatus(state: LobbyState): "active" | "completed" {
  if (state.completedAt) return "completed";
  const allFilled =
    state.players.length > 0 &&
    state.players.every((player) =>
      Object.values(player.slots).every((slot) => slot !== null)
    );
  return allFilled ? "completed" : "active";
}

function normalizeLobbyState(state: LobbyState): LobbyState {
  if (!state.draftedIds) state.draftedIds = [];
  if (state.startedAt === undefined) state.startedAt = null;
  if (state.completedAt === undefined) state.completedAt = null;
  if (state.version === undefined) state.version = 0;
  if (!state.draftType) state.draftType = "anime";
  if (!isDraftPreset(state.preset)) state.preset = "classic";
  if (!Number.isFinite(state.timerDuration) || state.timerDuration <= 0) {
    state.timerDuration = 300;
  }
  if (state.lastTickAt === undefined) state.lastTickAt = Date.now();
  if (state.isPaused === undefined) state.isPaused = false;
  return state;
}

function parseState(row: Pick<LobbyRow, "state_json" | "version">): LobbyState {
  const state = normalizeLobbyState(JSON.parse(row.state_json) as LobbyState);
  state.version = row.version;
  return state;
}

async function getLobbyRow(id: string): Promise<LobbyRow | null> {
  return (
    (await getDb()
      .prepare(
        `SELECT id, state_json, created_at, updated_at, host_name, status,
                players_count, last_pick_at, manage_key_hash, draft_type, version
           FROM lobbies
          WHERE id = ?`
      )
      .bind(toNumericLobbyId(id))
      .first<LobbyRow>()) ?? null
  );
}

export async function createLobby(opts?: {
  hostName?: string;
  targetPlayers?: number;
  draftType?: "anime" | "pokemon";
  preset?: DraftPreset;
}): Promise<{ id: string; state: LobbyState; manageKey: string }> {
  await cleanupStaleLobbies();

  const now = new Date().toISOString();
  const manageKey = generateManageKey();
  const state = makeFreshLobby(opts?.draftType ?? "anime", opts?.preset ?? "classic");

  if (opts?.targetPlayers && [2, 4, 8, 12].includes(opts.targetPlayers)) {
    state.targetPlayers = opts.targetPlayers;
  }
  if (opts?.hostName) {
    state.hostName = opts.hostName.trim() || null;
  }

  const result = await getDb()
    .prepare(
      `INSERT INTO lobbies (
         state_json, created_at, updated_at, host_name, status, players_count,
         last_pick_at, manage_key_hash, draft_type, version
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      JSON.stringify(state),
      now,
      now,
      state.hostName,
      computeStatus(state),
      state.players.length,
      null,
      hashManageKey(manageKey),
      state.draftType,
      state.version
    )
    .run();

  const lastRowId = Number(result.meta.last_row_id);
  if (!Number.isSafeInteger(lastRowId) || lastRowId <= 0) {
    throw new Error("Unable to create lobby ID.");
  }

  return { id: String(lastRowId), state, manageKey };
}

export async function loadLobby(id: string): Promise<LobbyState> {
  const row = await getLobbyRow(id);
  return row ? parseState(row) : makeFreshLobby();
}

export async function loadLobbyIfExists(id: string): Promise<LobbyState | null> {
  const row = await getLobbyRow(id);
  return row ? parseState(row) : null;
}

export async function saveLobby(
  id: string,
  state: LobbyState,
  expectedVersion?: number
) {
  const numericId = toNumericLobbyId(id);
  const current = await getLobbyRow(id);
  const now = new Date().toISOString();

  recomputeDraftedIds(state);

  if (!current) {
    await getDb()
      .prepare(
        `INSERT INTO lobbies (
           id, state_json, created_at, updated_at, host_name, status,
           players_count, last_pick_at, manage_key_hash, draft_type, version
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        numericId,
        JSON.stringify(state),
        now,
        now,
        state.hostName,
        computeStatus(state),
        state.players.length,
        state.lastPick ? now : null,
        null,
        state.draftType,
        state.version
      )
      .run();
    return;
  }

  if (expectedVersion !== undefined && state.version <= expectedVersion) {
    state.version = expectedVersion + 1;
  }

  const nextLastPickAt = state.lastPick ? now : current.last_pick_at;
  const statement =
    expectedVersion === undefined
      ? getDb()
          .prepare(
            `UPDATE lobbies
                SET state_json = ?, updated_at = ?, host_name = ?, status = ?,
                    players_count = ?, last_pick_at = ?, draft_type = ?, version = ?
              WHERE id = ?`
          )
          .bind(
            JSON.stringify(state),
            now,
            state.hostName,
            computeStatus(state),
            state.players.length,
            nextLastPickAt,
            state.draftType,
            state.version,
            numericId
          )
      : getDb()
          .prepare(
            `UPDATE lobbies
                SET state_json = ?, updated_at = ?, host_name = ?, status = ?,
                    players_count = ?, last_pick_at = ?, draft_type = ?, version = ?
              WHERE id = ? AND version = ?`
          )
          .bind(
            JSON.stringify(state),
            now,
            state.hostName,
            computeStatus(state),
            state.players.length,
            nextLastPickAt,
            state.draftType,
            state.version,
            numericId,
            expectedVersion
          );

  const result = await statement.run();
  if (result.meta.changes === 0) {
    throw new Error(
      "Optimistic lock failed: Data has changed since you loaded it."
    );
  }
}

export async function listLobbies(filter?: {
  status?: "active" | "completed";
  draftType?: "anime" | "pokemon";
}) {
  await cleanupStaleLobbies();

  const conditions: string[] = [];
  const bindings: string[] = [];
  if (filter?.status) {
    conditions.push("status = ?");
    bindings.push(filter.status);
  }
  if (filter?.draftType) {
    conditions.push("draft_type = ?");
    bindings.push(filter.draftType);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const statement = getDb().prepare(
    `SELECT id, created_at, updated_at, host_name, status, players_count,
            last_pick_at, draft_type, json_extract(state_json, '$.preset') AS preset
       FROM lobbies
       ${where}
      ORDER BY updated_at DESC`
  );
  const { results } = await (bindings.length
    ? statement.bind(...bindings)
    : statement
  ).all<LobbyListRow>();

  return results.map(
    (row): PublicLobbyMeta => ({
      id: String(row.id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      hostName: row.host_name,
      status: row.status,
      playersCount: row.players_count,
      lastPickAt: row.last_pick_at,
      draftType: row.draft_type ?? "anime",
      preset: isDraftPreset(row.preset) ? row.preset : "classic",
    })
  );
}

export async function getVotesState(id: string): Promise<VotesState> {
  const { results } = await getDb()
    .prepare(
      `SELECT id, ip_hash, first, second, third, created_at
         FROM votes
        WHERE lobby_id = ?
        ORDER BY created_at ASC`
    )
    .bind(toNumericLobbyId(id))
    .all<VoteRow>();

  return normalizeVotesState({
    records: results.map((row) => ({
      id: row.id,
      ipHash: row.ip_hash,
      first: row.first,
      second: row.second,
      third: row.third,
      createdAt: row.created_at,
    })),
  });
}

export async function recordVote(
  id: string,
  record: VoteRecord
): Promise<{ ok: boolean; already?: boolean; error?: string }> {
  if (!record.ipHash) {
    return { ok: false, error: "Missing vote fingerprint." };
  }

  try {
    await getDb()
      .prepare(
        `INSERT INTO votes (
           id, lobby_id, ip_hash, first, second, third, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        record.id,
        toNumericLobbyId(id),
        record.ipHash,
        record.first,
        record.second,
        record.third,
        record.createdAt
      )
      .run();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/unique|constraint/i.test(message)) {
      return { ok: false, already: true, error: "Duplicate vote." };
    }
    throw error;
  }
}

export async function summarizeVotesFor(id: string, playerIds: string[]) {
  const state = await getVotesState(id);
  const summary = tallyVotes(state.records, playerIds);
  return { ...summary, records: state.records };
}

export async function completeLobby(id: string, requesterName: string) {
  let result: { ok: boolean; error?: string } = { ok: true };
  const state = await withLobby(id, (draftState) => {
    result = finishDraft(draftState, requesterName);
  });
  return { state, result };
}

export async function deleteLobby(id: string) {
  const numericId = toNumericLobbyId(id);
  const db = getDb();
  await db.batch([
    db.prepare("DELETE FROM votes WHERE lobby_id = ?").bind(numericId),
    db.prepare("DELETE FROM lobbies WHERE id = ?").bind(numericId),
  ]);
}

export async function authorizeLobbyDelete(id: string, manageKey: string) {
  const row = await getLobbyRow(id);
  if (!row) return false;
  return verifyManageKey(manageKey, row.manage_key_hash);
}

async function cleanupStaleLobbies() {
  const activeCutoff = new Date(Date.now() - ACTIVE_LOBBY_MAX_AGE_MS).toISOString();
  const db = getDb();

  await db.batch([
    db
      .prepare(
        `DELETE FROM votes
          WHERE lobby_id IN (
            SELECT id FROM lobbies
             WHERE status = 'active' AND updated_at < ?
          )`
      )
      .bind(activeCutoff),
    db
      .prepare(
        "DELETE FROM lobbies WHERE status = 'active' AND updated_at < ?"
      )
      .bind(activeCutoff),
  ]);
}

export async function withLobby(
  id: string,
  mutate: (state: LobbyState) => void | Promise<void>
): Promise<LobbyState> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const state = await loadLobby(id);
    const versionBefore = state.version;
    await mutate(state);

    try {
      await saveLobby(id, state, versionBefore);
      return state;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === 0 && message.includes("Optimistic lock failed")) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Unable to update lobby.");
}
