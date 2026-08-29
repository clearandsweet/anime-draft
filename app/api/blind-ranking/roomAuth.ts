import { randomBytes } from "crypto";
import { generateManageKey, hashManageKey, verifyManageKey } from "../lobby/manageKey";
import {
  BlindRankingParticipant,
  BlindRankingRoomState,
} from "../../lib/blindRankingRoom";
import { BlindRankingSource } from "../../lib/blindRanking";

export function createBlindRankingParticipant(
  name: string,
  source: BlindRankingSource | null
) {
  const cleanedName = name.trim().replace(/\s+/g, " ").slice(0, 32);
  if (cleanedName.length < 1) {
    throw new Error("Enter a display name.");
  }
  const token = generateManageKey();
  const participant: BlindRankingParticipant = {
    id: randomBytes(8).toString("hex"),
    name: cleanedName,
    source,
    tokenHash: hashManageKey(token),
    joinedAt: new Date().toISOString(),
  };
  return { participant, token };
}

export function authorizeBlindRankingParticipant(
  room: BlindRankingRoomState,
  participantId: string,
  token: string
) {
  const participant = room.participants.find(
    (current) => current.id === participantId
  );
  return Boolean(participant && verifyManageKey(token, participant.tokenHash));
}
