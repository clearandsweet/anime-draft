import { LobbyStore } from "../store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const n = Number(body.targetPlayers);
  LobbyStore.setTargetPlayers(n);
  const lobby = LobbyStore.getLobby();

  return new Response(JSON.stringify(lobby), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
