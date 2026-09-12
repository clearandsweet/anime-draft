import assert from 'node:assert/strict';
import test from 'node:test';
import { createAniListClient, AniListError, anilistErrorResponse } from '../app/lib/anilist.ts';

const success = () => Response.json({ data: { Page: { characters: [{ id: 1 }] } } });
test('deduplicates concurrent requests, caches success, and expires the cache', async () => {
  let calls = 0, now = 0;
  const client = createAniListClient({ now: () => now, fetch: async () => { calls++; return success(); } });
  await Promise.all([client('query', { page: 1 }, 100), client('query', { page: 1 }, 100)]);
  await client('query', { page: 1 }, 100);
  assert.equal(calls, 1);
  now = 101;
  await client('query', { page: 1 }, 100);
  assert.equal(calls, 2);
});
test('rejects GraphQL errors in HTTP 200 and never caches failure', async () => {
  let calls = 0;
  const client = createAniListClient({ fetch: async () => ++calls === 1 ? Response.json({ errors: [{ message: 'Bad query' }] }) : success() });
  await assert.rejects(client('query', {}), AniListError);
  assert.ok((await client('query', {})).data);
  assert.equal(calls, 2);
});
test('honors rate-limit cooldown without rapid retries and forwards Retry-After', async () => {
  let calls = 0, now = 0;
  const client = createAniListClient({ now: () => now, fetch: async () => ++calls === 1 ? new Response('', { status: 429, headers: { 'Retry-After': '45' } }) : success() });
  await assert.rejects(client('query', {}), (error) => {
    const response = anilistErrorResponse(error);
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '45');
    return true;
  });
  await assert.rejects(client('another query', {}), /45 seconds/);
  assert.equal(calls, 1);
  now = 45_001;
  await client('query', {});
  assert.equal(calls, 2);
});
test('explains a forbidden response without retrying it', async () => {
  let calls = 0;
  const client = createAniListClient({ fetch: async () => { calls++; return new Response('<html>Forbidden</html>', { status: 403 }); } });
  await assert.rejects(client('query', {}), (error) => error.status === 503 && /refusing/.test(error.message));
  assert.equal(calls, 1);
});
test('recovers from one transient server error', async () => {
  let calls = 0;
  const delays = [];
  const client = createAniListClient({ sleep: async (ms) => { delays.push(ms); }, fetch: async () => ++calls === 1 ? new Response('', { status: 502 }) : success() });
  assert.ok((await client('query', {})).data);
  assert.equal(calls, 2);
  assert.deepEqual(delays, [500]);
});
test('rejects malformed JSON, missing data, and private lists', async () => {
  for (const response of [new Response('<html>oops</html>'), Response.json({}), Response.json({data: null, errors: [{ message: 'User not found', status: 404 }]})]) {
    const client = createAniListClient({fetch: async () => response});
    await assert.rejects(client('query', {}), AniListError);
  }
});
