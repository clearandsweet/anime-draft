"use client";

import { useState, useCallback, useEffect } from "react";

// ─────────────────────────────────────────────────
// CARD CATEGORIZATION
// ─────────────────────────────────────────────────

// Order matters: more specific patterns first (bubbly before water, genesect_ex before genesect).
const TR = "(team\\s*rocket['’]?s?\\s*|tr['’]?s?\\s*)"; // straight or curly apostrophe
const CARD_TYPES = {
  staryu: /\bstaryu\b/i,
  starmie: /\bstarmie\b/i,          // Mega Starmie ex (POR) — Jet Blow {W} / Nebula Beam {C}{C}{C}
  snorunt: /\bsnorunt\b/i,
  froslass: /\bfroslass\b/i,        // Mega Froslass ex (ASC) — Resentful Refrain {W}
  meowth_ex: /\bmeowth\s*ex\b/i,
  mew_ex: /\bmew(\s*ex)?\b/i,       // "Mew" or "Mew ex" (\b stops it matching Mewtwo)
  psyduck: /\bpsyduck\b/i,
  latias_ex: /\blatias\s*ex\b/i,
  tatsugiri: /\btatsugiri\b/i,
  munkidori: /\bmunkidori\b/i,
  genesect_ex: /\bgenesect\s*ex\b/i,
  genesect: /\bgenesect\b/i,
  carmine: /\bcarmine\b/i,
  boss: /\bboss['’]?s?\s*orders\b/i,
  hilda: /\bhilda\b/i,
  lillies: /\blillie['’]?s?\s*determination\b/i,
  wally: /\bwally['’]?s?\s*compassion\b/i,
  judge: /\bjudge\b/i,
  lucian: /\blucian\b/i,
  salvatore: /\bsalvatore\b/i,
  pokegear: /\bpok[eé]gear\b/i,
  pokepad: /\bpok[eé]\s*pad\b/i,
  poffin: /\bpoffin\b/i,
  ultra_ball: /\bultra\s*ball\b/i,
  nest_ball: /\bnest\s*ball\b/i,
  air_balloon: /\b(air\s*balloon|rescue\s*board)\b/i, // Rescue Board (−1) = Balloon for our 1-retreat basics
  call_bell: /\bcall\s*bell\b/i,       // Item: going second, first turn only → any Supporter
  scoop_up: /\bscoop\s*up\s*cyclone\b/i,
  secret_box: /\bsecret\s*box\b/i,     // ACE SPEC: discard 3 → Item + Tool + Supporter + Stadium
  surfing_beach: /\bsurfing\s*beach\b/i,
  energy_search: /\benergy\s*search\b/i,
  bubbly_water_energy: /\bbubbly\b.*\benergy\b/i,     // Special Energy — Energy Search can't fetch it
  water_energy: /(\bwater\b|\{W\})\s*energy\b/i,      // "Water Energy" or PTCGL's "Basic {W} Energy"
  ignition_energy: /\bignition\s*energy\b/i,
  switch_card: /\bswitch\b(?!\s*(cart|catcher))/i,
  tr_mimikyu: new RegExp(`\\b${TR}mimikyu\\b`, "i"),
  tr_articuno: new RegExp(`\\b${TR}articuno\\b`, "i"),
  tr_zubat: new RegExp(`\\b${TR}zubat\\b`, "i"),
};

const ZERO_RETREAT = new Set(["tr_mimikyu", "mew_ex"]);
const NONZERO_RETREAT = new Set([
  "staryu", "snorunt", "meowth_ex", "tr_zubat", "tr_articuno",
  "tatsugiri", "latias_ex", "munkidori", "genesect", "genesect_ex", "psyduck",
]);
// Rule Box basics — Poké Pad can't fetch these
const RULE_BOX = new Set(["meowth_ex", "mew_ex", "latias_ex", "genesect_ex"]);
// Basics with ≤70 HP that matter as fetch targets — Buddy-Buddy Poffin eligible
const POFFIN_OK = new Set(["staryu", "snorunt", "tatsugiri"]);
// Water basics — Surfing Beach can swap an Active one with a Benched one
const WATER_BASICS = new Set(["staryu", "snorunt", "psyduck"]);

const BASIC_TYPES = new Set([
  "staryu", "snorunt", "meowth_ex", "mew_ex",
  "tr_mimikyu", "tr_articuno", "tr_zubat",
  "tatsugiri", "latias_ex",
  "munkidori", "genesect", "genesect_ex", "psyduck",
  "basic_pokemon",
]);

const EVOLUTION_PATTERNS = [
  /\bstarmie\b/i, /\bpersian\b/i, /\braichu\b/i, /\bcharizard\b/i,
  /\bblastoise\b/i, /\bvenusaur\b/i, /\bgallade\b/i,
  /\binteleon\b/i, /\bdrizzile\b/i, /\bdragapult\b/i, /\bdrakloak\b/i,
  /\bkirlia\b/i, /\bgardevoir\b/i, /\bdudunsparce\b/i,
  /\bbaxcalibur\b/i, /\bnoivern\b/i, /\bfrosmoth\b/i,
  /\bmeganium\b/i, /\bmienshao\b/i, /\bclefable\b/i, /\bazumarill\b/i,
  /\bmilotic\b/i, /\bludicolo\b/i, /\blombre\b/i, /\bdragalge\b/i,
  /\bcrobat\b/i, /\bgolbat\b/i, /\bivysaur\b/i, /\bcharmeleon\b/i,
  /\bwartortle\b/i, /\bpidgeotto\b/i, /\bpidgeot\b/i,
  /\bninetales\b/i, /\bwigglytuff\b/i, /\barcanine\b/i,
  /\bpoliwhirl\b/i, /\bpoliwrath\b/i, /\bkadabra\b/i, /\balakazam\b/i,
  /\bmachoke\b/i, /\bmachamp\b/i, /\btentacruel\b/i, /\bgraveler\b/i,
  /\bgolem\b/i, /\bslowbro\b/i, /\bmagneton\b/i, /\bhaunter\b/i,
  /\bgengar\b/i, /\bhypno\b/i, /\bkingler\b/i, /\belectrode\b/i,
  /\bexeggutor\b/i, /\bmarowak\b/i, /\bweezing\b/i,
  /\brhydon\b/i, /\brhyperior\b/i, /\bseadra\b/i,
  /\bgyarados\b/i, /\bvaporeon\b/i, /\bjolteon\b/i, /\bflareon\b/i,
  /\bdragonair\b/i, /\bdragonite\b/i, /\bambipom\b/i, /\bcinccino\b/i,
  /\bfroslass\b/i, /\bgolduck\b/i, /\bferaligatr\b/i, /\bcroconaw\b/i,
  /\bweavile\b/i, /\bglalie\b/i,
];

function categorizeCard(name, inPokemonSection) {
  for (const [key, pattern] of Object.entries(CARD_TYPES)) {
    if (pattern.test(name)) return key;
  }
  for (const p of EVOLUTION_PATTERNS) {
    if (p.test(name)) return "evolution_pokemon";
  }
  if (inPokemonSection) return "basic_pokemon";
  if (/\bex\b/i.test(name)) return "basic_pokemon";
  if (/energy/i.test(name)) return "energy";
  return "other";
}

// Accepts the PTCGL export as-is: "Pokémon: 17" headers, "Basic {W} Energy MEE 11", "Total Cards: 60".
function parseDeckList(text) {
  const lines = text.trim().split("\n");
  const cards = [];
  let currentSection = "unknown";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const secMatch = trimmed.match(/^(Pok[eé]mon|Trainer|Energy|Total(?:\s+Cards)?)\s*:/i);
    if (secMatch) {
      const s = secMatch[1].toLowerCase();
      currentSection = /pok/i.test(s) ? "pokemon" : /train/i.test(s) ? "trainer" : /energy/i.test(s) ? "energy" : "unknown";
      continue;
    }
    if (/^\d+\s*$/.test(trimmed)) continue;

    const m = trimmed.match(/^\*?\s*(\d+)\s+(.+)$/);
    if (!m) continue;
    const count = parseInt(m[1], 10);
    // Strip trailing "SET 123" — set codes may contain digits (e.g. 30C) but need at least one letter
    const name = (m[2].trim().replace(/\s+(?=[A-Z0-9-]*[A-Z])[A-Z0-9-]{2,6}\s+\d+.*$/, "").trim()) || m[2].trim();
    const type = categorizeCard(name, currentSection === "pokemon");

    for (let i = 0; i < count; i++) {
      cards.push({ name, type, isBasic: BASIC_TYPES.has(type) });
    }
  }
  return cards;
}

// ─────────────────────────────────────────────────
// SIMULATION
// ─────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const has = (cards, t) => cards.some((c) => c.type === t);
const cnt = (cards, t) => cards.filter((c) => c.type === t).length;
function topHas(arr, n, t) {
  const m = Math.min(n, arr.length);
  for (let i = 0; i < m; i++) if (arr[i].type === t) return true;
  return false;
}

const METHODS = ["direct", "via_call_bell", "via_secret_box", "via_pokegear", "via_meowth", "via_scoop_meowth", "via_ultraball_meowth", "via_tatsugiri"];
let SCOOP_REPLAY = true; // Scoop Up an Active Meowth ex, then replay it for Last-Ditch Catch (false = Scoop only switches)
let DISCARDS = true; // charge discard costs: Ultra Ball 2, Secret Box 3, paid only from cards the combo doesn't need

// Cards in hand a turn-1 combo never uses, so they can pay discard costs: other Supporters/Trainers,
// Megas stuck in hand (Salvatore can't use them), Carmine going second, a Secret Box you're not playing,
// spare energy (keep 1), spare Salvatore (keep 1), Energy Search when a {W} is already in hand, copies of
// a Basic past 2 (one may be Active, one may be needed). On top of this, each plan adds whatever it leaves
// unused: Pokégear / Call Bell (once the Supporter is secured), Switch / Scoop Up / Air Balloon / Stadium,
// and search cards (Nest Ball, Poffin, Poké Pad, spare Ultra Ball) — see planFeasible / canFetch.
const JUNK_TYPES = new Set(["other", "carmine", "starmie", "froslass", "evolution_pokemon", "energy", "secret_box",
  "boss", "hilda", "lillies", "wally", "judge", "lucian"]);
function junkCount(hh) {
  let n = 0; const c = {};
  for (const x of hh) { if (JUNK_TYPES.has(x.type)) n++; else c[x.type] = (c[x.type] || 0) + 1; }
  const en = (c.water_energy || 0) + (c.bubbly_water_energy || 0) + (c.ignition_energy || 0);
  n += Math.max(0, en - 1) + Math.max(0, (c.salvatore || 0) - 1);
  const es = c.energy_search || 0;
  n += (c.water_energy || c.bubbly_water_energy) ? es : Math.max(0, es - 1);
  for (const t in c) if (BASIC_TYPES.has(t)) n += Math.max(0, c[t] - 2);
  return n;
}
const BOX_ITEMS = ["ultra_ball", "poffin", "nest_ball", "switch_card", "energy_search", null]; // Secret Box Item picks
function emptyMethods() { const o = {}; METHODS.forEach(m => o[m] = 0); return o; }

// Going-second outcome buckets — every game lands in exactly one. g = group:
// "vn" attacks from a normal start · "vs" attacks after a forced Meowth ex start
// "nn" no attack, normal start      · "ns" no attack, forced Meowth ex start
const OUTCOMES = [
  { k: "v_both",           g: "vn", label: "Either Mega can attack" },
  { k: "v_starmie",        g: "vn", label: "Only Starmie can attack" },
  { k: "v_froslass",       g: "vn", label: "Only Froslass can attack" },
  { k: "v_stuck_balloon",  g: "vs", label: "Meowth start → Air Balloon out" },
  { k: "v_stuck_scoop",    g: "vs", label: "Meowth start → Scoop Up out" },
  { k: "v_stuck_either",   g: "vs", label: "Meowth start → Balloon or Scoop (both in hand)" },
  { k: "v_stuck_box",      g: "vs", label: "Meowth start → Secret Box got the way out" },
  { k: "v_stuck_both",     g: "vs", label: "Meowth start → needed Balloon + Scoop" },
  { k: "v_stuck_other",    g: "vs", label: "Meowth start → other escape (Switch / Latias)" },
  { k: "n_setup",          g: "nn", label: "Salvatore reachable, attacker can't be set up" },
  { k: "n_salvatore",      g: "nn", label: "No way to reach Salvatore" },
  { k: "n_energy",         g: "nn", label: "No usable energy" },
  { k: "n_prized",         g: "nn", label: "Both Megas prized / in hand" },
  { k: "n_stuck_blocked",  g: "ns", label: "Meowth start, had an escape card, still blocked" },
  { k: "n_stuck_noescape", g: "ns", label: "Meowth start, no Balloon / Scoop / Switch" },
  { k: "n_stuck_norescue", g: "ns", label: "Meowth start, no rescue (can't bench a basic)" },
];

// Per-game solver. Given the turn hand (h, 8 cards), remaining deck (d) and the basics
// available to start Active (openTypes), decides whether a Supporter can be found AND
// the required Pokémon can end up where they need to be — with every search card, Switch,
// Scoop Up Cyclone, Air Balloon and the Surfing Beach swap spent at most once, and at most
// one retreat per turn.
// junkSpent: discards already paid this turn (Secret Box's 3) — they come out of the same junk.
function makeSolver(h, d, openTypes, orders = [d], junkSpent = 0) {
  const res = {
    UB: cnt(h, "ultra_ball"), NB: cnt(h, "nest_ball"), PF: cnt(h, "poffin"), PD: cnt(h, "pokepad"),
    SW: cnt(h, "switch_card"),
    SC: Math.min(1, cnt(h, "scoop_up")),   // ACE SPEC — Scoop the Active, promote from Bench
    AB: cnt(h, "air_balloon"),
    PG: cnt(h, "pokegear"),
    CB: cnt(h, "call_bell"),               // only usable going second, on your first turn
    SB: has(h, "surfing_beach") ? 1 : 0,   // Stadium effect: once per turn, Water ↔ Water
  };
  const latiasInHand = has(h, "latias_ex");
  // Discard budget for Ultra Ball (2 cards each): baseJ (always-spare cards, minus discards already paid)
  // + pj (Pokégear / Call Bell not spent on the Supporter) + whatever the plan leaves unused.
  const baseJ = junkCount(h) - junkSpent;
  const pgcb = cnt(h, "pokegear") + cnt(h, "call_bell"); // any Latias in hand can simply be benched this turn

  // Deck orders for "look at top N" effects. Look #0 sees the real top of deck; every later
  // look happens after a shuffle (Pokégear / Tatsugiri both shuffle), so it gets a fresh order.
  // `orders` can be shared between solvers for the same game so what-if checks see the same shuffles.
  const order =(k) => { while (orders.length <= k) orders.push(shuffle(d)); return orders[k]; };
  const lookHit = (sup, sizes) => sizes.some((s, k) => topHas(order(k), s, sup));

  // Can every requirement be fetched from deck with distinct search cards?
  // Reqs: a basic type (to Bench) or "meowth_hand" (Ultra Ball only — Meowth's ability needs it
  // played FROM HAND, so Nest Ball / Poffin putting it straight onto the Bench doesn't trigger it).
  const fetchMemo = new Map();
  // extraJunk: spare cards the calling plan leaves unused (see planFeasible); default = nothing used.
  function canFetch(reqs, extraJunk = pgcb + res.SW + res.SC + res.AB + res.SB) {
    const key = `${[...reqs].sort().join(",")}|${extraJunk}`;
    if (fetchMemo.has(key)) return fetchMemo.get(key);
    const need = {};
    for (const r of reqs) { const t = r === "meowth_hand" ? "meowth_ex" : r; need[t] = (need[t] || 0) + 1; }
    let ok = true;
    for (const t in need) if (cnt(d, t) < need[t]) ok = false;
    if (ok) {
      const pool = { UB: res.UB, NB: res.NB, PF: res.PF * 2, PD: res.PD }; // each Poffin = 2 slots
      // Every Ultra Ball played needs 2 other cards discarded: spare cards + search cards left unplayed
      // (a Poffin with both slots unused, Nest Balls, Poké Pads, other Ultra Balls).
      const paid = () => {
        const ubUsed = res.UB - pool.UB;
        if (!DISCARDS || ubUsed === 0) return true;
        return 2 * ubUsed <= baseJ + extraJunk + pool.NB + pool.PD + Math.floor(pool.PF / 2) + pool.UB;
      };
      const opts = (r) => {
        if (r === "meowth_hand") return ["UB"];
        const o = ["NB", "UB"];
        if (POFFIN_OK.has(r)) o.push("PF");
        if (!RULE_BOX.has(r)) o.push("PD");
        return o;
      };
      const rec = (i) => {
        if (i === reqs.length) return paid();
        for (const s of opts(reqs[i])) {
          if (pool[s] > 0) { pool[s]--; if (rec(i + 1)) return true; pool[s]++; }
        }
        return false;
      };
      ok = rec(0);
    }
    fetchMemo.set(key, ok);
    return ok;
  }

  // path = sequence of Active Pokémon, e.g. [Meowth ex, Snorunt]. Each transition is paid by
  // one of: Switch / Scoop Up Cyclone (swAvail of them), the Surfing Beach swap (Water → Water,
  // once), or a retreat. Max ONE retreat per turn, and it must be free (leaving Pokémon has 0 RC,
  // Air Balloon on it, or Latias ex in play). Paying retreat with Energy would burn the turn's
  // attachment the attack needs, so it's not allowed.
  const planMemo = new Map();
  // pj = Pokégear / Call Bell cards free to discard on this line.
  function planFeasible(path, reqs, swAvail = res.SW + res.SC, pj = pgcb) {
    const key = `${path.join(">")}|${[...reqs].sort().join(",")}|${swAvail}|${pj}`;
    if (planMemo.has(key)) return planMemo.get(key);
    const n = path.length - 1;
    const rec = (i, sw, beach, retreated, ab, latias) => {
      if (i === n) {
        const spare = pj + (swAvail - sw) + (res.AB - ab) + (res.SB && !beach ? 1 : 0); // unused movers are discardable
        return latias && !latiasInHand ? canFetch([...reqs, "latias_ex"], spare) : canFetch(reqs, spare);
      }
      const from = path[i], to = path[i + 1];
      if (sw < swAvail && rec(i + 1, sw + 1, beach, retreated, ab, latias)) return true;
      if (!beach && res.SB && WATER_BASICS.has(from) && WATER_BASICS.has(to) &&
          rec(i + 1, sw, true, retreated, ab, latias)) return true;
      if (!retreated) {
        if ((ZERO_RETREAT.has(from) || latias) && rec(i + 1, sw, beach, true, ab, latias)) return true;
        if (ab < res.AB && rec(i + 1, sw, beach, true, ab + 1, latias)) return true;  // Air Balloon
        if (!latias && rec(i + 1, sw, beach, true, ab, true)) return true;            // Latias ex in play
      }
      return false;
    };
    const ok = rec(0, 0, false, false, 0, false);
    planMemo.set(key, ok);
    return ok;
  }

  // Build a plan: consecutive duplicates collapse; anything that has to be in play (in the path
  // or on the Bench) but isn't the starting Active and isn't already in hand must be fetched.
  function mkPlan(raw, bench = []) {
    const path = raw.filter((x, i) => i === 0 || x !== raw[i - 1]);
    const reqs = [];
    const seen = new Set([path[0]]);
    for (const x of [...path, ...bench]) {
      if (seen.has(x)) continue;
      seen.add(x);
      if (!has(h, x)) reqs.push(x);
    }
    return { path, reqs };
  }

  const otherBasics = [...new Set([...h, ...d].filter(c => c.isBasic && c.type !== "meowth_ex").map(c => c.type))];

  // sup: Supporter to find. target: basic that must evolve and attack from the Active Spot (null for Combo 1).
  // (Mew ex's Memory Helix — Mew Active copying the Benched Mega's attack — is deliberately not a
  // separate route: anything that gets Mew Active can get the target Active instead, because Mew
  // retreats for free. Tested: it adds 0 games on turn 1.)
  // second = going second (Combos 2/3): Call Bell is live. Combo 1 is going first, so it never is.
  function solve(sup, target, second = false) {
    const byLen = (a, b) => a.path.length - b.path.length;
    const tail = target ? [target] : [];
    const plans = openTypes.map(A => mkPlan([A, ...tail])).sort(byLen);
    const tatPlans = openTypes.map(A => mkPlan([A, "tatsugiri", ...tail])).sort(byLen);
    const anyPlan = (ps, extra = [], pred = () => true, pj = pgcb) =>
      ps.some(p => pred(p) && planFeasible(p.path, [...p.reqs, ...extra], res.SW + res.SC, pj));
    const inDeck = has(d, sup);
    const gear = Array(res.PG).fill(7);
    // Meowth ex from hand: a copy that isn't the one sitting Active
    const meowthFree = (p) => cnt(h, "meowth_ex") - (p.path[0] === "meowth_ex" ? 1 : 0) >= 1;
    // Active Meowth ex → Scoop Up Cyclone it (that pays the first transition), promote, then replay
    // it from hand to the Bench to trigger Last-Ditch Catch.
    const scoopMeowth = (ps, pj = pgcb) => res.SC > 0 && ps.some(p => {
      if (p.path[0] !== "meowth_ex") return false;
      const sw = res.SW + res.SC - 1;
      if (p.path.length >= 2) return planFeasible(p.path.slice(1), p.reqs, sw, pj);
      // No target (Combo 1): anything else in play to promote
      return otherBasics.some(t => planFeasible([t], has(h, t) ? p.reqs : [...p.reqs, t], sw, pj));
    });

    const U0 = pgcb, U1 = Math.max(0, pgcb - 1); // U1: a Pokégear / Call Bell was spent on the Supporter
    if (has(h, sup) && anyPlan(plans, [], undefined, U0)) return "direct";
    if (second && res.CB > 0 && inDeck && anyPlan(plans, [], undefined, U1)) return "via_call_bell";
    if (res.PG > 0 && lookHit(sup, gear) && anyPlan(plans, [], undefined, U1)) return "via_pokegear";
    if (inDeck && anyPlan(plans, [], meowthFree, U0)) return "via_meowth";
    if (inDeck && SCOOP_REPLAY && scoopMeowth(plans, U0)) return "via_scoop_meowth";
    if (inDeck && anyPlan(plans, ["meowth_hand"], undefined, U0)) return "via_ultraball_meowth";
    if (lookHit(sup, [...gear, 6]) && anyPlan(tatPlans, [], undefined, U1)) return "via_tatsugiri";
    return null;
  }

  return { solve, canFetch };
}

// ─────────────────────────────────────────────────
// GOING FIRST — Combo 1
// Turn 1: draw, Items / Abilities / bench / 1 attachment / 1 retreat. No Supporter, no attack, no evolving.
// Turn 2: draw, 1 Supporter, 2nd attachment, evolve anything in play since turn 1, 1 retreat, attack.
// Ignition Energy is discarded at the end of the turn it's attached, so it only powers a turn-2 attack as
// the turn-2 attachment; Water attached on turn 1 stays.
// ─────────────────────────────────────────────────
const MEGA_OF = { staryu: "starmie", snorunt: "froslass" };
const SUPPORTERS = ["boss", "hilda", "lillies", "salvatore", "wally", "judge", "lucian", "carmine"];
const ENERGY_TYPES = new Set(["water_energy", "bubbly_water_energy", "ignition_energy"]);
const isWater = (t) => t === "water_energy" || t === "bubbly_water_energy";

// Every going-first game lands in exactly one bucket, checked in this order.
// g: "o" optimal · "d" decent · "f" failure
const OUTCOMES_FIRST = [
  { k: "o_both",      g: "o", label: "Optimal: Boss + either Mega attacks turn 2" },
  { k: "o_starmie",   g: "o", label: "Optimal: Boss + Mega Starmie attacks turn 2" },
  { k: "o_froslass",  g: "o", label: "Optimal: Boss + Mega Froslass attacks turn 2" },
  { k: "f_meowth",    g: "f", label: "Meowth ex stuck Active through turn 2" },
  { k: "d_salvo_new", g: "d", label: "Decent: Salvatore on a Staryu / Snorunt played turn 2" },
  { k: "d_hilda",     g: "d", label: "Decent: Hilda for turn 2" },
  { k: "d_salvatore", g: "d", label: "Decent: Salvatore + energy for turn 2" },
  { k: "d_lillies",   g: "d", label: "Decent: Lillie's Determination for turn 2" },
  { k: "f_energy",    g: "f", label: "No energy to attach on either turn" },
  { k: "f_wally",     g: "f", label: "Only Wally's Compassion for a Supporter" },
  { k: "f_none",      g: "f", label: "No Supporter for turn 2" },
  { k: "f_other",     g: "f", label: "Only Boss / Judge / Lucian, board not ready" },
];

// h8 = opening 7 + turn-1 draw (usable on turn 1). late = the turn-2 draw (usable on turn 2 only).
// d = deck after both draws. stuck = Meowth ex is the only Basic in the opening hand (so it's Active).
// junkSpent = discards already paid (Secret Box's 3).
function makeFirstSolver(h8, late, d, openTypes, orders, stuck, junkSpent = 0) {
  const h9 = [...h8, ...late];
  const res = {
    SW: cnt(h9, "switch_card"), SC: Math.min(1, cnt(h9, "scoop_up")), AB: cnt(h9, "air_balloon"),
    SB: has(h9, "surfing_beach") ? 2 : 0,   // Stadium effect once per turn, two turns
    PG: cnt(h9, "pokegear"),
  };
  const pgcb = cnt(h9, "pokegear") + cnt(h9, "call_bell");   // Call Bell is dead going first → spare
  // Search cards: turn-1 ones can bench a pre-evolution in time; the turn-2 draw can only fetch to hand.
  const E = { UB: cnt(h8, "ultra_ball"), NB: cnt(h8, "nest_ball"), PF: 2 * cnt(h8, "poffin"), PD: cnt(h8, "pokepad") };
  const L = { LUB: cnt(late, "ultra_ball"), LNB: cnt(late, "nest_ball"), LPF: 2 * cnt(late, "poffin"), LPD: cnt(late, "pokepad") };
  const latiasEarly = has(h8, "latias_ex");
  const order = (k) => { while (orders.length <= k) orders.push(shuffle(d)); return orders[k]; };
  const lookHit = (sup, n) => Array.from({ length: n }).some((_, k) => topHas(order(k), 7, sup));

  // Energy cards by when they can be attached: e = turn 1 or 2, else turn 2 only. Energy Search adds a Basic {W}.
  const slots = [];
  for (const c of h8) if (ENERGY_TYPES.has(c.type)) slots.push({ t: c.type, e: true });
  for (const c of late) if (ENERGY_TYPES.has(c.type)) slots.push({ t: c.type, e: false });
  if (has(d, "water_energy")) {
    if (has(h8, "energy_search")) slots.push({ t: "water_energy", e: true });
    else if (has(late, "energy_search")) slots.push({ t: "water_energy", e: false });
  }
  // Can `target`'s Mega attack on turn 2? paid = one attachment also has to pay a 1-energy retreat.
  function energyOK(target, paid) {
    const powers = (x, turn) => !!x && (isWater(x) || (target === "staryu" && x === "ignition_energy" && turn === 2));
    for (let i = -1; i < slots.length; i++) {
      if (i >= 0 && !slots[i].e) continue;
      for (let j = -1; j < slots.length; j++) {
        if (j >= 0 && j === i) continue;
        const a1 = i >= 0 ? slots[i].t : null, a2 = j >= 0 ? slots[j].t : null;
        if (!paid) { if (powers(a1, 1) || powers(a2, 2)) return true; }
        else if ((a1 && powers(a2, 2)) || (a2 && powers(a1, 1))) return true; // one pays, the other powers
      }
    }
    return false;
  }

  let baseJ = junkCount(h9) - junkSpent;
  // reqs: "<basic>" bench by turn 1 · "late:<basic>" bench by turn 2 · "hand:<pokemon>" / "meowth_hand" via Ultra Ball
  function canFetch(reqs, extraJunk) {
    const need = {};
    for (const r of reqs) { const t = r.startsWith("hand:") ? r.slice(5) : r.startsWith("late:") ? r.slice(5) : r === "meowth_hand" ? "meowth_ex" : r; need[t] = (need[t] || 0) + 1; }
    for (const t in need) if (cnt(d, t) < need[t]) return false;
    const pool = { ...E, ...L };
    const opts = (r) => {
      if (r === "meowth_hand" || r.startsWith("hand:")) return ["UB", "LUB"];
      const late = r.startsWith("late:"), t = late ? r.slice(5) : r;
      const o = ["NB", "UB"]; if (POFFIN_OK.has(t)) o.push("PF"); if (!RULE_BOX.has(t)) o.push("PD");
      return late ? [...o, ...o.map(x => "L" + x)] : o;
    };
    const paid = () => {
      const ub = (E.UB - pool.UB) + (L.LUB - pool.LUB);
      if (!DISCARDS || ub === 0) return true;
      const unused = pool.NB + pool.PD + Math.floor(pool.PF / 2) + pool.UB + pool.LNB + pool.LPD + Math.floor(pool.LPF / 2) + pool.LUB;
      return 2 * ub <= baseJ + extraJunk + unused;
    };
    const rec = (i) => {
      if (i === reqs.length) return paid();
      for (const s of opts(reqs[i])) if (pool[s] > 0) { pool[s]--; if (rec(i + 1)) return true; pool[s]++; }
      return false;
    };
    return rec(0);
  }
  // Two turns: up to 2 retreats (one per turn) — free (0 RC, Air Balloon, Latias ex) or, if canPay, one paid
  // with an attachment — plus Switch / Scoop Up and up to two Surfing Beach swaps.
  function moveOK(path, reqs, canPay, pj, swAvail = res.SW + res.SC) {
    const n = path.length - 1;
    const rec = (i, sw, beach, rt, paidUsed, ab, latias) => {
      if (i === n) {
        const spare = pj + (swAvail - sw) + (res.AB - ab) + (res.SB && beach === 0 ? 1 : 0);
        return canFetch(latias && !latiasEarly ? [...reqs, "latias_ex"] : reqs, spare);
      }
      const from = path[i], to = path[i + 1];
      if (sw < swAvail && rec(i + 1, sw + 1, beach, rt, paidUsed, ab, latias)) return true;
      if (beach < res.SB && WATER_BASICS.has(from) && WATER_BASICS.has(to) && rec(i + 1, sw, beach + 1, rt, paidUsed, ab, latias)) return true;
      if (rt < 2) {
        if ((ZERO_RETREAT.has(from) || latias) && rec(i + 1, sw, beach, rt + 1, paidUsed, ab, latias)) return true;
        if (ab < res.AB && rec(i + 1, sw, beach, rt + 1, paidUsed, ab + 1, latias)) return true;
        if (!latias && rec(i + 1, sw, beach, rt + 1, paidUsed, ab, true)) return true;
        if (canPay && !paidUsed && rec(i + 1, sw, beach, rt + 1, true, ab, latias)) return true;
      }
      return false;
    };
    return rec(0, 0, 0, 0, false, 0, false);
  }

  // Optimal board: `sup` (Boss) in hand for turn 2, the Mega in hand by turn 2, `target` in play since turn 1,
  // energy for the attack, and the target able to be Active on turn 2. Returns how the Supporter was found.
  function board(sup, target) {
    const mega = MEGA_OF[target];
    if (!has(h9, mega) && !has(d, mega)) return null;
    if (!energyOK(target, false)) return null;
    const canPay = energyOK(target, true);
    // the Boss and the Mega you're keeping aren't spare cards
    baseJ = junkCount(h9) - junkSpent - (has(h9, sup) && JUNK_TYPES.has(sup) ? 1 : 0) - (has(h9, mega) ? 1 : 0);
    const plans = openTypes.map(A => {
      const path = A === target ? [A] : [A, target];
      const reqs = [];
      if (A !== target && !has(h8, target)) reqs.push(target);
      if (!has(h9, mega)) reqs.push("hand:" + mega);
      return { path, reqs };
    }).sort((a, b) => a.path.length - b.path.length);
    const any = (extra = [], pred = () => true, pj = pgcb) => plans.some(p => pred(p) && moveOK(p.path, [...p.reqs, ...extra], canPay, pj));
    const inDeck = has(d, sup);
    const meowthFree = (p) => cnt(h9, "meowth_ex") - (p.path[0] === "meowth_ex" ? 1 : 0) >= 1;
    let m = null;
    if (has(h9, sup) && any()) m = "direct";
    else if (res.PG > 0 && lookHit(sup, res.PG) && any([], undefined, Math.max(0, pgcb - 1))) m = "via_pokegear";
    else if (inDeck && any([], meowthFree)) m = "via_meowth";
    else if (inDeck && SCOOP_REPLAY && res.SC > 0 && plans.some(p => p.path[0] === "meowth_ex" && p.path.length >= 2 &&
      moveOK(p.path.slice(1), p.reqs, canPay, pgcb, res.SW + res.SC - 1))) m = "via_scoop_meowth";
    else if (inDeck && any(["meowth_hand"])) m = "via_ultraball_meowth";
    baseJ = junkCount(h9) - junkSpent;
    return m;
  }

  // Can Supporter X be in hand for turn 2? In hand, a Pokégear look, or any deck search for a Supporter.
  function access(X) {
    if (has(h9, X)) return true;
    if (res.PG > 0 && lookHit(X, res.PG)) return true;
    if (!has(d, X)) return false;
    if (cnt(h9, "meowth_ex") - (stuck ? 1 : 0) >= 1) return true;                       // Meowth ex from hand
    const spare = junkCount(h9) + pgcb + res.SW + res.SC + res.AB + cnt(h9, "nest_ball") + cnt(h9, "poffin") + cnt(h9, "pokepad");
    if (has(h9, "ultra_ball") && has(d, "meowth_ex") && (!DISCARDS || spare + cnt(h9, "ultra_ball") - 1 >= 2)) return true;
    if (has(h9, "secret_box") && (!DISCARDS || spare - 1 >= 3)) return true;
    if (stuck && SCOOP_REPLAY && res.SC > 0 && escapeOK(true)) return true;                // Scoop + replay Meowth
    return false;
  }
  // Turn-2 Salvatore line: Salvatore can evolve a Pokémon put into play this turn, so a Staryu / Snorunt
  // played on turn 2 (drawn that turn, held in hand, or searched out) + Salvatore + its Mega still in the deck.
  // Shares search cards with however Salvatore is found. No energy required.
  function salvatoreFresh(target) {
    if (!has(d, MEGA_OF[target])) return false;
    const fresh = cnt(h9, target) - (openTypes.length === 1 && openTypes[0] === target ? 1 : 0); // not the forced Active
    const reqs = fresh > 0 ? [] : ["late:" + target];
    const spare = (pj) => pj + res.SW + res.SC + res.AB;
    const inDeck = has(d, "salvatore");
    if (has(h9, "salvatore") && canFetch(reqs, spare(pgcb))) return true;
    if (res.PG > 0 && lookHit("salvatore", res.PG) && canFetch(reqs, spare(Math.max(0, pgcb - 1)))) return true;
    if (inDeck && cnt(h9, "meowth_ex") - (stuck ? 1 : 0) >= 1 && canFetch(reqs, spare(pgcb))) return true;
    if (inDeck && canFetch([...reqs, "meowth_hand"], spare(pgcb))) return true;
    if (inDeck && stuck && SCOOP_REPLAY && res.SC > 0 && canFetch(reqs, pgcb + res.SW + res.AB) && escapeOK(true)) return true;
    return false;
  }
  // Forced Meowth start: can any other Pokémon be Active by turn 2? (A spare attachment can pay the retreat.)
  function escapeOK(viaScoopOnly = false) {
    const others = [...new Set([...h9, ...d].filter(c => c.isBasic && c.type !== "meowth_ex").map(c => c.type))];
    return others.some(X => {
      const reqs = has(h9, X) ? [] : ["late:" + X];
      if (viaScoopOnly) return canFetch(reqs, pgcb + res.SW + res.AB);
      return moveOK(["meowth_ex", X], reqs, slots.length >= 1, pgcb);
    });
  }
  return { board, access, escapeOK, salvatoreFresh, hasEnergy: slots.length > 0, h9 };
}

function simulate(deckCards, iterations) {
  const R = {
    total: iterations, mulligans: 0,
    meowth_stuck: 0,      // every basic in the opening 7 is Meowth ex (1 or 2+), counted once
    meowth_no_rescue: 0,  // stuck AND no way to get any non-Meowth basic onto the Bench this turn
    c1_success: 0, c1: emptyMethods(),
    c2a_success: 0, c2a: emptyMethods(),
    c2b_success: 0, c2b: emptyMethods(),
    c3_success: 0, c3: emptyMethods(),
    either_success: 0,     // same game: Mega Starmie (any energy) OR Mega Froslass attacks
    starmie_prized: 0, froslass_prized: 0,
    outcome: Object.fromEntries(OUTCOMES.map(o => [o.k, 0])), // every game in exactly one bucket (going second)
    outcomeFirst: Object.fromEntries(OUTCOMES_FIRST.map(o => [o.k, 0])), // same, going first
    c1_ok: 0,              // going first: optimal or decent start
  };

  const totalStarmie = cnt(deckCards, "starmie");
  const totalFroslass = cnt(deckCards, "froslass");

  for (let i = 0; i < iterations; i++) {
    let deck = shuffle(deckCards);
    let hand, mulls = 0;

    while (true) {
      hand = deck.slice(0, 7);
      deck = deck.slice(7);
      if (hand.some(c => c.isBasic)) break;
      mulls++;
      deck = shuffle(deckCards);
      if (mulls > 200) break;
    }
    R.mulligans += mulls;

    const prizes = deck.slice(0, 6);
    deck = deck.slice(6);

    const openTypes = [...new Set(hand.filter(c => c.isBasic).map(c => c.type))];

    if (totalStarmie > 0 && cnt(prizes, "starmie") >= totalStarmie) R.starmie_prized++;
    if (totalFroslass > 0 && cnt(prizes, "froslass") >= totalFroslass) R.froslass_prized++;

    // Draw for turn (both players draw on turn 1)
    const h = [...hand];
    const d = [...deck];
    if (d.length > 0) h.push(d.shift());

    const orders = [d];
    const solver = makeSolver(h, d, openTypes, orders);

    // ── Meowth stuck diagnostic ──
    const stuck = openTypes.length === 1 && openTypes[0] === "meowth_ex";
    let noRescue = false;
    if (stuck) {
      R.meowth_stuck++;
      const drewOther = h.some(c => c.isBasic && c.type !== "meowth_ex");
      const deckOthers = [...new Set(d.filter(c => c.isBasic && c.type !== "meowth_ex").map(c => c.type))];
      if (!drewOther && !deckOthers.some(t => solver.canFetch([t]))) { noRescue = true; R.meowth_no_rescue++; }
    }

    // Water = Basic {W} or Bubbly {W} in hand, or Energy Search for a Basic {W} still in deck.
    // Ignition only provides Colorless ({C}{C}{C} on an Evolution): pays Starmie's Nebula Beam,
    // never a {W} cost — so it doesn't work for Froslass.
    const waterIn = (hh, dd) => has(hh, "water_energy") || has(hh, "bubbly_water_energy") ||
      (has(hh, "energy_search") && has(dd, "water_energy"));
    const ignIn = (hh) => has(hh, "ignition_energy");
    const anyEnergy = (hh, dd) => waterIn(hh, dd) || ignIn(hh);

    // Secret Box (ACE SPEC): discard 3 other cards, then take 1 Item + 1 Tool + 1 Supporter + 1 Stadium
    // from the deck. Every useful Item choice is tried; the Tool is an Air Balloon / Rescue Board if any.
    // Its discard 3 must come from junk (see junkCount; Pokégear / Call Bell count, since Box gets the
    // Supporter); whatever junk is left then pays for Ultra Balls.
    const take = (arr, t) => { const i = arr.findIndex(c => c.type === t); return i < 0 ? null : arr.splice(i, 1)[0]; };
    const boxVariants = (hh, dd, sup) => {
      if (!has(hh, "secret_box") || !has(dd, sup)) return [];
      const rest = hh.filter((c, i) => i !== hh.findIndex(x => x.type === "secret_box"));
      if (DISCARDS && junkCount(rest) + cnt(rest, "pokegear") + cnt(rest, "call_bell") < 3) return [];
      const out = [];
      for (const item of BOX_ITEMS) {
        if (item && !has(dd, item)) continue;
        const h2 = [...hh], d2 = [...dd];
        take(h2, "secret_box");
        h2.push(take(d2, sup));
        for (const t of ["air_balloon", "surfing_beach", item]) { if (!t) continue; const c = take(d2, t); if (c) h2.push(c); }
        out.push({ h2, d2 });
      }
      return out;
    };
    const tryCombo = (hh, dd, sup, target, second, energyOK) => {
      if (energyOK(hh, dd)) {
        const m = (hh === h ? solver : makeSolver(hh, dd, openTypes, orders)).solve(sup, target, second);
        if (m) return m;
      }
      for (const { h2, d2 } of boxVariants(hh, dd, sup)) {
        if (energyOK(h2, d2) && makeSolver(h2, d2, openTypes, orders, DISCARDS ? 3 : 0).solve(sup, target, second)) return "via_secret_box";
      }
      return null;
    };
    const evalHand = (hh) => ({
      c2a: has(d, "starmie") ? tryCombo(hh, d, "salvatore", "staryu", true, waterIn) : null,
      c2b: has(d, "starmie") ? tryCombo(hh, d, "salvatore", "staryu", true, (x) => ignIn(x)) : null,
      c3: has(d, "froslass") ? tryCombo(hh, d, "salvatore", "snorunt", true, waterIn) : null,
    });


    // ── COMBO 2 (going second): Staryu Active + energy + Salvatore → Mega Starmie ex attacks ──
    // ── COMBO 3 (going second): Snorunt Active + Water + Salvatore → Mega Froslass ex attacks ──
    const ev = evalHand(h);
    if (ev.c2a) { R.c2a_success++; R.c2a[ev.c2a]++; }
    if (ev.c2b) { R.c2b_success++; R.c2b[ev.c2b]++; }
    if (ev.c3) { R.c3_success++; R.c3[ev.c3]++; }
    const c2any = !!(ev.c2a || ev.c2b), c3ok = !!ev.c3;
    if (c2any || c3ok) R.either_success++;

    // ── Outcome bucket (going second: does a Mega attack on game turn 2?) ──
    const viable = c2any || c3ok;
    const canAttack = (hh) => { const e = evalHand(hh); return !!(e.c2a || e.c2b || e.c3); };
    let cat;
    if (stuck) {
      if (viable) {
        // What got Meowth out of the Active Spot? Re-run without each card to see which one was needed.
        const without = (ts) => h.filter(c => !ts.includes(c.type));
        if (has(h, "secret_box") && !canAttack(without(["secret_box"]))) cat = "v_stuck_box";
        else {
        const okNoBalloon = canAttack(without(["air_balloon"]));
        const okNoScoop = canAttack(without(["scoop_up"]));
        if (okNoBalloon && okNoScoop) cat = canAttack(without(["air_balloon", "scoop_up"])) ? "v_stuck_other" : "v_stuck_either";
        else if (okNoScoop) cat = "v_stuck_balloon";
        else if (okNoBalloon) cat = "v_stuck_scoop";
        else cat = "v_stuck_both";
        }
      } else if (noRescue) cat = "n_stuck_norescue";
      else if (!["air_balloon", "scoop_up", "switch_card", "latias_ex", "secret_box"].some(t => has(h, t))) cat = "n_stuck_noescape";
      else cat = "n_stuck_blocked";
    } else if (viable) {
      cat = c2any && c3ok ? "v_both" : c2any ? "v_starmie" : "v_froslass";
    } else {
      const boxWater = has(h, "secret_box") && has(d, "energy_search") && has(d, "water_energy");
      const w = waterIn(h, d) || boxWater;
      const targets = [];
      if (has(d, "starmie") && (w || ignIn(h))) targets.push("staryu");
      if (has(d, "froslass") && w) targets.push("snorunt");
      if (!has(d, "starmie") && !has(d, "froslass")) cat = "n_prized";
      else if (!targets.length) cat = "n_energy";
      // Could Salvatore be reached at all if the attacker were already Active? If yes, the setup failed.
      else cat = (has(h, "secret_box") && has(d, "salvatore")) ||
        targets.some(t => makeSolver(h, d, [t], orders).solve("salvatore", t, true)) ? "n_setup" : "n_salvatore";
    }
    R.outcome[cat]++;

    // ── COMBO 1 (going first): optimal turn-2 board, else a decent turn-2 Supporter, else why not ──
    {
      const h8 = h, late = d.slice(0, 1), dF = d.slice(1), ordersF = [dF];
      const fs = makeFirstSolver(h8, late, dF, openTypes, ordersF, stuck);
      // Secret Box (turn 1 if it's in the opening 8, else turn 2): Boss + Air Balloon + one Item
      const firstBox = (sup) => {
        const inH8 = has(h8, "secret_box"), inLate = has(late, "secret_box");
        if (!(inH8 || inLate) || !has(dF, sup)) return [];
        const h9 = [...h8, ...late], rest = h9.filter((c, i) => i !== h9.findIndex(x => x.type === "secret_box"));
        if (DISCARDS && junkCount(rest) + cnt(rest, "pokegear") + cnt(rest, "call_bell") < 3) return [];
        return BOX_ITEMS.filter(it => !it || has(dF, it)).map(item => {
          const e2 = h8.filter(c => c.type !== "secret_box" || !inH8), l2 = late.filter(c => c.type !== "secret_box" || inH8), d2 = [...dF];
          const got = [take(d2, sup)];
          for (const t of ["air_balloon", "surfing_beach", item]) { if (!t) continue; const c = take(d2, t); if (c) got.push(c); }
          return makeFirstSolver(inH8 ? [...e2, ...got] : e2, inH8 ? l2 : [...l2, ...got], d2, openTypes, [d2], stuck, DISCARDS ? 3 : 0);
        });
      };
      const opt = {};
      for (const t of ["staryu", "snorunt"]) {
        let m = fs.board("boss", t);
        if (!m && firstBox("boss").some(b => b.board("boss", t))) m = "via_secret_box";
        opt[t] = m;
      }
      let cat;
      if (opt.staryu || opt.snorunt) {
        const m = opt.staryu || opt.snorunt;
        R.c1_success++; R.c1[m]++;
        cat = opt.staryu && opt.snorunt ? "o_both" : opt.staryu ? "o_starmie" : "o_froslass";
      } else if (stuck && !fs.escapeOK() && !firstBox("salvatore").concat(firstBox("boss")).some(b => b.escapeOK())) {
        cat = "f_meowth";
      } else if (fs.salvatoreFresh("staryu") || fs.salvatoreFresh("snorunt") ||
        firstBox("salvatore").some(b => b.salvatoreFresh("staryu") || b.salvatoreFresh("snorunt"))) cat = "d_salvo_new";
      else if (fs.access("hilda")) cat = "d_hilda";
      else if (fs.access("salvatore") && fs.hasEnergy) cat = "d_salvatore";
      else if (fs.access("lillies")) cat = "d_lillies";
      else if (!fs.hasEnergy) cat = "f_energy";
      else {
        const S = SUPPORTERS.filter(x => fs.access(x));
        cat = !S.length ? "f_none" : S.every(x => x === "wally") ? "f_wally" : "f_other";
      }
      if (cat[0] !== "f") R.c1_ok++;
      R.outcomeFirst[cat]++;
    }
  }
  return R;
}

// ─────────────────────────────────────────────────
// SAMPLE DECK (PTCGL export format)
// ─────────────────────────────────────────────────

const SAMPLE_DECK = `Pokémon: 6
3 Mew ex 30C 66
2 Mega Froslass ex ASC 265
2 Meowth ex POR 107
4 Snorunt ASC 46
2 Mega Starmie ex POR 118
4 Staryu POR 20

Trainer: 14
4 Pokégear 3.0 UNB 182
1 Carmine TWM 217
3 Boss's Orders ASC 256
2 Lillie's Determination MEG 169
1 Energy Search POR 72
2 Wally's Compassion MEG 132
2 Air Balloon MEG 166
4 Buddy-Buddy Poffin MEG 167
2 Hilda WHT 171
4 Salvatore TEF 212
1 Scoop Up Cyclone TWM 162
1 Judge PAF 228
1 Lucian TWM 208
4 Ultra Ball 30C 128

Energy: 4
6 Basic {W} Energy MEE 11
2 Ignition Energy PFL 124
3 Bubbly {W} Energy CRI 84

Total Cards: 60`;

// ─────────────────────────────────────────────────
// STORAGE (v6: Froslass replaces Dunsparce, Either % added — v5 runs left under their old key)
// ─────────────────────────────────────────────────

// claude.ai artifact storage when present; otherwise this browser's localStorage (hosted page).
const RUNS_KEY = "combo-sim-runs-v7"; // v7: Combo 1 is now the going-first Boss start (v6 runs kept under their key)
async function loadRuns() {
  try {
    if (window.storage?.get) { const r = await window.storage.get(RUNS_KEY); return r ? JSON.parse(r.value) : []; }
    const v = window.localStorage.getItem(RUNS_KEY); return v ? JSON.parse(v) : [];
  } catch { return []; }
}
async function saveRuns(runs) {
  try {
    if (window.storage?.set) await window.storage.set(RUNS_KEY, JSON.stringify(runs));
    else window.localStorage.setItem(RUNS_KEY, JSON.stringify(runs));
  } catch (e) { console.error("Storage:", e); }
}

// ─────────────────────────────────────────────────
// UI
// ─────────────────────────────────────────────────

const ITERS = [10000, 50000, 100000, 500000];
const METHOD_LABELS = {
  direct: "Direct in hand",
  via_call_bell: "Call Bell (2nd, turn 1)",
  via_secret_box: "Secret Box",
  via_pokegear: "Pokégear 3.0",
  via_meowth: "Meowth ex from hand",
  via_scoop_meowth: "Scoop Up → replay Meowth",
  via_ultraball_meowth: "Ultra Ball → Meowth",
  via_tatsugiri: "Tatsugiri (active)",
};
// Overall good start = P(go 2nd) × P(a Mega attacks turn 1 going 2nd) + P(go 1st) × P(optimal or decent going 1st).
// "Strict" uses only the optimal going-first start. p2 is a fraction (0–1).
const P2_KEY = "combo-sim-p2";
function overallOf(R, p2) {
  const t = R.total, e = R.either_success / t, ok = (R.c1_ok || 0) / t, opt = R.c1_success / t;
  return { good: 100 * (p2 * e + (1 - p2) * ok), strict: 100 * (p2 * e + (1 - p2) * opt) };
}
const COL = { overall: "#e6edf3", c1: "#4fc3f7", c2a: "#66bb6a", c2b: "#ff9800", c3: "#4dd0e1", either: "#ffd54f", bad: "#ef5350" };
// Outcome donut colors: one ramp per group, darkest = most common / most important
//   blue = attacks from a normal start · teal = attacks after a Meowth start
//   gray = no attack, normal start      · coral = no attack, Meowth start
const OUT_COL = {
  v_both: "#185FA5", v_starmie: "#378ADD", v_froslass: "#85B7EB",
  v_stuck_balloon: "#0F6E56", v_stuck_scoop: "#1D9E75", v_stuck_either: "#5DCAA5", v_stuck_box: "#04342C", v_stuck_both: "#9FE1CB", v_stuck_other: "#085041",
  n_setup: "#5F5E5A", n_salvatore: "#888780", n_energy: "#B4B2A9", n_prized: "#D3D1C7",
  n_stuck_blocked: "#993C1D", n_stuck_noescape: "#D85A30", n_stuck_norescue: "#F0997B",
};

export default function App() {
  const [deckText, setDeckText] = useState(SAMPLE_DECK);
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [iterations, setIterations] = useState(100000);
  const [parseInfo, setParseInfo] = useState(null);
  const [error, setError] = useState(null);
  const [runName, setRunName] = useState("");
  const [savedRuns, setSavedRuns] = useState([]);
  const [hlRun, setHlRun] = useState(null);
  const [p2Pct, setP2Pct] = useState(87.5);
  const p2 = Math.min(100, Math.max(0, isNaN(p2Pct) ? 87.5 : p2Pct)) / 100;
  // Read the saved share after mount (keeps server-rendered and first client render identical).
  useEffect(() => { try { const v = parseFloat(window.localStorage.getItem(P2_KEY)); if (!isNaN(v)) setP2Pct(v); } catch {} }, []);
  const changeP2 = (v) => { setP2Pct(v); try { if (!isNaN(v)) window.localStorage.setItem(P2_KEY, String(v)); } catch {} };

  useEffect(() => { loadRuns().then(setSavedRuns); }, []);

  const run = useCallback(() => {
    setError(null); setResults(null);
    const cards = parseDeckList(deckText);
    if (cards.length === 0) { setError("Could not parse any cards."); return; }
    if (cards.length !== 60) setError(`Parsed ${cards.length} cards — expected 60.`);

    const sm = {};
    for (const c of cards) { if (!sm[c.name]) sm[c.name] = { count: 0, type: c.type, isBasic: c.isBasic }; sm[c.name].count++; }
    setParseInfo(sm);

    const any = (t) => cards.some(c => c.type === t);
    const flags = {
      boss: any("boss"),
      starmie: any("staryu") && any("starmie"),
      froslass: any("snorunt") && any("froslass"),
      water: any("water_energy") || any("bubbly_water_energy"),
      ignition: any("ignition_energy"),
    };
    const basicCount = cards.filter(c => c.isBasic).length;
    const w = [`✓ ${basicCount} basic Pokémon identified`];
    const assumed = [...new Set(cards.filter(c => c.type === "basic_pokemon").map(c => c.name))];
    if (assumed.length) w.push(`⚠ Assumed Basic (not a known card — check it isn't an evolution): ${assumed.join(", ")}`);
    if (!flags.boss) w.push("ℹ No Boss's Orders — the going-first optimal start can't happen");
    if (!any("staryu")) w.push("⚠ No Staryu — Combo 2 disabled");
    if (!any("starmie")) w.push("⚠ No Mega Starmie ex — Combo 2 disabled");
    if (!any("snorunt")) w.push("⚠ No Snorunt — Combo 3 disabled");
    if (!any("froslass")) w.push("⚠ No Mega Froslass ex — Combo 3 disabled");
    if (!any("salvatore")) w.push("⚠ No Salvatore found");
    if (!flags.water) w.push("⚠ No Water Energy (Basic or Bubbly)");
    if (!flags.ignition) w.push("ℹ No Ignition Energy — Combo 2b disabled");

    setRunning(true);
    setTimeout(() => {
      const r = simulate(cards, iterations);
      r.warnings = w; r.iterations = iterations; r.flags = flags;
      setResults(r); setRunning(false);
    }, 50);
  }, [deckText, iterations]);

  const saveRun = useCallback(async () => {
    if (!results) return;
    const p = (n, t) => ((n / t) * 100).toFixed(2);
    const t = results.total;
    const oc = results.outcome || {};
    const outcome = Object.fromEntries(OUTCOMES.map(o => [o.k, +((100 * (oc[o.k] || 0)) / t).toFixed(3)]));
    const mStart = OUTCOMES.filter(o => o.g[1] === "s").reduce((s, o) => s + (oc[o.k] || 0), 0);
    const mAtk = OUTCOMES.filter(o => o.g === "vs").reduce((s, o) => s + (oc[o.k] || 0), 0);
    const nr = {
      outcome, meowthAttack: mStart ? ((100 * mAtk) / mStart).toFixed(1) : "—",
      id: Date.now(), name: runName.trim() || `Run ${savedRuns.length + 1}`,
      timestamp: new Date().toLocaleString(), iterations: results.iterations || t,
      c1: p(results.c1_success, t), c1ok: p(results.c1_ok, t),
      outcomeFirst: Object.fromEntries(OUTCOMES_FIRST.map(o => [o.k, +((100 * (results.outcomeFirst?.[o.k] || 0)) / t).toFixed(3)])),
      c2a: p(results.c2a_success, t), c2b: p(results.c2b_success, t), c3: p(results.c3_success, t),
      either: p(results.either_success, t),
      overall: overallOf(results, p2).good.toFixed(2), p2: (p2 * 100).toFixed(1),
      meowthStuck: p(results.meowth_stuck, t),
      meowthNoRescue: p(results.meowth_no_rescue, t),
      avgMull: (results.mulligans / t).toFixed(3),
    };
    const u = [nr, ...savedRuns]; setSavedRuns(u); await saveRuns(u);
    setResults(r => (r ? { ...r, savedId: nr.id } : r)); // compare against the run before this one
    setRunName(""); setHlRun(nr.id); setTimeout(() => setHlRun(null), 2000);
  }, [results, runName, savedRuns, p2]);

  const delRun = useCallback(async (id) => { const u = savedRuns.filter(r => r.id !== id); setSavedRuns(u); await saveRuns(u); }, [savedRuns]);
  const clearRuns = useCallback(async () => { setSavedRuns([]); await saveRuns([]); }, []);

  const pct = (n, t) => ((n / t) * 100).toFixed(2);
  const frac = (n, t) => `${n.toLocaleString()} / ${t.toLocaleString()}`;

  const tc = (type) => {
    if (type === "latias_ex") return "#b388ff";
    if (type === "tatsugiri") return "#80cbc4";
    if (type === "mew_ex") return "#f48fb1";
    if (type === "snorunt") return "#4dd0e1";
    if (BASIC_TYPES.has(type)) return "#4fc3f7";
    if (["carmine", "salvatore", "boss", "hilda", "lillies"].includes(type)) return "#ff8a65";
    if (["wally", "judge", "lucian"].includes(type)) return "#a1887f";
    if (type === "water_energy" || type === "bubbly_water_energy") return "#29b6f6";
    if (type === "ignition_energy") return "#ff7043";
    if (["pokegear", "pokepad", "poffin", "ultra_ball", "nest_ball", "energy_search", "call_bell", "secret_box"].includes(type)) return "#ce93d8";
    if (["switch_card", "air_balloon", "scoop_up", "surfing_beach"].includes(type)) return "#aed581";
    if (type === "starmie") return "#7986cb";
    if (type === "froslass") return "#80deea";
    if (type === "evolution_pokemon") return "#ffa726";
    return "#555";
  };

  const bestOf = (k, fn) => {
    const v = savedRuns.map(r => parseFloat(r[k])).filter(x => !isNaN(x));
    return v.length ? fn(...v) : null;
  };
  const bests = savedRuns.length > 1 ? {
    c1: bestOf("c1", Math.max), c1ok: bestOf("c1ok", Math.max), c2a: bestOf("c2a", Math.max), c2b: bestOf("c2b", Math.max),
    c3: bestOf("c3", Math.max), either: bestOf("either", Math.max), overall: bestOf("overall", Math.max),
    ms: bestOf("meowthStuck", Math.min), ma: bestOf("meowthAttack", Math.max),
  } : null;

  const R = results;

  return (
    <div style={S.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes flash{0%{background:rgba(79,195,247,0.15)}100%{background:transparent}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:6px}
        ::-webkit-scrollbar-thumb{background:#30363d;border-radius:3px}
        .sim-grid{display:grid;grid-template-columns:370px 1fr;gap:20px;max-width:1280px;margin:0 auto}
        @media (max-width:860px){.sim-grid{grid-template-columns:1fr}}
      `}</style>

      <header style={S.hdr}>
        <div style={S.pb}><div style={S.pbc}/></div>
        <h1 style={S.ttl}>COMBO SIMULATOR</h1>
        <p style={S.stl}>Pokémon TCG · Opening Hand Monte Carlo</p>
      </header>

      <div className="sim-grid">
        <div style={S.left}>
          <label style={S.l1}>DECK LIST</label>
          <p style={S.hint}>Paste the PTCGL export as-is (Limitless works too). Section headers (Pokémon:, Trainer:, Energy:) ensure correct basic detection.</p>
          <textarea style={S.ta} value={deckText} onChange={e => setDeckText(e.target.value)} spellCheck={false}/>

          <div style={{marginTop:10}}>
            <label style={S.l2}>RUN NAME</label>
            <input style={S.ni} value={runName} onChange={e => setRunName(e.target.value)} placeholder="e.g. 3 Mew, 2 Beach…" spellCheck={false}/>
          </div>
          <div style={{marginTop:10}}>
            <label style={S.l2}>GOING SECOND % OF GAMES</label>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="number" min="0" max="100" step="0.5" style={{...S.ni,width:90}} value={isNaN(p2Pct) ? "" : p2Pct}
                onChange={e => changeP2(parseFloat(e.target.value))}/>
              <span style={{fontSize:10,color:"#484f58"}}>Weights the overall estimate. Default 87.5, for a deck that chooses to go second.</span>
            </div>
          </div>

          <div style={S.cr}>
            <div>
              <label style={S.l2}>ITERATIONS</label>
              <div style={{display:"flex",gap:3,marginTop:3}}>
                {ITERS.map(n => <button key={n} style={{...S.ib,...(iterations===n?S.iba:{})}} onClick={() => setIterations(n)}>{n>=1000?`${n/1000}K`:n}</button>)}
              </div>
            </div>
            <button style={{...S.rb,...(running?{opacity:.5,cursor:"not-allowed"}:{})}} onClick={run} disabled={running}>
              {running?"SIMULATING…":"▶ RUN"}
            </button>
          </div>

          {error && <div style={S.err}>{error}</div>}

          {parseInfo && (
            <div style={S.pw}>
              <label style={S.l2}>PARSED ({Object.values(parseInfo).reduce((a,b) => a+b.count, 0)} cards · {Object.values(parseInfo).filter(x=>x.isBasic).reduce((a,b)=>a+b.count,0)} basics)</label>
              <div style={S.pl}>
                {Object.entries(parseInfo).map(([name, info]) => (
                  <div key={name} style={{...S.pr, borderLeft:`3px solid ${tc(info.type)}`}}>
                    <span style={S.pc}>{info.count}×</span>
                    <span style={S.pn}>{name}</span>
                    {info.isBasic && <span style={{...S.pt, color:"#4fc3f7"}}>
                      {ZERO_RETREAT.has(info.type)?"BASIC·0RC":NONZERO_RETREAT.has(info.type)?"BASIC·RC":"BASIC?"}
                    </span>}
                    {(info.type==="starmie"||info.type==="froslass") && <span style={{...S.pt,color:"#80deea"}}>MEGA·TARGET</span>}
                    {info.type==="evolution_pokemon" && <span style={{...S.pt,color:"#ffa726"}}>EVOL</span>}
                    {(info.type==="water_energy"||info.type==="bubbly_water_energy") && <span style={{...S.pt,color:"#29b6f6"}}>{"{W}"}</span>}
                    {info.type==="ignition_energy" && <span style={{...S.pt,color:"#ff7043"}}>{"{C}/{C}{C}{C}"}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={S.right}>
          {!results && !running && (
            <div style={S.emp}>
              <div style={{fontSize:48,opacity:.25}}>⚡</div>
              <p style={S.ept}>Paste your deck list and hit Run</p>
              <div style={{display:"flex",flexDirection:"column",gap:8,width:"100%",maxWidth:500,marginTop:6}}>
                <CB c={COL.c1} t="COMBO 1 — Going First (your turn 2)" d="Optimal: Boss's Orders + a Mega in hand + its pre-evolution in play since turn 1 + energy to attack, Mega able to be Active. Decent: Hilda / Lillie's / Salvatore + energy for turn 2."/>
                <CB c={COL.c2a} t="COMBO 2a — Water → Mega Starmie ex (2nd)" d="Staryu + Basic or Bubbly {W} + Salvatore → Jet Blow. Starmie not all prized."/>
                <CB c={COL.c2b} t="COMBO 2b — Ignition → Mega Starmie ex (2nd)" d="Ignition on the Evolution = {C}{C}{C} → Nebula Beam."/>
                <CB c={COL.c3} t="COMBO 3 — Water → Mega Froslass ex (2nd)" d="Snorunt + Basic or Bubbly {W} + Salvatore → Resentful Refrain. Ignition can't pay {W}."/>
                <CB c={COL.either} t="EITHER — Starmie or Froslass attacks T1 (2nd)" d="The same game succeeds at Combo 2 (Water or Ignition) or Combo 3 — not the sum, overlap counted once."/>
                <CB c={COL.bad} t="DIAGNOSTIC: Meowth Stuck" d="All basics in opening are Meowth ex (1 or 2+). 'No rescue' = no way to bench any other basic this turn."/>
              </div>
              <div style={{marginTop:12,padding:"10px 12px",background:"#0d1117",borderRadius:8,border:"1px solid #21262d",maxWidth:500,width:"100%"}}>
                <label style={S.l2}>KEY MECHANICS</label>
                <p style={{fontSize:11,color:"#8b949e",margin:"4px 0 0",lineHeight:1.6}}>
                  <strong style={{color:"#4fc3f7"}}>Moving Active:</strong> Switch, Scoop Up Cyclone, one Surfing Beach swap (Water → Water), plus one free retreat (Mew ex 0RC, Air Balloon, Latias ex).<br/>
                  <strong style={{color:"#29b6f6"}}>Water:</strong> Basic or Bubbly {"{W}"} in hand, or Energy Search → Basic {"{W}"} (can't fetch Bubbly).<br/>
                  <strong style={{color:"#f48fb1"}}>Mew ex:</strong> 0RC pivot. Memory Helix copying isn't a separate route — it never adds a T1 line Mew's free retreat doesn't already give.<br/>
                  <strong style={{color:"#ce93d8"}}>Resources:</strong> Each search card, Switch, Scoop and Balloon is spent once per plan.<br/>
                  <strong style={{color:"#ce93d8"}}>Discards:</strong> Ultra Ball (2) and Secret Box (3) are paid only with cards that turn's combo doesn't use.<br/>
                  <strong style={{color:"#e6edf3"}}>Overall:</strong> going-second share × (a Mega attacks turn 1 going second) + going-first share × (optimal or decent start going first).<br/>
                  <strong style={{color:"#4fc3f7"}}>Going first:</strong> turn 1 = items, abilities, bench, 1 attachment, 1 retreat; turn 2 = Supporter, 2nd attachment, evolve, attack. A spare attachment can pay a 1-energy retreat. Ignition is discarded at the end of its turn, so it only powers turn 2 as the turn-2 attachment.<br/>
                  <strong style={{color:"#ce93d8"}}>Scoop Up:</strong> also rescues a stranded Active Meowth ex — Scoop it, promote, replay it for Last-Ditch Catch.<br/>
                  <strong style={{color:"#ef5350"}}>Prizing:</strong> The Mega must be in the deck (not prized, not in hand) for Salvatore.
                </p>
              </div>
            </div>
          )}

          {running && (
            <div style={S.emp}>
              <div style={{width:32,height:32,border:"3px solid #30363d",borderTop:"3px solid #4fc3f7",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
              <p style={S.ept}>Running {(iterations/1000).toFixed(0)}K simulations…</p>
            </div>
          )}

          {results && !running && (
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {results.warnings?.length > 0 && (
                <div style={S.wrn}>{results.warnings.map((w,i) => <div key={i}>{w}</div>)}</div>
              )}

              <div style={S.saveBar}>
                <div style={{fontSize:11,color:"#8b949e",flex:1}}>{runName.trim()?`"${runName.trim()}" · `:""}{(iterations/1000).toFixed(0)}K iters</div>
                <button style={S.saveBtn} onClick={saveRun}>💾 SAVE</button>
              </div>

              {(() => {
                const o = overallOf(R, p2), lo = overallOf(R, 0.85).good, hi = overallOf(R, 0.90).good;
                return <ST l={`Overall good start · ${(p2 * 100).toFixed(1)}% going second`} v={`${o.good.toFixed(2)}%`}
                  s={`at 85%: ${lo.toFixed(2)}% · at 90%: ${hi.toFixed(2)}% · strict (1st optimal only): ${o.strict.toFixed(2)}%`} c={COL.overall} big/>;
              })()}
              <ST l="Either: Starmie or Froslass attacks T1 (2nd)" v={`${pct(R.either_success,R.total)}%`} s={frac(R.either_success, R.total)} c={COL.either} big/>

              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}>
                <ST l="Combo 2a: Water → Mega Starmie (2nd)" v={`${pct(R.c2a_success,R.total)}%`} s={frac(R.c2a_success, R.total)} c={COL.c2a}/>
                <ST l="Combo 2b: Ignition → Mega Starmie (2nd)" v={`${pct(R.c2b_success,R.total)}%`} s={frac(R.c2b_success, R.total)} c={COL.c2b}/>
                <ST l="Combo 3: Water → Mega Froslass (2nd)" v={`${pct(R.c3_success,R.total)}%`} s={frac(R.c3_success, R.total)} c={COL.c3}/>
                <ST l="Combo 1: Boss + Mega ready turn 2 (1st)" v={`${pct(R.c1_success,R.total)}%`} s={`optimal · ${pct(R.c1_ok,R.total)}% optimal or decent`} c={COL.c1}/>
              </div>

              <OutcomeBreakdown R={R} prev={savedRuns.find(r => r.outcome && r.id !== R.savedId)}/>
              <OutcomeFirst R={R} prev={savedRuns.find(r => r.outcomeFirst && r.id !== R.savedId)}/>

              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
                <ST l="Meowth Stuck" v={`${pct(R.meowth_stuck,R.total)}%`} s={`${R.meowth_stuck.toLocaleString()} games`} c={COL.bad} dg/>
                <ST l="Stuck (No Rescue)" v={`${pct(R.meowth_no_rescue,R.total)}%`} s={`${R.meowth_no_rescue.toLocaleString()} no bench recovery`} c={COL.bad} dg/>
                <ST l="Starmie Prized" v={`${pct(R.starmie_prized,R.total)}%`} s={`${R.starmie_prized.toLocaleString()}`} c="#7986cb" dg/>
                <ST l="Froslass Prized" v={`${pct(R.froslass_prized,R.total)}%`} s={`${R.froslass_prized.toLocaleString()}`} c="#80deea" dg/>
                <ST l="Avg Mulligans" v={(R.mulligans/R.total).toFixed(3)} s={`${R.mulligans.toLocaleString()} total`} c="#ffa726"/>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:10}}>
                <BD t="Combo 2a Paths" d={R.c2a} tot={R.c2a_success} st={R.total} c={COL.c2a}/>
                <BD t="Combo 2b Paths" d={R.c2b} tot={R.c2b_success} st={R.total} c={COL.c2b}/>
                <BD t="Combo 3 Paths" d={R.c3} tot={R.c3_success} st={R.total} c={COL.c3}/>
                <BD t="Combo 1 Paths · how Boss was found" d={R.c1} tot={R.c1_success} st={R.total} c={COL.c1}/>
              </div>

              <div style={{padding:12,background:"#0d1117",borderRadius:8,border:"1px solid #21262d"}}>
                <label style={S.l2}>SEARCH CHAINS MODELED</label>
                <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:4}}>
                  <CH i="🎁" f="Secret Box (ACE SPEC)" t="Discard 3 → Salvatore + Balloon + best Item"/>
                  <CH i="🔔" f="Call Bell" t="Going second, turn 1 only → any Supporter (Combos 2/3)"/>
                  <CH i="📋" f="Pokégear 3.0" t="Top 7 → Supporter (extra copies see a reshuffled deck)"/>
                  <CH i="🐱" f="Meowth ex" t="Played from hand to Bench → Supporter"/>
                  <CH i="🌀" f="Scoop Up → Meowth" t="Scoop the Active Meowth, promote, replay it → Supporter"/>
                  <CH i="🔗" f="Ultra Ball → Meowth" t="Hand → Bench → Supporter"/>
                  <CH i="🔵" f="Ultra Ball (-2)" t="Any Pokémon → hand"/>
                  <CH i="🍪" f="Poffin" t="Up to 2 Basics ≤70 HP → Bench (Staryu, Snorunt)"/>
                  <CH i="⚡" f="Energy Search" t="Basic {W} → hand (not Bubbly / Ignition)"/>
                  <CH i="🔄" f="Switch / Scoop Up Cyclone" t="Swap Active (not a retreat)"/>
                  <CH i="🏖️" f="Surfing Beach" t="Once: Active Water ↔ Benched Water"/>
                  <CH i="🏃" f="0 Retreat (Mew ex)" t="Free retreat if it's Active"/>
                  <CH i="🎯" f="Prize gate" t="Mega must be in deck, not prized / in hand"/>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {savedRuns.length > 0 && (
        <div style={S.histSec}>
          <div style={S.histHdr}>
            <div>
              <label style={S.l1}>RUN HISTORY</label>
              <p style={{fontSize:11,color:"#484f58",margin:"2px 0 0"}}>{savedRuns.length} saved · best values highlighted</p>
            </div>
            <button style={S.clrBtn} onClick={clearRuns}>CLEAR ALL</button>
          </div>
          <div style={S.tblWrap}>
            <table style={S.tbl}>
              <thead><tr>
                <th style={{...S.th,minWidth:140,textAlign:"left"}}>Name</th>
                <th style={{...S.th,minWidth:50}}>Iters</th>
                <th style={{...S.th,minWidth:70,color:COL.overall}}>Overall<br/><span style={S.thSub}>good start</span></th>
                <th style={{...S.th,minWidth:70,color:COL.either}}>Either<br/><span style={S.thSub}>Star/Fros</span></th>
                <th style={{...S.th,minWidth:70,color:COL.c2a}}>C2a<br/><span style={S.thSub}>Water</span></th>
                <th style={{...S.th,minWidth:70,color:COL.c2b}}>C2b<br/><span style={S.thSub}>Ignition</span></th>
                <th style={{...S.th,minWidth:70,color:COL.c3}}>C3<br/><span style={S.thSub}>Froslass</span></th>
                <th style={{...S.th,minWidth:60,color:COL.c1}}>1st<br/><span style={S.thSub}>optimal</span></th>
                <th style={{...S.th,minWidth:60,color:COL.c1}}>1st<br/><span style={S.thSub}>opt+decent</span></th>
                <th style={{...S.th,minWidth:60,color:COL.bad}}>MStuck</th>
                <th style={{...S.th,minWidth:60,color:"#1D9E75"}}>M→Atk<br/><span style={S.thSub}>of M starts</span></th>
                <th style={{...S.th,minWidth:50}}>Mull</th>
                <th style={{...S.th,width:32}}></th>
              </tr></thead>
              <tbody>
                {savedRuns.map(r => {
                  const hl = r.id === hlRun;
                  return (
                    <tr key={r.id} style={{background:hl?"rgba(79,195,247,0.08)":"transparent",animation:hl?"flash 2s ease":"none"}}>
                      <td style={{...S.td,textAlign:"left"}}>
                        <div style={{fontWeight:600,color:"#e6edf3",fontSize:11}}>{r.name}</div>
                        <div style={{fontSize:9,color:"#484f58",marginTop:1}}>{r.timestamp}</div>
                      </td>
                      <td style={S.td}>{(r.iterations/1000).toFixed(0)}K</td>
                      <TDC v={r.overall} best={bests?.overall} color={COL.overall}/>
                      <TDC v={r.either} best={bests?.either} color={COL.either}/>
                      <TDC v={r.c2a} best={bests?.c2a} color={COL.c2a}/>
                      <TDC v={r.c2b} best={bests?.c2b} color={COL.c2b}/>
                      <TDC v={r.c3} best={bests?.c3} color={COL.c3}/>
                      <TDC v={r.c1} best={bests?.c1} color={COL.c1}/>
                      <TDC v={r.c1ok} best={bests?.c1ok} color={COL.c1}/>
                      <TDC v={r.meowthStuck} best={bests?.ms} color={COL.bad}/>
                      <TDC v={r.meowthAttack} best={bests?.ma} color="#1D9E75"/>
                      <td style={S.td}>{r.avgMull}</td>
                      <td style={{...S.td,padding:"6px 2px"}}><button style={S.delBtn} onClick={() => delRun(r.id)} title="Delete">✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {savedRuns.length >= 2 && (
            <div style={S.deltaBox}>
              <label style={S.l2}>LATEST vs PREVIOUS</label>
              <div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:4}}>
                <DC label="Overall" a={savedRuns[0].overall} b={savedRuns[1].overall} higher/>
                <DC label="Either" a={savedRuns[0].either} b={savedRuns[1].either} higher/>
                <DC label="1st opt" a={savedRuns[0].c1} b={savedRuns[1].c1} higher/>
                <DC label="1st ok" a={savedRuns[0].c1ok} b={savedRuns[1].c1ok} higher/>
                <DC label="C2a" a={savedRuns[0].c2a} b={savedRuns[1].c2a} higher/>
                <DC label="C2b" a={savedRuns[0].c2b} b={savedRuns[1].c2b} higher/>
                <DC label="C3" a={savedRuns[0].c3} b={savedRuns[1].c3} higher/>
                <DC label="MStuck" a={savedRuns[0].meowthStuck} b={savedRuns[1].meowthStuck} higher={false}/>
                <DC label="M→Atk" a={savedRuns[0].meowthAttack} b={savedRuns[1].meowthAttack} higher/>
              </div>
              <div style={{fontSize:10,color:"#484f58",marginTop:6}}>"{savedRuns[0].name}" vs "{savedRuns[1].name}"</div>
            </div>
          )}
        </div>
      )}

      <footer style={{textAlign:"center",fontSize:9,color:"#30363d",marginTop:20,letterSpacing:".04em"}}>
        Monte Carlo · PTCGL-format parsing · mulligan → prizes → draw → resource-aware plan search (one retreat/turn, each card spent once)
      </footer>
    </div>
  );
}

// ── Outcome donuts ──
function arcPath(r0, r1, a0, a1) {
  const g = Math.min(0.009, (a1 - a0) / 4); a0 += g; a1 -= g;           // small surface gap between slices
  const P = (r, a) => `${(150 + r * Math.sin(a)).toFixed(2)},${(150 - r * Math.cos(a)).toFixed(2)}`;
  const L = a1 - a0 > Math.PI ? 1 : 0;
  return `M${P(r1, a0)}A${r1},${r1} 0 ${L} 1 ${P(r1, a1)}L${P(r0, a1)}A${r0},${r0} 0 ${L} 0 ${P(r0, a0)}Z`;
}
function Delta({ d, goodUp, size = 9.5 }) {
  if (d == null || isNaN(d)) return null;
  const r = Math.round(d * 100) / 100;
  const col = r === 0 ? "#6e7681" : (r > 0) === goodUp ? "#66bb6a" : "#ef5350";
  return <span style={{fontSize:size,color:col,fontVariantNumeric:"tabular-nums",marginLeft:6,whiteSpace:"nowrap"}}>{r > 0 ? "+" : r < 0 ? "−" : "±"}{Math.abs(r).toFixed(2)}</span>;
}
function Donut({ rings, center, sub, fmt, delta, maxW = 280 }) {
  const [hov, setHov] = useState(null);
  const dr = delta == null ? null : Math.round(delta.d * 100) / 100;
  return (
    <div>
      <svg viewBox="0 0 300 300" style={{width:"100%",maxWidth:maxW,display:"block",margin:"0 auto"}} role="img" aria-label={`${center} ${sub}`}>
        {rings.map((rg, ri) => {
          const live = rg.items.filter(x => x.n > 0);
          let a = 0;
          return live.map(it => {
            const a1 = a + 2 * Math.PI * it.n / rg.total;
            const d = live.length === 1 ? arcPath(rg.r0, rg.r1, 0, 2 * Math.PI - 0.0001) : arcPath(rg.r0, rg.r1, a, a1);
            a = a1;
            const msg = `${it.label}: ${fmt(it.n, rg.total)}`;
            return <path key={`${ri}-${it.k}`} d={d} fill={it.color} style={{cursor:"pointer"}} onMouseEnter={() => setHov(msg)} onClick={() => setHov(msg)}><title>{msg}</title></path>;
          });
        })}
        <text x="150" y={dr == null ? 150 : 143} textAnchor="middle" fontSize="28" fontWeight="700" fill="#e6edf3">{center}</text>
        <text x="150" y={dr == null ? 171 : 163} textAnchor="middle" fontSize="12" fill="#8b949e">{sub}</text>
        {dr != null && <text x="150" y="183" textAnchor="middle" fontSize="12" fontWeight="700"
          fill={dr === 0 ? "#6e7681" : (dr > 0) === delta.goodUp ? "#66bb6a" : "#ef5350"}>
          {dr > 0 ? "+" : dr < 0 ? "−" : "±"}{Math.abs(dr).toFixed(2)} vs saved</text>}
      </svg>
      <div style={{textAlign:"center",fontSize:10.5,color:hov?"#c9d1d9":"#484f58",minHeight:16,margin:"4px 0 8px"}}>{hov || "Hover or tap a slice"}</div>
    </div>
  );
}
function OutLegend({ groups, fmt }) {
  return (
    <div style={{fontSize:10.5}}>
      {groups.map(({ title, d, goodUp, items }) => (
        <div key={title} style={{marginBottom:6}}>
          <div style={{color:"#c9d1d9",fontWeight:700,margin:"6px 0 3px"}}>{title}<Delta d={d} goodUp={goodUp} size={10}/></div>
          {items.filter(x => x.n > 0 || (x.d != null && Math.abs(x.d) >= 0.005)).map(it => (
            <div key={it.k} style={{display:"flex",alignItems:"center",gap:7,padding:"2px 0",color:"#8b949e"}}>
              <span style={{width:9,height:9,borderRadius:2,background:it.color,flex:"none"}}/>
              <span style={{flex:1}}>{it.label}</span>
              <span style={{color:"#c9d1d9",fontVariantNumeric:"tabular-nums"}}>{fmt(it.n)}</span>
              <Delta d={it.d} goodUp={it.goodUp ?? it.g[0] === "v"}/>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
// prev = an earlier saved run (with outcome %s). Deltas are percentage points; for the Meowth donut they're
// points of "share of Meowth starts". Green = better for you (more attacks / fewer failures), red = worse.
function OutcomeBreakdown({ R, prev }) {
  const N = R.total;
  const P = prev?.outcome || null;
  const items = OUTCOMES.map(o => ({ ...o, n: R.outcome?.[o.k] || 0, color: OUT_COL[o.k] }));
  const sumOf = (xs) => xs.reduce((s, x) => s + x.n, 0);
  const sumPrev = (pred) => P ? OUTCOMES.filter(pred).reduce((s, o) => s + (P[o.k] || 0), 0) : null;
  const vAll = sumOf(items.filter(x => x.g[0] === "v"));
  const stuck = items.filter(x => x.g[1] === "s");
  const MS = sumOf(stuck), sv = sumOf(stuck.filter(x => x.g[0] === "v"));
  const pAll = (n) => `${(100 * n / N).toFixed(2)}%`;
  const pS = (n) => MS ? `${(100 * n / MS).toFixed(1)}%` : "—";

  // deltas
  const prevV = sumPrev(o => o.g[0] === "v"), prevS = sumPrev(o => o.g[1] === "s"), prevSV = sumPrev(o => o.g === "vs");
  for (const it of items) it.d = P ? 100 * it.n / N - (P[it.k] || 0) : null;
  const stuckRel = stuck.map(it => ({ ...it, d: P && prevS > 0 && MS > 0 ? 100 * it.n / MS - 100 * (P[it.k] || 0) / prevS : null }));
  const dV = P ? 100 * vAll / N - prevV : null;
  const dSV = P && prevS > 0 && MS > 0 ? 100 * sv / MS - 100 * prevSV / prevS : null;
  const noiseAll = P ? 100 / Math.sqrt(Math.min(N, prev.iterations || N)) : null;
  const noiseS = P && MS > 0 ? 100 / Math.sqrt(Math.min(MS, ((prevS || 0) / 100) * (prev.iterations || N)) || 1) : null;

  const card = {padding:12,background:"#0d1117",borderRadius:8,border:"1px solid #21262d"};
  return (
    <div style={card}>
      <label style={S.l2}>OUTCOME BREAKDOWN · GOING SECOND (TURN 2)</label>
      <div style={{fontSize:10,color:P?"#8b949e":"#484f58",margin:"-2px 0 10px",lineHeight:1.5}}>
        {P ? <>Changes vs saved run <span style={{color:"#c9d1d9"}}>"{prev.name}"</span>, in percentage points. Moves under about ±{noiseAll.toFixed(2)} are noise at this run size.</>
           : <>Tip: save a run, change your list, run again — every slice then shows how much it moved.</>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:18}}>
        <div>
          <div style={{fontSize:11,color:"#c9d1d9",fontWeight:700}}>All games</div>
          <div style={{fontSize:10,color:"#484f58",marginBottom:4}}>Inner ring: attack or not · outer ring: why</div>
          <Donut
            rings={[
              { r0: 62, r1: 84, total: N, items: [
                { k: "att", label: "Attacks on turn 2", n: vAll, color: "#0C447C" },
                { k: "no", label: "No attack", n: N - vAll, color: "#444441" } ] },
              { r0: 90, r1: 140, total: N, items },
            ]}
            center={pAll(vAll)} sub="attack turn 2" fmt={(n) => pAll(n)}
            delta={dV == null ? null : { d: dV, goodUp: true }}/>
          <OutLegend fmt={pAll} groups={[
            { title: `Attacks on turn 2 · ${pAll(vAll)}`, d: dV, goodUp: true, items: items.filter(x => x.g[0] === "v") },
            { title: `No attack · ${pAll(N - vAll)}`, d: dV == null ? null : -dV, goodUp: false, items: items.filter(x => x.g[0] === "n") },
          ]}/>
        </div>
        <div>
          <div style={{fontSize:11,color:"#c9d1d9",fontWeight:700}}>Forced Meowth ex starts</div>
          <div style={{fontSize:10,color:"#484f58",marginBottom:4}}>
            100% = Meowth ex is your only basic ({pAll(MS)} of games{P && prevS != null ? <>, was {prevS.toFixed(2)}%</> : null})
            {noiseS != null && <> · noise ±{noiseS.toFixed(1)}</>}
          </div>
          {MS > 0 ? (<>
            <Donut maxW={240} rings={[{ r0: 80, r1: 135, total: MS, items: stuck }]}
              center={pS(sv)} sub="still attack" fmt={(n) => `${pS(n)} of Meowth starts · ${pAll(n)} of all`}
              delta={dSV == null ? null : { d: dSV, goodUp: true }}/>
            <OutLegend fmt={pS} groups={[
              { title: `Still attack · ${pS(sv)}`, d: dSV, goodUp: true, items: stuckRel.filter(x => x.g[0] === "v") },
              { title: `No attack · ${pS(MS - sv)}`, d: dSV == null ? null : -dSV, goodUp: false, items: stuckRel.filter(x => x.g[0] === "n") },
            ]}/>
          </>) : <div style={{fontSize:11,color:"#484f58",padding:"30px 0",textAlign:"center"}}>No forced Meowth ex starts in this run</div>}
        </div>
      </div>
    </div>
  );
}

// Going-first donut colors: blue = optimal, teal = decent, gray/coral = failures
const OUT_FIRST_COL = {
  o_both: "#185FA5", o_starmie: "#378ADD", o_froslass: "#85B7EB",
  d_salvo_new: "#085041", d_hilda: "#0F6E56", d_salvatore: "#1D9E75", d_lillies: "#5DCAA5",
  f_meowth: "#993C1D", f_energy: "#D85A30", f_wally: "#F0997B", f_none: "#5F5E5A", f_other: "#888780",
};
function OutcomeFirst({ R, prev }) {
  if (!R.outcomeFirst) return null;
  const N = R.total;
  const P = prev?.outcomeFirst || null;
  const items = OUTCOMES_FIRST.map(o => ({ ...o, n: R.outcomeFirst[o.k] || 0, color: OUT_FIRST_COL[o.k], goodUp: o.g !== "f",
    d: P ? (100 * (R.outcomeFirst[o.k] || 0)) / N - (P[o.k] || 0) : null }));
  const sumG = (g) => items.filter(x => x.g === g).reduce((s, x) => s + x.n, 0);
  const sumP = (g) => P ? OUTCOMES_FIRST.filter(o => o.g === g).reduce((s, o) => s + (P[o.k] || 0), 0) : null;
  const nO = sumG("o"), nD = sumG("d"), nF = sumG("f");
  const p = (n) => `${(100 * n / N).toFixed(2)}%`;
  const dd = (n, g) => P ? (100 * n) / N - sumP(g) : null;
  return (
    <div style={{padding:12,background:"#0d1117",borderRadius:8,border:"1px solid #21262d"}}>
      <label style={S.l2}>OUTCOME BREAKDOWN · GOING FIRST (YOUR TURN 2)</label>
      <div style={{fontSize:10,color:"#484f58",margin:"-2px 0 10px",lineHeight:1.5}}>
        Optimal = Boss's Orders + Mega in hand + its pre-evolution in play since turn 1 + energy to attack, Mega able to be Active on turn 2.
        Each game counts once, in the order listed.{P ? <> Changes vs saved run <span style={{color:"#c9d1d9"}}>"{prev.name}"</span>, in points.</> : null}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:18,alignItems:"start"}}>
        <Donut rings={[
            { r0: 62, r1: 84, total: N, items: [
              { k: "o", label: "Optimal", n: nO, color: "#0C447C" },
              { k: "d", label: "Decent", n: nD, color: "#085041" },
              { k: "f", label: "Failure", n: nF, color: "#444441" } ] },
            { r0: 90, r1: 140, total: N, items },
          ]}
          center={p(nO)} sub="optimal start" fmt={(n) => p(n)}
          delta={P ? { d: dd(nO, "o"), goodUp: true } : null}/>
        <OutLegend fmt={p} groups={[
          { title: `Optimal · ${p(nO)}`, d: dd(nO, "o"), goodUp: true, items: items.filter(x => x.g === "o") },
          { title: `Decent · ${p(nD)}`, d: dd(nD, "d"), goodUp: true, items: items.filter(x => x.g === "d") },
          { title: `Failure · ${p(nF)}`, d: dd(nF, "f"), goodUp: false, items: items.filter(x => x.g === "f") },
        ]}/>
      </div>
    </div>
  );
}

function TDC({v,best,color}){ const n=parseFloat(v); const is=best!=null&&!isNaN(n)&&n===best; return <td style={{...S.td,color,fontWeight:700,background:is?"rgba(255,255,255,0.06)":undefined}}>{v==null?"—":isNaN(n)?v:`${v}%`}</td>; }
function DC({label,a,b,higher}){ const na=parseFloat(a), nb=parseFloat(b); if(isNaN(na)||isNaN(nb)) return(<div style={{display:"flex",alignItems:"center",gap:6,fontSize:11}}><span style={{color:"#8b949e",minWidth:40}}>{label}</span><span style={{color:"#6e7681"}}>—</span></div>); const n=+(na-nb).toFixed(2); const g=higher?n>0:n<0; return(<div style={{display:"flex",alignItems:"center",gap:6,fontSize:11}}><span style={{color:"#8b949e",minWidth:40}}>{label}</span><span style={{fontWeight:700,color:n===0?"#6e7681":g?"#66bb6a":"#ef5350",fontSize:12}}>{n>0?"+":""}{n.toFixed(2)}%</span>{n!==0&&<span style={{fontSize:10,color:g?"#66bb6a":"#ef5350"}}>{g?"▲":"▼"}</span>}</div>); }
function ST({l,v,s,c,dg,big}){ return(<div style={{padding:14,borderRadius:10,border:"1px solid #30363d",borderTop:`3px solid ${c}`,background:dg?"rgba(239,83,80,0.06)":"rgba(255,255,255,0.02)"}}><div style={{fontSize:9,color:"#8b949e",fontWeight:600,letterSpacing:".06em",marginBottom:6,textTransform:"uppercase"}}>{l}</div><div style={{fontSize:big?36:28,fontWeight:700,lineHeight:1,marginBottom:5,color:c}}>{v}</div><div style={{fontSize:10,color:"#484f58"}}>{s}</div></div>); }
function BD({t,d,tot,st,c}){ return(<div style={{padding:12,background:"#0d1117",borderRadius:8,border:"1px solid #21262d",borderTop:`2px solid ${c}`}}><div style={{fontSize:10,fontWeight:700,color:"#c9d1d9",letterSpacing:".06em",marginBottom:10,textTransform:"uppercase"}}>{t}</div>{Object.entries(METHOD_LABELS).map(([k,label])=>{ const n=d[k]||0; const w=tot>0?(n/tot)*100:0; return(<div key={k} style={{marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#8b949e",marginBottom:3}}><span>{label}</span><span style={{color:"#6e7681"}}>{n.toLocaleString()} ({st>0?((n/st)*100).toFixed(2):"0"}%)</span></div><div style={{height:5,background:"#21262d",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",borderRadius:3,width:`${w}%`,background:c,transition:"width .3s",minWidth:n>0?1:0}}/></div></div>);})}</div>); }
function CB({c,t,d}){ return(<div style={{padding:"8px 12px",background:"#0d1117",borderRadius:8,border:"1px solid #30363d",borderLeft:`3px solid ${c}`}}><div style={{fontSize:10,fontWeight:700,color:c,letterSpacing:".08em",marginBottom:3}}>{t}</div><p style={{fontSize:11,color:"#8b949e",margin:0,lineHeight:1.5}}>{d}</p></div>); }
function CH({i,f,t}){ return(<div style={{display:"flex",alignItems:"center",gap:8,fontSize:11,flexWrap:"wrap"}}><span style={{width:18,textAlign:"center"}}>{i}</span><span style={{color:"#c9d1d9",fontWeight:600,minWidth:175}}>{f}</span><span style={{color:"#484f58"}}>→</span><span style={{color:"#8b949e"}}>{t}</span></div>); }

const S={
  root:{fontFamily:"'Space Mono',monospace",background:"#0d1117",color:"#c9d1d9",minHeight:"100vh",padding:20},
  hdr:{textAlign:"center",marginBottom:28},
  pb:{width:44,height:44,borderRadius:"50%",background:"linear-gradient(180deg,#ef5350 50%,#fafafa 50%)",border:"3px solid #444",margin:"0 auto 10px",position:"relative",boxShadow:"0 0 24px rgba(239,83,80,0.25)"},
  pbc:{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:12,height:12,borderRadius:"50%",background:"#fafafa",border:"3px solid #444"},
  ttl:{fontSize:26,fontWeight:700,letterSpacing:".15em",color:"#e6edf3",margin:0},
  stl:{fontSize:11,color:"#6e7681",letterSpacing:".2em",marginTop:4,textTransform:"uppercase"},
  left:{background:"#161b22",borderRadius:12,padding:18,border:"1px solid #30363d",minWidth:0},
  right:{background:"#161b22",borderRadius:12,padding:22,border:"1px solid #30363d",minHeight:420,minWidth:0},
  l1:{fontSize:11,fontWeight:700,letterSpacing:".12em",color:"#8b949e",textTransform:"uppercase",display:"block",marginBottom:3},
  l2:{fontSize:10,fontWeight:700,letterSpacing:".12em",color:"#6e7681",textTransform:"uppercase",display:"block",marginBottom:6},
  hint:{fontSize:11,color:"#484f58",margin:"0 0 6px",lineHeight:1.4},
  ta:{width:"100%",height:280,background:"#0d1117",border:"1px solid #30363d",borderRadius:8,color:"#c9d1d9",fontFamily:"inherit",fontSize:10.5,padding:10,resize:"vertical",outline:"none",lineHeight:1.7,boxSizing:"border-box"},
  ni:{width:"100%",background:"#0d1117",border:"1px solid #30363d",borderRadius:6,color:"#e6edf3",fontFamily:"inherit",fontSize:12,padding:"7px 10px",outline:"none",boxSizing:"border-box"},
  cr:{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginTop:10,gap:10,flexWrap:"wrap"},
  ib:{background:"#21262d",border:"1px solid #30363d",color:"#8b949e",padding:"3px 9px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"inherit"},
  iba:{background:"#1f6feb",border:"1px solid #1f6feb",color:"#fff"},
  rb:{background:"linear-gradient(135deg,#1f6feb,#388bfd)",border:"none",color:"#fff",padding:"9px 18px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",letterSpacing:".06em",fontFamily:"inherit",whiteSpace:"nowrap"},
  err:{background:"rgba(239,83,80,0.08)",border:"1px solid #ef5350",borderRadius:8,padding:10,marginTop:10,fontSize:11,color:"#ef5350"},
  wrn:{background:"rgba(255,167,38,0.08)",border:"1px solid rgba(255,167,38,0.25)",borderRadius:8,padding:10,fontSize:11,color:"#ffa726",lineHeight:1.5},
  pw:{marginTop:14,padding:10,background:"#0d1117",borderRadius:8,border:"1px solid #21262d"},
  pl:{display:"flex",flexDirection:"column",gap:2,maxHeight:220,overflowY:"auto"},
  pr:{display:"flex",alignItems:"center",gap:6,padding:"2px 7px",fontSize:10.5,background:"#161b22",borderRadius:4},
  pc:{color:"#8b949e",minWidth:22,fontWeight:700},
  pn:{flex:1,color:"#c9d1d9"},
  pt:{fontSize:8,fontWeight:700,letterSpacing:".1em"},
  emp:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",minHeight:350,gap:14},
  ept:{fontSize:12,color:"#484f58",textAlign:"center"},
  saveBar:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:"#0d1117",borderRadius:8,border:"1px solid #21262d",gap:12},
  saveBtn:{background:"#238636",border:"1px solid #2ea043",color:"#fff",padding:"6px 14px",borderRadius:6,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",letterSpacing:".06em",whiteSpace:"nowrap"},
  histSec:{maxWidth:1280,margin:"24px auto 0",background:"#161b22",borderRadius:12,padding:20,border:"1px solid #30363d"},
  histHdr:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14},
  clrBtn:{background:"transparent",border:"1px solid #30363d",color:"#6e7681",padding:"4px 10px",borderRadius:5,fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"inherit",letterSpacing:".08em"},
  tblWrap:{overflowX:"auto",borderRadius:8,border:"1px solid #21262d"},
  tbl:{width:"100%",borderCollapse:"collapse",fontSize:11},
  th:{padding:"10px 8px",textAlign:"center",color:"#8b949e",fontSize:9,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",borderBottom:"1px solid #21262d",background:"#0d1117",whiteSpace:"nowrap"},
  thSub:{fontWeight:400,fontSize:8},
  td:{padding:"10px 8px",textAlign:"center",borderBottom:"1px solid #161b22",fontSize:12,whiteSpace:"nowrap"},
  delBtn:{background:"transparent",border:"none",color:"#484f58",fontSize:12,cursor:"pointer",padding:"2px 6px",borderRadius:4,lineHeight:1},
  deltaBox:{marginTop:14,padding:12,background:"#0d1117",borderRadius:8,border:"1px solid #21262d"},
};
