import { NextResponse } from "next/server";
import { withLobby } from "../../../lobby/fs";
import { LobbyState, tick } from "../../../lobby/logic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const state = await withLobby(id, (s) => {
    tick(s);
  });
  const body: LobbyState = { ...state, draftedIds: state.draftedIds ?? [] };
  return NextResponse.json(body, { status: 200 });
}

