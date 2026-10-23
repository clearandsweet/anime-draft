import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanRatings, pickWikidataCharacters, rankWikidataWorks } from '../app/lib/shelf/characters.ts';
import { characterPopularity } from '../app/lib/shelf/score.ts';

const entity = (id, name, description, links, classes = []) => ({
  id,
  labels: { en: { value: name } },
  descriptions: { en: { value: description } },
  sitelinks: Object.fromEntries(Array.from({ length: links }, (_, i) => [`wiki${i}`, {}])),
  claims: { P31: classes.map((c) => ({ mainsnak: { datavalue: { value: { id: c } } } })) },
});

test('keeps characters, drops places and weapons, and ranks by wiki coverage', () => {
  // Shapes seen for Touhou Project and Genshin Impact on 2026-10-23.
  const picked = pickWikidataCharacters([
    entity('Q1048313', 'Lævateinn', 'sword in Norse mythology', 7),
    entity('Q5365548', 'Gensokyo', 'fictional setting of Touhou Project', 6),
    entity('Q3293703', 'Marisa Kirisame', 'character from Touhou Project', 6, ['Q15632617']),
    entity('Q3469425', 'Sakuya Izayoi', 'Touhou Project character', 6),
    entity('Q107263539', 'Mondstadt', 'fictional city-state in Genshin Impact', 8),
    entity('Q102349530', '2B', 'protagonist of NieR: Automata', 12),
    entity('Q4646376', '9S', '', 5),
    entity('Q9', 'Prism River', 'fictional planet', 30),
    entity('Q10', 'Night of Nights', 'song from Touhou Project', 9),
  ]);
  assert.deepEqual(picked.map((c) => c.name), ['2B', 'Marisa Kirisame', 'Sakuya Izayoi', '9S']);
  assert.equal(picked[0].key, 'wikidata:Q102349530');
  assert.equal(picked[0].popularityLabel, '12 wikis');
});

test('returns at most five characters', () => {
  const many = Array.from({ length: 9 }, (_, i) => entity(`Q${i + 1}`, `Hero ${i}`, 'video game character', i));
  assert.equal(pickWikidataCharacters(many).length, 5);
  assert.equal(pickWikidataCharacters(many)[0].name, 'Hero 8');
});

test('puts games first among search hits without hiding the rest', () => {
  const works = rankWikidataWorks([
    { id: 'Q111657460', label: 'NieR:Automata Ver1.1a', description: 'Japanese anime television series' },
    { id: 'Q21078985', label: 'NieR: Automata', description: '2017 action role-playing video game' },
    { id: 'Q1', description: 'no label' },
  ]);
  assert.deepEqual(works.map((w) => w.id), ['Q21078985', 'Q111657460']);
});

test('accepts only whole 1–10 ratings with known keys', () => {
  assert.deepEqual(
    cleanRatings({ 'anilist:38005': 9, 'wikidata:Q3293703': 10, 'anilist:1': 0, 'anilist:2': 7.5, 'mal:3': 5, 'wikidata:Q4': '8' }),
    { 'anilist:38005': 9, 'wikidata:Q3293703': 10 }
  );
  assert.deepEqual(cleanRatings(null), {});
  assert.deepEqual(cleanRatings([1, 2]), {});
});

test("a character's rating replaces popularity, favourites included", () => {
  const chars = { homura: { show: 'madoka', fav: 100, rating: 6, favourite: true }, madoka: { show: 'madoka', fav: 400 } };
  assert.deepEqual(characterPopularity('homura', chars), { value: 0.6, how: 'your rating 6/10' });
  assert.equal(characterPopularity('madoka', chars).value, 1);
});
