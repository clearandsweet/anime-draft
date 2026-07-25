import { NextRequest, NextResponse } from "next/server";

import { withLobby } from "../../../../lobby/kv";
import { rerollCategory, type LobbyState } from "../../../../lobby/logic";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { meName, slotName } = await request.json().catch(() => ({}));

    if (
      typeof meName !== "string" ||
      !meName.trim() ||
      typeof slotName !== "string" ||
      !slotName.trim()
    ) {
      return NextResponse.json(
        { error: "Host name and category are required." },
        { status: 400 }
      );
    }

    let result: ReturnType<typeof rerollCategory> = { ok: true };
    const state = await withLobby(id, (lobby) => {
      result = rerollCategory(lobby, meName, slotName);
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Could not reroll category." },
        { status: 400 }
      );
    }

    const body: LobbyState = {
      ...state,
      draftedIds: state.draftedIds ?? [],
      readyPlayerIds: state.readyPlayerIds ?? [],
    };
    return NextResponse.json(body, { status: 200 });
  } catch (error) {
    console.error("reroll category error:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
