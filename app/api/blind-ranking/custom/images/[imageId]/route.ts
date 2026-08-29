import { NextResponse } from "next/server";
import { loadCustomImage } from "../../../customImages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ imageId: string }> }
) {
  const imageId = (await params).imageId;
  if (!/^[a-zA-Z0-9_-]{12,80}$/.test(imageId)) {
    return NextResponse.json({ error: "Invalid image." }, { status: 400 });
  }
  const image = await loadCustomImage(imageId);
  if (!image) return NextResponse.json({ error: "Image not found." }, { status: 404 });
  return new Response(image.body as BodyInit, {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
