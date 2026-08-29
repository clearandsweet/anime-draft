import { NextResponse } from "next/server";
import { createBlindRankingParticipant } from "../roomAuth";
import { parseBlindRankingConfig, parseBlindRankingSource, blindRankingError } from "../request";
import { createBlindRankingRoom } from "../rooms.store";
import { toPublicBlindRankingRoom } from "../../../lib/blindRankingRoom";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const config = parseBlindRankingConfig(body);
    const source = parseBlindRankingSource(body.source, config.mode);
    const { participant, token } = createBlindRankingParticipant(
      typeof body.name === "string" ? body.name : "",
      source
    );
    const room = await createBlindRankingRoom(config, participant);
    return NextResponse.json(
      {
        room: toPublicBlindRankingRoom(room),
        credentials: { participantId: participant.id, token },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: blindRankingError(error) },
      { status: 400 }
    );
  }
}
