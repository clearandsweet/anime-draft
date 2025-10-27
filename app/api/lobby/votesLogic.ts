import { randomUUID } from "crypto";

export type VoteRecord = {
  id: string;
  ipHash: string;
  first: string;
  second: string;
  third: string;
  createdAt: string;
};

export type VotesState = {
  records: VoteRecord[];
};

export type VoteTotals = Record<
  string,
  { first: number; second: number; third: number; points: number }
>;

export function normalizeVotesState(data?: Partial<VotesState> | null): VotesState {
  if (!data || !Array.isArray(data.records)) {
    return { records: [] };
  }
  return {
    records: data.records
      .filter(
        (entry): entry is VoteRecord =>
          !!entry &&
          typeof entry.ipHash === "string" &&
          typeof entry.first === "string" &&
          typeof entry.second === "string" &&
          typeof entry.third === "string"
      )
      .map((entry) => ({
        ...entry,
        id: entry.id || randomUUID(),
        createdAt: entry.createdAt || new Date().toISOString(),
      })),
  };
}

export function tallyVotes(
  records: VoteRecord[],
  playerIds: string[]
): { totals: VoteTotals; ballots: number } {
  const totals: VoteTotals = {};
  for (const id of playerIds) {
    totals[id] = { first: 0, second: 0, third: 0, points: 0 };
  }

  for (const record of records) {
    const award = (id: string, place: keyof VoteTotals[string], points: number) => {
      if (!totals[id]) {
        totals[id] = { first: 0, second: 0, third: 0, points: 0 };
      }
      totals[id][place] += 1;
      totals[id].points += points;
    };
    if (record.first) award(record.first, "first", 3);
    if (record.second) award(record.second, "second", 2);
    if (record.third) award(record.third, "third", 1);
  }

  return { totals, ballots: records.length };
}
import { randomUUID } from "crypto";


