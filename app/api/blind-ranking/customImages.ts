import { hasCloudflareR2 } from "../runtimeStorage";

export type CustomImage = {
  body: Uint8Array | ReadableStream;
  contentType: string;
};

async function backend() {
  return hasCloudflareR2()
    ? import("./customImages.r2")
    : import("./customImages.vercel");
}

export async function saveCustomImage(
  imageId: string,
  bytes: Uint8Array,
  contentType: string
) {
  return (await backend()).saveCustomImage(imageId, bytes, contentType);
}

export async function loadCustomImage(imageId: string): Promise<CustomImage | null> {
  return (await backend()).loadCustomImage(imageId);
}

export async function deleteCustomImage(imageId: string) {
  return (await backend()).deleteCustomImage(imageId);
}
