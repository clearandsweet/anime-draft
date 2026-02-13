import fs from "fs/promises";
import path from "path";
import os from "os";
import {
  LobbyState,
  makeFreshLobby,
  recomputeDraftedIds,
  finishDraft as finishDraftState,
} from "./logic";
import { VotesState, VoteRecord, normalizeVotesState } from "./votesLogic";
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

type IndexFile = {
  nextId: number;
  list: LobbyMeta[];
};

// On serverless platforms (e.g., Vercel), only /tmp is writable.
// Allow override via env LOBBIES_DIR, otherwise fall back to OS tmpdir.
const ROOT = process.env.LOBBIES_DIR
  ? path.resolve(process.env.LOBBIES_DIR)
  : path.join(os.tmpdir(), "anime-draft", "lobbies");
const INDEX = path.join(ROOT, "index.json");
const ACTIVE_LOBBY_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const COMPLETED_LOBBY_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function lobbyPath(id: string) {
  return path.join(ROOT, `${id}.json`);
}


async function ensureStorage() {
  await fs.mkdir(ROOT, { recursive: true });
  try {
    await fs.access(INDEX);
  } catch {
    const init: IndexFile = { nextId: 1, list: [] };
    await fs.writeFile(INDEX, JSON.stringify(init, null, 2), "utf8");
  }
}

async function readIndex(): Promise<IndexFile> {
  await ensureStorage();
  const buf = await fs.readFile(INDEX, "utf8");
  return JSON.parse(buf) as IndexFile;
}

async function writeIndex(idx: IndexFile) {
  await fs.writeFile(INDEX, JSON.stringify(idx, null, 2), "utf8");
}

function votesPath(id: string) {
  return path.join(ROOT, `${id}-votes.json`);
}

function computeStatus(state: LobbyState): "active" | "completed" {
  if (state.completedAt) return "completed";
  // completed when every slot is filled for every player
  const allFilled = state.players.every((p) =>
    Object.values(p.slots).every((v) => v !== null)
  );
  return allFilled ? "completed" : "active";
}

export async function createLobby(opts?: {
  hostName?: string;
  targetPlayers?: number;
}): Promise<{ id: string; state: LobbyState; manageKey: string }>
{
  await cleanupStaleLobbies();
  const idx = await readIndex();
  const id = String(idx.nextId++);
  const now = new Date().toISOString();
  const manageKey = generateManageKey();
  const state = makeFreshLobby();
  if (opts?.targetPlayers && [2,4,8,12].includes(opts.targetPlayers)) {
    state.targetPlayers = opts.targetPlayers;
  }
  if (opts?.hostName) {
    // host becomes first joiner
    state.hostName = opts.hostName.trim() || null;
    if (state.hostName) {
      // Defer actual join to client or keep hostName only; we keep hostName only
    }
  }

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
  idx.list.push(meta);
  await writeIndex(idx);
  await fs.writeFile(lobbyPath(id), JSON.stringify(state, null, 2), "utf8");
  return { id, state, manageKey };
}

export async function loadLobby(id: string): Promise<LobbyState> {
  await ensureStorage();
  const p = lobbyPath(id);
  try {
    const buf = await fs.readFile(p, "utf8");
    const state = JSON.parse(buf) as LobbyState;
    if (!state.draftedIds) state.draftedIds = [];
    if (state.startedAt === undefined) state.startedAt = null;
    if (state.completedAt === undefined) state.completedAt = null;
    return state;
  } catch {
    // If not found (e.g., another instance handled creation), start a fresh lobby
    const fresh = makeFreshLobby();
    return fresh;
  }
}

export async function saveLobby(id: string, state: LobbyState) {
  // keep computed fields fresh
  recomputeDraftedIds(state);
  await fs.writeFile(lobbyPath(id), JSON.stringify(state, null, 2), "utf8");

  const idx = await readIndex();
  let meta = idx.list.find((m) => m.id === id);
  const now = new Date().toISOString();
  if (!meta) {
    // Ensure an index entry exists even if this instance didn't create it
    meta = {
      id,
      createdAt: now,
      updatedAt: now,
      hostName: state.hostName,
      status: computeStatus(state),
      playersCount: state.players.length,
      lastPickAt: state.lastPick ? now : null,
    };
    idx.list.push(meta);
  } else {
    meta.updatedAt = now;
    meta.hostName = state.hostName;
    meta.status = computeStatus(state);
    meta.playersCount = state.players.length;
    meta.lastPickAt = state.lastPick ? now : meta.lastPickAt;
  }
  await writeIndex(idx);
}

export async function listLobbies(filter?: { status?: "active" | "completed" }) {
  await cleanupStaleLobbies();
  const idx = await readIndex();
  const list = filter?.status
    ? idx.list.filter((m) => m.status === filter.status)
    : idx.list;
  // newest first
  return [...list]
    .sort((a, b) => (a.id < b.id ? 1 : -1))
    .map((meta) => ({
      id: meta.id,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      hostName: meta.hostName,
      status: meta.status,
      playersCount: meta.playersCount,
      lastPickAt: meta.lastPickAt,
    }));
}

export async function getVotesState(id: string): Promise<VotesState> {
  await ensureStorage();
  try {
    const buf = await fs.readFile(votesPath(id), "utf8");
    const parsed = JSON.parse(buf) as VotesState;
    return normalizeVotesState(parsed);
  } catch {
    return normalizeVotesState(null);
  }
}

export async function saveVotesState(id: string, state: VotesState) {
  await ensureStorage();
  await fs.writeFile(votesPath(id), JSON.stringify(state, null, 2), "utf8");
}

export async function recordVote(
  id: string,
  record: VoteRecord
): Promise<{ ok: boolean; already?: boolean; error?: string }> {
  const state = await getVotesState(id);
  if (state.records.some((r) => r.ipHash === record.ipHash)) {
    return { ok: false, already: true, error: "Duplicate vote." };
  }
  state.records.push(record);
  await saveVotesState(id, state);
  return { ok: true };
}

export async function deleteLobby(id: string) {
  await ensureStorage();
  try { await fs.unlink(lobbyPath(id)); } catch {}
  try { await fs.unlink(votesPath(id)); } catch {}
  const idx = await readIndex();
  idx.list = idx.list.filter((m) => m.id !== id);
  await writeIndex(idx);
}

export async function authorizeLobbyDelete(id: string, manageKey: string) {
  const idx = await readIndex();
  const meta = idx.list.find((m) => m.id === id);
  if (!meta) return false;
  return verifyManageKey(manageKey, meta.manageKeyHash);
}

export async function finishLobby(id: string, requesterName: string) {
  let result: { ok: boolean; error?: string } = { ok: true };
  const state = await withLobby(id, async (state) => {
    result = finishDraftState(state, requesterName);
  });
  return { state, result };
}

export async function withLobby(
  id: string,
  mutate: (state: LobbyState) => void | Promise<void>
): Promise<LobbyState> {
  const state = await loadLobby(id);
  await mutate(state);
  await saveLobby(id, state);
  return state;
}

async function cleanupStaleLobbies() {
  const idx = await readIndex();
  const now = Date.now();
  const stale = idx.list.filter((meta) => {
    const updatedAtMs = Date.parse(meta.updatedAt || meta.createdAt);
    if (!Number.isFinite(updatedAtMs)) return false;
    const ageMs = now - updatedAtMs;
    const maxAgeMs =
      meta.status === "completed" ? COMPLETED_LOBBY_MAX_AGE_MS : ACTIVE_LOBBY_MAX_AGE_MS;
    return ageMs > maxAgeMs;
  });

  if (!stale.length) return;

  for (const meta of stale) {
    try {
      await fs.unlink(lobbyPath(meta.id));
    } catch {}
    try {
      await fs.unlink(votesPath(meta.id));
    } catch {}
  }

  const staleSet = new Set(stale.map((m) => m.id));
  idx.list = idx.list.filter((m) => !staleSet.has(m.id));
  await writeIndex(idx);
}










