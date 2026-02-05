import { z } from "zod";

// ストリーム状態
export const StreamStatusSchema = z.enum(["offline", "live", "error"]);
export type StreamStatus = z.infer<typeof StreamStatusSchema>;

// ストリーム（詳細）
export const StreamSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  streamKey: z.string(),
  contentId: z.string().uuid().nullable(),
  status: StreamStatusSchema,
  lastLiveAt: z.string().datetime().nullable(),
  description: z.string().nullable(),
  fallbackImagePath: z.string().nullable().optional(),
  rtmpUrl: z.string(),
  hlsUrl: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Stream = z.infer<typeof StreamSchema>;

// ストリームインデックス（一覧用）
export const StreamIndexSchema = StreamSchema;
export type StreamIndex = z.infer<typeof StreamIndexSchema>;

// ストリーム作成リクエスト
export const CreateStreamRequestSchema = z.object({
  name: z.string().min(1, "配信名は必須です"),
  description: z.string().optional(),
});
export type CreateStreamRequest = z.infer<typeof CreateStreamRequestSchema>;

// キー再生成レスポンス
export const RegenerateKeyResponseSchema = z.object({
  streamKey: z.string(),
  hlsUrl: z.string(),
});
export type RegenerateKeyResponse = z.infer<typeof RegenerateKeyResponseSchema>;

// ストリーム状態レスポンス
export const StreamStatusResponseSchema = z.object({
  status: StreamStatusSchema,
  lastLiveAt: z.string().datetime().nullable(),
});
export type StreamStatusResponse = z.infer<typeof StreamStatusResponseSchema>;
