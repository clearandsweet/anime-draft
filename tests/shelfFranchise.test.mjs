import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { castSimilarity, groupFranchises } from '../app/lib/shelf/franchise.ts';

// Real AniList main casts and relations, fetched 2026-10-22.
const media = JSON.parse(readFileSync(new URL('./fixtures/anilist-casts.json', import.meta.url), 'utf8'));
const byId = new Map(media.map((m) => [m.id, m]));
const groupOf = (groups, id) => groups.find((g) => g.ids.includes(id));

test('remakes and sequels with the same characters are one franchise', () => {
  const groups = groupFranchises(media);
  assert.deepEqual(groupOf(groups, 2966).ids, [2966, 5341, 6884, 145728]); // Spice and Wolf 2008, II, specials, 2024 remake
  assert.deepEqual(groupOf(groups, 9756).ids, [9756, 11981]); // Madoka TV + Rebellion
  assert.deepEqual(groupOf(groups, 530).ids, [530, 14751]); // Sailor Moon + Crystal
});

test('each Precure series and a new-cast spin-off stand alone', () => {
  const groups = groupFranchises(media);
  for (const id of [603, 1534, 100661, 20577, 104051]) assert.deepEqual(groupOf(groups, id).ids, [id]);
});

test('a crossover cast never bridges two franchises', () => {
  const series = [603, 1534, 100661, 20577];
  const allStars = {
    id: 900,
    relations: series.map((id) => ({ type: 'CHARACTER', id })),
    cast: [...series.flatMap((id) => byId.get(id).cast), 9001, 9002],
  };
  // Two series meeting in one movie is a crossover too.
  const duo = { id: 904, relations: [{ type: 'ALTERNATIVE', id: 603 }, { type: 'ALTERNATIVE', id: 1534 }], cast: [...byId.get(603).cast, ...byId.get(1534).cast] };
  const groups = groupFranchises([...media, allStars, duo]);
  for (const id of [900, 904]) {
    assert.equal(groupOf(groups, id).crossover, true);
    assert.deepEqual(groupOf(groups, id).ids, [id]);
  }
  for (const id of series) assert.deepEqual(groupOf(groups, id).ids, [id]);
});

test('a run of All Stars movies with near-identical casts still bridges nothing', () => {
  const series = [603, 1534, 100661, 20577];
  const movies = [910, 911, 912].map((id, i) => ({
    id,
    relations: [...series.map((s) => ({ type: 'CHARACTER', id: s })), { type: 'SEQUEL', id: id + 1 }],
    cast: [...series.flatMap((s) => byId.get(s).cast), 9200 + i],
  }));
  const groups = groupFranchises([...media, ...movies]);
  for (const id of series) assert.deepEqual(groupOf(groups, id).ids, [id]);
});

test('a main season is not a crossover of its own side stories', () => {
  // Two shorts with separate pairs of characters, both inside a later season's cast.
  const sm = byId.get(530).cast;
  const season = { id: 905, relations: [{ type: 'PREQUEL', id: 530 }], cast: [...sm, 9101, 9102] };
  const shortA = { id: 906, relations: [{ type: 'OTHER', id: 905 }], cast: [sm[1], sm[2]] };
  const shortB = { id: 907, relations: [{ type: 'OTHER', id: 905 }], cast: [9101, 9102] };
  const groups = groupFranchises([...media, season, shortA, shortB]);
  assert.equal(groupOf(groups, 905).crossover, false);
  assert.ok(groupOf(groups, 905).ids.includes(530));
});

test('a two-character film joins the show along with its own music video', () => {
  // Chainsaw Man: the TV cast is Denji, Power, Makima, Aki; the Reze Arc film is Denji and Reze,
  // and its IRIS OUT music video has the same two.
  const tv = { id: 950, relations: [{ type: 'SEQUEL', id: 951 }, { type: 'OTHER', id: 952 }], cast: [1, 2, 3, 4] };
  const film = { id: 951, relations: [{ type: 'PREQUEL', id: 950 }, { type: 'CHARACTER', id: 953 }], cast: [1, 7] };
  const tvVideo = { id: 952, relations: [{ type: 'OTHER', id: 950 }], cast: [2] };
  const filmVideo = { id: 953, relations: [{ type: 'CHARACTER', id: 951 }], cast: [1, 7] };
  const groups = groupFranchises([tv, film, tvVideo, filmVideo]);
  assert.deepEqual(groupOf(groups, 950).ids, [950, 951, 953]);
});

test('a one-character special joins its parent show', () => {
  const amiSpecial = { id: 901, relations: [{ type: 'PARENT', id: 530 }], cast: [byId.get(530).cast[1]] };
  const groups = groupFranchises([...media, amiSpecial]);
  assert.deepEqual(groupOf(groups, 901).ids, [530, 901, 14751]);
  assert.equal(groupOf(groups, 901).crossover, false);
});

test('an entry with no listed cast follows only a direct continuation', () => {
  const recap = { id: 902, relations: [{ type: 'SUMMARY', id: 9756 }], cast: [] };
  const unrelated = { id: 903, relations: [{ type: 'OTHER', id: 9756 }], cast: [] };
  const groups = groupFranchises([...media, recap, unrelated]);
  assert.deepEqual(groupOf(groups, 902).ids, [902, 9756, 11981]);
  assert.deepEqual(groupOf(groups, 903).ids, [903]);
});

test('cast similarity is shared over all characters', () => {
  assert.equal(castSimilarity([1, 2, 3], [2, 3, 4]), 0.5);
  assert.equal(castSimilarity([], [1]), 0);
});
