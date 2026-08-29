import { NextResponse, NextRequest } from "next/server";
export const runtime = "nodejs";
import { authorizeLobbyDelete, deleteLobby } from "../../lobby/kv";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const manageKey =
      typeof body?.manageKey === "string" ? body.manageKey.trim().slice(0, 128) : "";
    const authorized = await authorizeLobbyDelete(id, manageKey);
    if (!authorized) {
      return NextResponse.json(
        { error: "Incorrect deletion password." },
        { status: 403 }
      );
    }
    await deleteLobby(id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("delete lobby error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
