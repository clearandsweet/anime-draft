import { NextRequest, NextResponse } from "next/server";

import { withLobby } from "../../../lobby/kv";
import { type LobbyState, setPlayerReady } from "../../../lobby/logic";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { playerName, ready } = await request.json().catch(() => ({}));

    if (
      typeof playerName !== "string" ||
      !playerName.trim() ||
      typeof ready !== "boolean"
    ) {
      return NextResponse.json(
        { error: "Player name and readiness are required." },
        { status: 400 }
      );
    }

    let result: ReturnType<typeof setPlayerReady> = { ok: true };
    const state = await withLobby(id, (lobby) => {
      result = setPlayerReady(lobby, playerName, ready);
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Could not update readiness." },
        { status: 400 }
      );
    }

    const body: LobbyState = {
      ...state,
      draftedIds: state.draftedIds ?? [],
      readyPlayerIds: state.readyPlayerIds ?? [],
    };
    return NextResponse.json(body, { status: 200 });
  } catch (error) {
    console.error("ready check error:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
