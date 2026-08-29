declare global {
  var __CLEARANDSWEET_D1__: D1Database | undefined;
  var __CLEARANDSWEET_R2__: R2Bucket | undefined;
  var __CLEARANDSWEET_GOOGLE_API_KEY__: string | undefined;
  var __CLEARANDSWEET_LOBBY_DELETE_PASSWORD__: string | undefined;
}

export function setCloudflareR2(bucket: R2Bucket | undefined) {
  globalThis.__CLEARANDSWEET_R2__ = bucket;
}

export function hasCloudflareR2() {
  return Boolean(globalThis.__CLEARANDSWEET_R2__);
}

export function getCloudflareR2(): R2Bucket {
  const bucket = globalThis.__CLEARANDSWEET_R2__;
  if (!bucket) throw new Error("Cloudflare R2 binding `R2` is unavailable.");
  return bucket;
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

export function setRuntimeLobbyDeletePassword(password: string | undefined) {
  globalThis.__CLEARANDSWEET_LOBBY_DELETE_PASSWORD__ = password;
}

export function getRuntimeLobbyDeletePassword() {
  return (
    globalThis.__CLEARANDSWEET_LOBBY_DELETE_PASSWORD__?.trim() ||
    process.env.LOBBY_DELETE_PASSWORD?.trim() ||
    "delete"
  );
}
