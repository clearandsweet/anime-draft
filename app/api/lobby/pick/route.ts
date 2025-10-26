import { LobbyStore } from "../store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const actingName = (body.actingName || "").toString().trim();
    const slotName = (body.slotName || "").toString().trim();
    const chosen = body.chosen; // should be full Character object

    if (!actingName || !slotName || !chosen) {
      return new Response(
        JSON.stringify({ error: "Missing fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const lobby = LobbyStore.pick({
      actingName,
      slotName,
      chosen,
    });

    return new Response(JSON.stringify(lobby), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "Pick failed" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}
