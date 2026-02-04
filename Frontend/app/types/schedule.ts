import { z } from "zod";

// イベントタイプ
export const EventTypeSchema = z.enum(["playlist", "power_on", "power_off", "reboot"]);

// スケジュールイベント
export const ScheduleEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("playlist"),
    playlistId: z.string().min(1, "プレイリストIDは必須です"),
  }),
  z.object({
    type: z.literal("power_on"),
  }),
  z.object({
    type: z.literal("power_off"),
  }),
  z.object({
    type: z.literal("reboot"),
  }),
]);

// 曜日
export const WeekdaySchema = z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);

// スケジュールアイテム（詳細情報）
export const ScheduleItemSchema = z.object({
  id: z.string().min(1, "IDは必須です"),
  name: z.string().min(1, "名前は必須です"),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "時刻は HH:MM 形式で入力してください"),
  weekdays: z.array(WeekdaySchema).min(1, "少なくとも1つの曜日を選択してください"),
  event: ScheduleEventSchema,
  enabled: z.boolean().default(true),
  createdAt: z.string().datetime("無効な作成日時です"),
  updatedAt: z.string().datetime("無効な更新日時です").optional(),
});

// スケジュールインデックス（一覧表示用）
export const ScheduleIndexSchema = z.object({
  id: z.string(),
  name: z.string(),
  time: z.string(),
  weekdays: z.array(WeekdaySchema),
  eventType: EventTypeSchema,
  playlistId: z.string().optional(), // プレイリストイベントの場合のプレイリストID
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

export const SchedulesIndexSchema = z.array(ScheduleIndexSchema);

// 型エクスポート
export type EventType = z.infer<typeof EventTypeSchema>;
export type Weekday = z.infer<typeof WeekdaySchema>;
export type ScheduleEvent = z.infer<typeof ScheduleEventSchema>;
export type ScheduleItem = z.infer<typeof ScheduleItemSchema>;
export type ScheduleIndex = z.infer<typeof ScheduleIndexSchema>;

// イベントタイプの表示名
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  playlist: "プレイリスト開始",
  power_on: "電源オン",
  power_off: "電源オフ",
  reboot: "再起動",
};

// 曜日の表示名
export const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: "月",
  tuesday: "火",
  wednesday: "水",
  thursday: "木",
  friday: "金",
  saturday: "土",
  sunday: "日",
};
