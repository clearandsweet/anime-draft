import { hasCloudflareDb } from "../runtimeStorage";
import { BlindRankingConfig } from "../../lib/blindRanking";
import {
  BlindRankingParticipant,
  BlindRankingRoomState,
} from "../../lib/blindRankingRoom";

async function backend() {
  return hasCloudflareDb()
    ? import("./rooms.d1")
    : import("./rooms.vercel");
}

export async function createBlindRankingRoom(
  config: BlindRankingConfig,
  host: BlindRankingParticipant
) {
  return (await backend()).createBlindRankingRoom(config, host);
}

export async function loadBlindRankingRoom(code: string) {
  return (await backend()).loadBlindRankingRoom(code);
}

export async function saveBlindRankingRoom(
  room: BlindRankingRoomState,
  expectedVersion?: number
) {
  return (await backend()).saveBlindRankingRoom(room, expectedVersion);
}

export async function withBlindRankingRoom(
  code: string,
  mutate: (room: BlindRankingRoomState) => void | Promise<void>
) {
  return (await backend()).withBlindRankingRoom(code, mutate);
}
