﻿import { NextResponse, NextRequest } from "next/server";
export const runtime = "nodejs";
import { deleteLobby } from "../../lobby/kv";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const password = (body?.password as string | undefined) ?? "";
    if (password !== "Cynthia5") {
      return NextResponse.json({ error: "Invalid password." }, { status: 401 });
    }
    await deleteLobby(id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("delete lobby error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

