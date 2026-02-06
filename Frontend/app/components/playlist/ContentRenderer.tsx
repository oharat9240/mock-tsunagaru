import { Box, Text } from "@mantine/core";
import type Hls from "hls.js";
import { memo, useCallback, useEffect, useRef, useState } from "react";
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
  /** 動画の実際のdurationが検出されたときに呼ばれる */
  onDurationDetected?: (duration: number) => void;
  width: number;
  height: number;
  /** エンジン経過時間（秒） */
  engineTime?: number;
  /** このコンテンツの開始時刻（エンジン時間） */
  contentStartTime?: number;
  /** ミュート状態 */
  isMuted?: boolean;
}

export const ContentRenderer = memo(function ContentRenderer({
  content,
  duration,
  onComplete,
  onProgress,
  onDurationDetected,
  width,
  height,
  engineTime = 0,
  contentStartTime = 0,
  isMuted = true,
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
  const onDurationDetectedRef = useRef(onDurationDetected);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    onDurationDetectedRef.current = onDurationDetected;
  }, [onDurationDetected]);

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

    const handleLoadedMetadata = () => {
      // 動画の実際のdurationを検出したら親に通知
      if (video.duration && Number.isFinite(video.duration)) {
        logger.debug("ContentRenderer", `Video duration detected: ${video.duration}s`);
        onDurationDetectedRef.current?.(video.duration);
      }
    };

    const handleTimeUpdate = () => {
      if (video.duration) {
        const progress = (video.currentTime / video.duration) * 100;
        setProgress(progress);
        onProgressRef.current?.(progress);
      }
    };

    const handleEnded = () => {
      logger.debug("ContentRenderer", `Video ended naturally at ${video.currentTime}s / ${video.duration}s`);
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
      // エラー発生時は設定されたduration後に次のコンテンツに進む
      // メタデータからdurationが取得できない場合のフォールバック
      const fallbackDuration = duration > 0 && duration < 3600 ? duration : 10;
      logger.info("ContentRenderer", `Video error, will advance after ${fallbackDuration}s`);
      setTimeout(() => {
        onCompleteRef.current?.();
      }, fallbackDuration * 1000);
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("error", handleError);

    // 既にメタデータがロード済みの場合
    if (video.readyState >= 1 && video.duration && Number.isFinite(video.duration)) {
      onDurationDetectedRef.current?.(video.duration);
    }

    if (video.readyState >= 3) {
      video.play().catch((err) => {
        logger.warn("ContentRenderer", "Auto-play failed", err);
      });
    }

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
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
        return (
          <video ref={videoRef} src={videoUrl || undefined} style={commonStyle} autoPlay muted={isMuted} playsInline />
        );

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
            isMuted={isMuted}
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
  isMuted?: boolean;
}

function HlsRenderer({ url, width, height, fallbackImagePath, isMuted = true }: HlsRendererProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryIntervalRef = useRef<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWaitingForStream, setIsWaitingForStream] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setRetryCount] = useState(0);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const maxRetries = 3;
  const retryInterval = 5000; // 5秒ごとに再接続を試みる

  // リトライカウントをrefで管理（useCallback依存を減らすため）
  const retryCountRef = useRef(0);

  // HLS初期化関数
  const initHls = useCallback(
    async (video: HTMLVideoElement, mounted: { current: boolean }) => {
      const HlsClass = await loadHls();

      if (!mounted.current) return;

      if (!HlsClass) {
        // HLS.jsが読み込めない場合、ネイティブHLSサポートを試す
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url;
          video.play().catch((err) => {
            logger.warn("HlsRenderer", "Native HLS playback failed", err);
            setIsWaitingForStream(true);
            setIsLoading(false);
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
            setIsWaitingForStream(true);
            setIsLoading(false);
          });
          setIsLoading(false);
          return;
        }

        setError("このブラウザはHLSをサポートしていません");
        return;
      }

      // 既存のHLSインスタンスを破棄
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
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
        logger.debug("HlsRenderer", "HLS manifest parsed - stream is live");
        setIsLoading(false);
        setIsWaitingForStream(false);
        setError(null);
        retryCountRef.current = 0;
        // 再接続ポーリングを停止
        if (retryIntervalRef.current) {
          clearInterval(retryIntervalRef.current);
          retryIntervalRef.current = null;
        }
        video.play().catch((err) => {
          logger.warn("HlsRenderer", "Auto-play failed", err);
        });
      });

      // ストリーム終了時（配信が停止された場合）
      hls.on(HlsClass.Events.BUFFER_EOS, () => {
        logger.debug("HlsRenderer", "Buffer EOS - stream ended, switching to waiting mode");
        // 配信が終了したので待機モードに移行
        hls.destroy();
        hlsRef.current = null;
        setIsWaitingForStream(true);
      });

      hls.on(HlsClass.Events.ERROR, (_, data) => {
        if (data.fatal) {
          logger.warn("HlsRenderer", `HLS error (will retry): ${data.type} - ${data.details}`);
          switch (data.type) {
            case HlsClass.ErrorTypes.NETWORK_ERROR:
              // ネットワークエラー（ストリームがまだ開始されていない可能性）
              if (retryCountRef.current < maxRetries) {
                retryCountRef.current += 1;
                setRetryCount(retryCountRef.current);
                hls.startLoad();
              } else {
                // 最大リトライ回数に達したら、配信待機モードに移行
                setIsLoading(false);
                hls.destroy();
                hlsRef.current = null;
                setIsWaitingForStream(true);
              }
              break;
            case HlsClass.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              // その他のエラーも配信待機モードに移行
              setIsLoading(false);
              hls.destroy();
              hlsRef.current = null;
              setIsWaitingForStream(true);
              break;
          }
        }
      });

      hls.attachMedia(video);
    },
    [url],
  );

  // 初期接続
  // biome-ignore lint/correctness/useExhaustiveDependencies: URLの変更時のみ再初期化する（initHlsはurlに依存するため安定）
  useEffect(() => {
    if (!videoRef.current) return;

    const mounted = { current: true };
    const video = videoRef.current;

    setIsLoading(true);
    setIsWaitingForStream(false);
    setError(null);
    setRetryCount(0);
    retryCountRef.current = 0;
    setConnectionAttempt(0);

    initHls(video, mounted);

    return () => {
      mounted.current = false;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
    };
  }, [url]);

  // 配信待機中のポーリング再接続
  useEffect(() => {
    if (!isWaitingForStream) {
      // 配信中の場合はポーリングを停止
      if (retryIntervalRef.current) {
        logger.debug("HlsRenderer", "Stopping polling - stream is active");
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
      return;
    }

    if (!videoRef.current) return;

    logger.debug("HlsRenderer", "Starting polling for stream availability (isWaitingForStream=true)");

    // 既存のインターバルをクリア
    if (retryIntervalRef.current) {
      clearInterval(retryIntervalRef.current);
    }

    retryIntervalRef.current = window.setInterval(() => {
      logger.debug("HlsRenderer", "Polling: Attempting to reconnect to stream...");
      retryCountRef.current = 0;
      setRetryCount(0);
      setConnectionAttempt((prev) => prev + 1);
    }, retryInterval);

    return () => {
      if (retryIntervalRef.current) {
        logger.debug("HlsRenderer", "Cleanup: Stopping polling interval");
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
    };
  }, [isWaitingForStream]);

  // connectionAttempt変更時に再接続を試みる
  // biome-ignore lint/correctness/useExhaustiveDependencies: connectionAttemptの変更時のみ再接続を試みる（initHlsは安定）
  useEffect(() => {
    if (connectionAttempt === 0 || !videoRef.current || !isWaitingForStream) return;

    logger.debug("HlsRenderer", `Reconnection attempt #${connectionAttempt}`);

    const video = videoRef.current;
    let isCancelled = false;

    // 既存のHLSインスタンスを破棄
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setIsLoading(true);

    const mounted = { current: true };
    initHls(video, mounted).then(() => {
      if (isCancelled) {
        mounted.current = false;
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [connectionAttempt]);

  // 配信待機中にフォールバック画像を表示
  if (isWaitingForStream && fallbackImagePath) {
    const fallbackUrl = apiClient.getFileUrl(fallbackImagePath);
    return (
      <Box style={{ width, height, position: "relative" }}>
        <img src={fallbackUrl} alt="配信待機中" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        <Box
          style={{
            position: "absolute",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            padding: "8px 16px",
            borderRadius: "4px",
          }}
        >
          <Text c="white" size="sm">
            配信開始を待機中...
          </Text>
        </Box>
      </Box>
    );
  }

  // 配信待機中（フォールバック画像なし）
  if (isWaitingForStream) {
    return (
      <Box
        style={{
          width,
          height,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#111",
          gap: 8,
        }}
      >
        <Text c="white">配信開始を待機中...</Text>
        <Text c="dimmed" size="xs">
          配信が開始されると自動的に表示されます
        </Text>
      </Box>
    );
  }

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
      {/* シークバーを非表示にするためcontrolsを使用しない（ライブ配信用） */}
      <video
        ref={videoRef}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
        autoPlay
        muted={isMuted}
        playsInline
        onEnded={() => {
          // 配信が終了した場合は待機状態に戻る
          logger.debug("HlsRenderer", "Video ended - switching to waiting mode");
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
          setIsWaitingForStream(true);
        }}
      />
    </Box>
  );
}
