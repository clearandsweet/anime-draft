import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
import { completeLobby } from "../../../lobby/kv";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const meName = (body?.meName as string | undefined) ?? "";
    const { state, result } = await completeLobby(id, meName);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Unable to finish draft." },
        { status: 400 }
      );
    }
    return NextResponse.json(state, { status: 200 });
  } catch (err) {
    console.error("finish draft error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
