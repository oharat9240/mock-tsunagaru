import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { db, contents, layouts, playlists, schedules } from "./db/index.js";

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

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
});

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));

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

    const fileInfo = {
      id: path.basename(req.file.filename, path.extname(req.file.filename)),
      originalName: req.file.originalname,
      filename: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: `/uploads/files/${req.file.filename}`,
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

// ファイル削除
app.delete("/api/files/:filename", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filename = req.params.filename as string;
    const filePath = path.join(UPLOAD_DIR, "files", filename);

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
    const filename = req.params.filename as string;
    const filePath = path.join(UPLOAD_DIR, "thumbnails", filename);

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
    await db.delete(contents).where(eq(contents.id, id));
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

    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(downloadFilename)}"`);
    res.setHeader("Content-Type", c.fileMimeType || "application/octet-stream");

    const fileStream = await fs.readFile(filePath);
    res.send(fileStream);
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

// エラーハンドリング
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({ error: err.message });
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
