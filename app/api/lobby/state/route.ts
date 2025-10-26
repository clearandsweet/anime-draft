import { LobbyStore } from "../store";

export const dynamic = "force-dynamic";

export async function GET() {
  // tick timer each poll so everyone stays synced
  LobbyStore.tick();
  const lobby = LobbyStore.getLobby();

  return new Response(JSON.stringify(lobby), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
