import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getSavedBroadcast, saveBroadcast } from "../broadcasts";
import { loadLobbyIfExists } from "../../lobby/kv";

function getGoogleApiKey() {
  const workerKey = env.GOOGLE_API_KEY;
  if (typeof workerKey === "string" && workerKey.trim()) return workerKey.trim();
  return process.env.GOOGLE_API_KEY?.trim() || "";
}

function normalizeRequestValues(lobbyIdValue: unknown, competitionValue: unknown) {
  const lobbyId = typeof lobbyIdValue === "string" ? lobbyIdValue.trim() : "";
  const competition =
    typeof competitionValue === "string"
      ? competitionValue.trim().slice(0, 80)
      : "";
  const numericId = Number(lobbyId);
  const validLobbyId =
    Number.isSafeInteger(numericId) && numericId > 0 ? lobbyId : "";
  return { lobbyId: validLobbyId, competition };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const { lobbyId, competition } = normalizeRequestValues(
      url.searchParams.get("lobbyId"),
      url.searchParams.get("competition")
    );
    if (!lobbyId || !competition) {
      return NextResponse.json(
        { error: "A lobby and competition are required." },
        { status: 400 }
      );
    }

    const saved = await getSavedBroadcast(lobbyId, competition);
    return NextResponse.json(
      saved
        ? {
            result: saved.resultText,
            createdAt: saved.createdAt,
            cached: true,
          }
        : { result: null, createdAt: null, cached: false }
    );
  } catch (error) {
    console.error("Broadcast archive read error:", error);
    return NextResponse.json(
      { error: "The archived broadcast could not be loaded." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      lobbyId?: unknown;
      competition?: unknown;
    };
    const { lobbyId, competition } = normalizeRequestValues(
      body.lobbyId,
      body.competition
    );
    if (!lobbyId || !competition) {
      return NextResponse.json(
        { error: "A lobby and competition are required." },
        { status: 400 }
      );
    }

    const lobby = await loadLobbyIfExists(lobbyId);
    if (!lobby) {
      return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    }
    if (!lobby.completedAt) {
      return NextResponse.json(
        { error: "The draft must be completed before commentary is generated." },
        { status: 409 }
      );
    }

    const allowedCompetitions = Array.isArray(lobby.competitions)
      ? lobby.competitions
      : [];
    if (!allowedCompetitions.includes(competition)) {
      return NextResponse.json(
        { error: "That event is not part of this draft." },
        { status: 400 }
      );
    }

    const existing = await getSavedBroadcast(lobbyId, competition);
    if (existing) {
      return NextResponse.json({
        result: existing.resultText,
        createdAt: existing.createdAt,
        cached: true,
      });
    }

    const apiKey = getGoogleApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "The broadcast booth is not configured yet." },
        { status: 503 }
      );
    }

    const playersText = lobby.players
      .slice(0, 12)
      .map((player) => {
        const roster = Object.entries(player.slots)
          .slice(0, 20)
          .map(([slot, character]) => {
            const characterName = character?.name?.full || "Empty";
            return `- ${slot.slice(0, 80)}: ${String(characterName).slice(0, 100)}`;
          })
          .join("\n");
        return `Player: ${player.name.slice(0, 80)}\nRoster:\n${roster}`;
      })
      .join("\n\n");

    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: "gemini-3.5-flash",
      generationConfig: {
        maxOutputTokens: 2000,
        temperature: 0.9,
      },
    });
    const subject =
      lobby.draftType === "pokemon" ? "Pokémon teams" : "anime character teams";
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

    const generated = await model.generateContent(prompt);
    const generatedText = (await generated.response).text();
    const createdAt = new Date().toISOString();
    const saved = await saveBroadcast(
      lobbyId,
      competition,
      lobby.draftType,
      generatedText,
      createdAt
    );

    return NextResponse.json({
      result: saved.resultText,
      createdAt: saved.createdAt,
      cached: saved.createdAt !== createdAt,
    });
  } catch (error) {
    console.error("AI Broadcast Error:", error);
    return NextResponse.json(
      { error: "The broadcast booth could not generate commentary right now." },
      { status: 500 }
    );
  }
}
