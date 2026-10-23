import assert from 'node:assert/strict';
import test from 'node:test';
import { buildShelf, mfcLink } from '../app/lib/shelf/shelf.ts';

const seed = {
  pricesCheckedOn: '2026-10-22',
  shows: { madoka: { name: 'Madoka', anchor: 9756 }, hug: { name: 'HUGtto! Precure', anchor: 100661 } },
  chars: { homura: { name: 'Homura Akemi', show: 'madoka', rank: 1 }, hana: { name: 'Hana Nono', show: 'hug', rank: 1 } },
  figures: {
    'md-homura': { name: 'Homura 1/8', show: 'madoka', chars: ['homura'], tier: 'B', line: '1/8', maker: 'X', price: 100, mfcUrl: 'https://myfigurecollection.net/item/117637' },
    'hug-hana': { name: 'Hana Nendoroid', show: 'hug', chars: ['hana'], tier: 'C', line: 'Nendoroid', maker: 'Y' },
  },
};
const catalog = {
  generatedAt: '2026-10-22',
  shows: {
    madoka: { topFav: 40000, members: [{ id: 9756, idMal: 9756, title: 'TV' }, { id: 11981, idMal: 11981, title: 'Rebellion' }] },
    hug: { topFav: 900, members: [{ id: 100661, idMal: 36593, title: 'HUGtto' }] },
  },
  chars: { homura: { anilistId: 38005, name: 'Homura Akemi', fav: 40000 }, hana: { anilistId: 1, name: 'Hana Nono', fav: 300 } },
};
const entry = (anilistId, malId, score, title) => ({ anilistId, malId, score, status: 'COMPLETED', title });

test("a show takes the person's highest score in its franchise", () => {
  const shelf = buildShelf({ seed, catalog, entries: [entry(9756, 9756, 100, 'TV'), entry(11981, 11981, 40, 'Rebellion')] });
  const madoka = shelf.shows.find((s) => s.id === 'madoka');
  assert.equal(madoka.score, 100);
  assert.match(madoka.basis, /highest score in the franchise: 100 \(TV\)/);
});

test('MAL lists match through MAL ids, and unwatched shows drop their figures', () => {
  const shelf = buildShelf({ seed, catalog, entries: [entry(null, 36593, 80, 'HUGtto')] });
  assert.equal(shelf.shows.find((s) => s.id === 'hug').score, 80);
  assert.deepEqual(shelf.figures.map((f) => f.id), ['hug-hana']);
});

test('a favourite character counts as fully popular', () => {
  const entries = [entry(100661, null, 80, 'HUGtto')];
  const plain = buildShelf({ seed, catalog, entries }).figures[0].result.popularity.value;
  const fav = buildShelf({ seed, catalog, entries, favouriteCharacters: [1] }).figures[0].result.popularity.value;
  assert.equal(plain.toFixed(3), Math.sqrt(300 / 900).toFixed(3));
  assert.equal(fav, 1);
});

test('MFC links open the item page when known and search otherwise', () => {
  assert.deepEqual(mfcLink(seed.figures['md-homura']), { href: 'https://myfigurecollection.net/item/117637', direct: true });
  assert.equal(mfcLink({ name: 'Makima 1/7' }).href, 'https://myfigurecollection.net/?_tb=item&keywords=Makima%201%2F7');
});
