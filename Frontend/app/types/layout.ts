import { z } from "zod";

export const RegionSchema = z.object({
  id: z.string().min(1, "リージョンIDは必須です"),
  x: z.number().min(0, "X座標は0以上である必要があります"),
  y: z.number().min(0, "Y座標は0以上である必要があります"),
  width: z.number().min(1, "幅は1以上である必要があります"),
  height: z.number().min(1, "高さは1以上である必要があります"),
  zIndex: z.number().int().min(0, "z-indexは0以上の整数である必要があります").default(0),
});

export const LayoutItemSchema = z.object({
  id: z.string().min(1, "IDは必須です"),
  name: z.string().min(1, "名前は必須です"),
  orientation: z.enum(["landscape", "portrait-right", "portrait-left"], "向きを選択してください"),
  regions: z.array(RegionSchema).max(4, "リージョンは最大4つまでです"),
  createdAt: z.string().datetime("無効な作成日時です"),
  updatedAt: z.string().datetime("無効な更新日時です").optional(),
});

export const LayoutIndexSchema = z.object({
  id: z.string(),
  name: z.string(),
  orientation: z.enum(["landscape", "portrait-right", "portrait-left"]),
  regionCount: z.number().int().min(0).max(4), // 後方互換性のため残す
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

export const LayoutsIndexSchema = z.array(LayoutIndexSchema);

export type Region = z.infer<typeof RegionSchema>;
export type LayoutItem = z.infer<typeof LayoutItemSchema>;
export type LayoutIndex = z.infer<typeof LayoutIndexSchema>;
export type Orientation = z.infer<typeof LayoutItemSchema>["orientation"];
