import { kv } from "@vercel/kv";
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

function computeStatus(state: LobbyState): "active" | "completed" {
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

export async function createLobby(opts?: {
  hostName?: string;
  targetPlayers?: number;
}): Promise<{ id: string; state: LobbyState }>
{
  const next = await kv.incr(NEXT_ID_KEY);
  const id = String(next);
  const now = new Date().toISOString();
  const nowScore = Date.now();

  const state = makeFreshLobby();
  if (opts?.targetPlayers && [2,4,8,12].includes(opts.targetPlayers)) {
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
  };

  await Promise.all([
    kv.set(stateKey(id), state),
    kv.set(metaKey(id), meta),
    kv.zadd(INDEX_KEY, { score: nowScore, member: id }),
  ]);

  return { id, state };
}

export async function loadLobby(id: string): Promise<LobbyState> {
  const state = (await kv.get<LobbyState>(stateKey(id))) || makeFreshLobby();
  if (!state.draftedIds) state.draftedIds = [];
  return state;
}

export async function saveLobby(id: string, state: LobbyState) {
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
  // newest first
  const ids = await kv.zrange<string>(INDEX_KEY, 0, -1, { rev: true });
  if (!ids.length) return [];
  const metas = await kv.mget<LobbyMeta>(...ids.map((id) => metaKey(id)));
  const list: LobbyMeta[] = metas.filter(Boolean) as LobbyMeta[];
  return filter?.status ? list.filter((m) => m.status === filter.status) : list;
}

export async function deleteLobby(id: string) {
  await Promise.all([
    kv.del(stateKey(id)),
    kv.del(metaKey(id)),
    kv.zrem(INDEX_KEY, id),
  ]);
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
