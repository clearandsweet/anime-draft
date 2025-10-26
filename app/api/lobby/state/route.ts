// app/api/lobby/state/route.ts
import { NextResponse } from "next/server";
import { getLobby, tickTimerAndMaybeAutopick, LobbyState } from "../store";

export async function GET() {
  // run 1-second tick logic here to keep timer moving on prod
  tickTimerAndMaybeAutopick();

  const lobby = getLobby();
  const body: LobbyState = {
    ...lobby,
    draftedIds: lobby.draftedIds ?? [],
  };

  return NextResponse.json(body, { status: 200 });
}
