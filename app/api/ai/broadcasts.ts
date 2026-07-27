import { hasCloudflareDb } from "../runtimeStorage";

export type SavedBroadcast = {
  lobbyId: string;
  competition: string;
  draftType: "anime" | "pokemon";
  resultText: string;
  createdAt: string;
};

async function backend() {
  return hasCloudflareDb()
    ? import("./broadcasts.d1")
    : import("./broadcasts.vercel");
}

export async function getSavedBroadcast(
  lobbyId: string,
  competition: string
): Promise<SavedBroadcast | null> {
  return (await backend()).getSavedBroadcast(lobbyId, competition);
}

export async function saveBroadcast(
  lobbyId: string,
  competition: string,
  draftType: "anime" | "pokemon",
  resultText: string,
  createdAt: string
): Promise<SavedBroadcast> {
  return (await backend()).saveBroadcast(
    lobbyId,
    competition,
    draftType,
    resultText,
    createdAt
  );
}
