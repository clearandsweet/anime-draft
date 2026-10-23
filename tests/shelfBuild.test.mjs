import assert from 'node:assert/strict';
import test from 'node:test';
import { buildShelf, buildShows, mfcLink, scoreShelf } from '../app/lib/shelf/shelf.ts';

const character = (id, full, favourites, first = null, last = null) => ({ id, full, first, last, alternative: [], favourites });
const homura = character(38005, 'Homura Akemi', 12000, 'Homura', 'Akemi');
const madoka = character(38001, 'Madoka Kaname', 5000, 'Madoka', 'Kaname');
const hana = character(1, 'Hana Nono', 300, 'Hana', 'Nono');

const media = (id, english, romaji, extra = {}) => ({
  id, idMal: id, format: 'TV', year: 2011, popularity: 1000, title: { english, romaji, native: null },
  synonyms: [], image: `https://img/${id}.jpg`, relations: [], main: [], top: [], ...extra,
});
const tv = media(9756, 'Puella Magi Madoka Magica', 'Mahou Shoujo Madoka☆Magica', {
  popularity: 900, relations: [{ type: 'SEQUEL', id: 11981 }], main: [38005, 38001], top: [homura, madoka],
});
const rebellion = media(11981, 'Puella Magi Madoka Magica the Movie Part III: Rebellion', 'Gekijouban Mahou Shoujo Madoka☆Magica: Hangyaku no Monogatari', {
  format: 'MOVIE', year: 2013, popularity: 500, relations: [{ type: 'PREQUEL', id: 9756 }], main: [38005, 38001], top: [homura, madoka],
});
const hug = media(100661, 'HUGtto! PreCure', 'HUGtto! Precure', { year: 2018, main: [1], top: [hana] });
const entry = (m, score) => ({ media: m, score, status: 'COMPLETED' });

const seed = {
  pricesCheckedOn: '2026-10-22',
  shows: { madoka: { name: 'Madoka', anchor: 9756 } },
  chars: { homura: { name: 'Homura Akemi', show: 'madoka', rank: 1 } },
  figures: {
    'md-homura': { name: 'Homura 1/8', show: 'madoka', chars: ['homura'], tier: 'B', line: '1/8', maker: 'X', price: 100, mfcR: 9.2, mfcN: 400, url: 'https://solarisjapan.com/products/homura-1-8', mfcUrl: 'https://myfigurecollection.net/item/117637' },
  },
};
const catalog = {
  generatedAt: '2026-10-22',
  shows: { madoka: { topFav: 12000, members: [{ id: 9756, idMal: 9756, title: 'TV' }, { id: 11981, idMal: 11981, title: 'Rebellion' }] } },
  chars: { homura: { anilistId: 38005, name: 'Homura Akemi', fav: 12000 } },
};
const row = (handle, title, chars, price = 50, stock = 1) => [handle, title, `files/${handle}.jpg`, price, stock, 0, 0, 'General', '', chars, 0];
const solaris = {
  checkedOn: '2026-10-23',
  imagePrefix: 'https://cdn.example/',
  rows: [
    row('homura-1-8', 'Mahou Shoujo Madoka☆Magica - Akemi Homura - 1/8 (Good Smile Company)', 'Akemi Homura', 120),
    row('madoka-pup', 'Gekijouban Mahou Shoujo Madoka☆Magica: Hangyaku no Monogatari - Kaname Madoka - Pop Up Parade (Good Smile Company)', 'Kaname Madoka', 40),
    row('hana-style', 'HUGtto! Precure - Nono Hana - Precure Style (Bandai)', 'Nono Hana', 30),
  ],
};

test("a franchise takes the person's highest score and its first series' name", () => {
  const [show] = buildShows([entry(tv, 100), entry(rebellion, 40)]);
  assert.equal(show.score, 100);
  assert.equal(show.name, 'Puella Magi Madoka Magica');
  assert.equal(show.id, 'a9756');
  assert.match(show.basis, /highest score in the franchise: 100 \(Puella Magi Madoka Magica\)/);
  assert.deepEqual(show.cast.map((c) => c.key), ['anilist:38005', 'anilist:38001']);
  assert.deepEqual(show.terms.queries, ['puella magi madoka magica']);
});

test('researched figures join their franchise, refreshed from the catalog, which then skips that listing', () => {
  const shelf = buildShelf({ entries: [entry(rebellion, 90), entry(hug, 80)], seed, catalog, solaris });
  const researched = shelf.figures.find((f) => f.id === 'seed:md-homura');
  assert.equal(researched.show, 'a11981');
  assert.equal(researched.price, 120);
  assert.equal(researched.img, 'https://cdn.example/files/homura-1-8.jpg?width=400');
  assert.equal(researched.mfcHref, 'https://myfigurecollection.net/item/117637');
  assert.ok(!shelf.figures.some((f) => f.id === 'solaris:homura-1-8'));
  assert.deepEqual(shelf.figures.map((f) => f.id).sort(), ['seed:md-homura', 'solaris:hana-style', 'solaris:madoka-pup']);
  assert.equal(shelf.matched, 3);
});

test('unscored shows get no picks; favourites and ratings drive character popularity', () => {
  const entries = [entry(tv, 100), entry(hug, 0)];
  const shelf = buildShelf({ entries, seed, catalog, solaris });
  const plain = scoreShelf(shelf);
  assert.ok(plain.every((f) => f.show === 'a9756'));
  const pup = (scored) => scored.find((f) => f.id === 'solaris:madoka-pup').result.popularity;
  assert.equal(pup(plain).value.toFixed(3), Math.sqrt(5000 / 12000).toFixed(3));
  assert.equal(pup(scoreShelf({ ...shelf, favouriteCharacters: [38001] })).value, 1);
  assert.equal(pup(scoreShelf({ ...shelf, ratings: { 'anilist:38001': 5 } })).value, 0.5);
});

test("keeps each show's best 60 figures for sale and 15 sold out", () => {
  const many = { ...solaris, rows: Array.from({ length: 90 }, (_, i) => row(`f${i}`, `HUGtto! Precure - Nono Hana - Figure ${i} (Bandai)`, 'Nono Hana', 30 + i, i < 70 ? 1 : 0)) };
  const shelf = buildShelf({ entries: [entry(hug, 80)], seed, catalog, solaris: many });
  assert.equal(shelf.matched, 90);
  assert.equal(shelf.figures.filter((f) => f.avail !== 'sold out').length, 60);
  assert.equal(shelf.figures.filter((f) => f.avail === 'sold out').length, 15);
});

test('MFC links open the item page when known and search otherwise', () => {
  assert.deepEqual(mfcLink(seed.figures['md-homura']), { href: 'https://myfigurecollection.net/item/117637', direct: true });
  assert.equal(mfcLink({ name: 'Makima 1/7' }).href, 'https://myfigurecollection.net/?_tb=item&keywords=Makima%201%2F7');
});
