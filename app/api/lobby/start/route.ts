// app/api/lobby/start/route.ts
import { NextResponse } from "next/server";
import { getLobby, startDraft, LobbyState } from "../store";

export async function POST(request: Request) {
  try {
    const { meName } = await request.json();

    const result = startDraft(meName);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Cannot start draft." },
        { status: 400 }
      );
    }

    const lobby = getLobby();
    const body: LobbyState = {
      ...lobby,
      draftedIds: lobby.draftedIds ?? [],
    };

    return NextResponse.json(body, { status: 200 });
  } catch (err) {
    console.error("start error:", err);
    return NextResponse.json(
      { error: "Server error." },
      { status: 500 }
    );
  }
}
