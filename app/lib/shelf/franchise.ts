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

  // Pass 1: pairs whose whole casts match, closest first. Unrelated entries (S1 and S3 with
  // no S2 on the list) only join when the casts are all but the same.
  const pairs: [number, number, number][] = [];
  for (let i = 0; i < media.length; i++) {
    for (let j = i + 1; j < media.length; j++) {
      const [a, b] = [media[i], media[j]];
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
    const candidates = [...groups().values()]
      .filter((other) => find(other[0]) !== find(first) && castOf(other).length >= cast.length)
      .filter((other) => ids.some((id) => other.some((o) => related(byId.get(id)!, byId.get(o)!, CONTINUATION))))
      .map((other) => ({ other, overlap: shared(cast, castOf(other)) }));
    const best = cast.length
      ? candidates.filter((c) => c.overlap / cast.length >= 0.5).sort((a, b) => b.overlap - a.overlap)[0]
      : candidates.length === 1 ? candidates[0] : undefined;
    if (best) {
      const bridge = ids.flatMap((id) => best.other.filter((o) => related(byId.get(id)!, byId.get(o)!, CONTINUATION)).map((o) => [id, o]))[0];
      union(bridge[0], bridge[1]);
    }
  }

  const final = [...groups().values()];
  return final.map((ids) => {
    const cast = castOf(ids);
    // A lone entry whose cast reaches into two franchises that share nobody.
    const touching = final.filter((other) => other !== ids && shared(cast, castOf(other)) > 0);
    const crossover = ids.length === 1 && cast.length >= 2 &&
      touching.some((x, i) => touching.slice(i + 1).some((y) => shared(castOf(x), castOf(y)) === 0));
    return { ids: ids.sort((a, b) => a - b), cast, crossover };
  });
}
