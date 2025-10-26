// app/api/lobby/pick/route.ts
import { NextResponse } from "next/server";
import {
  getLobby,
  draftPick,
  LobbyState,
  Character,
} from "../store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const actingName = body.actingName;
    const slotName = body.slotName;
    const chosen: Character = body.chosen;

    const result = draftPick({
      actingName,
      slotName,
      chosen,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Pick failed." },
        { status: 400 }
      );
    }

    const lobby = getLobby();
    const responseBody: LobbyState = {
      ...lobby,
      draftedIds: lobby.draftedIds ?? [],
    };

    return NextResponse.json(responseBody, { status: 200 });
  } catch (err) {
    console.error("pick error:", err);
    return NextResponse.json(
      { error: "Server error." },
      { status: 500 }
    );
  }
}
