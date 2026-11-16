/** Matching shop listings to someone's franchises: by title, by character, and by kind of figure. */
import type { Tier } from "./score.ts";
import type { CastMember, SearchTerms } from "./types.ts";

/**
 * Lowercase words without accents or punctuation. Apostrophes join ("Journey's" → "journeys"), and
 * "x" and "and" are dropped so "SPY×FAMILY" meets "Spy x Family". "∀" is read "turn a".
 */
export function normalize(text: string) {
  return text
    .replace(/∀/g, " turn a ")
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

// Season, part and format markers that end a title without changing its characters.
const SUFFIX = /\s(?:season \d+|\d+(?:st|nd|rd|th) season|final season|part \d+|cour \d+|ii|iii|iv|\d{1,2}|(?:19|20)\d\d|the movie|movie|the animation|ova|oad|ona|specials?|tv)$/;
// The same without bare numbers, which may be part of the name ("Persona 4", "Lupin III").
const FORMAT_SUFFIX = /\s(?:season \d+|\d+(?:st|nd|rd|th) season|final season|part \d+|cour \d+|(?:19|20)\d\d|the movie|movie|the animation|ova|oad|ona|specials?|tv)$/;
const EDGE_WORDS = new Set(["the", "of", "a", "no", "wa", "to", "ga", "in", "on", "season"]);

export function stripSuffix(normalized: string, keepNumbers = false) {
  const suffix = keepNumbers ? FORMAT_SUFFIX : SUFFIX;
  let out = normalized;
  for (let previous = ""; previous !== out; ) {
    previous = out;
    out = out.replace(suffix, "");
  }
  return out;
}

/**
 * A one-word title must be the whole series name ("Lupin III" counts for "lupin"); longer titles
 * may sit inside one ("Gekijouban … Madoka Magica …").
 */
export const seriesHas = (series: string, title: string) =>
  title.includes(" ") ? hasPhrase(series, title) : series === title || stripSuffix(series) === title;

/** "Sword Art Online: Alicization" → "sword art online"; "Re:ZERO -Starting Life…- Season 2" keeps its main title. */
export function baseTitle(title: string) {
  const words = stripSuffix(normalize(title.split(/:\s|\s[-–~]\s/)[0])).split(" ");
  // "ARIA The OVA: Arietta" shouldn't leave "aria the".
  while (words.length > 1 && EDGE_WORDS.has(words[words.length - 1])) words.pop();
  return words.join(" ");
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
const MAX_RELATED = 40;

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

type Titled = { english: string | null; romaji: string | null; synonyms?: string[] };

/**
 * Search terms for a franchise. Entries should come most popular first: when the titles share no
 * name, the shop is searched for the best-known ones. `relatives` are sequels, spin-offs and
 * crossovers the person hasn't listed: their figures still count when they show a character the
 * person knows, and at a discount otherwise.
 */
export function searchTerms(entries: Titled[], relatives: Titled[] = []): SearchTerms {
  const english = entries.map((e) => e.english || e.romaji || "").filter(Boolean);
  const romaji = entries.map((e) => e.romaji || "").filter(Boolean);
  const queries = queriesFor(english);
  const altQueries = queriesFor(romaji).filter((query) => !queries.includes(query));
  const exact = new Set<string>();
  const loose = new Set<string>();
  for (const entry of entries) {
    for (const title of [entry.english, entry.romaji]) {
      if (!title) continue;
      // A number can be a season or the work itself: "Persona 4" isn't "Persona 5", so the
      // numbered title is the show's own and the bare name only counts beside its cast.
      const whole = stripSuffix(normalize(title), true);
      if (whole.length >= 3) exact.add(whole);
      const bare = stripSuffix(whole);
      if (bare !== whole && bare.length >= 3 && useful(bare)) loose.add(bare);
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
  const related = new Set<string>();
  for (const relative of relatives) {
    for (const title of [relative.english, relative.romaji]) {
      const whole = title ? stripSuffix(normalize(title)) : "";
      if (whole.includes(" ") && !exact.has(whole) && related.size < MAX_RELATED) related.add(whole);
    }
  }
  return { queries, altQueries, exact: [...exact], loose: [...loose], related: [...related] };
}

/** The franchise title a listing's text carries, if any, with stronger (whole-title) matches first. */
export function titleMatch(text: string, terms: Pick<SearchTerms, "exact" | "loose">, contains = hasPhrase) {
  const exact = terms.exact.filter((title) => contains(text, title)).sort((a, b) => b.length - a.length)[0];
  if (exact) return { strength: 2 as const, title: exact };
  const loose = terms.loose.filter((title) => contains(text, title)).sort((a, b) => b.length - a.length)[0];
  return loose ? { strength: 1 as const, title: loose } : null;
}

/**
 * One spelling for the ways shops romanize a name: Cocoa and Kokoa, Kyouko and Kyoko, Holo and
 * Horo, Shinji and Sinzi all share a key.
 */
export function nameKey(word: string) {
  return word
    .replace(/ou|oo|oh/g, "o")
    .replace(/uu/g, "u")
    .replace(/c(?!h)/g, "k")
    .replace(/l/g, "r")
    .replace(/v/g, "b")
    .replace(/ph/g, "f")
    .replace(/tsu/g, "tu")
    .replace(/shi/g, "si")
    .replace(/chi/g, "ti")
    .replace(/fu/g, "hu")
    .replace(/ji/g, "zi")
    .replace(/dzu/g, "zu")
    .replace(/([a-z])\1/g, "$1");
}

const keySets = new Map<string, Set<string>>();
/** A phrase's words as romanization-proof keys. */
export function keyWords(text: string) {
  let set = keySets.get(text);
  if (!set) {
    set = new Set(text.split(" ").filter(Boolean).map(nameKey));
    if (keySets.size > 20_000) keySets.clear();
    keySets.set(text, set);
  }
  return set;
}
const within = (inner: Set<string>, outer: Set<string>) => {
  for (const word of inner) if (!outer.has(word)) return false;
  return inner.size > 0;
};

// A name that's only part of someone's name ("~kokoro" for Kokoro Katsura) is marked, so it can
// be left out when the rest of the evidence is thin.
const PART = "~";
export const wholeName = (name: string) => (name.startsWith(PART) ? name.slice(1) : name);

/**
 * Spellings to search listings for: the full name and its alternatives, plus (marked as partial)
 * a given or family name only this character has.
 */
export function castNames(cast: { key: string; full: string; first?: string | null; last?: string | null; alternative?: string[] }[]) {
  const singles = new Map<string, number>();
  for (const member of cast) {
    for (const part of [member.first, member.last]) {
      const word = normalize(part ?? "");
      if (word && !word.includes(" ")) singles.set(nameKey(word), (singles.get(nameKey(word)) ?? 0) + 1);
    }
  }
  return cast.map((member) => {
    // Two letters are too little to go on, unless one is a digit ("2B", "9S").
    const names = new Set([member.full, ...(member.alternative ?? [])].map(normalize).filter((name) => name.length >= 3 || /^(?=.*\d)[a-z\d]{2}$/.test(name)));
    for (const part of [member.first, member.last]) {
      const word = normalize(part ?? "");
      if (word.length >= 4 && !word.includes(" ") && !names.has(word) && singles.get(nameKey(word)) === 1) names.add(PART + word);
    }
    return { key: member.key, names: [...names] };
  });
}

/**
 * Characters named in a listing's text (in any word order: "Suzumiya Haruhi" is Haruhi Suzumiya).
 * `strict` only accepts a name in full, for when the rest of the evidence is thin.
 */
export function findCharacters(text: string, cast: Pick<CastMember, "key" | "names">[], strict = false) {
  const have = new Set(text.split(" ").filter(Boolean).map(nameKey));
  return cast
    .filter((member) => member.names.some((name) => (!strict || !name.startsWith(PART)) && within(keyWords(wholeName(name)), have)))
    .map((member) => member.key);
}

// Makers as they open a listing title when the shop doesn't name one ("ALTER Panty & Stocking…").
const MAKERS: [string, string][] = [
  ["good smile company", "Good Smile Company"], ["max factory", "Max Factory"], ["alter", "Alter"], ["kotobukiya", "Kotobukiya"],
  ["megahouse", "MegaHouse"], ["freeing", "FREEing"], ["wave", "Wave"], ["aniplex", "Aniplex"], ["kadokawa", "Kadokawa"],
  ["phat company", "Phat Company"], ["alphamax", "Alphamax"], ["bandai spirits", "Bandai Spirits"], ["bandai", "Bandai"],
  ["banpresto", "Banpresto"], ["sega", "SEGA"], ["taito", "Taito"], ["furyu", "FuRyu"], ["union creative", "Union Creative"],
  ["bell fine", "Bell Fine"], ["myethos", "Myethos"], ["ques q", "Ques Q"], ["hobby japan", "Hobby Japan"], ["amakuni", "AMAKUNI"],
  ["orchid seed", "Orchid Seed"], ["griffon", "Griffon Enterprises"], ["chara ani", "Chara-Ani"], ["broccoli", "Broccoli"],
  ["stronger", "Stronger"], ["emontoys", "Emontoys"], ["estream", "eStream"], ["prime 1 studio", "Prime 1 Studio"],
  ["square enix", "Square Enix"], ["medicom toy", "Medicom Toy"], ["sentinel", "Sentinel"], ["plum", "PLUM"], ["pulchra", "Pulchra"],
  ["aquamarine", "Aquamarine"], ["vertex", "Vertex"], ["hobby max", "Hobby Max"], ["apex", "APEX"], ["spiritale", "Spiritale"],
  ["design coco", "Design Coco"], ["bushiroad", "Bushiroad"], ["arcadia", "Arcadia"], ["yamato", "Yamato"], ["kaiyodo", "Kaiyodo"],
];

/** The maker a title leads with, if it's one the shelf knows. */
export function leadingMaker(title: string) {
  const text = normalize(title);
  return MAKERS.find(([words]) => text === words || text.startsWith(`${words} `))?.[1] ?? "";
}

/** Characters a shop's character tag names: either the tag holds the whole name or the name holds the tag ("Homura"). */
export function findTaggedCharacters(tags: string[], cast: Pick<CastMember, "key" | "names">[]) {
  const found = new Set<string>();
  for (const tag of tags.map(normalize).filter(Boolean)) {
    const tagWords = keyWords(tag);
    const distinctive = tag.split(" ").some((word) => word.length >= 4);
    for (const member of cast) {
      if (member.names.map(wholeName).some((name) => within(keyWords(name), tagWords) || (distinctive && within(tagWords, keyWords(name))))) found.add(member.key);
    }
  }
  return [...found];
}

const NOT_FIGURE = /\b(acrylic|rubber|key ?chains?|keyholder|strap|can badge|badges?|plush|plushie|plushies|mascot|cushion|tapestry|poster|stickers?|t shirt|towel|mug|model kits?|plastic (?:model|kit)|plamo|gunpla|garage kit|resin kit|soft vinyl kit|unpainted|display (?:stand|case)|stand only|replacement parts?|parts set|clear file|art ?book|blu ray|dvd|soundtrack|trading cards?|sleeves?|pillow|nendoroid more|nendoroid doll outfit|doll accessory|jigsaw|puzzle|costume|wig|clock|hygrometer|pouch|tote|coaster|tumbler|calendar|umbrella|music box|card game|pin badge|necklace|pendant)\b/;
// Build-it-yourself kits: Gunpla grades and the plastic-kit girl lines.
const KIT = /\b(hg|hguc|hgbd|hgce|hgbf|hgac|mg|mgex|mgsd|rg|pg|re 100|sdcs|bb senshi|entry grade|30ms|30mm|figure rise|megami device|frame arms|arcanadea|hexa gear|plamax|moderoid)\b/;
const PRIZE = /\b(prize|game prize|ichiban kuji|ichibansho|spm|luminasta|noodle stopper|bicute|coreful|trio try it|q posket|espresto|glitter glamours|relax time|desktop cute|aqua float girls|chokonose|exq|dxf|grandista|vibration stars|break time|kyunties|nendoroid petite|nendoroid swacchao|trading|blind box|huggy good smile|palverse|world collectable|wcf|artist masterpiece|muchutto|fuwa petit|hold figure|capsule|gashapon)\b/;
const COMPACT = /\b(pop up parade|tenitol|look up|figuarts mini|figuarts zero|melty princess|chibi|deformed|mini figure|hello good smile|harmonia humming)\b/;
const ARTICULATED = /\b(nendoroid|figma|cu poche|s h figuarts|buzzmod|revoltech|posable|action figure)\b/;
// Makers whose scale figures rate above the usual on MyFigureCollection, and the ones that rate below it.
const PREMIUM = /\b(alter|myethos|aniplex|estream|shibuya scramble|apex|arctech|max factory|good smile company|good smile arts|phat|spiritale|wonderful works|design coco|prime 1|amakuni|hobby japan|hobby max|ribose|reverse studio|native|alphamax|ques q|proof|mimeyoi|emontoys)\b/;
const BUDGET = /\b(bell fine|taito|sega|furyu|union creative|pulchra|plum|our treasure|elcoco|hobby stock|aoshima|banpresto|bandai spirits|system service|t most)\b/;
const PRIZE_MAKERS = /\b(banpresto|taito|sega|bandai spirits|furyu|system service)\b/;
const FINISHED_MECHA = /\b(chogokin|metal build|robot spirits|dx)\b/;
export const BUDGET_SCALE_ADJUSTMENT = -0.3;

/**
 * The shelf's figure classes. `kind` is a shop's own category (Solaris: Prize, Nendoroid…). Returns null
 * for merchandise that isn't a figure (acrylic stands, plushies, kits). `adj` moves the class's
 * usual rating for makers known to sit below it.
 */
export function classifyFigure(title: string, kind = "", maker = ""): { tier: Tier; line: string; adj: number } | null {
  const text = normalize(`${title} ${kind}`);
  if (NOT_FIGURE.test(text) || KIT.test(text)) return null;
  const scale = Number(title.match(/\b1\/([1-9]|1[0-2])\b/)?.[1] ?? 0);
  // 1/144, 1/100, 1/60 and the like are vehicles and mecha kits, not character figures.
  if (!scale && /\b1\/(?:1[3-9]|[2-9]\d|\d{3,})\b/.test(title) && !FINISHED_MECHA.test(text)) return null;
  const plain = (tier: Tier, line: string) => ({ tier, line, adj: 0 });
  if (/\bnendoroid\b/.test(text) && !PRIZE.test(text)) return plain("C", "Nendoroid");
  if (/\bfigma\b/.test(text)) return plain("C", "figma");
  if (PRIZE.test(text) || kind === "Prize" || kind === "Trading") return plain("E", kind === "Trading" || /trading|blind box|capsule|gashapon/.test(text) ? "Trading figure" : "Prize");
  if (COMPACT.test(text)) return plain("D", /pop up parade/.test(text) ? "Pop Up Parade" : "Non-scale");
  if (ARTICULATED.test(text) || kind === "Action" || kind === "Nendoroid" || kind === "Figma") return plain("C", "Articulated");
  const makerText = normalize(`${maker} ${title}`);
  if (scale) {
    if (PREMIUM.test(makerText)) return plain("A", `1/${scale} scale`);
    return { tier: "B", line: `1/${scale} scale`, adj: BUDGET.test(makerText) ? BUDGET_SCALE_ADJUSTMENT : 0 };
  }
  if (PRIZE_MAKERS.test(normalize(maker))) return plain("E", "Prize");
  return plain("D", "Non-scale");
}

const GENERIC = new Set([
  "figure", "figures", "complete", "completed", "scale", "pvc", "abs", "painted", "pre", "order", "preorder", "release", "rerelease",
  "reissue", "re", "resale", "rerun", "run", "2nd", "3rd", "ver", "version", "the", "of", "a", "an", "with", "tv", "anime", "animation",
  "movie", "gekijouban", "from", "series", "statue", "non", "size", "character", "no", "new", "sales", "bonus", "edition",
  // Brand lines one shop spells out and another leaves off.
  "kdcolle", "collection", "caworks", "ca", "works", "nex",
]);

/**
 * A key two listings of the same figure share whatever the shop: the listing's words without the
 * series title, the maker and filler, in any order and any romanization. Empty when too little is
 * left to be sure.
 */
export function identityKey(title: string, seriesTitles: string[], maker = "") {
  let text = ` ${normalize(title)} `;
  const rereleased = /\b(re ?release|reissue|resale|re ?run)\b/.test(text);
  for (const series of [...seriesTitles].sort((a, b) => b.length - a.length)) {
    if (text.includes(` ${series} `)) {
      text = text.replace(` ${series} `, " ");
      break;
    }
  }
  // Makers named inside the title ("(Chara-Ani, Good Smile Company)") go, like the listing's own.
  for (const [words] of MAKERS) if (text.includes(` ${words} `)) text = text.replace(` ${words} `, " ");
  const drop = new Set(normalize(maker).split(" "));
  const tokens = new Set<string>();
  for (const word of text.split(" ")) {
    if (!word || GENERIC.has(word) || drop.has(word)) continue;
    if (word.length === 1 && !/\d/.test(word)) continue;
    if (rereleased && /^20[12]\d$/.test(word)) continue;
    tokens.add(nameKey(word));
  }
  return tokens.size >= 2 ? [...tokens].sort().join(" ") : "";
}
