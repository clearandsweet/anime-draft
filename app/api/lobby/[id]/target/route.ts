import { NextResponse, NextRequest } from "next/server";
export const runtime = "nodejs";
import { withLobby } from "../../../lobby/kv";
import { LobbyState, setTarget } from "../../../lobby/logic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { targetPlayers, meName } = await request.json();
    let result: { ok: boolean; error?: string } = { ok: true };
    const state = await withLobby(id, (s) => {
      result = setTarget(s, meName, targetPlayers);
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Cannot set target player count." },
        { status: 400 }
      );
    }
    const body: LobbyState = { ...state, draftedIds: state.draftedIds ?? [] };
    return NextResponse.json(body, { status: 200 });
  } catch (err) {
    console.error("target error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
