import { Box, Text } from "@mantine/core";
import type Hls from "hls.js";
import { memo, useEffect, useRef, useState } from "react";
import { apiClient } from "~/services/apiClient";
import type { ContentItem } from "~/types/content";
import { logger } from "~/utils/logger";

// HLS.jsを動的にインポート
let HlsModule: typeof import("hls.js") | null = null;
const loadHls = async (): Promise<typeof import("hls.js")["default"] | null> => {
  if (HlsModule) return HlsModule.default;
  try {
    HlsModule = await import("hls.js");
    return HlsModule.default;
  } catch (e) {
    logger.error("ContentRendererFullscreen", "Failed to load hls.js", e);
    return null;
  }
};

interface ContentRendererFullscreenProps {
  content: ContentItem;
  duration: number;
  onComplete?: () => void;
  width: number;
  height: number;
  isPaused: boolean;
  isMuted: boolean;
}

export const ContentRendererFullscreen = memo(function ContentRendererFullscreen({
  content,
  duration,
  onComplete,
  width,
  height,
  isPaused,
  isMuted,
}: ContentRendererFullscreenProps) {
  const intervalRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const pausedTimeRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  // ファイルコンテンツのURL生成
  useEffect(() => {
    setVideoUrl(null);
    setImageUrl(null);

    if ((content.type === "video" || content.type === "image") && content.fileInfo?.storagePath) {
      const url = apiClient.getFileUrl(content.fileInfo.storagePath);
      if (content.type === "video") {
        setVideoUrl(url);
      } else {
        setImageUrl(url);
      }
    }
  }, [content.type, content.fileInfo]);

  // 動画の再生/一時停止制御
  useEffect(() => {
    if (content.type !== "video" || !videoRef.current) return;

    const video = videoRef.current;

    if (isPaused) {
      video.pause();
    } else {
      video.play().catch(() => {
        // 自動再生がブロックされた場合は無視
      });
    }
  }, [isPaused, content.type]);

  // 動画のミュート制御
  useEffect(() => {
    if (content.type !== "video" || !videoRef.current) return;
    videoRef.current.muted = isMuted;
  }, [isMuted, content.type]);

  // 動画完了イベント
  useEffect(() => {
    if (content.type !== "video" || !videoRef.current) return;

    const video = videoRef.current;
    const handleEnded = () => {
      onComplete?.();
    };

    video.addEventListener("ended", handleEnded);
    return () => video.removeEventListener("ended", handleEnded);
  }, [content.type, onComplete]);

  // 非動画コンテンツのタイマー管理
  useEffect(() => {
    if (content.type === "video") return;

    // 初期化
    startTimeRef.current = Date.now();
    pausedTimeRef.current = 0;

    const checkCompletion = () => {
      if (isPaused) {
        // 一時停止中は経過時間を記録
        pausedTimeRef.current = Date.now() - startTimeRef.current;
        return;
      }

      // 再開時は開始時間を調整
      if (pausedTimeRef.current > 0) {
        startTimeRef.current = Date.now() - pausedTimeRef.current;
        pausedTimeRef.current = 0;
      }

      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      if (elapsed >= duration) {
        onComplete?.();
      }
    };

    intervalRef.current = window.setInterval(checkCompletion, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [content, duration, onComplete, isPaused]);

  const renderContent = () => {
    const commonStyle = {
      width: "100%",
      height: "100%",
      objectFit: "contain" as const,
    };

    switch (content.type) {
      case "video":
        return (
          <video
            ref={videoRef}
            src={videoUrl || undefined}
            style={commonStyle}
            autoPlay={!isPaused}
            muted={isMuted}
            playsInline
          />
        );

      case "image":
        return <img src={imageUrl || undefined} alt={content.name} style={commonStyle} />;

      case "hls":
        if (!content.hlsInfo?.url) return null;
        return (
          <HlsRendererFullscreen
            url={content.hlsInfo.url}
            width={width}
            height={height}
            fallbackImagePath={content.hlsInfo.fallbackImagePath}
            isPaused={isPaused}
            isMuted={isMuted}
          />
        );

      default:
        return <Text c="white">サポートされていないコンテンツタイプです</Text>;
    }
  };

  return (
    <Box style={{ width, height, position: "relative", overflow: "hidden", backgroundColor: "#000" }}>
      {renderContent()}
    </Box>
  );
});

// HLSストリーム表示コンポーネント（フルスクリーン版）
interface HlsRendererFullscreenProps {
  url: string;
  width: number;
  height: number;
  fallbackImagePath?: string;
  isPaused: boolean;
  isMuted: boolean;
}

function HlsRendererFullscreen({
  url,
  width,
  height,
  fallbackImagePath,
  isPaused,
  isMuted,
}: HlsRendererFullscreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  useEffect(() => {
    if (!videoRef.current) return;

    let mounted = true;
    const video = videoRef.current;

    const initHls = async () => {
      const HlsClass = await loadHls();

      if (!mounted) return;

      if (!HlsClass) {
        // HLS.jsが読み込めない場合、ネイティブHLSサポートを試す
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url;
          if (!isPaused) {
            video.play().catch((err) => {
              logger.warn("HlsRendererFullscreen", "Native HLS playback failed", err);
              setError("ストリームの再生に失敗しました");
            });
          }
          setIsLoading(false);
          return;
        }

        setError("HLSライブラリの読み込みに失敗しました");
        return;
      }

      if (!HlsClass.isSupported()) {
        // Safari等のネイティブHLSサポートを試す
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url;
          if (!isPaused) {
            video.play().catch((err) => {
              logger.warn("HlsRendererFullscreen", "Native HLS playback failed", err);
              setError("ストリームの再生に失敗しました");
            });
          }
          setIsLoading(false);
          return;
        }

        setError("このブラウザはHLSをサポートしていません");
        return;
      }

      // HLS.js を使用
      const hls = new HlsClass({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });

      hlsRef.current = hls;

      hls.on(HlsClass.Events.MEDIA_ATTACHED, () => {
        logger.debug("HlsRendererFullscreen", "HLS media attached");
        hls.loadSource(url);
      });

      hls.on(HlsClass.Events.MANIFEST_PARSED, () => {
        logger.debug("HlsRendererFullscreen", "HLS manifest parsed");
        setIsLoading(false);
        if (!isPaused) {
          video.play().catch((err) => {
            logger.warn("HlsRendererFullscreen", "Auto-play failed", err);
          });
        }
      });

      hls.on(HlsClass.Events.ERROR, (_, data) => {
        if (data.fatal) {
          logger.error("HlsRendererFullscreen", "HLS fatal error", data);
          switch (data.type) {
            case HlsClass.ErrorTypes.NETWORK_ERROR:
              if (retryCount < maxRetries) {
                setRetryCount((prev) => prev + 1);
                hls.startLoad();
              } else {
                setError("ネットワークエラー: ストリームに接続できません");
              }
              break;
            case HlsClass.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setError("ストリームの再生に失敗しました");
              break;
          }
        }
      });

      hls.attachMedia(video);
    };

    initHls();

    return () => {
      mounted = false;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [url, retryCount, isPaused]);

  // 再生/一時停止制御
  useEffect(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    if (isPaused) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
  }, [isPaused]);

  // ミュート制御
  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = isMuted;
  }, [isMuted]);

  // エラー時にフォールバック画像を表示
  if (error && fallbackImagePath) {
    const fallbackUrl = apiClient.getFileUrl(fallbackImagePath);
    return <img src={fallbackUrl} alt="Fallback" style={{ width: "100%", height: "100%", objectFit: "contain" }} />;
  }

  if (error) {
    return (
      <Box
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#111",
        }}
      >
        <Text c="red">{error}</Text>
      </Box>
    );
  }

  return (
    <Box style={{ width, height, position: "relative" }}>
      {isLoading && (
        <Box
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#111",
          }}
        >
          <Text c="white">ストリームを読み込み中...</Text>
        </Box>
      )}
      <video
        ref={videoRef}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
        autoPlay={!isPaused}
        muted={isMuted}
        playsInline
      />
    </Box>
  );
}
