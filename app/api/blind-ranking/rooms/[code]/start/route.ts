import { AniListError, anilistErrorResponse } from "../../../../../lib/anilist";
import { NextResponse } from "next/server";
import { startBlindRankingRoom, toPublicBlindRankingRoom } from "../../../../../lib/blindRankingRoom";
import { blindRankingError } from "../../../request";
import { authorizeBlindRankingParticipant } from "../../../roomAuth";
import { normalizeBlindRankingRoomCode } from "../../../roomCode";
import { loadBlindRankingRoom, withBlindRankingRoom } from "../../../rooms.store";
import { loadBlindRankingCandidates } from "../../../sources";

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
    };
    const current = await loadBlindRankingRoom(code);
    if (!current) throw new Error("Room not found.");
    if (
      current.hostParticipantId !== body.participantId ||
      !authorizeBlindRankingParticipant(
        current,
        body.participantId ?? "",
        body.token ?? ""
      )
    ) {
      throw new Error("Only the host can start this room.");
    }
    const sources = current.participants.flatMap((participant) =>
      participant.source
        ? [{ contributor: participant.name, source: participant.source }]
        : []
    );
    const result = await loadBlindRankingCandidates({
      ...current.config,
      sources,
      seed: `${current.code}:${Date.now()}`,
    });
    let actionError = "";
    const room = await withBlindRankingRoom(code, (state) => {
      if (
        state.hostParticipantId !== body.participantId ||
        !authorizeBlindRankingParticipant(
          state,
          body.participantId ?? "",
          body.token ?? ""
        )
      ) {
        actionError = "Only the host can start this room.";
        return;
      }
      const started = startBlindRankingRoom(state, result.items);
      if (!started.ok) actionError = started.error;
    });
    if (actionError) {
      return NextResponse.json({ error: actionError }, { status: 400 });
    }
    return NextResponse.json({ room: toPublicBlindRankingRoom(room) });
  } catch (error) {
    if (error instanceof AniListError) return anilistErrorResponse(error);
    return NextResponse.json(
      { error: blindRankingError(error) },
      { status: 400 }
    );
  }
}
