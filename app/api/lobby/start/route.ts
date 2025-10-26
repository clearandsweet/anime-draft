import { LobbyStore } from "../store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const actingName = (body.meName || "").toString().trim();

    // host-only
    LobbyStore.startDraft(actingName);

    const lobby = LobbyStore.getLobby();

    return new Response(JSON.stringify(lobby), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: err?.message || "Cannot start draft yet",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}
