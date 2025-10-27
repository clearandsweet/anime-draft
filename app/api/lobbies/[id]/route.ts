import { NextResponse } from "next/server";
import { deleteLobby } from "../../lobby/fs";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    await deleteLobby(id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("delete lobby error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

