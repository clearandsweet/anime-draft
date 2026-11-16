import assert from 'node:assert/strict';
import test from 'node:test';
import { matchEbay } from '../app/lib/shelf/ebay.ts';
import { castNames, classifyFigure, findCharacters, findTaggedCharacters, identityKey, leadingMaker, nameKey, normalize, searchTerms, seriesHas } from '../app/lib/shelf/match.ts';
import { mergeOffers } from '../app/lib/shelf/merge.ts';
import { DEFAULT_SETTINGS, scoreFigure } from '../app/lib/shelf/score.ts';
import { matchShop } from '../app/lib/shelf/shops.ts';
import { matchSolaris } from '../app/lib/shelf/solaris.ts';

test('normalizes punctuation, apostrophes, accents, "x" and the Turn A sign', () => {
  assert.equal(normalize("Frieren: Beyond Journey's End"), 'frieren beyond journeys end');
  assert.equal(normalize('SPY×FAMILY'), normalize('Spy x Family'));
  assert.equal(normalize('Noël Kannagi'), 'noel kannagi');
  assert.equal(normalize('Mahou Shoujo Madoka★Magica'), normalize('Mahou Shoujo Madoka☆Magica'));
  assert.equal(normalize('∀ Gundam'), 'turn a gundam');
});

test('one spelling for the ways shops romanize a name', () => {
  assert.equal(nameKey('cocoa'), nameKey('kokoa'));
  assert.equal(nameKey('kyouko'), nameKey('kyoko'));
  assert.equal(nameKey('holo'), nameKey('horo'));
  assert.equal(nameKey('ryuuko'), nameKey('ryuko'));
  assert.notEqual(nameKey('rem'), nameKey('ram'));
});

test('a one-word title has to be the whole series name', () => {
  assert.ok(seriesHas('lupin iii', 'lupin'));
  assert.ok(seriesHas('aria the animation', 'aria'));
  assert.ok(!seriesHas('monster musume no iru nichijou', 'nichijou'));
  assert.ok(seriesHas('gekijouban chainsaw man reze hen', 'chainsaw man'));
});

test('searches the name the main entries share, then a spin-off titled differently', () => {
  const terms = searchTerms([
    { english: 'The Melancholy of Haruhi Suzumiya', romaji: 'Suzumiya Haruhi no Yuuutsu' },
    { english: 'The Disappearance of Haruhi Suzumiya', romaji: 'Suzumiya Haruhi no Shoushitsu' },
    { english: 'The Melancholy of Haruhi Suzumiya (2009)', romaji: 'Suzumiya Haruhi no Yuuutsu (2009)' },
    { english: 'The Disappearance of Nagato Yuki-chan', romaji: 'Nagato Yuki-chan no Shoushitsu' },
  ], [{ english: 'The Melancholy of Haruhi-chan Suzumiya', romaji: 'Suzumiya Haruhi-chan no Yuuutsu' }, { english: 'Kyon', romaji: null }]);
  assert.deepEqual(terms.queries, ['haruhi suzumiya', 'disappearance of nagato yuki chan']);
  assert.ok(terms.exact.includes('the melancholy of haruhi suzumiya'));
  assert.ok(!terms.exact.some((title) => title.endsWith('2009')));
  // Relatives need two words to be worth matching on.
  assert.deepEqual(terms.related, ['the melancholy of haruhi chan suzumiya', 'suzumiya haruhi chan no yuuutsu']);
});

test('keeps a shorter title without the subtitle as a loose match', () => {
  const terms = searchTerms([{ english: 'Sword Art Online: Alicization', romaji: 'Sword Art Online: Alicization' }]);
  assert.deepEqual(terms.exact, ['sword art online alicization']);
  assert.deepEqual(terms.loose, ['sword art online']);
  assert.deepEqual(searchTerms([{ english: 'ARIA The OVA: Arietta', romaji: null }]).loose, []);
});

test('sorts figures into classes by line and maker, and drops merchandise and kits', () => {
  const kind = (...args) => { const c = classifyFigure(...args); return c ? `${c.tier}${c.adj || ''}` : null; };
  assert.equal(kind('Madoka - Nendoroid Petite (Good Smile Company)'), 'E');
  assert.equal(kind('Holo - Nendoroid (#728)'), 'C');
  assert.equal(kind('figma Utena #376 (with Chu-Chu)'), 'C');
  assert.equal(kind('POP UP PARADE Holo L size'), 'D');
  assert.equal(kind('Holo 1/7 Complete Figure', '', 'Alter'), 'A');
  assert.equal(kind('ALTER Panty and Stocking with Garterbelt Stocking 1/8 PVC'), 'A');
  assert.equal(kind('Makima - ARTFX J - 1/8 (Kotobukiya)'), 'B');
  assert.equal(kind('Akemi Homura - B-style - 1/4 - Rabbit Ears Ver. (FREEing)'), 'B');
  assert.equal(kind('Holo - 1/6 - Hakama Ver.', '', 'Bell Fine'), 'B-0.3');
  assert.equal(kind('Utena Tenjou G.E.M. 1/8', '', 'MegaHouse'), 'B');
  assert.equal(kind('Rem - Luminasta (SEGA)'), 'E');
  assert.equal(kind('Frieren - Something', 'Prize'), 'E');
  assert.equal(kind('Frieren - Acrylic Stand'), null);
  assert.equal(kind('Holo - Plushie'), null);
  assert.equal(kind('HGBD: R 1/144 Wodom Pod'), null);
  assert.equal(kind('Megami Device Puni Mofu Yoru Tu'), null);
  assert.equal(kind('DX Chogokin 1/60 VF-25S Messiah'), 'D');
});

test('a budget maker lowers the quality a scale figure starts from', () => {
  const figure = { show: 's', chars: [], tier: 'B', price: 100 };
  const plain = scoreFigure(figure, 100, {});
  const budget = scoreFigure({ ...figure, qAdj: -0.3 }, 100, {});
  assert.equal(plain.prior, DEFAULT_SETTINGS.priors.B);
  assert.equal(budget.prior.toFixed(1), '8.6');
  assert.ok(budget.overall < plain.overall);
});

const cast = (...members) => {
  const names = castNames(members.map(([id, full, first, last, alternative]) => ({ key: `anilist:${id}`, full, first, last, alternative })));
  return members.map(([, full], i) => ({ key: names[i].key, name: full, names: names[i].names, fav: 100 - i, score: 0 }));
};

test('finds characters in either name order and any romanization, by tag or by text', () => {
  const haruhi = cast([1, 'Haruhi Suzumiya', 'Haruhi', 'Suzumiya'], [2, 'Yuki Nagato', 'Yuki', 'Nagato']);
  assert.deepEqual(findTaggedCharacters(['Suzumiya Haruhi'], haruhi), ['anilist:1']);
  assert.deepEqual(findTaggedCharacters(['Nagato Yuki (Disappearance)'], haruhi), ['anilist:2']);
  assert.deepEqual(findCharacters(normalize('figma Yuki Nagato school uniform'), haruhi), ['anilist:2']);
  // A given name alone is enough normally, but not when the caller asks for names in full.
  assert.deepEqual(findCharacters(normalize('figma Yuki school uniform'), haruhi), ['anilist:2']);
  assert.deepEqual(findCharacters(normalize('figma Yuki school uniform'), haruhi, true), []);
  const madoka = cast([38005, 'Homura Akemi', 'Homura', 'Akemi']);
  assert.deepEqual(findTaggedCharacters(['Homura'], madoka), ['anilist:38005']);
  // Sisters share a family name, so only the given name tells them apart, however it's spelled.
  const rabbit = cast([3, 'Cocoa Hoto', 'Cocoa', 'Hoto'], [4, 'Mocha Hoto', 'Mocha', 'Hoto']);
  assert.deepEqual(findTaggedCharacters(['Hoto Kokoa'], rabbit), ['anilist:3']);
  const nier = cast([5, '2B', '2B', null], [6, '9S', '9S', null]);
  assert.deepEqual(findCharacters(normalize('TENITOL "NieR:Automata" 9S'), nier), ['anilist:6']);
});

test('reads the maker off the front of a title, and nowhere else', () => {
  assert.equal(leadingMaker('ALTER Panty and Stocking with Garterbelt Stocking 1/8 PVC'), 'Alter');
  assert.equal(leadingMaker('Max Factory K-On! Yui Hirasawa 1/7'), 'Max Factory');
  assert.equal(leadingMaker('New Wave of Figures'), '');
});

test('the same figure has the same key in every shop', () => {
  const titles = ['sono bisque doll wa koi o suru', 'my dress up darling'];
  const solaris = identityKey('Kitagawa Marin - 1/6 - Liz ver.', titles, 'Alter');
  assert.equal(solaris, identityKey('My Dress-Up Darling Marin Kitagawa Liz Ver. 1/6 Complete Figure', titles, 'Alter'));
  assert.equal(solaris, identityKey('"My Dress-Up Darling" Marin Kitagawa Liz Ver. 1/6 Scale Figure (Alter) - 2026 Re-release', titles, ''));
  assert.notEqual(solaris, identityKey('Kitagawa Marin - 1/7 - Swimsuit Ver.', titles, 'Alter'));
  // Too little left to be sure it's the same sculpt.
  assert.equal(identityKey('My Dress-Up Darling Marin', titles, ''), '');
});

const madokaShow = {
  id: 'a9756', score: 100,
  terms: searchTerms(
    [{ english: 'Puella Magi Madoka Magica', romaji: 'Mahou Shoujo Madoka☆Magica' }],
    [{ english: 'Magia Record: Puella Magi Madoka Magica Side Story', romaji: 'Magia Record: Mahou Shoujo Madoka☆Magica Gaiden' }]
  ),
  cast: cast([38005, 'Homura Akemi', 'Homura', 'Akemi'], [38001, 'Madoka Kaname', 'Madoka', 'Kaname']),
};
const magiaShow = {
  id: 'a104051', score: 60,
  terms: searchTerms([{ english: 'Magia Record: Puella Magi Madoka Magica Side Story', romaji: 'Magia Record: Mahou Shoujo Madoka☆Magica Gaiden' }]),
  cast: cast([1, 'Iroha Tamaki', 'Iroha', 'Tamaki']),
};
const row = (handle, title, chars, franchise = '') => [handle, title, '', 50, 1, 0, 0, 'General', franchise, chars, 0];
const catalog = {
  checkedOn: '2026-10-23', imagePrefix: '',
  rows: [
    row('homura', 'Gekijouban Mahou Shoujo Madoka☆Magica: Hangyaku no Monogatari - Akemi Homura - 1/7 (Aniplex)', 'Akemi Homura'),
    row('iroha', 'Magia Record: Mahou Shoujo Madoka☆Magica Gaiden - Tamaki Iroha - 1/7 (Aniplex)', 'Tamaki Iroha'),
    row('witch', 'Mahou Shoujo Madoka☆Magica - Charlotte - Witch Collection (Max Factory)', 'Charlotte'),
    row('untagged', 'Mahou Shoujo Madoka☆Magica - Kaname Madoka - 1/8 (Good Smile Company)', ''),
  ],
};

test('a listing is the cast, the show, or only a sister series', () => {
  const alone = Object.fromEntries(matchSolaris(catalog, [madokaShow]).map((f) => [f.id, f]));
  assert.equal(alone['solaris:homura'].match, 'cast');
  assert.equal(alone['solaris:homura'].tier, 'A');
  // Someone outside the cast under exactly the show's title: a minor character.
  assert.equal(alone['solaris:witch'].match, 'series');
  // No character tags: the title is read instead, and Max Factory isn't Max.
  assert.equal(alone['solaris:untagged'].match, 'cast');
  assert.deepEqual(alone['solaris:untagged'].charNames, ['Madoka Kaname']);
  // A spin-off with its own cast only counts as related.
  assert.equal(alone['solaris:iroha'].match, 'related');
  const both = matchSolaris(catalog, [madokaShow, magiaShow]);
  assert.equal(both.find((f) => f.id === 'solaris:iroha').show, 'a104051');
  assert.equal(both.find((f) => f.id === 'solaris:iroha').match, 'cast');
  assert.equal(both.find((f) => f.id === 'solaris:homura').show, 'a9756');
});

test('a related series keeps 60% of the show score', () => {
  const figure = { show: 's', chars: ['unknown'], tier: 'B', price: 100 };
  const own = scoreFigure({ ...figure, match: 'series' }, 100, {});
  const related = scoreFigure({ ...figure, match: 'related' }, 100, {});
  assert.equal(own.showScore, 100);
  assert.equal(related.showScore, 60);
  assert.match(related.showHow, /related series/);
});

const shop = (rows) => ({ id: 'animota', name: 'animota', host: 'animota.net', currency: 'USD', jpyPerUsd: 150, checkedOn: '2026-11-16', imagePrefix: 'https://cdn.example/', rows });
const listing = (handle, title, extra = {}) => [handle, title, '', extra.price ?? 50, 1, extra.used ?? 0, extra.maker ?? '', extra.jan ?? '', extra.series ?? '', extra.note ?? ''];

test('reads free-text listings: title, character, and what to do with one-word titles', () => {
  const aria = {
    id: 'a477', score: 100,
    terms: searchTerms([{ english: 'ARIA The ANIMATION', romaji: 'ARIA The ANIMATION' }]),
    cast: cast([10, 'Akari Mizunashi', 'Akari', 'Mizunashi'], [11, 'Alice Carroll', 'Alice', 'Carroll']),
  };
  const found = Object.fromEntries(matchShop(shop([
    listing('nendo', 'Nendoroid "ARIA" Mizunashi Akari', { series: 'ARIA', maker: 'Good Smile Company' }),
    listing('plain', 'ARIA Alice Carroll 1/8 Complete Figure'),
    listing('other', 'Aria the Scarlet Ammo Aria H. Kanzaki 1/8'),
    listing('given', 'Aria of Sorrow Alice figure'),
    listing('homura', 'ANIPLEX Puella Magi Madoka Magica Homura Akemi 1/8 PVC', { used: 1, note: 'Pre-owned, rank A' }),
    listing('iroha', 'Magia Record: Puella Magi Madoka Magica Side Story Iroha Tamaki 1/7'),
    listing('set', '[Resale] Puella Magi Madoka Magica Trading Figure Box'),
  ]), [aria, madokaShow]).map((f) => [f.id.replace('animota:', ''), f]));
  assert.deepEqual(Object.keys(found).sort(), ['homura', 'iroha', 'nendo', 'plain', 'set']);
  assert.deepEqual(found.nendo.charNames, ['Akari Mizunashi']);
  // A one-word title in running text needs a full name beside it.
  assert.deepEqual(found.plain.charNames, ['Alice Carroll']);
  assert.equal(found.homura.maker, 'Aniplex');
  assert.equal(found.homura.cond, 'pre-owned');
  assert.equal(found.homura.note, 'Pre-owned, rank A');
  assert.equal(found.iroha.match, 'related');
  assert.equal(found.set.match, 'series');
  assert.equal(found.set.name, 'Puella Magi Madoka Magica Trading Figure Box');
});

test('a short everyday title in running text needs a full name, and a numbered sequel is a sister series', () => {
  const school = {
    id: 'a2476', score: 90,
    terms: searchTerms([{ english: 'School Days', romaji: 'School Days' }]),
    cast: cast([30, 'Kotonoha Katsura', 'Kotonoha', 'Katsura'], [31, 'Kokoro Katsura', 'Kokoro', 'Katsura']),
  };
  const valkyria = {
    id: 'a5507', score: 50,
    terms: searchTerms([{ english: 'Valkyria Chronicles', romaji: 'Senjou no Valkyria' }]),
    cast: cast([40, 'Selvaria Bles', 'Selvaria', 'Bles']),
  };
  const persona = {
    id: 'a10588', score: 70,
    terms: searchTerms([{ english: 'Persona 4 the Animation', romaji: 'Persona 4 the Animation' }]),
    cast: cast([50, 'Rise Kujikawa', 'Rise', 'Kujikawa']),
  };
  assert.deepEqual(persona.terms.exact, ['persona 4']);
  assert.deepEqual(persona.terms.loose, ['persona']);
  const found = Object.fromEntries(matchShop(shop([
    listing('real', 'Nendoroid "School Days" Katsura Kotonoha', { series: 'School Days' }),
    listing('costume', '"BanG Dream! Girls Band Party!" PM Figure Tsurumaki Kokoro School Days', { series: 'BanG Dream! Girls Band Party!' }),
    listing('vc4', 'Senjou no Valkyria 4 Riley Miller 1/7 Complete Figure'),
    listing('vc1', 'Valkyria Chronicles Selvaria Bles Swimsuit Ver. 1/7'),
    listing('p5', '"Persona 5" Morgana Nendoroid', { series: 'Persona 5' }),
    listing('p4', '"Persona 4" Rise Kujikawa 1/8', { series: 'Persona 4' }),
  ]), [school, valkyria, persona]).map((f) => [f.id.replace('animota:', ''), f.match]));
  assert.deepEqual(found, { real: 'cast', vc4: 'related', vc1: 'cast', p4: 'cast' });
});

test("the show's name isn't its character, unless the listing says it twice", () => {
  const moon = {
    id: 'a530', score: 100,
    terms: searchTerms([{ english: 'Sailor Moon', romaji: 'Bishoujo Senshi Sailor Moon' }]),
    cast: cast([20, 'Usagi Tsukino', 'Usagi', 'Tsukino', ['Sailor Moon']], [21, 'Ami Mizuno', 'Ami', 'Mizuno', ['Sailor Mercury']]),
  };
  const found = Object.fromEntries(matchShop(shop([
    listing('mercury', 'S.H.Figuarts Sailor Moon Sailor Mercury'),
    listing('moon', 'Sailor Moon Q posket Sailor Moon'),
  ]), [moon]).map((f) => [f.id.replace('animota:', ''), f.charNames]));
  assert.deepEqual(found, { mercury: ['Ami Mizuno'], moon: ['Usagi Tsukino'] });
});

test('one card per figure: shops merge by barcode or by description, best offer first', () => {
  const base = { show: 'a1', match: 'cast', line: '1/7 scale', tier: 'A', chars: ['anilist:1'], charNames: ['Holo'], img: null, mfcHref: '', mfcDirect: false };
  const offer = (source, price, avail = 'in stock', cond = 'new') => ({ source, url: `https://${source}/x`, price, cond, avail });
  const figure = (id, name, maker, o, extra = {}) => ({ ...base, ...o, offers: [o], id, name, maker, ...extra });
  const shows = [{ id: 'a1', terms: searchTerms([{ english: 'Spice and Wolf', romaji: 'Ookami to Koushinryou' }]) }];
  const merged = mergeOffers([
    figure('solaris:a', 'Holo - 1/7 - Plentiful Apple Harvest Ver.', 'Chara-Ani, Good Smile Company', offer('solaris', 206, 'sold out'), { img: 'solaris.jpg' }),
    figure('ninoma:a', 'Ookami to Koushinryou - Holo - 1/7 - Plentiful Apple Harvest Ver. (Chara-Ani, Good Smile Company)', 'Chara-ani', offer('ninoma', 208), { jan: '4546098093594' }),
    figure('animota:a', 'Spice and Wolf Holo Plentiful Apple Harvest Ver. 1/7 Complete Figure', 'Kadokawa', offer('animota', 190, 'pre-order'), { jan: '4546098093594' }),
    figure('solaris:b', 'Holo - 1/7', 'Ques Q', offer('solaris', 119)),
    figure('animota:b', 'Spice and Wolf Holo 1/7 Complete Figure', 'Ques Q', offer('animota', 144)),
    figure('solaris:c', 'Holo - 1/7', 'Alter', offer('solaris', 300)),
  ], shows);
  assert.equal(merged.length, 3);
  const apple = merged.find((f) => f.id === 'solaris:a');
  // In stock beats pre-order beats sold out, whatever the price; the sold-out line is dropped.
  assert.deepEqual(apple.offers.map((o) => o.source), ['ninoma', 'animota']);
  assert.equal(apple.price, 208);
  assert.equal(apple.avail, 'in stock');
  assert.equal(apple.img, 'solaris.jpg');
  assert.equal(apple.jan, '4546098093594');
  // A bare "Holo 1/7" only merges within one maker.
  assert.deepEqual(merged.find((f) => f.id === 'solaris:b').offers.map((o) => o.price), [119, 144]);
  assert.equal(merged.find((f) => f.id === 'solaris:c').offers, undefined);
});

test('eBay listings need the show or a character, and knock-offs are dropped', () => {
  const item = (itemId, title, extra = {}) => ({
    itemId, title, itemWebUrl: `https://www.ebay.com/itm/${itemId}`, price: { value: '49.99', currency: 'USD' },
    condition: 'Pre-owned', itemLocation: { country: 'JP' }, image: { imageUrl: `https://i.ebayimg.com/${itemId}.jpg` }, ...extra,
  });
  const figures = matchEbay([
    item('1', 'Homura Akemi 1/8 figure Good Smile authentic'),
    item('2', 'Puella Magi Madoka Magica Nendoroid Madoka', { condition: 'New' }),
    item('3', 'Homura Akemi figure 25cm bootleg'),
    item('4', 'Homura Akemi 1/7 figure', { itemLocation: { country: 'CN' } }),
    item('5', 'Homura Akemi acrylic stand'),
    item('6', 'Random figure lot'),
    item('7', 'Homura Akemi 1/8', { price: { value: '6000', currency: 'JPY' } }),
  ], madokaShow);
  assert.deepEqual(figures.map((f) => f.id), ['ebay:1', 'ebay:2']);
  assert.equal(figures[0].charNames[0], 'Homura Akemi');
  assert.equal(figures[0].cond, 'pre-owned');
  assert.equal(figures[1].cond, 'new');
  assert.equal(figures[1].tier, 'C');
  assert.equal(figures[0].img, 'https://i.ebayimg.com/1.jpg');
});
