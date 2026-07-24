import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "cloudflare:workers";

type DraftType = "anime" | "pokemon";

type JudgePlayer = {
  name: string;
  slots: Record<string, { name?: { full?: string } } | null>;
};

function isDraftType(value: unknown): value is DraftType {
  return value === "anime" || value === "pokemon";
}

function getGoogleApiKey() {
  const workerKey = env.GOOGLE_API_KEY;
  if (typeof workerKey === "string" && workerKey.trim()) return workerKey.trim();
  return process.env.GOOGLE_API_KEY?.trim() || "";
}

function normalizePlayers(value: unknown): JudgePlayer[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 12).flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const player = candidate as {
      name?: unknown;
      slots?: unknown;
    };
    if (typeof player.name !== "string" || !player.name.trim()) return [];
    if (!player.slots || typeof player.slots !== "object" || Array.isArray(player.slots)) {
      return [];
    }
    return [
      {
        name: player.name.trim().slice(0, 80),
        slots: player.slots as JudgePlayer["slots"],
      },
    ];
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      lobby?: { players?: unknown };
      competition?: unknown;
      draftType?: unknown;
    };
    const players = normalizePlayers(body.lobby?.players);
    const competition =
      typeof body.competition === "string"
        ? body.competition.trim().slice(0, 80)
        : "";
    const draftType: DraftType = isDraftType(body.draftType)
      ? body.draftType
      : "anime";

    if (!players.length || !competition) {
      return NextResponse.json(
        { error: "A competition and at least one completed roster are required." },
        { status: 400 }
      );
    }

    const apiKey = getGoogleApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "The broadcast booth is not configured yet." },
        { status: 503 }
      );
    }

    const playersText = players
      .map((player) => {
        const roster = Object.entries(player.slots)
          .slice(0, 20)
          .map(([slot, character]) => {
            const characterName = character?.name?.full || "Empty";
            return `- ${slot.slice(0, 80)}: ${String(characterName).slice(0, 100)}`;
          })
          .join("\n");
        return `Player: ${player.name}\nRoster:\n${roster}`;
      })
      .join("\n\n");

    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: "gemini-3.5-flash",
      generationConfig: {
        maxOutputTokens: 2000,
        temperature: 0.9,
      },
    });
    const subject = draftType === "pokemon" ? "Pokémon teams" : "anime character teams";
    const prompt = `
You are the energetic but fair host of a post-draft broadcast desk.
The fictional matchup is "${competition}" and the rosters are ${subject}.

${playersText}

Call the matchup like a compact highlight show:
- Open with one punchy headline.
- Give every player a specific strength or memorable moment.
- Explain one matchup, synergy, or personality clash that swings the event.
- Name one winner, while making it clear this is playful commentary rather than an official vote.
- Stay under 350 words. Use plain text with short paragraphs and no tables.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return NextResponse.json({ result: response.text() });
  } catch (error) {
    console.error("AI Broadcast Error:", error);
    return NextResponse.json(
      { error: "The broadcast booth could not generate commentary right now." },
      { status: 500 }
    );
  }
}
