/**
 * コンテンツタイプ別サムネイル生成ユーティリティ
 * 動画、画像、テキストファイル用の統合サムネイル生成機能
 */

import { logger } from "~/utils/logger";
import { VideoThumbnailGenerator } from "./videoThumbnail";

export interface ThumbnailGenerationOptions {
  width?: number;
  height?: number;
  quality?: number; // JPEG品質（0-1）
  timestamp?: number; // 動画の場合のタイムスタンプ（0-1）
}

export interface ThumbnailResult {
  thumbnailData: ArrayBuffer; // OPFS保存用のバイナリデータ
  metadata: {
    width?: number;
    height?: number;
    duration?: number;
  };
}

export class ThumbnailGenerator {
  private static instance: ThumbnailGenerator;
  private videoGenerator: VideoThumbnailGenerator;

  static getInstance(): ThumbnailGenerator {
    if (!ThumbnailGenerator.instance) {
      ThumbnailGenerator.instance = new ThumbnailGenerator();
    }
    return ThumbnailGenerator.instance;
  }

  constructor() {
    this.videoGenerator = VideoThumbnailGenerator.getInstance();
  }

  /**
   * ファイルタイプに応じてサムネイルを生成
   */
  async generateThumbnail(file: File, options: ThumbnailGenerationOptions = {}): Promise<ThumbnailResult> {
    const { width = 400, height, quality = 0.8, timestamp = 0.25 } = options;

    if (file.type.startsWith("video/")) {
      return await this.generateVideoThumbnail(file, { width, height, quality, timestamp });
    }

    if (file.type.startsWith("image/")) {
      return await this.generateImageThumbnail(file, { width, height: height || Math.round((width * 3) / 4), quality });
    }

    if (file.type.startsWith("text/") || file.type === "application/json") {
      return await this.generateTextThumbnail(file, { width, height: height || Math.round((width * 3) / 4), quality });
    }

    throw new Error(`Unsupported file type for thumbnail generation: ${file.type}`);
  }

  /**
   * 動画サムネイル生成
   */
  private async generateVideoThumbnail(
    file: File,
    options: ThumbnailGenerationOptions & { width: number },
  ): Promise<ThumbnailResult> {
    try {
      const { thumbnail, metadata } = await this.videoGenerator.generateThumbnail(file, {
        width: options.width,
        height: options.height,
        quality: options.quality,
        timestamp: options.timestamp,
      });

      // Data URLからArrayBufferに変換
      const response = await fetch(thumbnail);
      const thumbnailData = await response.arrayBuffer();

      return {
        thumbnailData,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          duration: metadata.duration,
        },
      };
    } catch (error) {
      logger.error("ThumbnailGenerator", "Video thumbnail generation failed", error);
      // フォールバック: プレースホルダー画像を生成
      return await this.generatePlaceholderThumbnail(
        "動画",
        options.width,
        options.height || Math.round((options.width * 3) / 4),
      );
    }
  }

  /**
   * 画像サムネイル生成
   */
  private async generateImageThumbnail(
    file: File,
    options: Omit<Required<ThumbnailGenerationOptions>, "timestamp">,
  ): Promise<ThumbnailResult> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }

      img.onload = () => {
        try {
          // アスペクト比を維持してリサイズ
          const aspectRatio = img.width / img.height;
          let targetWidth = options.width;
          let targetHeight = options.height;

          if (aspectRatio > targetWidth / targetHeight) {
            targetHeight = targetWidth / aspectRatio;
          } else {
            targetWidth = targetHeight * aspectRatio;
          }

          canvas.width = targetWidth;
          canvas.height = targetHeight;

          // 背景を白で塗りつぶし
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // 画像を描画
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          // JPEGとしてエクスポート
          canvas.toBlob(
            async (blob) => {
              if (!blob) {
                reject(new Error("Failed to generate image thumbnail"));
                return;
              }

              const thumbnailData = await blob.arrayBuffer();
              resolve({
                thumbnailData,
                metadata: {
                  width: img.width,
                  height: img.height,
                },
              });
            },
            "image/jpeg",
            options.quality,
          );
        } catch (error) {
          reject(error);
        } finally {
          URL.revokeObjectURL(img.src);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error("Failed to load image"));
      };

      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * テキストファイルサムネイル生成
   */
  private async generateTextThumbnail(
    file: File,
    options: Omit<Required<ThumbnailGenerationOptions>, "timestamp">,
  ): Promise<ThumbnailResult> {
    try {
      // ファイル内容を読み取り
      const text = await file.text();
      const preview = text.slice(0, 200); // 最初の200文字

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Canvas context not available");
      }

      canvas.width = options.width;
      canvas.height = options.height;

      // 背景
      ctx.fillStyle = "#fd7e14"; // オレンジ背景
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // ヘッダー
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px 'Inter', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("テキストファイル", canvas.width / 2, 30);

      // ファイル名
      ctx.font = "12px 'Inter', sans-serif";
      const fileName = file.name.length > 30 ? `${file.name.slice(0, 27)}...` : file.name;
      ctx.fillText(fileName, canvas.width / 2, 50);

      // コンテンツプレビュー
      ctx.font = "10px 'Inter', sans-serif";
      ctx.textAlign = "left";

      const lines = this.wrapText(ctx, preview, canvas.width - 20);
      const maxLines = Math.floor((canvas.height - 70) / 12);

      for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
        ctx.fillText(lines[i], 10, 70 + i * 12);
      }

      // 省略記号
      if (text.length > 200 || lines.length > maxLines) {
        ctx.fillText("...", 10, 70 + Math.min(lines.length, maxLines) * 12);
      }

      return new Promise((resolve) => {
        canvas.toBlob(
          async (blob) => {
            if (!blob) {
              throw new Error("Failed to generate text thumbnail");
            }

            const thumbnailData = await blob.arrayBuffer();
            resolve({
              thumbnailData,
              metadata: {},
            });
          },
          "image/jpeg",
          options.quality,
        );
      });
    } catch (error) {
      logger.error("ThumbnailGenerator", "Text thumbnail generation failed", error);
      // フォールバック
      return await this.generatePlaceholderThumbnail("テキスト", options.width, options.height);
    }
  }

  /**
   * プレースホルダーサムネイル生成
   */
  private async generatePlaceholderThumbnail(label: string, width: number, height: number): Promise<ThumbnailResult> {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Canvas context not available");
    }

    canvas.width = width;
    canvas.height = height;

    // 背景
    ctx.fillStyle = "#e9ecef";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // テキスト
    ctx.fillStyle = "#6c757d";
    ctx.font = "14px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, canvas.width / 2, canvas.height / 2);
    ctx.fillText("プレビュー未対応", canvas.width / 2, canvas.height / 2 + 20);

    return new Promise((resolve) => {
      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            throw new Error("Failed to generate placeholder thumbnail");
          }

          const thumbnailData = await blob.arrayBuffer();
          resolve({
            thumbnailData,
            metadata: {},
          });
        },
        "image/jpeg",
        0.8,
      );
    });
  }

  /**
   * テキストを指定幅で折り返し
   */
  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine + (currentLine ? " " : "") + word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }
}

// シングルトンインスタンスをエクスポート
export const thumbnailGenerator = ThumbnailGenerator.getInstance();
