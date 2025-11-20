import { NextResponse, NextRequest } from "next/server";
export const runtime = "nodejs";
import { withLobby } from "../../../lobby/kv";
import { setCategoryMode } from "../../../lobby/logic";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { meName, mode } = body;

    if (!meName || !mode) {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    let result: { ok: boolean; error?: string } = { ok: true };
    const state = await withLobby(id, (s) => {
        result = setCategoryMode(s, meName, mode);
    });

    if (!result.ok) {
        return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(state, { status: 200 });
}
