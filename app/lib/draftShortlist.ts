export type DraftShortlistType = "anime" | "pokemon";
export type DraftShortlistMove = "up" | "down";
export type DraftScoutSlotPlans = Record<number, string>;
export type DraftScoutCoverage = {
  queuedCandidateCount: number;
  openSlotCount: number;
  coveredSlotCount: number;
  needsOpenPlanCount: number;
  slots: Array<{
    name: string;
    candidateCount: number;
  }>;
};

const SHORTLIST_KEY_PREFIX = "clearandsweet:draft-shortlist:";
const SCOUT_SLOT_PLAN_KEY_PREFIX = "clearandsweet:draft-scout-slots:";

function storageKey(draftType: DraftShortlistType, lobbyId: string) {
  return `${SHORTLIST_KEY_PREFIX}${draftType}:${lobbyId}`;
}

function scoutSlotPlanStorageKey(
  draftType: DraftShortlistType,
  lobbyId: string
) {
  return `${SCOUT_SLOT_PLAN_KEY_PREFIX}${draftType}:${lobbyId}`;
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

export function moveShortlistId(
  ids: number[],
  id: number,
  direction: DraftShortlistMove
) {
  const normalized = normalizeShortlistIds(ids);
  const currentIndex = normalized.indexOf(id);
  if (currentIndex === -1) return normalized;

  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (nextIndex < 0 || nextIndex >= normalized.length) return normalized;

  const reordered = [...normalized];
  [reordered[currentIndex], reordered[nextIndex]] = [
    reordered[nextIndex],
    reordered[currentIndex],
  ];
  return reordered;
}

export function normalizeDraftScoutSlotPlans(
  value: unknown
): DraftScoutSlotPlans {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const plans: DraftScoutSlotPlans = {};
  for (const [rawId, rawSlotName] of Object.entries(value)) {
    const id = Number(rawId);
    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      typeof rawSlotName !== "string"
    ) {
      continue;
    }
    const slotName = rawSlotName.trim();
    if (!slotName || slotName.length > 160) continue;
    plans[id] = slotName;
  }
  return plans;
}

export function getDraftScoutSlotPlans(
  draftType: DraftShortlistType,
  lobbyId: string
) {
  if (typeof window === "undefined") return {};

  try {
    const stored = window.localStorage.getItem(
      scoutSlotPlanStorageKey(draftType, lobbyId)
    );
    return stored ? normalizeDraftScoutSlotPlans(JSON.parse(stored)) : {};
  } catch {
    return {};
  }
}

export function rememberDraftScoutSlotPlans(
  draftType: DraftShortlistType,
  lobbyId: string,
  plans: DraftScoutSlotPlans
) {
  if (typeof window === "undefined") return false;

  try {
    const normalized = normalizeDraftScoutSlotPlans(plans);
    const key = scoutSlotPlanStorageKey(draftType, lobbyId);
    if (Object.keys(normalized).length === 0) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(normalized));
    }
    return true;
  } catch {
    return false;
  }
}

export function setDraftScoutSlotPlan(
  plans: DraftScoutSlotPlans,
  id: number,
  slotName: string
) {
  const normalized = normalizeDraftScoutSlotPlans(plans);
  if (!Number.isSafeInteger(id) || id <= 0) return normalized;

  const nextPlans = { ...normalized };
  const nextSlotName = slotName.trim();
  if (!nextSlotName) {
    delete nextPlans[id];
  } else if (nextSlotName.length <= 160) {
    nextPlans[id] = nextSlotName;
  }
  return nextPlans;
}

export function pruneDraftScoutSlotPlans(
  plans: DraftScoutSlotPlans,
  shortlistedIds: number[]
) {
  const allowedIds = new Set(normalizeShortlistIds(shortlistedIds));
  return Object.fromEntries(
    Object.entries(normalizeDraftScoutSlotPlans(plans)).filter(([rawId]) =>
      allowedIds.has(Number(rawId))
    )
  ) as DraftScoutSlotPlans;
}

export function getDraftScoutCoverage(
  shortlistedIds: number[],
  plans: DraftScoutSlotPlans,
  openSlotNames: readonly string[]
): DraftScoutCoverage {
  const ids = normalizeShortlistIds(shortlistedIds);
  const normalizedPlans = normalizeDraftScoutSlotPlans(plans);
  const openSlots = Array.from(
    new Set(
      openSlotNames
        .filter((slotName): slotName is string => typeof slotName === "string")
        .map((slotName) => slotName.trim())
        .filter(Boolean)
    )
  );
  const openSlotSet = new Set(openSlots);
  const counts = new Map(openSlots.map((slotName) => [slotName, 0]));

  let needsOpenPlanCount = 0;
  for (const id of ids) {
    const plannedSlotName = normalizedPlans[id];
    if (!plannedSlotName || !openSlotSet.has(plannedSlotName)) {
      needsOpenPlanCount += 1;
      continue;
    }
    counts.set(plannedSlotName, (counts.get(plannedSlotName) ?? 0) + 1);
  }

  const slots = openSlots.map((name) => ({
    name,
    candidateCount: counts.get(name) ?? 0,
  }));

  return {
    queuedCandidateCount: ids.length,
    openSlotCount: slots.length,
    coveredSlotCount: slots.filter((slot) => slot.candidateCount > 0).length,
    needsOpenPlanCount,
    slots,
  };
}

export function filterDraftScoutCandidateIds(
  candidateIds: number[],
  plans: DraftScoutSlotPlans,
  focusedSlotName: string
) {
  const ids = normalizeShortlistIds(candidateIds);
  const slotName = focusedSlotName.trim();
  if (!slotName) return ids;

  const normalizedPlans = normalizeDraftScoutSlotPlans(plans);
  return ids.filter((id) => normalizedPlans[id] === slotName);
}

export function getUnavailableShortlistIds(
  ids: number[],
  draftedIds: number[]
) {
  const drafted = new Set(normalizeShortlistIds(draftedIds));
  return normalizeShortlistIds(ids).filter((id) => drafted.has(id));
}

export function removeDraftedShortlistIds(
  ids: number[],
  draftedIds: number[]
) {
  const drafted = new Set(normalizeShortlistIds(draftedIds));
  return normalizeShortlistIds(ids).filter((id) => !drafted.has(id));
}
