import { NextResponse } from "next/server";
import { placeCurrentBlindRankingItem, toPublicBlindRankingRoom } from "../../../../../lib/blindRankingRoom";
import { blindRankingError } from "../../../request";
import { authorizeBlindRankingParticipant } from "../../../roomAuth";
import { normalizeBlindRankingRoomCode } from "../../../roomCode";
import { withBlindRankingRoom } from "../../../rooms.store";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const code = normalizeBlindRankingRoomCode((await params).code);
    const body = (await request.json()) as {
      participantId?: string;
      token?: string;
      slot?: number;
    };
    let actionError = "";
    const room = await withBlindRankingRoom(code, (state) => {
      if (
        !authorizeBlindRankingParticipant(
          state,
          body.participantId ?? "",
          body.token ?? ""
        )
      ) {
        actionError = "Join the room before placing a card.";
        return;
      }
      const placed = placeCurrentBlindRankingItem(
        state,
        body.participantId ?? "",
        Number(body.slot)
      );
      if (!placed.ok) actionError = placed.error;
    });
    if (actionError) {
      return NextResponse.json({ error: actionError }, { status: 400 });
    }
    return NextResponse.json({ room: toPublicBlindRankingRoom(room) });
  } catch (error) {
    return NextResponse.json(
      { error: blindRankingError(error) },
      { status: 400 }
    );
  }
}
