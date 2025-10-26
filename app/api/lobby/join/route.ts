// app/api/lobby/join/route.ts
import { NextResponse } from "next/server";
import { getLobby, joinLobby, LobbyState } from "../store";

export async function POST(request: Request) {
  try {
    const { name } = await request.json();

    const result = joinLobby(name);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Join failed" },
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
    console.error("join error:", err);
    return NextResponse.json(
      { error: "Server error." },
      { status: 500 }
    );
  }
}
