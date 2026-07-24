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
