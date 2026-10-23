/** Matching shop listings to someone's franchises: by title, by character, and by kind of figure. */
import type { Tier } from "./score.ts";
import type { CastMember, SearchTerms } from "./types.ts";

/**
 * Lowercase words without accents or punctuation. Apostrophes join ("Journey's" → "journeys"), and
 * "x" and "and" are dropped so "SPY×FAMILY" meets "Spy x Family".
 */
export function normalize(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((word) => word && word !== "x" && word !== "and")
    .join(" ");
}

export const hasPhrase = (text: string, phrase: string) => Boolean(phrase) && ` ${text} `.includes(` ${phrase} `);

/** A one-word title must be the whole series name; longer titles may sit inside one ("Gekijouban … Madoka Magica …"). */
export const seriesHas = (series: string, title: string) => (title.includes(" ") ? hasPhrase(series, title) : series === title);

// Season, part and format markers that end a title without changing its characters.
const SUFFIX = /\s(?:season \d+|\d+(?:st|nd|rd|th) season|final season|part \d+|cour \d+|ii|iii|iv|\d{1,2}|(?:19|20)\d\d|the movie|movie|ova|oad|ona|specials?|tv)$/;
const EDGE_WORDS = new Set(["the", "of", "a", "no", "wa", "to", "ga", "in", "on", "season"]);

function stripSuffix(normalized: string) {
  let out = normalized;
  for (let previous = ""; previous !== out; ) {
    previous = out;
    out = out.replace(SUFFIX, "");
  }
  return out;
}

/** "Sword Art Online: Alicization" → "sword art online"; "Re:ZERO -Starting Life…- Season 2" keeps its main title. */
export function baseTitle(title: string) {
  return stripSuffix(normalize(title.split(/:\s|\s[-–~]\s/)[0]));
}

function trimEdges(words: string[]) {
  const out = [...words];
  while (out.length && EDGE_WORDS.has(out[0])) out.shift();
  while (out.length && EDGE_WORDS.has(out[out.length - 1])) out.pop();
  return out;
}

/** The longest run of words every title shares: "The Melancholy of…" and "The Disappearance of Haruhi Suzumiya" → "haruhi suzumiya". */
export function commonRun(titles: string[]) {
  if (!titles.length) return "";
  const [first, ...rest] = titles.map((title) => title.split(" "));
  let best: string[] = [];
  for (let i = 0; i < first.length; i++) {
    for (let j = first.length; j > i + best.length; j--) {
      const run = first.slice(i, j).join(" ");
      if (rest.every((words) => hasPhrase(words.join(" "), run))) {
        best = first.slice(i, j);
        break;
      }
    }
  }
  return trimEdges(best).join(" ");
}

const useful = (phrase: string) => phrase.length >= 5 || phrase.includes(" ");
const latin = (phrase: string) => /^[a-z0-9 ]+$/.test(phrase);

const MAX_QUERIES = 3;

/**
 * Titles come most popular first. The name the best-known entries share comes first ("haruhi
 * suzumiya"), then any entry it doesn't cover (a spin-off titled differently), up to three searches.
 */
function queriesFor(titles: string[]) {
  const stripped = [...new Set(titles.map((title) => stripSuffix(normalize(title))).filter(Boolean))];
  for (let k = stripped.length; k >= 2; k--) {
    const run = commonRun(stripped.slice(0, k));
    if (!run || !useful(run)) continue;
    const rest = stripped.filter((title) => !hasPhrase(title, run)).map((title) => trimEdges(title.split(" ")).join(" "));
    return [run, ...rest.filter(useful)].slice(0, MAX_QUERIES);
  }
  // No shared name (Bakemonogatari, Nisemonogatari…): search the best-known entries one by one.
  return [...new Set(stripped.map((title) => trimEdges(title.split(" ")).join(" ")).filter(useful))].slice(0, MAX_QUERIES);
}

/**
 * Search terms for a franchise. Entries should come most popular first: when the titles share no
 * name, the shop is searched for the best-known ones.
 */
export function searchTerms(entries: { english: string | null; romaji: string | null; synonyms?: string[] }[]): SearchTerms {
  const english = entries.map((e) => e.english || e.romaji || "").filter(Boolean);
  const romaji = entries.map((e) => e.romaji || "").filter(Boolean);
  const queries = queriesFor(english);
  const altQueries = queriesFor(romaji).filter((query) => !queries.includes(query));
  const exact = new Set<string>();
  const loose = new Set<string>();
  for (const entry of entries) {
    for (const title of [entry.english, entry.romaji]) {
      if (!title) continue;
      const whole = stripSuffix(normalize(title));
      if (whole.length >= 3) exact.add(whole);
      const base = baseTitle(title);
      if (base.length >= 3 && useful(base)) loose.add(base);
    }
    // Short romanized nicknames ("Pansto", "Sora no Woto"); long synonyms are mostly translations.
    for (const synonym of (entry.synonyms ?? []).slice(0, 8)) {
      const whole = stripSuffix(normalize(synonym));
      if (latin(whole) && whole.length >= 6 && whole.split(" ").length <= 4) exact.add(whole);
    }
  }
  for (const title of exact) loose.delete(title);
  return { queries, altQueries, exact: [...exact], loose: [...loose] };
}

/** The franchise title a listing's text carries, if any, with stronger (whole-title) matches first. */
export function titleMatch(text: string, terms: Pick<SearchTerms, "exact" | "loose">, contains = hasPhrase) {
  const exact = terms.exact.filter((title) => contains(text, title)).sort((a, b) => b.length - a.length)[0];
  if (exact) return { strength: 2 as const, title: exact };
  const loose = terms.loose.filter((title) => contains(text, title)).sort((a, b) => b.length - a.length)[0];
  return loose ? { strength: 1 as const, title: loose } : null;
}

/** Spellings to search listings for: the full name, its alternatives, and a given or family name only this character has. */
export function castNames(cast: { key: string; full: string; first?: string | null; last?: string | null; alternative?: string[] }[]) {
  const singles = new Map<string, number>();
  for (const member of cast) {
    for (const part of [member.first, member.last]) {
      const word = normalize(part ?? "");
      if (word && !word.includes(" ")) singles.set(word, (singles.get(word) ?? 0) + 1);
    }
  }
  return cast.map((member) => {
    const names = new Set([member.full, ...(member.alternative ?? [])].map(normalize).filter((name) => name.length >= 3));
    for (const part of [member.first, member.last]) {
      const word = normalize(part ?? "");
      if (word.length >= 4 && singles.get(word) === 1) names.add(word);
    }
    return { key: member.key, names: [...names] };
  });
}

const words = (text: string) => new Set(text.split(" ").filter(Boolean));
const within = (inner: Set<string>, outer: Set<string>) => [...inner].every((word) => outer.has(word));

/** Characters named in a listing's text (in any word order: "Suzumiya Haruhi" is Haruhi Suzumiya). */
export function findCharacters(text: string, cast: Pick<CastMember, "key" | "names">[]) {
  const have = words(text);
  return cast.filter((member) => member.names.some((name) => within(words(name), have))).map((member) => member.key);
}

/** Characters a shop's character tag names: either the tag holds the whole name or the name holds the tag ("Homura"). */
export function findTaggedCharacters(tags: string[], cast: Pick<CastMember, "key" | "names">[]) {
  const found = new Set<string>();
  for (const tag of tags.map(normalize).filter(Boolean)) {
    const tagWords = words(tag);
    for (const member of cast) {
      if (member.names.some((name) => {
        const nameWords = words(name);
        return within(nameWords, tagWords) || (within(tagWords, nameWords) && [...tagWords].some((w) => w.length >= 4));
      })) found.add(member.key);
    }
  }
  return [...found];
}

const NOT_FIGURE = /\b(acrylic|rubber|key ?chains?|keyholder|strap|can badge|badges?|plush|plushie|mascot|cushion|tapestry|poster|stickers?|t shirt|towel|mug|model kit|plastic model|plamo|garage kit|resin kit|display (?:stand|case)|stand only|replacement parts?|parts set|clear file|art ?book|blu ray|dvd|soundtrack|trading cards?|sleeves?|pillow|nendoroid more|nendoroid doll outfit|doll accessory)\b/;
const PRIZE = /\b(prize|game prize|ichiban kuji|ichibansho|spm|luminasta|noodle stopper|bicute|coreful|trio try it|q posket|espresto|glitter glamours|relax time|desktop cute|aqua float girls|chokonose|exq|dxf|grandista|vibration stars|break time|kyunties|nendoroid petite|nendoroid swacchao|trading|blind box|huggy good smile|palverse)\b/;
const COMPACT = /\b(pop up parade|tenitol|look up|figuarts mini|figuarts zero|g e m|melty princess|chibi|deformed|mini figure)\b/;
const ARTICULATED = /\b(nendoroid|figma|cu poche|s h figuarts|buzzmod|revoltech|posable|action figure)\b/;
const PREMIUM = /\b(alter|myethos|aniplex|estream|apex|max factory|good smile arts|spiritale|wonderful works|design coco|prime 1|amakuni|hobby max|ribose|reverse studio)\b/;
const PRIZE_MAKERS = /\b(banpresto|taito|sega|bandai spirits)\b/;

/**
 * The shelf's figure classes. `kind` is a shop's own category (Solaris: Prize, Nendoroid…). Returns null
 * for merchandise that isn't a figure (acrylic stands, plushies, kits).
 */
export function classifyFigure(title: string, kind = "", maker = ""): { tier: Tier; line: string } | null {
  const text = normalize(`${title} ${kind}`);
  if (NOT_FIGURE.test(text)) return null;
  const scale = Number(title.match(/\b1\/([1-9]|1[0-2])\b/)?.[1] ?? 0);
  if (/\bnendoroid\b/.test(text) && !PRIZE.test(text)) return { tier: "C", line: "Nendoroid" };
  if (/\bfigma\b/.test(text)) return { tier: "C", line: "figma" };
  if (PRIZE.test(text) || kind === "Prize" || kind === "Trading") return { tier: "E", line: kind === "Trading" || /trading|blind box/.test(text) ? "Trading figure" : "Prize" };
  if (COMPACT.test(text)) return { tier: "D", line: /pop up parade/.test(text) ? "Pop Up Parade" : "Non-scale" };
  if (ARTICULATED.test(text) || kind === "Action" || kind === "Nendoroid" || kind === "Figma") return { tier: "C", line: "Articulated" };
  if (scale) {
    const premium = scale <= 4 || PREMIUM.test(normalize(`${maker} ${title}`));
    return { tier: premium ? "A" : "B", line: `1/${scale} scale` };
  }
  if (PRIZE_MAKERS.test(normalize(maker))) return { tier: "E", line: "Prize" };
  return { tier: "D", line: "Non-scale" };
}
