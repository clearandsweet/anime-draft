import { LobbyStore } from "../store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = (body.name || "").toString().trim();

  if (!name) {
    return new Response(
      JSON.stringify({ error: "Name required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const lobby = LobbyStore.join(name);

  return new Response(JSON.stringify(lobby), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
