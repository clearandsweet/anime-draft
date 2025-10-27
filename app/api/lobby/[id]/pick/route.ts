import { NextResponse, NextRequest } from "next/server";
export const runtime = "nodejs";
import { withLobby } from "../../../lobby/kv";
import { LobbyState, Character, pick as pickFn } from "../../../lobby/logic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const actingName = body.actingName as string;
    const slotName = body.slotName as string;
    const chosen: Character = body.chosen as Character;

    let result: { ok: boolean; error?: string } = { ok: true };
    const state = await withLobby(id, (s) => {
      result = pickFn(s, { actingName, slotName, chosen });
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Pick failed." },
        { status: 400 }
      );
    }
    const responseBody: LobbyState = { ...state, draftedIds: state.draftedIds ?? [] };
    return NextResponse.json(responseBody, { status: 200 });
  } catch (err) {
    console.error("pick error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
