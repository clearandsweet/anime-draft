import { getCloudflareDb } from "../runtimeStorage";

export type SavedBroadcast = {
  lobbyId: string;
  competition: string;
  draftType: "anime" | "pokemon";
  resultText: string;
  createdAt: string;
};

type BroadcastRow = {
  lobby_id: number;
  competition: string;
  draft_type: "anime" | "pokemon";
  result_text: string;
  created_at: string;
};

function getDb(): D1Database {
  return getCloudflareDb();
}

function toNumericLobbyId(id: string): number {
  const numericId = Number(id);
  if (!Number.isSafeInteger(numericId) || numericId <= 0) {
    throw new Error("Invalid lobby ID.");
  }
  return numericId;
}

function toSavedBroadcast(row: BroadcastRow): SavedBroadcast {
  return {
    lobbyId: String(row.lobby_id),
    competition: row.competition,
    draftType: row.draft_type,
    resultText: row.result_text,
    createdAt: row.created_at,
  };
}

export async function getSavedBroadcast(
  lobbyId: string,
  competition: string
): Promise<SavedBroadcast | null> {
  const row =
    (await getDb()
      .prepare(
        `SELECT lobby_id, competition, draft_type, result_text, created_at
           FROM broadcasts
          WHERE lobby_id = ? AND competition = ?`
      )
      .bind(toNumericLobbyId(lobbyId), competition)
      .first<BroadcastRow>()) ?? null;

  return row ? toSavedBroadcast(row) : null;
}

export async function saveBroadcast(
  lobbyId: string,
  competition: string,
  draftType: "anime" | "pokemon",
  resultText: string,
  createdAt: string
): Promise<SavedBroadcast> {
  await getDb()
    .prepare(
      `INSERT INTO broadcasts (
         lobby_id, competition, draft_type, result_text, created_at
       ) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(lobby_id, competition) DO NOTHING`
    )
    .bind(
      toNumericLobbyId(lobbyId),
      competition,
      draftType,
      resultText,
      createdAt
    )
    .run();

  const saved = await getSavedBroadcast(lobbyId, competition);
  if (!saved) throw new Error("Unable to save broadcast.");
  return saved;
}
