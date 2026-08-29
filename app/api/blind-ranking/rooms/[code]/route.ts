import { NextResponse } from "next/server";
import { blindRankingError } from "../../request";
import { normalizeBlindRankingRoomCode } from "../../roomCode";
import { loadBlindRankingRoom } from "../../rooms.store";
import { toPublicBlindRankingRoom } from "../../../../lib/blindRankingRoom";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const code = normalizeBlindRankingRoomCode((await params).code);
    const room = await loadBlindRankingRoom(code);
    if (!room) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }
    return NextResponse.json({ room: toPublicBlindRankingRoom(room) });
  } catch (error) {
    return NextResponse.json(
      { error: blindRankingError(error) },
      { status: 400 }
    );
  }
}
