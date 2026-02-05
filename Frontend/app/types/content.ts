import { z } from "zod";

// コンテンツタイプの定義（動画、静止画、HLSのみ）
export const ContentTypeSchema = z.enum([
  "video", // 動画ファイル
  "image", // 画像ファイル
  "hls", // HLSストリーム
]);

// ファイルコンテンツの詳細情報（動画・画像共通）
export const FileContentSchema = z.object({
  originalName: z.string().min(1, "オリジナルファイル名は必須です"),
  size: z.number().min(0, "ファイルサイズは0以上である必要があります"),
  mimeType: z.string().min(1, "MIMEタイプは必須です"),
  storagePath: z.string().min(1, "ストレージパスは必須です"),
  thumbnailPath: z.string().optional().nullable(),
  metadata: z
    .object({
      width: z.number().optional().nullable(),
      height: z.number().optional().nullable(),
      duration: z.number().optional().nullable(), // 動画の場合
    })
    .optional()
    .nullable(),
});

// HLSストリームコンテンツの詳細情報
export const HlsContentSchema = z.object({
  url: z.string().url("有効なHLS URLを入力してください"),
  fallbackImagePath: z.string().optional(), // ストリームが利用できない時の代替画像パス
  isLive: z.boolean().optional(), // ライブ配信かどうか
  streamId: z.string().uuid().optional(), // 関連するストリームID
});

// コンテンツアイテムのスキーマ
export const ContentItemSchema = z.object({
  id: z.string().min(1, "IDは必須です"),
  name: z.string().min(1, "名前は必須です"),
  type: ContentTypeSchema,
  fileInfo: FileContentSchema.optional().nullable(), // 動画・画像の場合
  hlsInfo: HlsContentSchema.optional().nullable(), // HLSの場合
  tags: z.array(z.string()).default([]),
  createdAt: z.string().datetime("無効な作成日時です"),
  updatedAt: z.string().datetime("無効な更新日時です").optional().nullable(),
});

// コンテンツインデックス（一覧表示用）
export const ContentIndexSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: ContentTypeSchema,
  size: z.number().optional().nullable(),
  url: z.string().optional().nullable(),
  // 静的ファイルのパス
  filePath: z.string().optional().nullable(),
  thumbnailPath: z.string().optional().nullable(),
  tags: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional().nullable(),
});

export const ContentsIndexSchema = z.array(ContentIndexSchema);

// 型エクスポート
export type ContentType = z.infer<typeof ContentTypeSchema>;
export type FileContent = z.infer<typeof FileContentSchema>;
export type HlsContent = z.infer<typeof HlsContentSchema>;
export type ContentItem = z.infer<typeof ContentItemSchema>;
export type ContentIndex = z.infer<typeof ContentIndexSchema>;

// ファイルタイプからコンテンツタイプを判定するヘルパー
export const getContentTypeFromMimeType = (mimeType: string): ContentType => {
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  // デフォルトは画像として扱う
  return "image";
};

// 一般的なファイル形式の受け入れ可能なMIMEタイプ
export const ACCEPTED_MIME_TYPES = {
  video: ["video/mp4", "video/webm", "video/avi", "video/mov", "video/wmv", "video/flv", "video/mkv"],
  image: ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp"],
} as const;

// HLS URLの判定（.m3u8拡張子）
export const isHlsUrl = (url: string): boolean => {
  return url.includes(".m3u8");
};
