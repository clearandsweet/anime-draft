// app/api/lobby/target/route.ts
import { NextResponse } from "next/server";
import {
  getLobby,
  setTargetPlayerCount,
  LobbyState,
} from "../store";

export async function POST(request: Request) {
  try {
    const { targetPlayers, meName } = await request.json();

    const result = setTargetPlayerCount(meName, targetPlayers);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Cannot set target player count." },
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
    console.error("target error:", err);
    return NextResponse.json(
      { error: "Server error." },
      { status: 500 }
    );
  }
}
