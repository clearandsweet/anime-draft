/**
 * A franchise is every entry that shares the same characters: seasons, films and remakes join;
 * a spin-off with a new cast, or each Precure series, stands alone.
 */
export type FranchiseMedia = {
  id: number;
  relations: { type: string; id: number }[];
  /** AniList character ids with the MAIN role. */
  cast: number[];
};

export type FranchiseGroup = {
  ids: number[];
  cast: number[];
  /** A crossover (Precure All Stars) whose cast spans several franchises; never merged. */
  crossover: boolean;
};

// The same story continuing: these join whenever the casts largely overlap.
const CONTINUATION = new Set(["SEQUEL", "PREQUEL", "PARENT", "SIDE_STORY", "SUMMARY", "COMPILATION", "CONTAINS"]);
// Remakes, spin-offs and shared-character links (how AniList ties each Precure series and every
// All Stars movie together) only join a nearly identical cast. OTHER, SOURCE and ADAPTATION never join.
const LOOSE = new Set(["ALTERNATIVE", "SPIN_OFF", "CHARACTER"]);

function shared(a: Iterable<number>, b: Iterable<number>) {
  const set = new Set(a);
  let count = 0;
  for (const id of new Set(b)) if (set.has(id)) count++;
  return count;
}

/** Shared characters over all characters in either cast. */
export function castSimilarity(a: number[], b: number[]) {
  const all = new Set([...a, ...b]).size;
  return all ? shared(a, b) / all : 0;
}

export function groupFranchises(media: FranchiseMedia[]): FranchiseGroup[] {
  const byId = new Map(media.map((entry) => [entry.id, entry]));
  const related = (a: FranchiseMedia, b: FranchiseMedia, types: Set<string>) =>
    a.relations.some((r) => r.id === b.id && types.has(r.type)) ||
    b.relations.some((r) => r.id === a.id && types.has(r.type));

  const parent = new Map(media.map((entry) => [entry.id, entry.id]));
  const find = (id: number): number => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };
  const membersOf = (id: number) => media.filter((entry) => find(entry.id) === find(id)).map((entry) => entry.id);
  const castOf = (ids: number[]) => [...new Set(ids.flatMap((id) => byId.get(id)!.cast))];
  // Joining through a and b is refused when the rest of either group shares nobody with the
  // other group: an entry starring two casts at once can't chain them together.
  const union = (a: number, b: number) => {
    if (find(a) === find(b)) return;
    const [left, right] = [membersOf(a), membersOf(b)];
    const [castLeft, castRight] = [castOf(left), castOf(right)];
    const restLeft = castOf(left.filter((id) => id !== a));
    const restRight = castOf(right.filter((id) => id !== b));
    if (restLeft.length && castRight.length && !shared(restLeft, castRight)) return;
    if (restRight.length && castLeft.length && !shared(restRight, castLeft)) return;
    const [ra, rb] = [find(a), find(b)];
    parent.set(Math.max(ra, rb), Math.min(ra, rb));
  };
  const groups = () => {
    const out = new Map<number, number[]>();
    for (const entry of media) out.set(find(entry.id), [...(out.get(find(entry.id)) ?? []), entry.id]);
    return out;
  };

  const position = new Map(media.map((entry, i) => [entry.id, i]));
  // Entries that share a character, and entries one continues: the only pairs worth comparing
  // on a list of hundreds.
  const starring = new Map<number, number[]>();
  media.forEach((entry, i) => {
    for (const character of new Set(entry.cast)) {
      const list = starring.get(character);
      if (list) list.push(i);
      else starring.set(character, [i]);
    }
  });
  const continues = new Map<number, Set<number>>();
  const link = (a: number, b: number) => continues.set(a, (continues.get(a) ?? new Set()).add(b));
  for (const entry of media) {
    for (const relation of entry.relations) {
      if (!CONTINUATION.has(relation.type) || !byId.has(relation.id) || relation.id === entry.id) continue;
      link(entry.id, relation.id);
      link(relation.id, entry.id);
    }
  }

  // Pass 1: pairs whose whole casts match, closest first. Unrelated entries (S1 and S3 with
  // no S2 on the list) only join when the casts are all but the same.
  const pairs: [number, number, number][] = [];
  for (let i = 0; i < media.length; i++) {
    const a = media[i];
    const later = new Set<number>();
    for (const character of a.cast) for (const j of starring.get(character) ?? []) if (j > i) later.add(j);
    for (const j of [...later].sort((x, y) => x - y)) {
      const b = media[j];
      const similarity = castSimilarity(a.cast, b.cast);
      if (
        (related(a, b, CONTINUATION) && similarity >= 0.3) ||
        (related(a, b, LOOSE) && similarity >= 0.65) ||
        (shared(a.cast, b.cast) >= 2 && similarity >= 0.75)
      ) {
        pairs.push([a.id, b.id, similarity]);
      }
    }
  }
  for (const [a, b] of pairs.sort((x, y) => y[2] - x[2])) union(a, b);

  // Pass 2: a smaller group (a one-character special, a film starring two of the cast) joins
  // the larger group it continues when that group holds most of its characters.
  const ordered = [...groups().values()].sort((a, b) => castOf(a).length - castOf(b).length);
  for (const [first] of ordered) {
    const ids = membersOf(first);
    const cast = castOf(ids);
    const roots = new Set<number>();
    for (const id of ids) for (const other of continues.get(id) ?? []) if (find(other) !== find(first)) roots.add(find(other));
    const candidates = [...roots]
      .map((root) => membersOf(root))
      .sort((a, b) => position.get(a[0])! - position.get(b[0])!)
      .filter((other) => castOf(other).length >= cast.length)
      .map((other) => ({ other, overlap: shared(cast, castOf(other)) }));
    const best = cast.length
      ? candidates.filter((c) => c.overlap / cast.length >= 0.5).sort((a, b) => b.overlap - a.overlap)[0]
      : candidates.length === 1 ? candidates[0] : undefined;
    if (best) {
      const bridge = ids.flatMap((id) => best.other.filter((o) => related(byId.get(id)!, byId.get(o)!, CONTINUATION)).map((o) => [id, o]))[0];
      union(bridge[0], bridge[1]);
    }
  }

  const final = [...groups().values()].map((ids) => ({ ids, cast: castOf(ids) }));
  const groupsWith = new Map<number, number[]>();
  final.forEach((group, i) => {
    for (const character of group.cast) {
      const list = groupsWith.get(character);
      if (list) list.push(i);
      else groupsWith.set(character, [i]);
    }
  });
  return final.map(({ ids, cast }, i) => {
    // A lone entry whose cast reaches into two franchises that share nobody.
    let crossover = false;
    if (ids.length === 1 && cast.length >= 2) {
      const touching = [...new Set(cast.flatMap((character) => groupsWith.get(character) ?? []))].filter((j) => j !== i).map((j) => final[j].cast);
      crossover = touching.some((x, at) => touching.slice(at + 1).some((y) => shared(x, y) === 0));
    }
    return { ids: ids.sort((a, b) => a - b), cast, crossover };
  });
}
