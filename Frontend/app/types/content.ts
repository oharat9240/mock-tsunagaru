import { z } from "zod";

// コンテンツタイプの定義
export const ContentTypeSchema = z.enum([
  "video", // 動画ファイル
  "image", // 画像ファイル
  "text", // テキストファイル（スタイル情報を含む）
  "youtube", // YouTubeのURL
  "url", // その他のURL
  "weather", // 気象情報
  "csv", // CSVデータから生成する画像
]);

// ファイルコンテンツの詳細情報
export const FileContentSchema = z.object({
  originalName: z.string().min(1, "オリジナルファイル名は必須です"),
  size: z.number().min(0, "ファイルサイズは0以上である必要があります"),
  mimeType: z.string().min(1, "MIMEタイプは必須です"),
  storagePath: z.string().min(1, "ストレージパスは必須です"), // OPFSでのパス
  thumbnailPath: z.string().optional(), // サムネイル画像のOPFSパス
  metadata: z
    .object({
      width: z.number().optional(),
      height: z.number().optional(),
      duration: z.number().optional(), // 動画の場合
    })
    .optional(),
});

// URLコンテンツの詳細情報
export const UrlContentSchema = z.object({
  url: z.string().url("有効なURLを入力してください"),
  title: z.string().optional(), // URLから取得したタイトル
  description: z.string().optional(), // URLから取得した説明
  thumbnail: z.string().optional(), // サムネイルURL
});

// テキストコンテンツの詳細情報（スタイル情報を含む）
export const TextContentSchema = z.object({
  content: z.string().min(1, "テキストコンテンツは必須です"),
  writingMode: z.enum(["horizontal", "vertical"], "書字方向を選択してください"),
  fontFamily: z.string().min(1, "フォントファミリーは必須です"),
  textAlign: z.enum(["start", "center", "end"], "テキスト整列を選択してください"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "有効な色コードを入力してください"),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "有効な背景色コードを入力してください"),
  fontSize: z.number().min(8).max(200).default(16), // フォントサイズ
  scrollType: z.enum(["none", "horizontal", "vertical"]).default("none"), // スクロールタイプ
  scrollSpeed: z.number().min(1).max(10).default(3), // スクロール速度（1-10）
});

// 気象情報コンテンツの詳細情報
export const WeatherContentSchema = z.object({
  locations: z.array(z.string()).min(1).max(5), // 地点コード（最大5つ）
  weatherType: z.enum(["current", "weekly"]).default("weekly"), // 現在の天気 or 週間予報
  apiUrl: z.string().url().default("https://jma-proxy.deno.dev"), // APIのベースURL
});

// CSVレイアウト設定
export const CsvLayoutConfigSchema = z.object({
  table: z.object({
    width: z.number().min(1),
    height: z.number().min(1),
    x: z.number().min(0),
    y: z.number().min(0),
  }),
  columns: z.object({
    widths: z.union([z.array(z.number()), z.literal("auto")]),
    alignment: z.array(z.enum(["left", "center", "right"])),
  }),
  rows: z.object({
    headerHeight: z.number().min(1),
    rowHeight: z.number().min(1),
  }),
  padding: z.object({
    cell: z.number().min(0),
    table: z.number().min(0),
  }),
});

// CSVスタイル設定
export const CsvStyleConfigSchema = z.object({
  font: z.object({
    family: z.string(),
    size: z.number().min(1),
    color: z.string(),
  }),
  header: z.object({
    backgroundColor: z.string(),
    fontWeight: z.enum(["normal", "bold"]).optional(),
    fontSize: z.number().optional(),
    color: z.string().optional(),
  }),
  table: z.object({
    borderWidth: z.number().min(0),
    borderColor: z.string(),
    backgroundColor: z.string(),
  }),
  cell: z.object({
    borderWidth: z.number().min(0),
    borderColor: z.string(),
    backgroundColor: z.string().optional(),
    alternateRowColor: z.string().optional(),
  }),
});

// CSVコンテンツの詳細情報
export const CsvContentSchema = z.object({
  originalCsvData: z.string(), // 元のCSVデータ
  editedCsvData: z.string().optional(), // 編集されたCSVデータ
  originalCsvFilePath: z.string().optional(), // 元のCSVファイルのOPFSパス
  originalCsvFileName: z.string().optional(), // 元のCSVファイル名
  selectedRows: z.array(z.number()), // 選択された行のインデックス（0ベース）
  selectedColumns: z.array(z.number()), // 選択された列のインデックス（0ベース）
  layout: CsvLayoutConfigSchema.optional(), // レイアウト設定
  style: CsvStyleConfigSchema.optional(), // スタイル設定
  backgroundPath: z.string().optional(), // 背景画像のOPFSパス
  backgroundFileName: z.string().optional(), // 背景画像のファイル名
  format: z.enum(["png", "jpeg"]).default("png"), // 出力形式
  renderedImagePath: z.string(), // 生成された画像のOPFSパス
  apiUrl: z.string().url().default("https://csv-renderer.onrender.com"), // APIのベースURL
});

// コンテンツアイテムのスキーマ
export const ContentItemSchema = z.object({
  id: z.string().min(1, "IDは必須です"),
  name: z.string().min(1, "名前は必須です"),
  type: ContentTypeSchema,
  // ファイルの場合はfileInfo、URLの場合はurlInfo、テキストの場合はtextInfo、気象情報の場合はweatherInfo、CSVの場合はcsvInfo
  fileInfo: FileContentSchema.optional().nullable(),
  urlInfo: UrlContentSchema.optional().nullable(),
  textInfo: TextContentSchema.optional().nullable(),
  weatherInfo: WeatherContentSchema.optional().nullable(),
  csvInfo: CsvContentSchema.optional().nullable(),
  tags: z.array(z.string()).default([]), // タグ
  createdAt: z.string().datetime("無効な作成日時です"),
  updatedAt: z.string().datetime("無効な更新日時です").optional().nullable(),
});

// コンテンツインデックス（一覧表示用）
export const ContentIndexSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: ContentTypeSchema,
  size: z.number().optional(), // ファイルの場合のみ
  url: z.string().optional(), // URLの場合のみ
  tags: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

export const ContentsIndexSchema = z.array(ContentIndexSchema);

// 型エクスポート
export type ContentType = z.infer<typeof ContentTypeSchema>;
export type FileContent = z.infer<typeof FileContentSchema>;
export type UrlContent = z.infer<typeof UrlContentSchema>;
export type TextContent = z.infer<typeof TextContentSchema>;
export type WeatherContent = z.infer<typeof WeatherContentSchema>;
export type CsvLayoutConfig = z.infer<typeof CsvLayoutConfigSchema>;
export type CsvStyleConfig = z.infer<typeof CsvStyleConfigSchema>;
export type CsvContent = z.infer<typeof CsvContentSchema>;
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
  if (mimeType.startsWith("text/")) {
    return "text";
  }
  // デフォルトはテキストとして扱う
  return "text";
};

// 一般的なファイル形式の受け入れ可能なMIMEタイプ
export const ACCEPTED_MIME_TYPES = {
  video: ["video/mp4", "video/webm", "video/avi", "video/mov", "video/wmv", "video/flv", "video/mkv"],
  image: ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp"],
  text: [
    "text/plain",
    "text/html",
    "text/css",
    "text/javascript",
    "text/json",
    "application/json",
    "text/xml",
    "application/xml",
  ],
} as const;

// YouTubeのURL判定
export const isYouTubeUrl = (url: string): boolean => {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/;
  return youtubeRegex.test(url);
};

export const extractYouTubeVideoId = (url: string): string | null => {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  return match ? match[1] : null;
};

// 利用可能なフォントファミリー
export const FONT_FAMILIES = [
  { value: "Inter, sans-serif", label: "Inter（デフォルト）" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Helvetica, Arial, sans-serif", label: "Helvetica" },
  { value: "Times, serif", label: "Times" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "Courier, monospace", label: "Courier" },
  { value: "Monaco, monospace", label: "Monaco" },
  { value: "Hiragino Sans, sans-serif", label: "ヒラギノ角ゴ" },
  { value: "Yu Gothic, sans-serif", label: "游ゴシック" },
  { value: "Meiryo, sans-serif", label: "メイリオ" },
  { value: "MS Gothic, monospace", label: "ＭＳ ゴシック" },
] as const;
