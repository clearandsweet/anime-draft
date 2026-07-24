import { NextRequest, NextResponse } from "next/server";

import { withLobby } from "../../../lobby/kv";
import { type LobbyState, removePlayer } from "../../../lobby/logic";

export const runtime = "nodejs";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { meName, playerId } = await request.json().catch(() => ({}));

    if (
      typeof meName !== "string" ||
      !meName.trim() ||
      typeof playerId !== "string" ||
      !playerId.trim()
    ) {
      return NextResponse.json(
        { error: "Host name and player are required." },
        { status: 400 }
      );
    }

    let result: ReturnType<typeof removePlayer> = { ok: true };
    const state = await withLobby(id, (lobby) => {
      result = removePlayer(lobby, meName, playerId);
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Could not remove player." },
        { status: 400 }
      );
    }

    const body: LobbyState = {
      ...state,
      draftedIds: state.draftedIds ?? [],
    };
    return NextResponse.json(body, { status: 200 });
  } catch (error) {
    console.error("remove player error:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
