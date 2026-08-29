import { kv } from "@vercel/kv";
import * as fsStore from "./fs";
import {
  type DraftPreset,
  type LobbyState,
  finishDraft,
  isDraftPreset,
  makeFreshLobby,
  recomputeDraftedIds,
} from "./logic";
import {
  type VoteRecord,
  type VotesState,
  normalizeVotesState,
  tallyVotes,
} from "./votesLogic";
import {
  generateManageKey,
  hashManageKey,
  verifyLobbyDeleteCredential,
} from "./manageKey";
import { normalizeReadyPlayerIds } from "../../lib/draftReadiness";
import {
  shouldDeleteStaleEmptyLobby,
} from "../../lib/lobbyRetention";
import { getRuntimeLobbyDeletePassword } from "../runtimeStorage";

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

export type PublicLobbyMeta = Omit<LobbyMeta, "manageKeyHash">;

const INDEX_KEY = "lobby:index";
const NEXT_ID_KEY = "lobby:nextId";
function stateKey(id: string) {
  return `lobby:state:${id}`;
}

function metaKey(id: string) {
  return `lobby:meta:${id}`;
}

function votesKey(id: string) {
  return `lobby:votes:${id}`;
}

function hasKVEnv() {
  const vercelKV =
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
  const upstash =
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(vercelKV || upstash);
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
  state.readyPlayerIds = normalizeReadyPlayerIds(
    state.readyPlayerIds,
    state.players ?? []
  );
  if (state.startedAt === undefined) state.startedAt = null;
  if (state.completedAt === undefined) state.completedAt = null;
  if (state.orderShuffled === undefined) state.orderShuffled = false;
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

async function fsLobbyExists(id: string) {
  const lobbies = await fsStore.listLobbies();
  return lobbies.some((lobby) => lobby.id === id);
}

export async function createLobby(opts?: {
  hostName?: string;
  targetPlayers?: number;
  draftType?: "anime" | "pokemon";
  preset?: DraftPreset;
}): Promise<{ id: string; state: LobbyState; manageKey: string }> {
  if (!hasKVEnv()) {
    const created = await fsStore.createLobby(opts);
    created.state.preset = opts?.preset ?? "classic";
    await fsStore.saveLobby(created.id, created.state);
    return created;
  }

  await cleanupStaleLobbies();
  const id = String(await kv.incr(NEXT_ID_KEY));
  const now = new Date().toISOString();
  const manageKey = generateManageKey();
  const state = makeFreshLobby(
    opts?.draftType ?? "anime",
    opts?.preset ?? "classic"
  );

  if (opts?.targetPlayers && [2, 4, 8, 12].includes(opts.targetPlayers)) {
    state.targetPlayers = opts.targetPlayers;
  }
  if (opts?.hostName) state.hostName = opts.hostName.trim() || null;

  const meta: LobbyMeta = {
    id,
    createdAt: now,
    updatedAt: now,
    hostName: state.hostName,
    status: computeStatus(state),
    playersCount: state.players.length,
    lastPickAt: null,
    manageKeyHash: hashManageKey(manageKey),
    draftType: state.draftType,
    preset: state.preset,
  };

  await Promise.all([
    kv.set(stateKey(id), state),
    kv.set(metaKey(id), meta),
    kv.zadd(INDEX_KEY, { score: Date.now(), member: id }),
  ]);

  return { id, state, manageKey };
}

export async function loadLobby(id: string): Promise<LobbyState> {
  if (!hasKVEnv()) return fsStore.loadLobby(id);
  const state = await kv.get<LobbyState>(stateKey(id));
  return state ? normalizeLobbyState(state) : makeFreshLobby();
}

export async function loadLobbyIfExists(
  id: string
): Promise<LobbyState | null> {
  if (!hasKVEnv()) {
    return (await fsLobbyExists(id)) ? fsStore.loadLobby(id) : null;
  }
  const state = await kv.get<LobbyState>(stateKey(id));
  return state ? normalizeLobbyState(state) : null;
}

export async function saveLobby(
  id: string,
  state: LobbyState,
  expectedVersion?: number
) {
  if (!hasKVEnv()) return fsStore.saveLobby(id, state);

  const current = await kv.get<LobbyState>(stateKey(id));
  if (
    expectedVersion !== undefined &&
    current &&
    current.version !== expectedVersion
  ) {
    throw new Error(
      "Optimistic lock failed: Data has changed since you loaded it."
    );
  }
  if (expectedVersion !== undefined && state.version <= expectedVersion) {
    state.version = expectedVersion + 1;
  }

  recomputeDraftedIds(state);
  const now = new Date().toISOString();
  const existingMeta = await kv.get<LobbyMeta>(metaKey(id));
  const meta: LobbyMeta = {
    id,
    createdAt: existingMeta?.createdAt ?? now,
    updatedAt: now,
    hostName: state.hostName,
    status: computeStatus(state),
    playersCount: state.players.length,
    lastPickAt: state.lastPick ? now : existingMeta?.lastPickAt ?? null,
    manageKeyHash: existingMeta?.manageKeyHash,
    draftType: state.draftType ?? existingMeta?.draftType ?? "anime",
    preset: isDraftPreset(state.preset) ? state.preset : "classic",
  };

  await Promise.all([
    kv.set(stateKey(id), state),
    kv.set(metaKey(id), meta),
    kv.zadd(INDEX_KEY, { score: Date.now(), member: id }),
  ]);
}

export async function listLobbies(filter?: {
  status?: "active" | "completed";
  draftType?: "anime" | "pokemon";
}) {
  if (!hasKVEnv()) {
    const lobbies = await fsStore.listLobbies(filter);
    return lobbies.map((lobby) => ({ ...lobby, preset: "classic" as const }));
  }

  await cleanupStaleLobbies();
  const ids = (await kv.zrange(INDEX_KEY, 0, -1, {
    rev: true,
  })) as string[];
  if (!ids.length) return [];
  const metas = (await kv.mget(
    ...ids.map((id) => metaKey(id))
  )) as (LobbyMeta | null)[];

  let result = metas
    .filter((meta): meta is LobbyMeta => Boolean(meta))
    .map(
      (meta): PublicLobbyMeta => ({
        id: meta.id,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        hostName: meta.hostName,
        status: meta.status,
        playersCount: meta.playersCount,
        lastPickAt: meta.lastPickAt,
        draftType: meta.draftType ?? "anime",
        preset: isDraftPreset(meta.preset) ? meta.preset : "classic",
      })
    );
  if (filter?.status) {
    result = result.filter((lobby) => lobby.status === filter.status);
  }
  if (filter?.draftType) {
    result = result.filter(
      (lobby) => (lobby.draftType ?? "anime") === filter.draftType
    );
  }
  return result;
}

export async function getVotesState(id: string): Promise<VotesState> {
  if (!hasKVEnv()) return fsStore.getVotesState(id);
  return normalizeVotesState((await kv.get<VotesState>(votesKey(id))) ?? null);
}

export async function recordVote(
  id: string,
  record: VoteRecord
): Promise<{ ok: boolean; already?: boolean; error?: string }> {
  if (!record.ipHash) {
    return { ok: false, error: "Missing vote fingerprint." };
  }
  if (!hasKVEnv()) return fsStore.recordVote(id, record);

  const current = await getVotesState(id);
  if (current.records.some((entry) => entry.ipHash === record.ipHash)) {
    return { ok: false, already: true, error: "Duplicate vote." };
  }
  current.records.push(record);
  await kv.set(votesKey(id), current);
  return { ok: true };
}

export async function summarizeVotesFor(id: string, playerIds: string[]) {
  const state = await getVotesState(id);
  const summary = tallyVotes(state.records, playerIds);
  return { ...summary, records: state.records };
}

export async function completeLobby(id: string, requesterName: string) {
  if (!hasKVEnv()) return fsStore.finishLobby(id, requesterName);
  let result: { ok: boolean; error?: string } = { ok: true };
  const state = await withLobby(id, (draftState) => {
    result = finishDraft(draftState, requesterName);
  });
  return { state, result };
}

export async function deleteLobby(id: string) {
  if (!hasKVEnv()) return fsStore.deleteLobby(id);
  await Promise.all([
    kv.del(stateKey(id)),
    kv.del(metaKey(id)),
    kv.del(votesKey(id)),
    kv.zrem(INDEX_KEY, id),
  ]);
}

export async function authorizeLobbyDelete(id: string, manageKey: string) {
  if (!hasKVEnv()) return fsStore.authorizeLobbyDelete(id, manageKey);
  const meta = await kv.get<LobbyMeta>(metaKey(id));
  return Boolean(
    meta &&
      verifyLobbyDeleteCredential(
        manageKey,
        meta.manageKeyHash,
        getRuntimeLobbyDeletePassword()
      )
  );
}

async function cleanupStaleLobbies() {
  const ids = (await kv.zrange(INDEX_KEY, 0, -1)) as string[];
  if (!ids.length) return;
  const metas = (await kv.mget(
    ...ids.map((id) => metaKey(id))
  )) as (LobbyMeta | null)[];
  const now = Date.now();
  const staleIds = metas.flatMap((meta) => {
    if (!meta) return [];
    return shouldDeleteStaleEmptyLobby(meta, now) ? [meta.id] : [];
  });

  await Promise.all(
    staleIds.flatMap((id) => [
      kv.del(stateKey(id)),
      kv.del(metaKey(id)),
      kv.del(votesKey(id)),
      kv.zrem(INDEX_KEY, id),
    ])
  );
}

export async function withLobby(
  id: string,
  mutate: (state: LobbyState) => void | Promise<void>
): Promise<LobbyState> {
  if (!hasKVEnv()) return fsStore.withLobby(id, mutate);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const state = await loadLobby(id);
    const versionBefore = state.version;
    await mutate(state);
    try {
      await saveLobby(id, state, versionBefore);
      return state;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === 0 && message.includes("Optimistic lock failed")) continue;
      throw error;
    }
  }

  throw new Error("Unable to update lobby.");
}
