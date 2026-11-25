/** Pokémon cards whose artwork was printed only in Simplified Chinese: the Gem Pack line, the 151C Pikachu art rares and the China-only SARs. */

export type Rarity = "AR" | "IR" | "SAR" | "SIR";
export type Line = "Gem Packs" | "151" | "Main sets";

export type CnSet = { name: string; code: string; line: Line; date: string };

export const SETS = {
  c151j: { name: "151 Journey", code: "151C", line: "151", date: "17 Oct 2025" },
  c151h: { name: "151 Hope", code: "151C", line: "151", date: "17 Oct 2025" },
  c151s: { name: "151 Surprise", code: "151C", line: "151", date: "17 Oct 2025" },
  c151g: { name: "151 Gathering", code: "151C", line: "151", date: "17 Oct 2025" },
  g1: { name: "Gem Pack Vol. 1", code: "CBB1C", line: "Gem Packs", date: "17 Jan 2025" },
  g2: { name: "Gem Pack Vol. 2", code: "CBB2C", line: "Gem Packs", date: "16 May 2025" },
  g3: { name: "Gem Pack Vol. 3", code: "CBB3C", line: "Gem Packs", date: "26 Sep 2025" },
  g4: { name: "Gem Pack Vol. 4", code: "CBB4C", line: "Gem Packs", date: "6 Feb 2026" },
  g5: { name: "Gem Pack Vol. 5", code: "CBB5C", line: "Gem Packs", date: "24 Apr 2026" },
  g6: { name: "Gem Pack Vol. 6", code: "CBB6C", line: "Gem Packs", date: "7 Aug 2026" },
  g7: { name: "Gem Pack Vol. 7", code: "CBB7C", line: "Gem Packs", date: "Nov 2026" },
  csv3: { name: "Fearless Terastal", code: "CSV3C", line: "Main sets", date: "16 May 2025" },
  csv4: { name: "Bonus Round", code: "CSV4C", line: "Main sets", date: "18 Jul 2025" },
  csv5: { name: "Dark Crystal Blaze", code: "CSV5C", line: "Main sets", date: "12 Sep 2025" },
  csv6: { name: "True Mystery", code: "CSV6C", line: "Main sets", date: "7 Nov 2025" },
  csv7: { name: "Blade Awakening", code: "CSV7C", line: "Main sets", date: "16 Jan 2026" },
  csv8: { name: "Brilliant Illusions", code: "CSV8C", line: "Main sets", date: "13 Mar 2026" },
  csv9: { name: "Stellar Crystal", code: "CSV9C", line: "Main sets", date: "15 May 2026" },
  csv95: { name: "Terastal Gathering", code: "CSV9.5C", line: "Main sets", date: "12 Jun 2026" },
  csv10: { name: "Together in Pursuit of Glory", code: "CSV10C", line: "Main sets", date: "16 Jul 2026" },
  csv105: { name: "Black Bolt", code: "CSV10.5C", line: "Main sets", date: "6 Nov 2026" },
  csv106: { name: "White Flare", code: "CSV10.6C", line: "Main sets", date: "6 Nov 2026" },
} satisfies Record<string, CnSet>;

export type SetKey = keyof typeof SETS;

export type CnCard = {
  id: string;
  name: string;
  no: string;
  rarity: Rarity;
  set: SetKey;
  artist: string;
  /** Path under /pokemon-cn-binder/cards/ (webp). */
  img: string;
  /** PriceCharting product path, after /game/. */
  pc: string;
  /** Words an eBay listing title has to contain (any one of each group). */
  must: string[][];
  /** eBay keyword search. */
  q: string;
  note?: string;
  /** Researched by hand on 25 Nov 2026, shown until live prices load. */
  seed?: { price: string; basis: string };
};

// Variants of a Gem Pack card share its name, so their finish words rule a listing out.
const GEM_VARIANTS = ["poke ball", "pokeball", "master ball", "masterball", "stars", "rotary", "stamped", "reverse"];

const gem = (vol: number) => [`gem pack ${vol}`, `gem pack vol ${vol}`, `gem pack volume ${vol}`, `cbb${vol}`, `cbb${vol}c`, `vol ${vol}`, `volume ${vol}`];

export const CARDS: CnCard[] = [
  { id: "151c-170", name: "Pikachu", no: "170/151", rarity: "AR", set: "c151j", artist: "Oswaldo KATO", img: "151c-pikachu-170-151", pc: "pokemon-chinese-151-collect/pikachu-170", must: [["pikachu"], ["170"]], q: "chinese 151 pikachu 170", seed: { price: "$1,156", basis: "dealer" } },
  { id: "151c-171", name: "Pikachu", no: "171/151", rarity: "AR", set: "c151h", artist: "Oswaldo KATO", img: "151c-pikachu-171-151", pc: "pokemon-chinese-151-collect/pikachu-171", must: [["pikachu"], ["171"]], q: "chinese 151 pikachu 171", seed: { price: "$491–1,017", basis: "raw range" } },
  { id: "151c-172", name: "Pikachu", no: "172/151", rarity: "AR", set: "c151s", artist: "Oswaldo KATO", img: "151c-pikachu-172-151", pc: "pokemon-chinese-151-collect/pikachu-172", must: [["pikachu"], ["172"]], q: "chinese 151 pikachu 172", note: "The Gengar-behind-Pikachu art, the most valuable of the four.", seed: { price: "$2,500", basis: "PSA 10 ask" } },
  { id: "151c-173", name: "Pikachu", no: "173/151", rarity: "AR", set: "c151g", artist: "Oswaldo KATO", img: "151c-pikachu-173-151", pc: "pokemon-chinese-151-collect/pikachu-173", must: [["pikachu"], ["173"]], q: "chinese 151 pikachu 173", seed: { price: "$650", basis: "raw ask" } },

  { id: "cbb1c-109", name: "Sprigatito", no: "109/09", rarity: "IR", set: "g1", artist: "Yasuda Shuhei", img: "cbb1c-sprigatito-109-09", pc: "pokemon-chinese-gem-pack/sprigatito-horizons-full-art-109", must: [["sprigatito"], ["109", "0109", "horizons"], gem(1)], q: "chinese gem pack sprigatito" },
  { id: "cbb1c-309", name: "Fuecoco", no: "309/09", rarity: "IR", set: "g1", artist: "Ito Kyoko", img: "cbb1c-fuecoco-309-09", pc: "pokemon-chinese-gem-pack/fuecoco-horizons-full-art-309", must: [["fuecoco"], ["309", "0309", "horizons"], gem(1)], q: "chinese gem pack fuecoco" },
  { id: "cbb1c-509", name: "Quaxly", no: "509/09", rarity: "IR", set: "g1", artist: "Yamazaki Rei", img: "cbb1c-quaxly-509-09", pc: "pokemon-chinese-gem-pack/quaxly-horizons-full-art-509", must: [["quaxly"], ["509", "0509", "horizons"], gem(1)], q: "chinese gem pack quaxly" },
  { id: "cbb1c-709", name: "Captain Pikachu", no: "709/09", rarity: "IR", set: "g1", artist: "Yamazaki Rei", img: "cbb1c-pikachu-709-09", pc: "pokemon-chinese-gem-pack/captain-pikachu-709", must: [["pikachu"], ["709", "0709"], gem(1)], q: "chinese gem pack captain pikachu 709", note: "Vol. 1 also printed this art in several holo and stamped versions (701–707/09)." },

  { id: "cbb2c-115", name: "Eevee", no: "115/15", rarity: "IR", set: "g2", artist: "HYOGONOSUKE", img: "cbb2c-eevee-115-15", pc: "pokemon-chinese-gem-pack-2/eevee-115", must: [["eevee"], ["115", "0115", "art rare", " ar ", "exclusive"], gem(2)], q: "chinese gem pack 2 eevee", note: "The four Vol. 2 cards join into one forest panorama when placed side by side.", seed: { price: "$257", basis: "PSA 10" } },
  { id: "cbb2c-615", name: "Umbreon", no: "615/15", rarity: "IR", set: "g2", artist: "HYOGONOSUKE", img: "cbb2c-umbreon-615-15", pc: "pokemon-chinese-gem-pack-2/umbreon-615", must: [["umbreon"], ["615", "0615", "art rare", " ar ", "exclusive"], gem(2)], q: "chinese gem pack 2 umbreon", seed: { price: "$806", basis: "PSA 10" } },
  { id: "cbb2c-715", name: "Leafeon", no: "715/15", rarity: "IR", set: "g2", artist: "HYOGONOSUKE", img: "cbb2c-leafeon-715-15", pc: "pokemon-chinese-gem-pack-2/leafeon-715", must: [["leafeon"], ["715", "0715", "art rare", " ar ", "exclusive"], gem(2)], q: "chinese gem pack 2 leafeon", seed: { price: "$206", basis: "PSA 10" } },
  { id: "cbb2c-915", name: "Sylveon", no: "915/15", rarity: "IR", set: "g2", artist: "HYOGONOSUKE", img: "cbb2c-sylveon-915-15", pc: "pokemon-chinese-gem-pack-2/sylveon-915", must: [["sylveon"], ["915", "0915", "art rare", " ar ", "exclusive"], gem(2)], q: "chinese gem pack 2 sylveon", seed: { price: "$330", basis: "PSA 10" } },

  { id: "cbb3c-207", name: "Meowth", no: "207/07", rarity: "IR", set: "g3", artist: "Makura Tami", img: "cbb3c-meowth-207-07", pc: "pokemon-chinese-gem-pack-3/meowth-207", must: [["meowth"], ["207", "0207", "art rare", "illustration", " ar ", " ir ", "exclusive"], gem(3)], q: "chinese gem pack 3 meowth", seed: { price: "$232.50", basis: "PSA 10 sold" } },
  { id: "cbb3c-307", name: "Gengar", no: "307/07", rarity: "IR", set: "g3", artist: "aspara", img: "cbb3c-gengar-307-07", pc: "pokemon-chinese-gem-pack-3/gengar-307", must: [["gengar"], ["307", "0307", "art rare", "illustration", " ar ", " ir ", "exclusive"], gem(3)], q: "chinese gem pack 3 gengar", seed: { price: "$160", basis: "raw ask" } },
  { id: "cbb3c-407", name: "Cubone", no: "407/07", rarity: "IR", set: "g3", artist: "Taira Akitsu", img: "cbb3c-cubone-407-07", pc: "pokemon-chinese-gem-pack-3/cubone-407", must: [["cubone"], ["407", "0407", "art rare", "illustration", " ar ", " ir ", "exclusive"], gem(3)], q: "chinese gem pack 3 cubone" },
  { id: "cbb3c-1107", name: "Chandelure", no: "1107/07", rarity: "IR", set: "g3", artist: "satoma", img: "cbb3c-chandelure-1107-07", pc: "pokemon-chinese-gem-pack-3/chandelure-1107", must: [["chandelure"], ["1107", "art rare", "illustration", " ar ", " ir ", "exclusive"], gem(3)], q: "chinese gem pack 3 chandelure" },
  { id: "cbb3c-1507", name: "Ceruledge", no: "1507/07", rarity: "IR", set: "g3", artist: "kodama", img: "cbb3c-ceruledge-1507-07", pc: "pokemon-chinese-gem-pack-3/ceruledge-1507", must: [["ceruledge"], ["1507", "art rare", "illustration", " ar ", " ir ", "exclusive"], gem(3)], q: "chinese gem pack 3 ceruledge" },

  { id: "cbb4c-107", name: "Ponyta", no: "107/07", rarity: "IR", set: "g4", artist: "MINAMINAMI Take", img: "cbb4c-ponyta-107-07", pc: "pokemon-chinese-gem-pack-4/ponyta-107", must: [["ponyta"], ["107", "0107", "art rare", "illustration", " ar ", " ir ", "exclusive"], gem(4)], q: "chinese gem pack 4 ponyta", note: "The first Ponyta Illustration Rare ever printed." },

  { id: "cbb5c-107", name: "Captain Pikachu", no: "107/07", rarity: "IR", set: "g5", artist: "Keita Hagiwara", img: "cbb5c-pikachu-107-07", pc: "pokemon-chinese-gem-pack-5/captain-pikachu-107", must: [["pikachu"], ["107", "0107", "art rare", "illustration", " ar ", " ir ", "exclusive"], gem(5)], q: "chinese gem pack 5 captain pikachu", note: "Vol. 5 also printed this art in several holo and stamped versions (101–106/07).", seed: { price: "$342", basis: "raw" } },
  { id: "cbb5c-2207", name: "Floragato", no: "2207/07", rarity: "IR", set: "g5", artist: "Lyu Yifei", img: "cbb5c-floragato-2207-07", pc: "pokemon-chinese-gem-pack-5/floragato-2207", must: [["floragato"], ["2207", "art rare", "illustration", " ar ", " ir ", "exclusive"], gem(5)], q: "chinese gem pack 5 floragato", note: "Continues the Vol. 1 Sprigatito art." },
  { id: "cbb5c-2307", name: "Crocalor", no: "2307/07", rarity: "IR", set: "g5", artist: "Kouki Yanagihara", img: "cbb5c-crocalor-2307-07", pc: "pokemon-chinese-gem-pack-5/crocalor-2307", must: [["crocalor"], ["2307", "art rare", "illustration", " ar ", " ir ", "exclusive"], gem(5)], q: "chinese gem pack 5 crocalor", note: "Continues the Vol. 1 Fuecoco art." },
  { id: "cbb5c-2407", name: "Quaxwell", no: "2407/07", rarity: "IR", set: "g5", artist: "Rei Yamazaki", img: "cbb5c-quaxwell-2407-07", pc: "pokemon-chinese-gem-pack-5/quaxwell-2407", must: [["quaxwell"], ["2407", "art rare", "illustration", " ar ", " ir ", "exclusive"], gem(5)], q: "chinese gem pack 5 quaxwell", note: "Continues the Vol. 1 Quaxly art." },

  { id: "cbb6c-1907", name: "Applin", no: "1907/07", rarity: "IR", set: "g6", artist: "Jiro Sasumo", img: "cbb6c-applin-1907-07", pc: "pokemon-chinese-gem-pack-6/applin-1907", must: [["applin"], ["1907", "art rare", "illustration", " ar ", " ir ", "exclusive"], gem(6)], q: "chinese gem pack 6 applin", note: "Poké Exclusives lists this art as China-only; one set list matches it to English Destined Rivals 16 instead." },
  { id: "cbb7c-307", name: "Misty's Psyduck", no: "0307/07", rarity: "IR", set: "g7", artist: "Cona Nitanda", img: "cbb7c-mistys-psyduck-0307-07", pc: "pokemon-chinese-gem-pack-7/misty%27s-psyduck-307", must: [["psyduck"], ["307", "0307", "art rare", "illustration", " ar ", " ir ", "exclusive"], gem(7)], q: "chinese gem pack 7 misty psyduck", note: "Vol. 7's headline card." },

  { id: "csv3c-155", name: "Arcanine ex", no: "155/130", rarity: "SAR", set: "csv3", artist: "Gemi", img: "csv3c-arcanine-155-130", pc: "pokemon-chinese-csv3c/arcanine-ex-155", must: [["arcanine"], ["155"]], q: "chinese arcanine ex 155", seed: { price: "$382", basis: "raw" } },
  { id: "csv4c-158", name: "Maushold ex", no: "158/129", rarity: "SAR", set: "csv4", artist: "Yoshimi Miyoshi", img: "csv4c-maushold-ex-158-129", pc: "pokemon-chinese-csv4c/maushold-ex-158", must: [["maushold"], ["158"]], q: "chinese maushold ex 158", seed: { price: "$738", basis: "PSA 10 ask" } },
  { id: "csv4c-159", name: "Rika", no: "159/129", rarity: "SAR", set: "csv4", artist: "kantaro", img: "csv4c-rika-159-129", pc: "pokemon-chinese-csv4c/rika-159", must: [["rika"], ["159"]], q: "chinese rika 159", seed: { price: "$35", basis: "raw sold" } },
  { id: "csv5c-157", name: "Larry", no: "157/129", rarity: "SAR", set: "csv5", artist: "Kariya", img: "csv5c-larry-157-129", pc: "pokemon-chinese-csv5c/larry-157", must: [["larry"], ["157"]], q: "chinese larry 157" },
  { id: "csv6c-152", name: "Iron Hands ex", no: "152/128", rarity: "SAR", set: "csv6", artist: "Tonji Matsuno", img: "csv6c-iron-hands-152-128", pc: "pokemon-chinese-csv6c/iron-hands-ex-152", must: [["iron hands"], ["152"]], q: "chinese iron hands ex 152", seed: { price: "$48", basis: "raw sold" } },
  { id: "csv7c-245", name: "Ciphermaniac's Codebreaking", no: "245/204", rarity: "SAR", set: "csv7", artist: "Taira Akitsu", img: "csv7c-ciphermaniacs-codebreaking-245-204", pc: "pokemon-chinese-csv7c/ciphermaniac%27s-codebreaking-245", must: [["ciphermaniac"], ["245"]], q: "chinese ciphermaniac 245" },
  { id: "csv8c-255", name: "Carmine", no: "255/207", rarity: "SAR", set: "csv8", artist: "OKACHEKE", img: "csv8c-carmine-255-207", pc: "pokemon-chinese-csv8c/carmine-255", must: [["carmine"], ["255"]], q: "chinese carmine 255" },
  { id: "csv9c-257", name: "Lisia's Appeal", no: "257/208", rarity: "SAR", set: "csv9", artist: "En Morikura", img: "csv9c-lisias-appeal-257-208", pc: "pokemon-chinese-csv9c/lisia%27s-appeal-257", must: [["lisia"], ["257"]], q: "chinese lisia 257" },
  { id: "csv95c-234", name: "Sylveon ex", no: "234/208", rarity: "SAR", set: "csv95", artist: "rika", img: "csv95c-sylveon-ex-234-208", pc: "pokemon-chinese-csv95c/sylveon-ex-234", must: [["sylveon"], ["234"]], q: "chinese sylveon ex 234", note: "This art differs from the English Prismatic Evolutions SIR. Don't confuse it with 233/208." },
  { id: "csv10c-276", name: "Brock's Scouting", no: "276/222", rarity: "SAR", set: "csv10", artist: "Atsushi Furusawa", img: "csv10c-brocks-scouting-276-222", pc: "pokemon-chinese-csv10c/brock%27s-scouting-276", must: [["brock"], ["276"]], q: "chinese brock's scouting 276" },
  { id: "csv105c-173", name: "N's Plan", no: "173/086", rarity: "SIR", set: "csv105", artist: "Iwamoto05", img: "csv105c-ns-plan-173-086", pc: "pokemon-chinese-csv105c/n%27s-plan-173", must: [["plan"], ["173"]], q: "chinese n's plan 173", note: "Released 6 Nov 2026." },
  { id: "csv106c-173", name: "Hilda", no: "173/086", rarity: "SIR", set: "csv106", artist: "Ligton", img: "csv106c-hilda-173-086", pc: "pokemon-chinese-csv106c/hilda-173", must: [["hilda"], ["173"]], q: "chinese hilda 173", note: "Released 6 Nov 2026." },
];

/** Gem Pack variant finishes that rule a listing out for these cards. */
export function excludedWords(card: CnCard): string[] {
  return SETS[card.set].line === "Gem Packs" ? GEM_VARIANTS : [];
}

export const cardById = new Map(CARDS.map((card) => [card.id, card]));
