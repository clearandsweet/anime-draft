import { kv } from "@vercel/kv";
import * as fsStore from "./fs";
import {
  LobbyState,
  makeFreshLobby,
  recomputeDraftedIds,
  finishDraft,
} from "./logic";
import { VotesState, VoteRecord, normalizeVotesState, tallyVotes } from "./votesLogic";
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
};

export type PublicLobbyMeta = Omit<LobbyMeta, "manageKeyHash">;

function computeStatus(state: LobbyState): "active" | "completed" {
  if (state.completedAt) return "completed";
  const allFilled = state.players.every((p) =>
    Object.values(p.slots).every((v) => v !== null)
  );
  return allFilled ? "completed" : "active";
}

const INDEX_KEY = "lobby:index"; // zset of ids scored by updatedAt (epoch millis)
const NEXT_ID_KEY = "lobby:nextId"; // incr counter

function stateKey(id: string) {
  return `lobby:state:${id}`;
}
function metaKey(id: string) {
  return `lobby:meta:${id}`;
}
function votesKey(id: string) {
  return `lobby:votes:${id}`;
}

const ACTIVE_LOBBY_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const COMPLETED_LOBBY_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days


function hasKVEnv() {
  const vercelKV = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
  const upstash = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(vercelKV || upstash);
}

export async function createLobby(opts?: {
  hostName?: string;
  targetPlayers?: number;
}): Promise<{ id: string; state: LobbyState; manageKey: string }> {
  if (!hasKVEnv()) {
    return fsStore.createLobby(opts);
  }
  await cleanupStaleLobbies();
  const next = await kv.incr(NEXT_ID_KEY);
  const id = String(next);
  const now = new Date().toISOString();
  const nowScore = Date.now();
  const manageKey = generateManageKey();

  const state = makeFreshLobby();
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
  };

  await Promise.all([
    kv.set(stateKey(id), state),
    kv.set(metaKey(id), meta),
    kv.zadd(INDEX_KEY, { score: nowScore, member: id }),
  ]);

  return { id, state, manageKey };
}

export async function loadLobby(id: string): Promise<LobbyState> {
  if (!hasKVEnv()) {
    return fsStore.loadLobby(id);
  }
  const state = (await kv.get<LobbyState>(stateKey(id))) || makeFreshLobby();
  if (!state.draftedIds) state.draftedIds = [];
  if (state.startedAt === undefined) state.startedAt = null;
  if (state.completedAt === undefined) state.completedAt = null;
  if (state.version === undefined) state.version = 0;
  return state;
}

export async function saveLobby(id: string, state: LobbyState, expectedVersion?: number) {
  if (!hasKVEnv()) {
    return fsStore.saveLobby(id, state);
  }

  // Optimistic locking check
  if (expectedVersion !== undefined) {
    const current = await kv.get<LobbyState>(stateKey(id));
    if (current && current.version !== expectedVersion) {
      throw new Error("Optimistic lock failed: Data has changed since you loaded it.");
    }
  }

  recomputeDraftedIds(state);
  const now = new Date().toISOString();
  const nowScore = Date.now();
  await kv.set(stateKey(id), state);
  const existingMeta = (await kv.get<LobbyMeta>(metaKey(id))) || null;
  const meta: LobbyMeta = {
    id,
    createdAt: existingMeta?.createdAt || now,
    updatedAt: now,
    hostName: state.hostName,
    status: computeStatus(state),
    playersCount: state.players.length,
    lastPickAt: state.lastPick ? now : existingMeta?.lastPickAt || null,
  };
  await Promise.all([
    kv.set(metaKey(id), meta),
    kv.zadd(INDEX_KEY, { score: nowScore, member: id }),
  ]);
}

export async function listLobbies(filter?: { status?: "active" | "completed" }) {
  if (!hasKVEnv()) {
    return fsStore.listLobbies(filter);
  }
  await cleanupStaleLobbies();
  // newest first
  const ids = (await kv.zrange(INDEX_KEY, 0, -1, { rev: true })) as string[];
  if (!ids.length) return [];
  const metas = (await kv.mget(
    ...ids.map((id) => metaKey(id))
  )) as (LobbyMeta | null)[];
  const list: PublicLobbyMeta[] = metas
    .filter((m): m is LobbyMeta => !!m)
    .map((meta) => ({
      id: meta.id,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      hostName: meta.hostName,
      status: meta.status,
      playersCount: meta.playersCount,
      lastPickAt: meta.lastPickAt,
    }));
  return filter?.status ? list.filter((m) => m.status === filter.status) : list;
}

export async function getVotesState(id: string): Promise<VotesState> {
  if (!hasKVEnv()) {
    return fsStore.getVotesState(id);
  }
  const raw = await kv.get<VotesState>(votesKey(id));
  return normalizeVotesState(raw || null);
}

async function saveVotesState(id: string, state: VotesState) {
  if (!hasKVEnv()) {
    await fsStore.saveVotesState(id, state);
    return;
  }
  await kv.set(votesKey(id), state);
}

export async function recordVote(
  id: string,
  record: VoteRecord
): Promise<{ ok: boolean; already?: boolean; error?: string }> {
  if (!record.ipHash) {
    return { ok: false, error: "Missing vote fingerprint." };
  }
  if (!hasKVEnv()) {
    return fsStore.recordVote(id, record);
  }
  const current = await getVotesState(id);
  if (current.records.some((r) => r.ipHash === record.ipHash)) {
    return { ok: false, already: true, error: "Duplicate vote." };
  }
  current.records.push(record);
  await saveVotesState(id, current);
  return { ok: true };
}

export async function summarizeVotesFor(id: string, playerIds: string[]) {
  const state = await getVotesState(id);
  const summary = tallyVotes(state.records, playerIds);
  return { ...summary, records: state.records };
}

export async function completeLobby(id: string, requesterName: string) {
  if (!hasKVEnv()) {
    return fsStore.finishLobby(id, requesterName);
  }
  let result: { ok: boolean; error?: string } = { ok: true };
  const state = await withLobby(id, (s) => {
    const outcome = finishDraft(s, requesterName);
    result = outcome;
  });
  return { state, result };
}

export async function deleteLobby(id: string) {
  if (!hasKVEnv()) {
    return fsStore.deleteLobby(id);
  }
  await Promise.all([
    kv.del(stateKey(id)),
    kv.del(metaKey(id)),
    kv.zrem(INDEX_KEY, id),
  ]);
}

export async function authorizeLobbyDelete(id: string, manageKey: string) {
  if (!hasKVEnv()) {
    return fsStore.authorizeLobbyDelete(id, manageKey);
  }
  const meta = await kv.get<LobbyMeta>(metaKey(id));
  if (!meta) return false;
  return verifyManageKey(manageKey, meta.manageKeyHash);
}

async function cleanupStaleLobbies() {
  const ids = (await kv.zrange(INDEX_KEY, 0, -1)) as string[];
  if (!ids.length) return;
  const metas = (await kv.mget(...ids.map((id) => metaKey(id)))) as (LobbyMeta | null)[];
  const now = Date.now();
  const staleIds: string[] = [];

  for (const meta of metas) {
    if (!meta) continue;
    const updatedAtMs = Date.parse(meta.updatedAt || meta.createdAt);
    if (!Number.isFinite(updatedAtMs)) continue;
    const ageMs = now - updatedAtMs;
    const maxAgeMs =
      meta.status === "completed" ? COMPLETED_LOBBY_MAX_AGE_MS : ACTIVE_LOBBY_MAX_AGE_MS;
    if (ageMs > maxAgeMs) staleIds.push(meta.id);
  }

  if (!staleIds.length) return;

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
  if (!hasKVEnv()) {
    return fsStore.withLobby(id, mutate);
  }
  const state = await loadLobby(id);
  const versionBefore = state.version;
  await mutate(state);
  await saveLobby(id, state, versionBefore);
  return state;
}









