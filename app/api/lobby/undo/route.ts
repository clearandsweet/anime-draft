import { LobbyStore } from "../store";

export const dynamic = "force-dynamic";

export async function POST() {
  const lobby = LobbyStore.undo();
  return new Response(JSON.stringify(lobby), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
