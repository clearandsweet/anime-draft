export type DraftShortlistType = "anime" | "pokemon";

const SHORTLIST_KEY_PREFIX = "clearandsweet:draft-shortlist:";

function storageKey(draftType: DraftShortlistType, lobbyId: string) {
  return `${SHORTLIST_KEY_PREFIX}${draftType}:${lobbyId}`;
}

export function normalizeShortlistIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value.filter(
        (id): id is number =>
          typeof id === "number" && Number.isSafeInteger(id) && id > 0
      )
    )
  );
}

export function getDraftShortlist(
  draftType: DraftShortlistType,
  lobbyId: string
) {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(storageKey(draftType, lobbyId));
    return stored ? normalizeShortlistIds(JSON.parse(stored)) : [];
  } catch {
    return [];
  }
}

export function rememberDraftShortlist(
  draftType: DraftShortlistType,
  lobbyId: string,
  ids: number[]
) {
  if (typeof window === "undefined") return false;

  try {
    const normalized = normalizeShortlistIds(ids);
    const key = storageKey(draftType, lobbyId);
    if (normalized.length === 0) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(normalized));
    }
    return true;
  } catch {
    return false;
  }
}

export function toggleShortlistId(ids: number[], id: number) {
  const normalized = normalizeShortlistIds(ids);
  if (!Number.isSafeInteger(id) || id <= 0) return normalized;
  return normalized.includes(id)
    ? normalized.filter((savedId) => savedId !== id)
    : [...normalized, id];
}

export function removeDraftedShortlistIds(
  ids: number[],
  draftedIds: number[]
) {
  const drafted = new Set(normalizeShortlistIds(draftedIds));
  return normalizeShortlistIds(ids).filter((id) => !drafted.has(id));
}
