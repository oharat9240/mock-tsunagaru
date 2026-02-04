/**
 * WebCodecs APIを使用した動画サムネイル生成ユーティリティ
 * Canvas APIフォールバック機能付き
 */
import { logger } from "~/utils/logger";

export interface ThumbnailOptions {
  width?: number;
  height?: number;
  timestamp?: number; // 0-1の範囲で指定（0.25 = 25%地点）
  quality?: number; // JPEG品質（0-1）
}

export interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  codec?: string;
}

export class VideoThumbnailGenerator {
  private static instance: VideoThumbnailGenerator;
  private supportsWebCodecs: boolean;

  static getInstance(): VideoThumbnailGenerator {
    if (!VideoThumbnailGenerator.instance) {
      VideoThumbnailGenerator.instance = new VideoThumbnailGenerator();
    }
    return VideoThumbnailGenerator.instance;
  }

  constructor() {
    this.supportsWebCodecs = this.checkWebCodecsSupport();
  }

  private checkWebCodecsSupport(): boolean {
    return typeof VideoDecoder !== "undefined" && typeof VideoFrame !== "undefined";
  }

  /**
   * 動画ファイルからサムネイルを生成
   */
  async generateThumbnail(
    videoFile: File,
    options: ThumbnailOptions = {},
  ): Promise<{ thumbnail: string; metadata: VideoMetadata }> {
    const { timestamp: _timestamp = 0.25, quality: _quality = 0.8 } = options;

    try {
      if (this.supportsWebCodecs) {
        logger.debug("VideoThumbnail", "Using WebCodecs API");
        return await this.generateWithWebCodecs(videoFile, options);
      }
      logger.debug("VideoThumbnail", "Falling back to Canvas API");
      return await this.generateWithCanvas(videoFile, options);
    } catch (error) {
      logger.warn("VideoThumbnail", "WebCodecs failed, falling back to Canvas", error);
      return await this.generateWithCanvas(videoFile, options);
    }
  }

  /**
   * WebCodecs APIを使用したサムネイル生成
   */
  private async generateWithWebCodecs(
    videoFile: File,
    options: ThumbnailOptions,
  ): Promise<{ thumbnail: string; metadata: VideoMetadata }> {
    const { timestamp: _timestamp = 0.25, width: _width, height: _height, quality: _quality = 0.8 } = options;

    // まずは動画メタデータを取得（Canvas APIで）
    const _metadata = await this.getVideoMetadata(videoFile);

    // WebCodecs実装のためのプレースホルダー
    // 実際の実装では MP4Box.js などのデマルチプレクサーが必要
    // 現在はCanvas APIにフォールバック
    logger.debug("VideoThumbnail", "WebCodecs implementation needs demuxer, falling back to Canvas");
    return await this.generateWithCanvas(videoFile, options);
  }

  /**
   * Canvas APIを使用したサムネイル生成（フォールバック）
   */
  private async generateWithCanvas(
    videoFile: File,
    options: ThumbnailOptions,
  ): Promise<{ thumbnail: string; metadata: VideoMetadata }> {
    const { timestamp = 0.25, width, height, quality = 0.8 } = options;

    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }

      video.preload = "metadata";
      video.muted = true;

      const cleanup = () => {
        URL.revokeObjectURL(video.src);
      };

      video.addEventListener(
        "loadedmetadata",
        () => {
          const metadata: VideoMetadata = {
            width: video.videoWidth,
            height: video.videoHeight,
            duration: video.duration,
          };

          // サムネイル生成位置を設定
          video.currentTime = video.duration * timestamp;

          video.addEventListener(
            "seeked",
            () => {
              try {
                // アスペクト比を維持してリサイズ
                const aspectRatio = video.videoWidth / video.videoHeight;

                if (width && !height) {
                  // 幅のみ指定：アスペクト比を保持して高さを計算
                  canvas.width = width;
                  canvas.height = width / aspectRatio;
                } else if (height && !width) {
                  // 高さのみ指定：アスペクト比を保持して幅を計算
                  canvas.width = height * aspectRatio;
                  canvas.height = height;
                } else if (width && height) {
                  // 両方指定された場合もアスペクト比を保持（幅を優先）
                  canvas.width = width;
                  canvas.height = width / aspectRatio;
                } else {
                  // 未指定の場合：デフォルト最大幅でアスペクト比保持
                  canvas.width = Math.min(video.videoWidth, 400);
                  canvas.height = canvas.width / aspectRatio;
                }

                // フレームを描画
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                // サムネイルを生成
                const thumbnail = canvas.toDataURL("image/jpeg", quality);

                cleanup();
                resolve({ thumbnail, metadata });
              } catch (error) {
                cleanup();
                reject(error);
              }
            },
            { once: true },
          );

          video.addEventListener(
            "error",
            () => {
              cleanup();
              reject(new Error("Video seek failed"));
            },
            { once: true },
          );
        },
        { once: true },
      );

      video.addEventListener(
        "error",
        () => {
          cleanup();
          reject(new Error("Video metadata loading failed"));
        },
        { once: true },
      );

      // 動画を読み込み
      video.src = URL.createObjectURL(videoFile);
    });
  }

  /**
   * 動画メタデータを取得
   */
  private async getVideoMetadata(videoFile: File): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;

      video.addEventListener(
        "loadedmetadata",
        () => {
          const metadata: VideoMetadata = {
            width: video.videoWidth,
            height: video.videoHeight,
            duration: video.duration,
          };
          URL.revokeObjectURL(video.src);
          resolve(metadata);
        },
        { once: true },
      );

      video.addEventListener(
        "error",
        () => {
          URL.revokeObjectURL(video.src);
          reject(new Error("Failed to load video metadata"));
        },
        { once: true },
      );

      video.src = URL.createObjectURL(videoFile);
    });
  }

  /**
   * 複数のタイムスタンプでサムネイルを生成（プレビューストリップ用）
   */
  async generateMultipleThumbnails(
    videoFile: File,
    timestamps: number[],
    options: Omit<ThumbnailOptions, "timestamp"> = {},
  ): Promise<Array<{ thumbnail: string; timestamp: number }>> {
    const results: Array<{ thumbnail: string; timestamp: number }> = [];

    for (const timestamp of timestamps) {
      try {
        const { thumbnail } = await this.generateThumbnail(videoFile, {
          ...options,
          timestamp,
        });
        results.push({ thumbnail, timestamp });
      } catch (error) {
        logger.error("VideoThumbnail", `Failed to generate thumbnail at ${timestamp}`, error);
      }
    }

    return results;
  }

  /**
   * 動画のサポート状況をチェック
   */
  static isVideoSupported(mimeType: string): boolean {
    const video = document.createElement("video");
    return video.canPlayType(mimeType) !== "";
  }

  /**
   * WebCodecsサポート状況を取得
   */
  getSupport() {
    return {
      webCodecs: this.supportsWebCodecs,
      canvas: true, // Canvas APIは常にサポートされている
    };
  }
}

// シングルトンインスタンスをエクスポート
export const videoThumbnailGenerator = VideoThumbnailGenerator.getInstance();

// 便利な関数をエクスポート
export const generateVideoThumbnail = (file: File, options?: ThumbnailOptions) =>
  videoThumbnailGenerator.generateThumbnail(file, options);

export const generateMultipleVideoThumbnails = (
  file: File,
  timestamps: number[],
  options?: Omit<ThumbnailOptions, "timestamp">,
) => videoThumbnailGenerator.generateMultipleThumbnails(file, timestamps, options);
