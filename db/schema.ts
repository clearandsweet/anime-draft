import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const lobbies = sqliteTable(
  "lobbies",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    stateJson: text("state_json").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    hostName: text("host_name"),
    status: text("status", { enum: ["active", "completed"] })
      .notNull()
      .default("active"),
    playersCount: integer("players_count").notNull().default(0),
    lastPickAt: text("last_pick_at"),
    manageKeyHash: text("manage_key_hash"),
    draftType: text("draft_type", { enum: ["anime", "pokemon"] })
      .notNull()
      .default("anime"),
    version: integer("version").notNull().default(0),
  },
  (table) => [
    index("lobbies_updated_at_idx").on(table.updatedAt),
    index("lobbies_status_type_idx").on(table.status, table.draftType),
  ]
);

export const votes = sqliteTable(
  "votes",
  {
    id: text("id").primaryKey(),
    lobbyId: integer("lobby_id")
      .notNull()
      .references(() => lobbies.id, { onDelete: "cascade" }),
    ipHash: text("ip_hash").notNull(),
    first: text("first"),
    second: text("second"),
    third: text("third"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("votes_lobby_ip_idx").on(table.lobbyId, table.ipHash),
    index("votes_lobby_created_idx").on(table.lobbyId, table.createdAt),
  ]
);

export const broadcasts = sqliteTable(
  "broadcasts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    lobbyId: integer("lobby_id")
      .notNull()
      .references(() => lobbies.id, { onDelete: "cascade" }),
    competition: text("competition").notNull(),
    draftType: text("draft_type", { enum: ["anime", "pokemon"] }).notNull(),
    resultText: text("result_text").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("broadcasts_lobby_competition_idx").on(
      table.lobbyId,
      table.competition
    ),
    index("broadcasts_lobby_created_idx").on(table.lobbyId, table.createdAt),
  ]
);

export const blindRankingRooms = sqliteTable(
  "blind_ranking_rooms",
  {
    code: text("code").primaryKey(),
    stateJson: text("state_json").notNull(),
    status: text("status", { enum: ["lobby", "playing", "complete"] })
      .notNull()
      .default("lobby"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    version: integer("version").notNull().default(0),
  },
  (table) => [index("blind_ranking_rooms_updated_at_idx").on(table.updatedAt)]
);

export const customRankings = sqliteTable(
  "custom_rankings",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    stateJson: text("state_json").notNull(),
    searchText: text("search_text").notNull(),
    manageKeyHash: text("manage_key_hash").notNull(),
    playsCount: integer("plays_count").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("custom_rankings_slug_idx").on(table.slug),
    index("custom_rankings_created_at_idx").on(table.createdAt),
  ]
);
