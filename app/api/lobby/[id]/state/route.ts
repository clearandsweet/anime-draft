import { NextResponse, NextRequest } from "next/server";
export const runtime = "nodejs";
import { withLobby } from "../../../lobby/kv";
import { LobbyState, tick } from "../../../lobby/logic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const state = await withLobby(id, (s) => {
    tick(s);
  });
  const body: LobbyState = { ...state, draftedIds: state.draftedIds ?? [] };
  return NextResponse.json(body, { status: 200 });
}
