import { NextResponse, NextRequest } from "next/server";
export const runtime = "nodejs";
import { deleteLobby } from "../../lobby/kv";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteLobby(id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("delete lobby error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
