import { randomBytes } from "crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateBlindRankingRoomCode() {
  const bytes = randomBytes(6);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export function normalizeBlindRankingRoomCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6);
}
