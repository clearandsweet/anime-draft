import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DEFAULT_SETTINGS, characterPopularity, scoreFigure } from '../app/lib/shelf/score.ts';

const seed = JSON.parse(readFileSync(new URL('../app/lib/shelf/seed.json', import.meta.url), 'utf8'));
// The artifact's own show scores and character data on 2026-10-22.
const artifact = JSON.parse(readFileSync(new URL('./fixtures/shelf-artifact.json', import.meta.url), 'utf8'));
const score = (id) => scoreFigure(seed.figures[id], artifact.showScores[seed.figures[id].show], artifact.chars);

test('reproduces the Figure Shelf Score artifact to 0.1', () => {
  // [figure, overall, value] as the artifact showed them; null where it showed nothing
  for (const [id, overall, value] of [
    ['md-homura-timeshift', 90.2, null],
    ['ut-utena-gem', 89.4, null],
    ['onk-ai-kd', 88.0, undefined],
    ['ps-panty-alter', 88.0, 50.7],
    ['onk-ai-pup', undefined, 54.7],
    ['sxf-yor-nendo', undefined, 53.0],
  ]) {
    const result = score(id);
    if (overall !== undefined) assert.equal(result.overall.toFixed(1), overall.toFixed(1), id);
    if (value === null) assert.equal(result.value, null, id);
    else if (value !== undefined) assert.equal(result.value.toFixed(1), value.toFixed(1), id);
  }
});

test('blends a small MFC sample toward the line average', () => {
  const few = scoreFigure({ show: 's', chars: [], tier: 'B', mfcR: 10, mfcN: 5 }, 100, {});
  const many = scoreFigure({ show: 's', chars: [], tier: 'B', mfcR: 10, mfcN: 5000 }, 100, {});
  assert.ok(few.quality < many.quality);
  assert.equal(scoreFigure({ show: 's', chars: [], tier: 'B' }, 100, {}).quality, DEFAULT_SETTINGS.priors.B);
});

test('uses favourite counts only when every character in the show has one', () => {
  const chars = { a: { show: 's', fav: 400 }, b: { show: 's', fav: 100 }, c: { show: 't', rank: 2 } };
  assert.equal(characterPopularity('b', chars).value, 0.5);
  assert.equal(characterPopularity('c', chars).value, 0.75);
  assert.equal(characterPopularity('b', { ...chars, b: { ...chars.b, favourite: true } }).value, 1);
});

test('a show scored 0 drops out and an unpriced figure has no value score', () => {
  const result = scoreFigure({ show: 's', chars: [], tier: 'C' }, 0, {});
  assert.equal(result.excluded, true);
  assert.equal(result.value, null);
});
