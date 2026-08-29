import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { saveCustomImage } from "../../customImages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 750_000;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function hasExpectedSignature(bytes: Uint8Array, contentType: string) {
  if (contentType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (contentType === "image/png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  return (
    contentType === "image/webp" &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { dataUrl?: unknown };
    if (typeof body.dataUrl !== "string") throw new Error("Choose a picture to upload.");
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-zA-Z0-9+/=]+)$/.exec(body.dataUrl);
    if (!match || !ALLOWED_TYPES.has(match[1])) {
      throw new Error("Use a JPEG, PNG, or WebP picture.");
    }
    const bytes = new Uint8Array(Buffer.from(match[2], "base64"));
    if (bytes.byteLength < 64 || bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new Error("The picture must be smaller than 750 KB after compression.");
    }
    if (!hasExpectedSignature(bytes, match[1])) throw new Error("That picture file is invalid.");
    const imageId = randomBytes(18).toString("base64url");
    await saveCustomImage(imageId, bytes, match[1]);
    return NextResponse.json(
      { imageId, imageUrl: `/api/blind-ranking/custom/images/${imageId}` },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The picture could not be uploaded." },
      { status: 400 }
    );
  }
}
