import fs from "fs/promises";
import os from "os";
import path from "path";

const ROOT = path.join(os.tmpdir(), "anime-draft", "custom-ranking-images");

function imagePath(imageId: string) {
  return path.join(ROOT, `${imageId}.bin`);
}

function metadataPath(imageId: string) {
  return path.join(ROOT, `${imageId}.json`);
}

export async function saveCustomImage(
  imageId: string,
  bytes: Uint8Array,
  contentType: string
) {
  await fs.mkdir(ROOT, { recursive: true });
  await Promise.all([
    fs.writeFile(imagePath(imageId), bytes),
    fs.writeFile(metadataPath(imageId), JSON.stringify({ contentType }), "utf8"),
  ]);
}

export async function loadCustomImage(imageId: string) {
  try {
    const [bytes, metadata] = await Promise.all([
      fs.readFile(imagePath(imageId)),
      fs.readFile(metadataPath(imageId), "utf8"),
    ]);
    return {
      body: new Uint8Array(bytes),
      contentType: (JSON.parse(metadata) as { contentType?: string }).contentType || "image/webp",
    };
  } catch {
    return null;
  }
}

export async function deleteCustomImage(imageId: string) {
  await Promise.allSettled([
    fs.unlink(imagePath(imageId)),
    fs.unlink(metadataPath(imageId)),
  ]);
}
