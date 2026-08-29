import { NextResponse } from "next/server";
import { verifyManageKey } from "../../../lobby/manageKey";
import { toPublicCustomRanking } from "../../../../lib/customRanking";
import { deleteCustomImage } from "../../customImages";
import { deleteCustomRanking, loadCustomRanking } from "../../customRankings.store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 70);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const ranking = await loadCustomRanking(cleanSlug((await params).slug));
  if (!ranking) return NextResponse.json({ error: "Ranking not found." }, { status: 404 });
  return NextResponse.json({ ranking: toPublicCustomRanking(ranking) });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const ranking = await loadCustomRanking(cleanSlug((await params).slug));
  if (!ranking) return NextResponse.json({ error: "Ranking not found." }, { status: 404 });
  const manageKey = request.headers.get("x-manage-key") || "";
  if (!verifyManageKey(manageKey, ranking.manageKeyHash)) {
    return NextResponse.json({ error: "This browser cannot manage that ranking." }, { status: 403 });
  }
  await deleteCustomRanking(ranking.id);
  await Promise.allSettled(ranking.items.map((item) => deleteCustomImage(item.imageId)));
  return NextResponse.json({ ok: true });
}
