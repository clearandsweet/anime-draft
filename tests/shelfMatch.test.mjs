import assert from 'node:assert/strict';
import test from 'node:test';
import { matchEbay } from '../app/lib/shelf/ebay.ts';
import { castNames, classifyFigure, findCharacters, findTaggedCharacters, normalize, searchTerms } from '../app/lib/shelf/match.ts';
import { matchSolaris } from '../app/lib/shelf/solaris.ts';

test('normalizes punctuation, apostrophes, accents and "x"', () => {
  assert.equal(normalize("Frieren: Beyond Journey's End"), 'frieren beyond journeys end');
  assert.equal(normalize('SPY×FAMILY'), normalize('Spy x Family'));
  assert.equal(normalize('Noël Kannagi'), 'noel kannagi');
  assert.equal(normalize('Mahou Shoujo Madoka★Magica'), normalize('Mahou Shoujo Madoka☆Magica'));
});

test('searches the name the main entries share, then a spin-off titled differently', () => {
  const terms = searchTerms([
    { english: 'The Melancholy of Haruhi Suzumiya', romaji: 'Suzumiya Haruhi no Yuuutsu' },
    { english: 'The Disappearance of Haruhi Suzumiya', romaji: 'Suzumiya Haruhi no Shoushitsu' },
    { english: 'The Melancholy of Haruhi Suzumiya (2009)', romaji: 'Suzumiya Haruhi no Yuuutsu (2009)' },
    { english: 'The Disappearance of Nagato Yuki-chan', romaji: 'Nagato Yuki-chan no Shoushitsu' },
  ]);
  assert.deepEqual(terms.queries, ['haruhi suzumiya', 'disappearance of nagato yuki chan']);
  assert.ok(terms.exact.includes('the melancholy of haruhi suzumiya'));
  assert.ok(!terms.exact.some((title) => title.endsWith('2009')));
});

test('keeps a shorter title without the subtitle as a loose match', () => {
  const terms = searchTerms([{ english: 'Sword Art Online: Alicization', romaji: 'Sword Art Online: Alicization' }]);
  assert.deepEqual(terms.exact, ['sword art online alicization']);
  assert.deepEqual(terms.loose, ['sword art online']);
});

test('sorts figures into classes and drops merchandise', () => {
  const tier = (...args) => classifyFigure(...args)?.tier ?? null;
  assert.equal(tier('Madoka - Nendoroid Petite (Good Smile Company)'), 'E');
  assert.equal(tier('Holo - Nendoroid (#728)'), 'C');
  assert.equal(tier('figma Utena #376 (with Chu-Chu)'), 'C');
  assert.equal(tier('POP UP PARADE Holo L size'), 'D');
  assert.equal(tier('Holo 1/7 Complete Figure', '', 'Alter'), 'A');
  assert.equal(tier('Makima - ARTFX J - 1/8 (Kotobukiya)'), 'B');
  assert.equal(tier('Akemi Homura - B-style - 1/4 - Rabbit Ears Ver. (FREEing)'), 'A');
  assert.equal(tier('Rem - Luminasta (SEGA)'), 'E');
  assert.equal(tier('Frieren - Something', 'Prize'), 'E');
  assert.equal(tier('Frieren - Acrylic Stand'), null);
  assert.equal(tier('Holo - Plushie'), null);
});

const cast = (...members) => {
  const names = castNames(members.map(([id, full, first, last]) => ({ key: `anilist:${id}`, full, first, last })));
  return members.map(([, full], i) => ({ key: names[i].key, name: full, names: names[i].names, fav: 100 - i }));
};

test('finds characters in either name order, by tag or by text', () => {
  const haruhi = cast([1, 'Haruhi Suzumiya', 'Haruhi', 'Suzumiya'], [2, 'Yuki Nagato', 'Yuki', 'Nagato']);
  assert.deepEqual(findTaggedCharacters(['Suzumiya Haruhi'], haruhi), ['anilist:1']);
  assert.deepEqual(findTaggedCharacters(['Nagato Yuki (Disappearance)'], haruhi), ['anilist:2']);
  assert.deepEqual(findCharacters(normalize('figma Yuki Nagato school uniform'), haruhi), ['anilist:2']);
  const madoka = cast([38005, 'Homura Akemi', 'Homura', 'Akemi']);
  assert.deepEqual(findTaggedCharacters(['Homura'], madoka), ['anilist:38005']);
});

const madokaShow = {
  id: 'a9756', score: 100,
  terms: searchTerms([{ english: 'Puella Magi Madoka Magica', romaji: 'Mahou Shoujo Madoka☆Magica' }]),
  cast: cast([38005, 'Homura Akemi', 'Homura', 'Akemi'], [38001, 'Madoka Kaname', 'Madoka', 'Kaname']),
};
const magiaShow = {
  id: 'a104051', score: 60,
  terms: searchTerms([{ english: 'Magia Record: Puella Magi Madoka Magica Side Story', romaji: 'Magia Record: Mahou Shoujo Madoka☆Magica Gaiden' }]),
  cast: cast([1, 'Iroha Tamaki', 'Iroha', 'Tamaki']),
};
const row = (handle, title, chars) => [handle, title, '', 50, 1, 0, 0, 'General', '', chars, 0];
const catalog = {
  checkedOn: '2026-10-23', imagePrefix: '',
  rows: [
    row('homura', 'Gekijouban Mahou Shoujo Madoka☆Magica: Hangyaku no Monogatari - Akemi Homura - 1/7 (Aniplex)', 'Akemi Homura'),
    row('iroha', 'Magia Record: Mahou Shoujo Madoka☆Magica Gaiden - Tamaki Iroha - 1/7 (Aniplex)', 'Tamaki Iroha'),
  ],
};

test('a spin-off with another cast stays out of the franchise its title contains', () => {
  const alone = matchSolaris(catalog, [madokaShow]);
  assert.deepEqual(alone.map((f) => f.id), ['solaris:homura']);
  assert.equal(alone[0].tier, 'A');
  const both = matchSolaris(catalog, [madokaShow, magiaShow]);
  assert.equal(both.find((f) => f.id === 'solaris:iroha').show, 'a104051');
  assert.equal(both.find((f) => f.id === 'solaris:homura').show, 'a9756');
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
