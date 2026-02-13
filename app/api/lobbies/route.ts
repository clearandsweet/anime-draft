import { NextResponse } from "next/server";
export const runtime = "nodejs";
import { createLobby, listLobbies } from "../lobby/kv";
import { LobbyState } from "../lobby/logic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as "active" | "completed" | null;
  const list = await listLobbies(status ? { status } : undefined);
  return NextResponse.json({ lobbies: list }, { status: 200 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const hostName = (body?.hostName as string | undefined) ?? undefined;
    const targetPlayers = (body?.targetPlayers as number | undefined) ?? undefined;
    const { id, state, manageKey } = await createLobby({ hostName, targetPlayers });
    const response: { id: string; state: LobbyState; manageKey: string } = { id, state, manageKey };
    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error("create lobby error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
