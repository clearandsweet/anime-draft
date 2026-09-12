import { AniListError } from "../../lib/anilist";
import {
  BlindRankingConfig,
  BlindRankingSource,
  isBlindRankingCount,
  isBlindRankingMode,
  isBlindRankingService,
  normalizeBlindRankingGenres,
  normalizeBlindRankingStatuses,
} from "../../lib/blindRanking";

export function parseBlindRankingConfig(body: Record<string, unknown>) {
  const mode = isBlindRankingMode(body.mode) ? body.mode : "anime";
  const count = isBlindRankingCount(body.count) ? body.count : 5;
  const config: BlindRankingConfig = {
    mode,
    count,
    genres: mode === "anime" ? normalizeBlindRankingGenres(body.genres) : [],
    statuses: normalizeBlindRankingStatuses(body.statuses),
  };
  return config;
}

export function parseBlindRankingSource(
  value: unknown,
  mode: "anime" | "character"
): BlindRankingSource | null {
  if (mode === "character" || !value || typeof value !== "object") return null;
  const source = value as { service?: unknown; username?: unknown };
  if (!isBlindRankingService(source.service)) return null;
  const username = typeof source.username === "string" ? source.username.trim() : "";
  if (!username) return null;
  return { service: source.service, username };
}

export function blindRankingError(error: unknown) {
  if (error instanceof AniListError) return error.message;
  const message = error instanceof Error ? error.message : "Server error.";
  if (
    /not found|private|valid|already|full|started|eligible|join|host|room|reached/i.test(
      message
    )
  ) {
    return message;
  }
  console.error("blind ranking error:", error);
  return "The Blind Ranking room could not be updated. Try again.";
}
