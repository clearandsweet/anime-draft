import { NextResponse, NextRequest } from "next/server";
export const runtime = "nodejs";
import { withLobby } from "../../kv";
import { togglePause } from "../../logic";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const { meName } = await request.json();

    let result: { ok: boolean; error?: string; isPaused?: boolean } = { ok: false, error: "Unknown error" };
    const state = await withLobby(id, (s) => {
        result = togglePause(s, meName);
    });

    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, isPaused: result.isPaused }, { status: 200 });
}
