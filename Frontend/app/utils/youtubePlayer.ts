import { logger } from "./logger";

// YouTube Player APIの型定義
interface YouTubePlayer {
  getDuration(): number;
  destroy(): void;
}

// YouTube Player APIのグローバル型定義
declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        options: {
          videoId: string;
          events: {
            onReady: (event: { target: YouTubePlayer }) => void;
            onError?: (event: { data: number }) => void;
          };
        },
      ) => YouTubePlayer;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

// YouTube iframe APIを読み込む
let apiLoadPromise: Promise<void> | null = null;

const loadYouTubeAPI = (): Promise<void> => {
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise((resolve) => {
    // すでに読み込まれている場合
    if (window.YT) {
      resolve();
      return;
    }

    // APIの読み込みコールバック
    window.onYouTubeIframeAPIReady = () => {
      resolve();
    };

    // スクリプトタグを追加
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });

  return apiLoadPromise;
};

// YouTube動画の再生時間を取得（隠しiframeを使用）
export const getYouTubeVideoDuration = async (videoId: string): Promise<number | null> => {
  try {
    // YouTube Player APIを読み込む
    await loadYouTubeAPI();

    return new Promise((resolve) => {
      // 隠しコンテナを作成
      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.width = "1px";
      container.style.height = "1px";
      container.id = `yt-player-${videoId}`;
      document.body.appendChild(container);

      // タイムアウト設定（10秒）
      const timeout = setTimeout(() => {
        container.remove();
        logger.warn("YouTube", `Timeout getting duration for video ${videoId}`);
        resolve(null);
      }, 10000);

      // プレーヤーを作成
      const _player = new window.YT.Player(container.id, {
        videoId: videoId,
        events: {
          onReady: (event) => {
            clearTimeout(timeout);
            const duration = event.target.getDuration();

            // プレーヤーを破棄
            event.target.destroy();
            container.remove();

            if (duration > 0) {
              logger.info("YouTube", `Video ${videoId} duration: ${duration} seconds`);
              resolve(Math.ceil(duration));
            } else {
              logger.warn("YouTube", `Invalid duration for video ${videoId}`);
              resolve(null);
            }
          },
          onError: (event) => {
            clearTimeout(timeout);
            container.remove();
            logger.error("YouTube", `Error loading video ${videoId}: ${event.data}`);
            resolve(null);
          },
        },
      });
    });
  } catch (error) {
    logger.error("YouTube", "Failed to get video duration", error);
    return null;
  }
};

// キャッシュ付きバージョン
const durationCache = new Map<string, number>();

export const getYouTubeVideoDurationCached = async (videoId: string): Promise<number | null> => {
  const cached = durationCache.get(videoId);
  if (cached !== undefined) {
    return cached;
  }

  const duration = await getYouTubeVideoDuration(videoId);
  if (duration !== null) {
    durationCache.set(videoId, duration);
  }

  return duration;
};
