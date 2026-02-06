import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import ffmpeg from "fluent-ffmpeg";
import { db, contents, layouts, playlists, schedules, streams } from "./db/index.js";
import crypto from "node:crypto";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

// アップロードディレクトリの初期化
async function initUploadDir() {
  const dirs = [
    UPLOAD_DIR,
    path.join(UPLOAD_DIR, "files"),
    path.join(UPLOAD_DIR, "thumbnails"),
    path.join(UPLOAD_DIR, "csv"),
  ];
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
}

// Multer設定
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(UPLOAD_DIR, "files"));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const id = uuidv4();
    cb(null, `${id}${ext}`);
  },
});

// 許可するMIMEタイプ
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp",
  "video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-msvideo", "video/x-matroska",
  "text/csv", "text/plain",
  "application/pdf",
]);

const upload = multer({
  storage,
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE) || 500 * 1024 * 1024, // 500MB
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});

// 動画からサムネイルを生成
async function generateVideoThumbnail(videoPath: string, thumbnailPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .on("error", (err) => {
        console.error("Thumbnail generation error:", err);
        reject(err);
      })
      .on("end", () => {
        console.log("Thumbnail generated:", thumbnailPath);
        resolve();
      })
      .screenshots({
        count: 1,
        folder: path.dirname(thumbnailPath),
        filename: path.basename(thumbnailPath),
        size: "320x180",
        timemarks: ["1"], // 1秒目のフレームを取得
      });
  });
}

// MIMEタイプが動画かどうかを判定
function isVideoMimeType(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

// 動画のメタデータ（duration, width, height）を取得
interface VideoMetadata {
  duration: number;
  width?: number;
  height?: number;
}

async function getVideoMetadata(videoPath: string): Promise<VideoMetadata | null> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        console.error("Failed to get video metadata:", err);
        resolve(null);
        return;
      }

      const videoStream = metadata.streams.find((s) => s.codec_type === "video");
      const duration = metadata.format.duration;

      if (duration === undefined) {
        resolve(null);
        return;
      }

      resolve({
        duration,
        width: videoStream?.width,
        height: videoStream?.height,
      });
    });
  });
}

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN === "*" ? true : (process.env.CORS_ORIGIN || "http://localhost:5173"),
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true })); // nginx-rtmpコールバック用

// 静的ファイル配信
app.use("/uploads", express.static(UPLOAD_DIR));

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
app.get("/api", (_req: Request, res: Response) => {
  res.json({ message: "Mock Tsunagaru Backend API" });
});

// ========================================
// ファイルアップロードAPI
// ========================================

// 単一ファイルアップロード
app.post("/api/files/upload", upload.single("file"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const fileId = path.basename(req.file.filename, path.extname(req.file.filename));
    let thumbnailPath: string | undefined;
    let metadata: VideoMetadata | null = null;

    // 動画の場合はサムネイルとメタデータを取得
    if (isVideoMimeType(req.file.mimetype)) {
      const videoPath = path.join(UPLOAD_DIR, "files", req.file.filename);
      const thumbnailFilename = `${fileId}.jpg`;
      const thumbnailFullPath = path.join(UPLOAD_DIR, "thumbnails", thumbnailFilename);

      // サムネイル生成
      try {
        await generateVideoThumbnail(videoPath, thumbnailFullPath);
        thumbnailPath = `/uploads/thumbnails/${thumbnailFilename}`;
      } catch (error) {
        console.error("Failed to generate thumbnail:", error);
        // サムネイル生成に失敗してもアップロード自体は成功とする
      }

      // メタデータ取得
      metadata = await getVideoMetadata(videoPath);
      if (metadata) {
        console.log("Video metadata:", metadata);
      }
    }

    const fileInfo = {
      id: fileId,
      originalName: req.file.originalname,
      filename: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: `/uploads/files/${req.file.filename}`,
      thumbnailPath,
      metadata: metadata || undefined,
    };

    res.json(fileInfo);
  } catch (error) {
    next(error);
  }
});

// Base64形式でサムネイルをアップロード
app.post("/api/files/thumbnail-base64/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    // IDのバリデーション（パストラバーサル対策）
    if (!UUID_REGEX.test(id)) {
      res.status(400).json({ error: "Invalid ID format" });
      return;
    }

    const { data, mimeType } = req.body;

    if (!data) {
      res.status(400).json({ error: "No thumbnail data provided" });
      return;
    }

    const ext = mimeType === "image/png" ? ".png" : ".jpg";
    const thumbnailFilename = `${id}${ext}`;
    const thumbnailPath = path.join(UPLOAD_DIR, "thumbnails", thumbnailFilename);

    // Base64からバッファに変換して保存
    const buffer = Buffer.from(data, "base64");
    await fs.writeFile(thumbnailPath, buffer);

    res.json({
      id,
      path: `/uploads/thumbnails/${thumbnailFilename}`,
    });
  } catch (error) {
    next(error);
  }
});

// パストラバーサル対策: ファイル名を検証する共通関数
function sanitizeFilename(filename: string): string | null {
  // パスセパレータや ".." を含むファイル名を拒否
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return null;
  }
  return path.basename(filename);
}

// ファイル削除
app.delete("/api/files/:filename", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filename = sanitizeFilename(req.params.filename as string);
    if (!filename) {
      res.status(400).json({ error: "Invalid filename" });
      return;
    }
    const filePath = path.join(UPLOAD_DIR, "files", filename);

    // パスがUPLOAD_DIR内かを確認
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(UPLOAD_DIR))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    try {
      await fs.unlink(filePath);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// サムネイル削除
app.delete("/api/thumbnails/:filename", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filename = sanitizeFilename(req.params.filename as string);
    if (!filename) {
      res.status(400).json({ error: "Invalid filename" });
      return;
    }
    const filePath = path.join(UPLOAD_DIR, "thumbnails", filename);

    // パスがUPLOAD_DIR内かを確認
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(UPLOAD_DIR))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    try {
      await fs.unlink(filePath);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ========================================
// コンテンツAPI (PostgreSQL)
// ========================================

// コンテンツ一覧取得
app.get("/api/contents", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const allContents = await db.select().from(contents).orderBy(contents.createdAt);

    // フロントエンド用のインデックス形式に変換
    const indexData = allContents.map((content) => ({
      id: content.id,
      name: content.name,
      type: content.type,
      size: content.fileSize,
      url: content.urlInfo ? (content.urlInfo as { url?: string }).url : undefined,
      // ファイルパス情報を追加
      filePath: content.fileStoragePath || null,
      thumbnailPath: content.fileThumbnailPath || null,
      tags: content.tags,
      createdAt: content.createdAt.toISOString(),
      updatedAt: content.updatedAt.toISOString(),
    }));

    res.json(indexData);
  } catch (error) {
    next(error);
  }
});

// コンテンツインデックス保存（互換性のため残す）
app.put("/api/contents", async (_req: Request, res: Response) => {
  // DBを使用するため、インデックス保存は不要
  res.json({ success: true });
});

// 個別コンテンツ取得
app.get("/api/contents/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const content = await db.select().from(contents).where(eq(contents.id, id)).limit(1);

    if (content.length === 0) {
      res.status(404).json({ error: "Content not found" });
      return;
    }

    const c = content[0];

    // フロントエンド用の形式に変換
    // HLSコンテンツの場合、urlInfoをhlsInfoとして返す
    const hlsInfo = c.type === "hls" && c.urlInfo ? c.urlInfo : undefined;

    const responseData = {
      id: c.id,
      name: c.name,
      type: c.type,
      tags: c.tags,
      fileInfo: c.fileStoragePath
        ? {
            originalName: c.fileOriginalName,
            size: c.fileSize,
            mimeType: c.fileMimeType,
            storagePath: c.fileStoragePath,
            thumbnailPath: c.fileThumbnailPath,
            metadata: c.fileMetadata,
          }
        : undefined,
      urlInfo: c.urlInfo,
      hlsInfo, // HLSコンテンツ用
      textInfo: c.textInfo,
      weatherInfo: c.weatherInfo,
      csvInfo: c.csvInfo,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };

    res.json(responseData);
  } catch (error) {
    next(error);
  }
});

// 個別コンテンツ保存
app.put("/api/contents/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const data = req.body;

    // 既存データを確認
    const existing = await db.select().from(contents).where(eq(contents.id, id)).limit(1);

    const contentData = {
      id,
      name: data.name,
      type: data.type,
      tags: data.tags || [],
      fileOriginalName: data.fileInfo?.originalName,
      fileSize: data.fileInfo?.size,
      fileMimeType: data.fileInfo?.mimeType,
      fileStoragePath: data.fileInfo?.storagePath,
      fileThumbnailPath: data.fileInfo?.thumbnailPath,
      fileMetadata: data.fileInfo?.metadata,
      urlInfo: data.urlInfo,
      textInfo: data.textInfo,
      weatherInfo: data.weatherInfo,
      csvInfo: data.csvInfo,
      updatedAt: new Date(),
    };

    if (existing.length === 0) {
      // 新規作成
      await db.insert(contents).values({
        ...contentData,
        createdAt: new Date(),
      });
    } else {
      // 更新
      await db.update(contents).set(contentData).where(eq(contents.id, id));
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// 個別コンテンツ削除
app.delete("/api/contents/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    // 削除前にコンテンツ情報を取得（関連ファイル削除のため）
    const existing = await db.select().from(contents).where(eq(contents.id, id)).limit(1);

    // 関連するストリームを先に削除（外部キー制約対応）
    await db.delete(streams).where(eq(streams.contentId, id));
    // コンテンツを削除
    await db.delete(contents).where(eq(contents.id, id));

    // 関連するファイルをディスクから削除
    if (existing.length > 0) {
      const c = existing[0];
      if (c.fileStoragePath) {
        const filePath = path.resolve(c.fileStoragePath.replace(/^\/uploads/, UPLOAD_DIR));
        try { await fs.unlink(filePath); } catch { /* file may not exist */ }
      }
      if (c.fileThumbnailPath) {
        const thumbPath = path.resolve(c.fileThumbnailPath.replace(/^\/uploads/, UPLOAD_DIR));
        try { await fs.unlink(thumbPath); } catch { /* file may not exist */ }
      }
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ========================================
// レイアウトAPI (PostgreSQL)
// ========================================

// レイアウト一覧取得
app.get("/api/layouts", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const allLayouts = await db.select().from(layouts).orderBy(layouts.createdAt);

    const indexData = allLayouts.map((layout) => ({
      id: layout.id,
      name: layout.name,
      orientation: layout.orientation,
      regionCount: Array.isArray(layout.regions) ? layout.regions.length : 0,
      createdAt: layout.createdAt.toISOString(),
      updatedAt: layout.updatedAt.toISOString(),
    }));

    res.json(indexData);
  } catch (error) {
    next(error);
  }
});

// レイアウトインデックス保存（互換性のため残す）
app.put("/api/layouts", async (_req: Request, res: Response) => {
  res.json({ success: true });
});

// 個別レイアウト取得
app.get("/api/layouts/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const layout = await db.select().from(layouts).where(eq(layouts.id, id)).limit(1);

    if (layout.length === 0) {
      res.status(404).json({ error: "Layout not found" });
      return;
    }

    const l = layout[0];
    res.json({
      id: l.id,
      name: l.name,
      orientation: l.orientation,
      regions: l.regions,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// 個別レイアウト保存
app.put("/api/layouts/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const data = req.body;

    const existing = await db.select().from(layouts).where(eq(layouts.id, id)).limit(1);

    const layoutData = {
      id,
      name: data.name,
      orientation: data.orientation,
      regions: data.regions || [],
      updatedAt: new Date(),
    };

    if (existing.length === 0) {
      await db.insert(layouts).values({
        ...layoutData,
        createdAt: new Date(),
      });
    } else {
      await db.update(layouts).set(layoutData).where(eq(layouts.id, id));
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// 個別レイアウト削除
app.delete("/api/layouts/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    // 関連するプレイリストのlayoutIdをnullに更新（外部キー制約対応）
    await db.update(playlists).set({ layoutId: null }).where(eq(playlists.layoutId, id));
    // レイアウトを削除
    await db.delete(layouts).where(eq(layouts.id, id));
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ========================================
// プレイリストAPI (PostgreSQL)
// ========================================

// プレイリスト一覧取得
app.get("/api/playlists", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const allPlaylists = await db.select().from(playlists).orderBy(playlists.createdAt);

    const indexData = allPlaylists.map((playlist) => {
      const assignments = playlist.contentAssignments as Array<{ contentIds?: string[] }>;
      const contentCount = assignments.reduce((total, a) => total + (a.contentIds?.length || 0), 0);

      return {
        id: playlist.id,
        name: playlist.name,
        layoutId: playlist.layoutId,
        contentCount,
        device: playlist.device,
        createdAt: playlist.createdAt.toISOString(),
        updatedAt: playlist.updatedAt.toISOString(),
      };
    });

    res.json(indexData);
  } catch (error) {
    next(error);
  }
});

// プレイリストインデックス保存（互換性のため残す）
app.put("/api/playlists", async (_req: Request, res: Response) => {
  res.json({ success: true });
});

// 個別プレイリスト取得
app.get("/api/playlists/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const playlist = await db.select().from(playlists).where(eq(playlists.id, id)).limit(1);

    if (playlist.length === 0) {
      res.status(404).json({ error: "Playlist not found" });
      return;
    }

    const p = playlist[0];
    res.json({
      id: p.id,
      name: p.name,
      layoutId: p.layoutId,
      device: p.device,
      contentAssignments: p.contentAssignments,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// 個別プレイリスト保存
app.put("/api/playlists/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const data = req.body;

    const existing = await db.select().from(playlists).where(eq(playlists.id, id)).limit(1);

    const playlistData = {
      id,
      name: data.name,
      layoutId: data.layoutId,
      device: data.device,
      contentAssignments: data.contentAssignments || [],
      updatedAt: new Date(),
    };

    if (existing.length === 0) {
      await db.insert(playlists).values({
        ...playlistData,
        createdAt: new Date(),
      });
    } else {
      await db.update(playlists).set(playlistData).where(eq(playlists.id, id));
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// 個別プレイリスト削除
app.delete("/api/playlists/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    // 関連するスケジュールを先に削除（外部キー制約対応）
    await db.delete(schedules).where(eq(schedules.playlistId, id));
    // プレイリストを削除
    await db.delete(playlists).where(eq(playlists.id, id));
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ========================================
// スケジュールAPI (PostgreSQL)
// ========================================

// スケジュール一覧取得
app.get("/api/schedules", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const allSchedules = await db.select().from(schedules).orderBy(schedules.time);

    const indexData = allSchedules.map((schedule) => ({
      id: schedule.id,
      name: schedule.name,
      time: schedule.time,
      weekdays: schedule.weekdays,
      eventType: schedule.eventType,
      playlistId: schedule.playlistId,
      enabled: schedule.enabled,
      createdAt: schedule.createdAt.toISOString(),
      updatedAt: schedule.updatedAt.toISOString(),
    }));

    res.json(indexData);
  } catch (error) {
    next(error);
  }
});

// スケジュールインデックス保存（互換性のため残す）
app.put("/api/schedules", async (_req: Request, res: Response) => {
  res.json({ success: true });
});

// 個別スケジュール取得
app.get("/api/schedules/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const schedule = await db.select().from(schedules).where(eq(schedules.id, id)).limit(1);

    if (schedule.length === 0) {
      res.status(404).json({ error: "Schedule not found" });
      return;
    }

    const s = schedule[0];
    res.json({
      id: s.id,
      name: s.name,
      time: s.time,
      weekdays: s.weekdays,
      event: {
        type: s.eventType,
        playlistId: s.playlistId,
      },
      enabled: s.enabled,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// 個別スケジュール保存
app.put("/api/schedules/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const data = req.body;

    const existing = await db.select().from(schedules).where(eq(schedules.id, id)).limit(1);

    const scheduleData = {
      id,
      name: data.name,
      time: data.time,
      weekdays: data.weekdays,
      eventType: data.event?.type || data.eventType,
      playlistId: data.event?.playlistId || data.playlistId,
      enabled: data.enabled ?? true,
      updatedAt: new Date(),
    };

    if (existing.length === 0) {
      await db.insert(schedules).values({
        ...scheduleData,
        createdAt: new Date(),
      });
    } else {
      await db.update(schedules).set(scheduleData).where(eq(schedules.id, id));
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// 個別スケジュール削除
app.delete("/api/schedules/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    await db.delete(schedules).where(eq(schedules.id, id));
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ========================================
// CSVファイルAPI
// ========================================

// CSVファイルアップロード
app.post("/api/csv/:contentId/upload", upload.single("file"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const contentId = req.params.contentId as string;
    const type = req.query.type as string | undefined;
    const csvDir = path.join(UPLOAD_DIR, "csv", contentId);
    await fs.mkdir(csvDir, { recursive: true });

    const ext = path.extname(req.file.originalname);
    let filename: string;
    if (type === "original") {
      filename = `original${ext}`;
    } else if (type === "background") {
      filename = `background${ext}`;
    } else if (type === "rendered") {
      filename = `rendered${ext}`;
    } else {
      filename = req.file.filename;
    }

    const destPath = path.join(csvDir, filename);
    await fs.rename(req.file.path, destPath);

    res.json({
      path: `/uploads/csv/${contentId}/${filename}`,
    });
  } catch (error) {
    next(error);
  }
});

// Base64形式でCSVレンダリング画像をアップロード
app.post("/api/csv/:contentId/rendered-base64", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contentId = req.params.contentId as string;
    const { data, format } = req.body;

    if (!data) {
      res.status(400).json({ error: "No image data provided" });
      return;
    }

    const csvDir = path.join(UPLOAD_DIR, "csv", contentId);
    await fs.mkdir(csvDir, { recursive: true });

    const ext = format === "png" ? ".png" : ".jpg";
    const filename = `rendered${ext}`;
    const destPath = path.join(csvDir, filename);

    const buffer = Buffer.from(data, "base64");
    await fs.writeFile(destPath, buffer);

    res.json({
      path: `/uploads/csv/${contentId}/${filename}`,
    });
  } catch (error) {
    next(error);
  }
});

// ========================================
// ファイルダウンロードAPI
// ========================================

// UUIDバリデーション用の正規表現
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// コンテンツIDからファイルをダウンロード
app.get("/api/download/content/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    // UUIDフォーマットのバリデーション
    if (!UUID_REGEX.test(id)) {
      res.status(400).json({ error: "Invalid content ID format" });
      return;
    }

    const content = await db.select().from(contents).where(eq(contents.id, id)).limit(1);

    if (content.length === 0) {
      res.status(404).json({ error: "Content not found" });
      return;
    }

    const c = content[0];

    if (!c.fileStoragePath) {
      res.status(400).json({ error: "Content has no associated file" });
      return;
    }

    // /uploads/files/xxx.ext -> ./uploads/files/xxx.ext
    const relativePath = c.fileStoragePath.replace(/^\/uploads/, UPLOAD_DIR);
    const filePath = path.resolve(relativePath);

    // セキュリティ: パスがUPLOAD_DIR内かを確認
    const resolvedUploadDir = path.resolve(UPLOAD_DIR);
    if (!filePath.startsWith(resolvedUploadDir)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    // ファイルの存在確認
    try {
      await fs.access(filePath);
    } catch {
      res.status(404).json({ error: "File not found on disk" });
      return;
    }

    // オリジナルのファイル名を使用
    const downloadFilename = c.fileOriginalName || path.basename(filePath);

    // RFC 5987準拠のContent-Dispositionヘッダー
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(downloadFilename)}"; filename*=UTF-8''${encodeURIComponent(downloadFilename)}`,
    );
    res.setHeader("Content-Type", c.fileMimeType || "application/octet-stream");

    // ストリーミングでファイルを配信（メモリ効率向上）
    const readStream = createReadStream(filePath);
    readStream.pipe(res);
  } catch (error) {
    next(error);
  }
});

// ファイル名から直接ダウンロード
app.get("/api/download/file/:filename", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filename = req.params.filename as string;
    const filePath = path.resolve(path.join(UPLOAD_DIR, "files", filename));

    // セキュリティ: パスがUPLOAD_DIR内かを確認
    const resolvedUploadDir = path.resolve(UPLOAD_DIR);
    if (!filePath.startsWith(resolvedUploadDir)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    // ファイルの存在確認
    try {
      await fs.access(filePath);
    } catch {
      res.status(404).json({ error: "File not found" });
      return;
    }

    // クエリパラメータでオリジナルファイル名を指定可能
    const originalName = req.query.name as string | undefined;
    const downloadFilename = originalName || filename;

    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(downloadFilename)}"`);
    res.download(filePath, downloadFilename);
  } catch (error) {
    next(error);
  }
});

// CSVディレクトリ削除
app.delete("/api/csv/:contentId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contentId = req.params.contentId as string;
    const csvDir = path.join(UPLOAD_DIR, "csv", contentId);
    try {
      await fs.rm(csvDir, { recursive: true });
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ========================================
// ストリームAPI (ライブ配信管理)
// ========================================

// ストリームキー生成関数
function generateStreamKey(): string {
  return crypto.randomBytes(16).toString("hex");
}

// HLS/RTMP URL（リクエストのホスト名から動的生成）
function getHlsBaseUrl(req: Request): string {
  if (process.env.HLS_BASE_URL) return process.env.HLS_BASE_URL;
  return `http://${req.hostname}:8080/hls`;
}

function getRtmpUrl(req: Request): string {
  if (process.env.RTMP_URL) return process.env.RTMP_URL;
  return `rtmp://${req.hostname}:1935/live`;
}

// ストリーム一覧取得
app.get("/api/streams", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allStreams = await db.select().from(streams).orderBy(streams.createdAt);
    const hlsBaseUrl = getHlsBaseUrl(req);
    const rtmpUrl = getRtmpUrl(req);

    const responseData = allStreams.map((stream) => ({
      id: stream.id,
      name: stream.name,
      streamKey: stream.streamKey,
      contentId: stream.contentId,
      status: stream.status,
      lastLiveAt: stream.lastLiveAt?.toISOString() || null,
      description: stream.description,
      rtmpUrl,
      hlsUrl: `${hlsBaseUrl}/${stream.streamKey}.m3u8`,
      createdAt: stream.createdAt.toISOString(),
      updatedAt: stream.updatedAt.toISOString(),
    }));

    res.json(responseData);
  } catch (error) {
    next(error);
  }
});

// ストリーム作成（HLSコンテンツも自動作成）
app.post("/api/streams", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }

    const streamKey = generateStreamKey();
    const hlsBaseUrl = getHlsBaseUrl(req);
    const rtmpUrl = getRtmpUrl(req);
    const hlsUrl = `${hlsBaseUrl}/${streamKey}.m3u8`;

    // HLSコンテンツを先に作成
    const contentId = uuidv4();
    await db.insert(contents).values({
      id: contentId,
      name: `${name} (ライブ配信)`,
      type: "hls",
      tags: ["ライブ配信"],
      urlInfo: {
        url: hlsUrl,
        title: name,
        description: description || "",
        isLive: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // ストリームを作成
    const streamId = uuidv4();
    await db.insert(streams).values({
      id: streamId,
      name,
      streamKey,
      contentId,
      status: "offline",
      description,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    res.json({
      id: streamId,
      name,
      streamKey,
      contentId,
      status: "offline",
      description,
      rtmpUrl,
      hlsUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// ストリーム詳細取得
app.get("/api/streams/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const stream = await db.select().from(streams).where(eq(streams.id, id)).limit(1);

    if (stream.length === 0) {
      res.status(404).json({ error: "Stream not found" });
      return;
    }

    const hlsBaseUrl = getHlsBaseUrl(req);
    const rtmpUrl = getRtmpUrl(req);
    const s = stream[0];
    res.json({
      id: s.id,
      name: s.name,
      streamKey: s.streamKey,
      contentId: s.contentId,
      status: s.status,
      lastLiveAt: s.lastLiveAt?.toISOString() || null,
      description: s.description,
      fallbackImagePath: s.fallbackImagePath,
      rtmpUrl,
      hlsUrl: `${hlsBaseUrl}/${s.streamKey}.m3u8`,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// ストリームキー再生成
app.post("/api/streams/:id/regenerate-key", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const stream = await db.select().from(streams).where(eq(streams.id, id)).limit(1);

    if (stream.length === 0) {
      res.status(404).json({ error: "Stream not found" });
      return;
    }

    const hlsBaseUrl = getHlsBaseUrl(req);
    const newStreamKey = generateStreamKey();
    const newHlsUrl = `${hlsBaseUrl}/${newStreamKey}.m3u8`;

    // ストリームキーを更新
    await db.update(streams).set({
      streamKey: newStreamKey,
      updatedAt: new Date(),
    }).where(eq(streams.id, id));

    // 関連するコンテンツのHLS URLも更新
    const s = stream[0];
    if (s.contentId) {
      await db.update(contents).set({
        urlInfo: {
          url: newHlsUrl,
          isLive: true,
        },
        updatedAt: new Date(),
      }).where(eq(contents.id, s.contentId));
    }

    res.json({
      streamKey: newStreamKey,
      hlsUrl: newHlsUrl,
    });
  } catch (error) {
    next(error);
  }
});

// ストリーム削除
app.delete("/api/streams/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const stream = await db.select().from(streams).where(eq(streams.id, id)).limit(1);

    if (stream.length === 0) {
      res.status(404).json({ error: "Stream not found" });
      return;
    }

    // 関連するコンテンツも削除
    const s = stream[0];
    if (s.contentId) {
      await db.delete(contents).where(eq(contents.id, s.contentId));
    }

    // ストリームを削除
    await db.delete(streams).where(eq(streams.id, id));

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ストリーム状態取得
app.get("/api/streams/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const stream = await db.select().from(streams).where(eq(streams.id, id)).limit(1);

    if (stream.length === 0) {
      res.status(404).json({ error: "Stream not found" });
      return;
    }

    res.json({
      status: stream[0].status,
      lastLiveAt: stream[0].lastLiveAt?.toISOString() || null,
    });
  } catch (error) {
    next(error);
  }
});

// nginx-rtmpコールバック: 配信開始
app.post("/api/streams/on-publish", async (req: Request, res: Response, next: NextFunction) => {
  try {
    // nginx-rtmpからのコールバック（application/x-www-form-urlencoded）
    const streamKey = req.body.name as string;

    if (!streamKey) {
      res.status(400).send("Invalid stream key");
      return;
    }

    // ストリームキーでストリームを検索
    const stream = await db.select().from(streams).where(eq(streams.streamKey, streamKey)).limit(1);

    if (stream.length === 0) {
      // 未登録のストリームキーは拒否
      console.log(`Rejected unknown stream key: ${streamKey}`);
      res.status(403).send("Forbidden");
      return;
    }

    // ステータスをliveに更新
    await db.update(streams).set({
      status: "live",
      lastLiveAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(streams.streamKey, streamKey));

    console.log(`Stream started: ${stream[0].name} (${streamKey})`);
    res.status(200).send("OK");
  } catch (error) {
    console.error("on-publish error:", error);
    next(error);
  }
});

// nginx-rtmpコールバック: 配信終了
app.post("/api/streams/on-publish-done", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const streamKey = req.body.name as string;

    if (!streamKey) {
      res.status(400).send("Invalid stream key");
      return;
    }

    // ストリームキーでストリームを検索
    const stream = await db.select().from(streams).where(eq(streams.streamKey, streamKey)).limit(1);

    if (stream.length === 0) {
      res.status(200).send("OK");
      return;
    }

    // ステータスをofflineに更新
    await db.update(streams).set({
      status: "offline",
      updatedAt: new Date(),
    }).where(eq(streams.streamKey, streamKey));

    console.log(`Stream ended: ${stream[0].name} (${streamKey})`);
    res.status(200).send("OK");
  } catch (error) {
    console.error("on-publish-done error:", error);
    next(error);
  }
});

// エラーハンドリング
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Error:", err);

  // Multerのファイルサイズ超過エラー
  if (err.message?.includes("File too large") || (err as { code?: string }).code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ error: "File size exceeds the limit" });
    return;
  }

  // MIMEタイプ不許可エラー
  if (err.message?.startsWith("File type not allowed")) {
    res.status(400).json({ error: err.message });
    return;
  }

  // 内部エラーメッセージはクライアントに返さない
  res.status(500).json({ error: "Internal server error" });
});

// Start server
initUploadDir().then(() => {
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`🚀 Backend server running on http://0.0.0.0:${PORT}`);
    console.log(`✓ Health check: http://localhost:${PORT}/health`);
    console.log(`✓ API: http://localhost:${PORT}/api`);
    console.log(`✓ Upload directory: ${UPLOAD_DIR}`);
    console.log(`✓ Database: PostgreSQL connected`);
  });
});
