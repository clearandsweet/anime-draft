import { getCloudflareR2 } from "../runtimeStorage";

function key(imageId: string) {
  return `custom-rankings/images/${imageId}`;
}

export async function saveCustomImage(
  imageId: string,
  bytes: Uint8Array,
  contentType: string
) {
  await getCloudflareR2().put(key(imageId), bytes, {
    httpMetadata: { contentType },
  });
}

export async function loadCustomImage(imageId: string) {
  const object = await getCloudflareR2().get(key(imageId));
  if (!object) return null;
  return {
    body: object.body,
    contentType: object.httpMetadata?.contentType || "application/octet-stream",
  };
}

export async function deleteCustomImage(imageId: string) {
  await getCloudflareR2().delete(key(imageId));
}
