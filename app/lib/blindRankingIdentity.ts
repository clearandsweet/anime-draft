export type BlindRankingCredentials = {
  participantId: string;
  token: string;
};

function storageKey(code: string) {
  return `clearandsweet:blind-ranking:${code.toUpperCase()}`;
}

export function rememberBlindRankingCredentials(
  code: string,
  credentials: BlindRankingCredentials
) {
  try {
    window.localStorage.setItem(storageKey(code), JSON.stringify(credentials));
  } catch {}
}

export function readBlindRankingCredentials(code: string) {
  try {
    const raw = window.localStorage.getItem(storageKey(code));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BlindRankingCredentials>;
    if (!parsed.participantId || !parsed.token) return null;
    return parsed as BlindRankingCredentials;
  } catch {
    return null;
  }
}

export function forgetBlindRankingCredentials(code: string) {
  try {
    window.localStorage.removeItem(storageKey(code));
  } catch {}
}
