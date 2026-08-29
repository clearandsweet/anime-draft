import { kv } from "@vercel/kv";
import * as fsStore from "./customImages.fs";

type StoredImage = { body: string; contentType: string };

function hasKvEnvironment() {
  return Boolean(
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) ||
      (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}

function key(imageId: string) {
  return `custom-ranking:image:${imageId}`;
}

export async function saveCustomImage(
  imageId: string,
  bytes: Uint8Array,
  contentType: string
) {
  if (!hasKvEnvironment()) return fsStore.saveCustomImage(imageId, bytes, contentType);
  await kv.set<StoredImage>(key(imageId), {
    body: Buffer.from(bytes).toString("base64"),
    contentType,
  });
}

export async function loadCustomImage(imageId: string) {
  if (!hasKvEnvironment()) return fsStore.loadCustomImage(imageId);
  const stored = await kv.get<StoredImage>(key(imageId));
  if (!stored) return null;
  return {
    body: new Uint8Array(Buffer.from(stored.body, "base64")),
    contentType: stored.contentType,
  };
}

export async function deleteCustomImage(imageId: string) {
  if (!hasKvEnvironment()) return fsStore.deleteCustomImage(imageId);
  await kv.del(key(imageId));
}
