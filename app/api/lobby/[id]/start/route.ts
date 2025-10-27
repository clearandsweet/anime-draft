import { NextResponse } from "next/server";
import { withLobby } from "../../../lobby/fs";
import { LobbyState, start } from "../../../lobby/logic";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { meName } = await request.json();
    let result: { ok: boolean; error?: string } = { ok: true };
    const state = await withLobby(id, (s) => {
      result = start(s, meName);
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Cannot start draft." },
        { status: 400 }
      );
    }
    const body: LobbyState = { ...state, draftedIds: state.draftedIds ?? [] };
    return NextResponse.json(body, { status: 200 });
  } catch (err) {
    console.error("start error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

