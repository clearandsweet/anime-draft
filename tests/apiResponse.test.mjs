import assert from "node:assert/strict";
import test from "node:test";
import { readApiResponse } from "../app/lib/apiResponse.ts";

test("reads JSON API responses", async () => {
  const result = await readApiResponse(
    new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    })
  );
  assert.deepEqual(result, { ok: true });
});

test("turns an HTML server failure into a useful message", async () => {
  await assert.rejects(
    () =>
      readApiResponse(
        new Response("<!DOCTYPE html><title>500</title>", {
          status: 500,
          headers: { "Content-Type": "text/html" },
        })
      ),
    /temporarily unavailable/
  );
});

test("explains authorization pages without exposing parser errors", async () => {
  await assert.rejects(
    () =>
      readApiResponse(
        new Response("<!DOCTYPE html><title>Sign in</title>", {
          status: 401,
          headers: { "Content-Type": "text/html" },
        })
      ),
    /not publicly available/
  );
});
