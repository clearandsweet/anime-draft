type SavedCustomRanking = {
  id: string;
  slug: string;
  manageKey: string;
};

const STORAGE_KEY = "clearandsweet:custom-rankings";

export function readSavedCustomRankings(): SavedCustomRanking[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is SavedCustomRanking =>
        Boolean(entry?.id && entry?.slug && entry?.manageKey)
    );
  } catch {
    return [];
  }
}

export function rememberSavedCustomRanking(entry: SavedCustomRanking) {
  try {
    const current = readSavedCustomRankings().filter(
      (saved) => saved.id !== entry.id
    );
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([entry, ...current].slice(0, 40))
    );
  } catch {}
}

export function forgetSavedCustomRanking(id: string) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(readSavedCustomRankings().filter((entry) => entry.id !== id))
    );
  } catch {}
}

export function customRankingManageKey(id: string) {
  return readSavedCustomRankings().find((entry) => entry.id === id)?.manageKey ?? null;
}
