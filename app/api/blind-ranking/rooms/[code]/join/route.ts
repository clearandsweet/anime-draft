import { NextResponse } from "next/server";
import { addBlindRankingParticipant, toPublicBlindRankingRoom } from "../../../../../lib/blindRankingRoom";
import { blindRankingError, parseBlindRankingSource } from "../../../request";
import { createBlindRankingParticipant } from "../../../roomAuth";
import { normalizeBlindRankingRoomCode } from "../../../roomCode";
import { withBlindRankingRoom } from "../../../rooms.store";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const code = normalizeBlindRankingRoomCode((await params).code);
    const body = (await request.json()) as Record<string, unknown>;
    let credentials: { participantId: string; token: string } | null = null;
    let actionError = "";
    const room = await withBlindRankingRoom(code, (state) => {
      const source = parseBlindRankingSource(body.source, state.config.mode);
      const created = createBlindRankingParticipant(
        typeof body.name === "string" ? body.name : "",
        source
      );
      const result = addBlindRankingParticipant(state, created.participant);
      if (!result.ok) {
        actionError = result.error;
        return;
      }
      credentials = {
        participantId: created.participant.id,
        token: created.token,
      };
    });
    if (actionError || !credentials) {
      return NextResponse.json(
        { error: actionError || "Could not join the room." },
        { status: 400 }
      );
    }
    return NextResponse.json({
      room: toPublicBlindRankingRoom(room),
      credentials,
    });
  } catch (error) {
    return NextResponse.json(
      { error: blindRankingError(error) },
      { status: 400 }
    );
  }
}
