import { NextRequest, NextResponse } from "next/server";

import { withLobby } from "../../../lobby/kv";
import type { LobbyState } from "../../../lobby/logic";
import { shuffleDraftPlayerOrder } from "../../../../lib/draftOrder";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { meName } = await request.json().catch(() => ({}));

    if (typeof meName !== "string" || !meName.trim()) {
      return NextResponse.json(
        { error: "Host name is required." },
        { status: 400 }
      );
    }

    let result: ReturnType<typeof shuffleDraftPlayerOrder> = { ok: true };
    const state = await withLobby(id, (lobby) => {
      result = shuffleDraftPlayerOrder(lobby, meName);
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Could not shuffle draft order." },
        { status: 400 }
      );
    }

    const body: LobbyState = {
      ...state,
      draftedIds: state.draftedIds ?? [],
    };
    return NextResponse.json(body, { status: 200 });
  } catch (error) {
    console.error("shuffle draft order error:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

