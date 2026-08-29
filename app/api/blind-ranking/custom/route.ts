import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { generateManageKey, hashManageKey } from "../../lobby/manageKey";
import {
  buildCustomRankingSearchText,
  customRankingSlug,
  normalizeCustomRankingDraft,
  toCustomRankingSummary,
  toPublicCustomRanking,
  type CustomRankingDraft,
  type StoredCustomRanking,
} from "../../../lib/customRanking";
import { loadCustomImage } from "../customImages";
import { listCustomRankings, saveCustomRanking } from "../customRankings.store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) || "";
  const rankings = await listCustomRankings(query);
  return NextResponse.json({
    rankings: rankings.map((ranking) =>
      toCustomRankingSummary(toPublicCustomRanking(ranking))
    ),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CustomRankingDraft;
    const draft = normalizeCustomRankingDraft(body);
    const images = await Promise.all(draft.items.map((item) => loadCustomImage(item.imageId)));
    if (images.some((image) => !image)) throw new Error("One or more uploaded pictures expired. Upload them again.");

    const id = randomBytes(12).toString("hex");
    const slug = customRankingSlug(draft.title, randomBytes(3).toString("hex"));
    const manageKey = generateManageKey();
    const now = new Date().toISOString();
    const visible = {
      id,
      slug,
      ...draft,
      playsCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    const ranking: StoredCustomRanking = {
      ...visible,
      manageKeyHash: hashManageKey(manageKey),
      searchText: buildCustomRankingSearchText(visible),
    };
    await saveCustomRanking(ranking);
    return NextResponse.json(
      { ranking: toPublicCustomRanking(ranking), manageKey },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The ranking could not be saved." },
      { status: 400 }
    );
  }
}
