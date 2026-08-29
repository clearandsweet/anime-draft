import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCustomRankingSearchText,
  customRankingSlug,
  normalizeCustomRankingDraft,
  selectCustomRankingPlay,
  toPublicCustomRanking,
} from "../app/lib/customRanking.ts";

function draft(size = 7) {
  return {
    title: "Best Magical Transformations",
    creator: "Kai",
    description: "Rank the transformation sequences.",
    tags: ["Anime", "Magical Girls", "anime"],
    playCount: 5,
    items: Array.from({ length: size }, (_, index) => ({
      title: `Transformation ${index + 1}`,
      imageId: `abcdefghijkl${String(index).padStart(2, "0")}`,
    })),
  };
}

function ranking() {
  const normalized = normalizeCustomRankingDraft(draft());
  return {
    id: "ranking-1",
    slug: "best-magical-transformations-abc123",
    ...normalized,
    playsCount: 0,
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
  };
}

test("normalizes a ranking draft and deduplicates tags", () => {
  const normalized = normalizeCustomRankingDraft(draft());
  assert.equal(normalized.items.length, 7);
  assert.deepEqual(normalized.tags, ["anime", "magical girls"]);
  assert.equal(normalized.items[0].imageUrl, "/api/blind-ranking/custom/images/abcdefghijkl00");
});

test("requires enough completed titled pictures", () => {
  assert.throws(
    () => normalizeCustomRankingDraft(draft(4)),
    /at least 5 titled images/
  );
});

test("rejects duplicate item titles and duplicate pictures", () => {
  const duplicateTitle = draft();
  duplicateTitle.items[1].title = duplicateTitle.items[0].title;
  assert.throws(() => normalizeCustomRankingDraft(duplicateTitle), /different title/);

  const duplicatePicture = draft();
  duplicatePicture.items[1].imageId = duplicatePicture.items[0].imageId;
  assert.throws(() => normalizeCustomRankingDraft(duplicatePicture), /different picture/);
});

test("builds searchable text from metadata and hidden pool entries", () => {
  const value = ranking();
  const text = buildCustomRankingSearchText(value);
  assert.match(text, /kai/);
  assert.match(text, /magical girls/);
  assert.match(text, /transformation 7/);
});

test("creates readable collision-resistant slugs", () => {
  assert.equal(customRankingSlug("  Café! Tier List ", "A1B2C3"), "cafe-tier-list-a1b2c3");
});

test("selects a deterministic random subset for each play seed", () => {
  const value = ranking();
  const first = selectCustomRankingPlay(value, "same-seed");
  const again = selectCustomRankingPlay(value, "same-seed");
  const different = selectCustomRankingPlay(value, "different-seed");
  assert.equal(first.length, 5);
  assert.deepEqual(first, again);
  assert.notDeepEqual(first.map((item) => item.id), different.map((item) => item.id));
});

test("public rankings never expose creator management data", () => {
  const stored = {
    ...ranking(),
    manageKeyHash: "secret-hash",
    searchText: "secret-index",
  };
  const visible = toPublicCustomRanking(stored);
  assert.equal("manageKeyHash" in visible, false);
  assert.equal("searchText" in visible, false);
});
