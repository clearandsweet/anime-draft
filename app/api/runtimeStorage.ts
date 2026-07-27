declare global {
  var __CLEARANDSWEET_D1__: D1Database | undefined;
  var __CLEARANDSWEET_GOOGLE_API_KEY__: string | undefined;
}

export function setCloudflareDb(db: D1Database | undefined) {
  globalThis.__CLEARANDSWEET_D1__ = db;
}

export function hasCloudflareDb() {
  return Boolean(globalThis.__CLEARANDSWEET_D1__);
}

export function getCloudflareDb(): D1Database {
  const db = globalThis.__CLEARANDSWEET_D1__;
  if (!db) {
    throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  }
  return db;
}

export function setRuntimeGoogleApiKey(apiKey: string | undefined) {
  globalThis.__CLEARANDSWEET_GOOGLE_API_KEY__ = apiKey;
}

export function getRuntimeGoogleApiKey() {
  return (
    globalThis.__CLEARANDSWEET_GOOGLE_API_KEY__?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    ""
  );
}
