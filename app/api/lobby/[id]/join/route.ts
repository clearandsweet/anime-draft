import { NextResponse, NextRequest } from "next/server";
export const runtime = "nodejs";
import { withLobby } from "../../../lobby/fs";
import { LobbyState, join } from "../../../lobby/logic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name } = await request.json();
    let result: { ok: boolean; error?: string } = { ok: true };
    const state = await withLobby(id, (s) => {
      const r = join(s, name);
      result = r;
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Join failed" },
        { status: 400 }
      );
    }
    const body: LobbyState = { ...state, draftedIds: state.draftedIds ?? [] };
    return NextResponse.json(body, { status: 200 });
  } catch (err) {
    console.error("join error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
