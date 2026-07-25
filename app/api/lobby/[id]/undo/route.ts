import { NextResponse, NextRequest } from "next/server";
export const runtime = "nodejs";
import { withLobby } from "../../../lobby/kv";
import { LobbyState, undo } from "../../../lobby/logic";
import { isDraftUndoExpectation } from "../../../../lib/draftUndo";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { meName, expectation } = await request.json();
    if (
      expectation !== undefined &&
      !isDraftUndoExpectation(expectation)
    ) {
      return NextResponse.json(
        { error: "Invalid undo confirmation." },
        { status: 400 }
      );
    }
    let result: { ok: boolean; error?: string } = { ok: true };
    const state = await withLobby(id, (s) => {
      result = undo(s, meName, expectation);
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Undo failed." },
        { status: 400 }
      );
    }
    const body: LobbyState = { ...state, draftedIds: state.draftedIds ?? [] };
    return NextResponse.json(body, { status: 200 });
  } catch (err) {
    console.error("undo error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
