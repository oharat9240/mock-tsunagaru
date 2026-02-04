import { pgTable, uuid, text, timestamp, integer, boolean, jsonb, pgEnum } from "drizzle-orm/pg-core";

// Enums
export const contentTypeEnum = pgEnum("content_type", ["video", "image", "text", "youtube", "url", "weather", "csv"]);
export const orientationEnum = pgEnum("orientation", ["landscape", "portrait"]);
export const eventTypeEnum = pgEnum("event_type", ["playlist", "power_off", "power_on"]);
export const weekdayEnum = pgEnum("weekday", [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

// Contents table
export const contents = pgTable("contents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: contentTypeEnum("type").notNull(),
  tags: text("tags").array().default([]),

  // File info (for video, image, text file types)
  fileOriginalName: text("file_original_name"),
  fileSize: integer("file_size"),
  fileMimeType: text("file_mime_type"),
  fileStoragePath: text("file_storage_path"),
  fileThumbnailPath: text("file_thumbnail_path"),
  fileMetadata: jsonb("file_metadata"), // { width, height, duration }

  // URL info (for youtube, url types)
  urlInfo: jsonb("url_info"), // { url, title, description }

  // Text info (for text type)
  textInfo: jsonb("text_info"), // { content, writingMode, fontFamily, textAlign, color, backgroundColor, fontSize, scrollType, scrollSpeed }

  // Weather info (for weather type)
  weatherInfo: jsonb("weather_info"), // { locationCode, weatherType, apiUrl }

  // CSV info (for csv type)
  csvInfo: jsonb("csv_info"), // { originalCsvData, selectedRows, selectedColumns, layout, style, backgroundPath, format, renderedImagePath, apiUrl }

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Layouts table
export const layouts = pgTable("layouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  orientation: orientationEnum("orientation").notNull(),
  regions: jsonb("regions").notNull().default([]), // Array of { id, name, x, y, width, height, zIndex }

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Playlists table
export const playlists = pgTable("playlists", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  layoutId: uuid("layout_id").references(() => layouts.id),
  device: text("device"),
  contentAssignments: jsonb("content_assignments").notNull().default([]), // Array of { regionId, contentIds, durations }

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Schedules table
export const schedules = pgTable("schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  time: text("time").notNull(), // HH:MM format
  weekdays: weekdayEnum("weekdays").array().notNull(),
  eventType: eventTypeEnum("event_type").notNull(),
  playlistId: uuid("playlist_id").references(() => playlists.id),
  enabled: boolean("enabled").default(true).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Type exports
export type Content = typeof contents.$inferSelect;
export type NewContent = typeof contents.$inferInsert;
export type Layout = typeof layouts.$inferSelect;
export type NewLayout = typeof layouts.$inferInsert;
export type Playlist = typeof playlists.$inferSelect;
export type NewPlaylist = typeof playlists.$inferInsert;
export type Schedule = typeof schedules.$inferSelect;
export type NewSchedule = typeof schedules.$inferInsert;
