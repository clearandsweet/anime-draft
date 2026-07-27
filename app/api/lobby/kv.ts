import type { DraftPreset, LobbyState } from "./logic";
import type { VoteRecord, VotesState } from "./votesLogic";
import { hasCloudflareDb } from "../runtimeStorage";

export type PublicLobbyMeta = {
  id: string;
  createdAt: string;
  updatedAt: string;
  hostName: string | null;
  status: "active" | "completed";
  playersCount: number;
  lastPickAt: string | null;
  draftType?: "anime" | "pokemon";
  preset?: DraftPreset;
};

async function backend() {
  return hasCloudflareDb() ? import("./kv.d1") : import("./kv.vercel");
}

export async function createLobby(opts?: {
  hostName?: string;
  targetPlayers?: number;
  draftType?: "anime" | "pokemon";
  preset?: DraftPreset;
}) {
  return (await backend()).createLobby(opts);
}

export async function loadLobby(id: string): Promise<LobbyState> {
  return (await backend()).loadLobby(id);
}

export async function loadLobbyIfExists(
  id: string
): Promise<LobbyState | null> {
  return (await backend()).loadLobbyIfExists(id);
}

export async function saveLobby(
  id: string,
  state: LobbyState,
  expectedVersion?: number
) {
  return (await backend()).saveLobby(id, state, expectedVersion);
}

export async function listLobbies(filter?: {
  status?: "active" | "completed";
  draftType?: "anime" | "pokemon";
}): Promise<PublicLobbyMeta[]> {
  return (await backend()).listLobbies(filter);
}

export async function getVotesState(id: string): Promise<VotesState> {
  return (await backend()).getVotesState(id);
}

export async function recordVote(id: string, record: VoteRecord) {
  return (await backend()).recordVote(id, record);
}

export async function summarizeVotesFor(id: string, playerIds: string[]) {
  return (await backend()).summarizeVotesFor(id, playerIds);
}

export async function completeLobby(id: string, requesterName: string) {
  return (await backend()).completeLobby(id, requesterName);
}

export async function deleteLobby(id: string) {
  return (await backend()).deleteLobby(id);
}

export async function authorizeLobbyDelete(id: string, manageKey: string) {
  return (await backend()).authorizeLobbyDelete(id, manageKey);
}

export async function withLobby(
  id: string,
  mutate: (state: LobbyState) => void | Promise<void>
): Promise<LobbyState> {
  return (await backend()).withLobby(id, mutate);
}
