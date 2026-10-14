import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const rsvps = sqliteTable("rsvps", {
  id: text("id").primaryKey(),
  accessTokenHash: text("access_token_hash").notNull(),
  fullName: text("full_name").notNull(),
  attendance: text("attendance").notNull(),
  guests: integer("guests").notNull(),
  companionNames: text("companion_names").notNull(),
  menu: text("menu").notNull(),
  drinks: text("drinks").notNull(),
  notes: text("notes").notNull(),
  consentAt: text("consent_at").notNull(),
  createdAt: text("created_at").notNull(),
});
