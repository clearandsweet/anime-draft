/** Shared public AniList transport. Never turn upstream failures into empty pools. */
export class AniListError extends Error {
  status: number;
  retryAfter: number | null;
  constructor(message: string, status = 502, retryAfter: number | null = null) {
    super(message);
    this.name = "AniListError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

type Envelope = { data?: unknown; errors?: { message?: string; status?: number }[] };

export function createAniListClient(options: {
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
} = {}) {
  const request = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const cache = new Map<string, { expires: number; value: Envelope }>();
  const pending = new Map<string, Promise<Envelope>>();
  let blockedUntil = 0;

  return async function anilistRequest<T>(query: string, variables: object, ttl = 300_000): Promise<T> {
    const key = JSON.stringify({ query, variables });
    const cached = cache.get(key);
    if (cached && cached.expires > now()) return cached.value as T;
    if (cached) cache.delete(key);
    const existing = pending.get(key);
    if (existing) return existing as Promise<T>;
    if (blockedUntil > now()) {
      const seconds = Math.ceil((blockedUntil - now()) / 1000);
      throw new AniListError(`AniList is busy. Please try again in ${seconds} seconds.`, 429, seconds);
    }

    const task = (async (): Promise<Envelope> => {
      for (let attempt = 0; attempt < 2; attempt++) {
        let response: Response;
        try {
          response = await request("https://graphql.anilist.co", {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: key,
            signal: AbortSignal.timeout(12_000),
          });
        } catch {
          if (!attempt) { await sleep(500); continue; }
          throw new AniListError("AniList could not be reached. Please try again shortly.", 503);
        }
        if (response.status === 429) {
          const raw = response.headers.get("Retry-After");
          const reset = Number(response.headers.get("X-RateLimit-Reset")) * 1000;
          const delay = raw && /^\d+$/.test(raw) ? Number(raw) : raw && Number.isFinite(Date.parse(raw)) ? Math.ceil((Date.parse(raw) - now()) / 1000) : reset > now() ? Math.ceil((reset - now()) / 1000) : 60;
          const seconds = Math.max(1, delay);
          blockedUntil = now() + seconds * 1000;
          throw new AniListError(`AniList is busy. Please try again in ${seconds} seconds.`, 429, seconds);
        }
        if (response.status === 403) {
          throw new AniListError("AniList is currently refusing requests from this server. Please try again later.", 503);
        }
        if (response.status >= 500 && !attempt) { await sleep(500); continue; }
        if (!response.ok) {
          throw new AniListError(response.status === 404 ? "AniList user was not found or has a private list." : `AniList could not be reached (${response.status}).`, response.status === 404 ? 404 : 502);
        }
        let payload: Envelope;
        try { payload = await response.json(); }
        catch { throw new AniListError("AniList returned an invalid response. Please try again later."); }
        if (payload?.errors?.length) {
          const missing = payload.errors.some((error) => error.status === 404 || /not found|private/i.test(error.message ?? ""));
          throw new AniListError(missing ? "AniList user was not found or has a private list." : "AniList could not complete this request. Please try again later.", missing ? 404 : 502);
        }
        if (!payload?.data || typeof payload.data !== "object") {
          throw new AniListError("AniList returned an incomplete response. Please try again later.");
        }
        if (ttl > 0) {
          if (cache.size >= 120) cache.delete(cache.keys().next().value!);
          cache.set(key, { expires: now() + ttl, value: payload });
        }
        return payload;
      }
      throw new AniListError("AniList could not be reached.");
    })();
    pending.set(key, task);
    try { return await task as T; }
    finally { pending.delete(key); }
  };
}

export const anilistRequest = createAniListClient();

export function anilistErrorResponse(error: unknown) {
  const known = error instanceof AniListError;
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (known && error.retryAfter !== null) headers["Retry-After"] = String(error.retryAfter);
  return Response.json({ error: known ? error.message : "AniList could not be reached. Please try again later." }, {
    status: known ? error.status : 502, headers,
  });
}
