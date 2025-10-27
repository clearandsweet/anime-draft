import fs from "fs/promises";
import path from "path";
import {
  LobbyState,
  makeFreshLobby,
  recomputeDraftedIds,
} from "./logic";

type LobbyMeta = {
  id: string;
  createdAt: string;
  updatedAt: string;
  hostName: string | null;
  status: "active" | "completed";
  playersCount: number;
  lastPickAt: string | null;
};

type IndexFile = {
  nextId: number;
  list: LobbyMeta[];
};

const ROOT = path.join(process.cwd(), "data", "lobbies");
const INDEX = path.join(ROOT, "index.json");

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

function lobbyPath(id: string) {
  return path.join(ROOT, `${id}.json`);
}

function computeStatus(state: LobbyState): "active" | "completed" {
  // completed when every slot is filled for every player
  const allFilled = state.players.every((p) =>
    Object.values(p.slots).every((v) => v !== null)
  );
  return allFilled ? "completed" : "active";
}

export async function createLobby(opts?: {
  hostName?: string;
  targetPlayers?: number;
}): Promise<{ id: string; state: LobbyState }>
{
  const idx = await readIndex();
  const id = String(idx.nextId++);
  const now = new Date().toISOString();
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
  };
  idx.list.push(meta);
  await writeIndex(idx);
  await fs.writeFile(lobbyPath(id), JSON.stringify(state, null, 2), "utf8");
  return { id, state };
}

export async function loadLobby(id: string): Promise<LobbyState> {
  await ensureStorage();
  const p = lobbyPath(id);
  const buf = await fs.readFile(p, "utf8");
  const state = JSON.parse(buf) as LobbyState;
  if (!state.draftedIds) state.draftedIds = [];
  return state;
}

export async function saveLobby(id: string, state: LobbyState) {
  // keep computed fields fresh
  recomputeDraftedIds(state);
  await fs.writeFile(lobbyPath(id), JSON.stringify(state, null, 2), "utf8");

  const idx = await readIndex();
  const meta = idx.list.find((m) => m.id === id);
  const now = new Date().toISOString();
  if (meta) {
    meta.updatedAt = now;
    meta.hostName = state.hostName;
    meta.status = computeStatus(state);
    meta.playersCount = state.players.length;
    meta.lastPickAt = state.lastPick ? now : meta.lastPickAt;
    await writeIndex(idx);
  }
}

export async function listLobbies(filter?: { status?: "active" | "completed" }) {
  const idx = await readIndex();
  const list = filter?.status
    ? idx.list.filter((m) => m.status === filter.status)
    : idx.list;
  // newest first
  return [...list].sort((a, b) => (a.id < b.id ? 1 : -1));
}

export async function deleteLobby(id: string) {
  await ensureStorage();
  try { await fs.unlink(lobbyPath(id)); } catch {}
  const idx = await readIndex();
  idx.list = idx.list.filter((m) => m.id !== id);
  await writeIndex(idx);
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

