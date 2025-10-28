import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
import { loadLobby, getVotesState, recordVote, summarizeVotesFor } from "../../../lobby/kv";
import { randomUUID, createHash } from "crypto";

function getClientIp(req: NextRequest): string {
  const header = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
  if (header) {
    return header.split(",")[0]?.trim() || "unknown";
  }
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  return "unknown";
}

function buildFingerprintSource(req: NextRequest): string {
  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") ?? "";
  const acceptLanguage = req.headers.get("accept-language") ?? "";
  const forwardedHost = req.headers.get("x-forwarded-host") ?? "";
  return [ip, userAgent, acceptLanguage, forwardedHost].join("|");
}

function hashFingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const lobby = await loadLobby(id);
    const playerIds = lobby.players.map((p) => p.id);
    const votesState = await getVotesState(id);
    const summary = await summarizeVotesFor(id, playerIds);
    const fingerprintHash = hashFingerprint(buildFingerprintSource(request));
    const already = votesState.records.some((r) => r.ipHash === fingerprintHash);
    return NextResponse.json(
      {
        ballots: summary.ballots,
        totals: summary.totals,
        alreadyVoted: already,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("votes GET error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const lobby = await loadLobby(id);
    if (!lobby.completedAt) {
      return NextResponse.json(
        { error: "Voting opens when the draft is complete." },
        { status: 400 }
      );
    }
    const body = await request.json().catch(() => ({}));
    const parsePick = (value: unknown): string | null =>
      typeof value === "string" && value.trim() ? value : null;
    const first = parsePick(body?.first);
    const second = parsePick(body?.second);
    const third = parsePick(body?.third);
    const picks: (string | null)[] = [first, second, third];
    const chosen = picks.filter((v): v is string => !!v);
    const requiredSelections = lobby.players.length === 2 ? 1 : 3;
    if (chosen.length < requiredSelections) {
      return NextResponse.json(
        {
          error:
            requiredSelections === 1
              ? "Select at least one board before submitting."
              : "Select three distinct boards before submitting.",
        },
        { status: 400 }
      );
    }
    const unique = new Set(chosen);
    if (unique.size !== chosen.length) {
      return NextResponse.json(
        { error: "Selections must be distinct." },
        { status: 400 }
      );
    }
    const validIds = new Set(lobby.players.map((p) => p.id));
    if (chosen.some((idValue) => !validIds.has(idValue))) {
      return NextResponse.json(
        { error: "One or more selections are invalid." },
        { status: 400 }
      );
    }
    const fingerprintHash = hashFingerprint(buildFingerprintSource(request));
    const record = {
      id: randomUUID(),
      ipHash: fingerprintHash,
      first,
      second,
      third,
      createdAt: new Date().toISOString(),
    };
    const result = await recordVote(id, record);
    if (!result.ok) {
      const status = result.already ? 409 : 400;
      return NextResponse.json(
        { error: result.error || "Vote rejected.", already: result.already === true },
        { status }
      );
    }
    const summary = await summarizeVotesFor(id, Array.from(validIds));
    return NextResponse.json(
      {
        ballots: summary.ballots,
        totals: summary.totals,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("votes POST error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}


