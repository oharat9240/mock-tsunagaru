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
    logger.error("ContentRenderer", "Failed to load hls.js", e);
    return null;
  }
};

interface ContentRendererProps {
  content: ContentItem;
  duration: number; // 秒単位
  onComplete?: () => void;
  onProgress?: (progress: number) => void;
  width: number;
  height: number;
  /** エンジン経過時間（秒） */
  engineTime?: number;
  /** このコンテンツの開始時刻（エンジン時間） */
  contentStartTime?: number;
}

export const ContentRenderer = memo(function ContentRenderer({
  content,
  duration,
  onComplete,
  onProgress,
  width,
  height,
  engineTime = 0,
  contentStartTime = 0,
}: ContentRendererProps) {
  const [, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // エンジン時間に基づく経過時間計算
  const elapsedTime = engineTime - contentStartTime;

  // コールバックをrefで保持
  const onCompleteRef = useRef(onComplete);
  const onProgressRef = useRef(onProgress);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

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

  // 動画のイベントリスナー設定
  useEffect(() => {
    if (content.type !== "video" || !videoUrl || !videoRef.current) return;

    const video = videoRef.current;

    const handleTimeUpdate = () => {
      if (video.duration) {
        const progress = (video.currentTime / video.duration) * 100;
        setProgress(progress);
        onProgressRef.current?.(progress);
      }
    };

    const handleEnded = () => {
      setProgress(100);
      onProgressRef.current?.(100);
      onCompleteRef.current?.();
    };

    const handleCanPlay = () => {
      video.play().catch((err) => {
        logger.warn("ContentRenderer", "Auto-play failed", err);
      });
    };

    const handleError = () => {
      const errorMessage = video.error?.message || "Unknown video error";
      logger.error("ContentRenderer", `Video playback error: ${errorMessage}`);
      setProgress(100);
      onProgressRef.current?.(100);
      onCompleteRef.current?.();
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("error", handleError);

    if (video.readyState >= 3) {
      video.play().catch((err) => {
        logger.warn("ContentRenderer", "Auto-play failed", err);
      });
    }

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleError);
    };
  }, [content.type, videoUrl]);

  // 静止画・HLSの進捗管理（エンジン時間ベース）
  useEffect(() => {
    if (content.type === "video") return;

    const newProgress = Math.min((elapsedTime / duration) * 100, 100);
    setProgress(newProgress);
    onProgressRef.current?.(newProgress);
  }, [content.type, duration, elapsedTime]);

  const renderContent = () => {
    const commonStyle = {
      width: "100%",
      height: "100%",
      objectFit: "contain" as const,
    };

    switch (content.type) {
      case "video":
        return <video ref={videoRef} src={videoUrl || undefined} style={commonStyle} autoPlay muted playsInline />;

      case "image":
        return <img src={imageUrl || undefined} alt={content.name} style={commonStyle} />;

      case "hls":
        if (!content.hlsInfo?.url) return null;
        return (
          <HlsRenderer
            url={content.hlsInfo.url}
            width={width}
            height={height}
            fallbackImagePath={content.hlsInfo.fallbackImagePath}
          />
        );

      default:
        return <Text>サポートされていないコンテンツタイプです</Text>;
    }
  };

  return <Box style={{ width, height, position: "relative", overflow: "hidden" }}>{renderContent()}</Box>;
});

// HLSストリーム表示コンポーネント
interface HlsRendererProps {
  url: string;
  width: number;
  height: number;
  fallbackImagePath?: string;
}

function HlsRenderer({ url, width, height, fallbackImagePath }: HlsRendererProps) {
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
          video.play().catch((err) => {
            logger.warn("HlsRenderer", "Native HLS playback failed", err);
            setError("ストリームの再生に失敗しました");
          });
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
          video.play().catch((err) => {
            logger.warn("HlsRenderer", "Native HLS playback failed", err);
            setError("ストリームの再生に失敗しました");
          });
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
        logger.debug("HlsRenderer", "HLS media attached");
        hls.loadSource(url);
      });

      hls.on(HlsClass.Events.MANIFEST_PARSED, () => {
        logger.debug("HlsRenderer", "HLS manifest parsed");
        setIsLoading(false);
        video.play().catch((err) => {
          logger.warn("HlsRenderer", "Auto-play failed", err);
        });
      });

      hls.on(HlsClass.Events.ERROR, (_, data) => {
        if (data.fatal) {
          logger.error("HlsRenderer", "HLS fatal error", data);
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
  }, [url, retryCount]);

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
        autoPlay
        muted
        playsInline
      />
    </Box>
  );
}
