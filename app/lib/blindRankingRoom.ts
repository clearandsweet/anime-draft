import type {
  BlindRankingConfig,
  BlindRankingItem,
  BlindRankingSource,
} from "./blindRanking.ts";
import {
  createBlindRankingBoard,
  placeBlindRankingItem,
} from "./blindRanking.ts";

export type BlindRankingParticipant = {
  id: string;
  name: string;
  source: BlindRankingSource | null;
  tokenHash: string;
  joinedAt: string;
};

export type BlindRankingRoomState = {
  code: string;
  status: "lobby" | "playing" | "complete";
  hostParticipantId: string;
  participants: BlindRankingParticipant[];
  config: BlindRankingConfig;
  pool: BlindRankingItem[];
  board: (BlindRankingItem | null)[];
  currentIndex: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  lastAction: {
    participantName: string;
    itemTitle: string;
    slot: number;
  } | null;
  version: number;
};

export type PublicBlindRankingRoom = Omit<
  BlindRankingRoomState,
  "participants" | "pool"
> & {
  participants: Omit<BlindRankingParticipant, "tokenHash">[];
  currentItem: BlindRankingItem | null;
  totalItems: number;
};

export function createBlindRankingRoomState(
  code: string,
  config: BlindRankingConfig,
  host: BlindRankingParticipant
): BlindRankingRoomState {
  const now = new Date().toISOString();
  return {
    code,
    status: "lobby",
    hostParticipantId: host.id,
    participants: [host],
    config,
    pool: [],
    board: createBlindRankingBoard(config.count),
    currentIndex: 0,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    lastAction: null,
    version: 0,
  };
}

export function toPublicBlindRankingRoom(
  room: BlindRankingRoomState
): PublicBlindRankingRoom {
  const { participants, pool, ...publicRoom } = room;
  return {
    ...publicRoom,
    participants: participants.map((person) => ({
      id: person.id,
      name: person.name,
      source: person.source,
      joinedAt: person.joinedAt,
    })),
    currentItem: pool[room.currentIndex] ?? null,
    totalItems: pool.length || room.config.count,
  };
}

export function addBlindRankingParticipant(
  room: BlindRankingRoomState,
  participant: BlindRankingParticipant
) {
  if (room.status !== "lobby") {
    return { ok: false as const, error: "This game has already started." };
  }
  if (room.participants.length >= 12) {
    return { ok: false as const, error: "This room is full." };
  }
  if (
    room.participants.some(
      (current) => current.name.toLowerCase() === participant.name.toLowerCase()
    )
  ) {
    return {
      ok: false as const,
      error: "That display name is already in the room.",
    };
  }
  room.participants.push(participant);
  room.updatedAt = new Date().toISOString();
  return { ok: true as const };
}

export function startBlindRankingRoom(
  room: BlindRankingRoomState,
  items: BlindRankingItem[]
) {
  if (room.status !== "lobby") {
    return { ok: false as const, error: "This game has already started." };
  }
  if (items.length < room.config.count) {
    return {
      ok: false as const,
      error: `The shared pool only found ${items.length} eligible items. Remove a filter or add another list.`,
    };
  }
  room.pool = items.slice(0, room.config.count);
  room.board = createBlindRankingBoard(room.config.count);
  room.currentIndex = 0;
  room.status = "playing";
  room.updatedAt = new Date().toISOString();
  return { ok: true as const };
}

export function placeCurrentBlindRankingItem(
  room: BlindRankingRoomState,
  participantId: string,
  slot: number
) {
  if (room.status !== "playing") {
    return { ok: false as const, error: "This game is not taking picks." };
  }
  const participant = room.participants.find(
    (current) => current.id === participantId
  );
  if (!participant) {
    return { ok: false as const, error: "Join the room before placing a card." };
  }
  const item = room.pool[room.currentIndex];
  if (!item) {
    return { ok: false as const, error: "There is no card to place." };
  }
  const placement = placeBlindRankingItem(room.board, slot, item);
  if (!placement.ok) return placement;

  room.board = placement.board;
  room.currentIndex += 1;
  room.lastAction = {
    participantName: participant.name,
    itemTitle: item.title,
    slot,
  };
  room.updatedAt = new Date().toISOString();
  if (room.currentIndex >= room.pool.length) {
    room.status = "complete";
    room.completedAt = room.updatedAt;
  }
  return { ok: true as const };
}
