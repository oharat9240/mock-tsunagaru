import { Box, Text } from "@mantine/core";
import type { CSSProperties } from "react";
import { memo, useEffect, useRef, useState } from "react";
import { apiClient } from "~/services/apiClient";
import type { ContentItem, TextContent } from "~/types/content";
import { extractYouTubeVideoId } from "~/types/content";
import { logger } from "~/utils/logger";

interface ContentRendererProps {
  content: ContentItem;
  duration: number; // 秒単位
  onComplete?: () => void; // 再生完了時のコールバック
  onProgress?: (progress: number) => void; // 進捗更新時のコールバック（0-100）
  width: number;
  height: number;
}

export const ContentRenderer = memo(function ContentRenderer({
  content,
  duration,
  onComplete,
  onProgress,
  width,
  height,
}: ContentRendererProps) {
  const [, setProgress] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // コールバックをrefで保持（依存配列からの除外のため）
  const onCompleteRef = useRef(onComplete);
  const onProgressRef = useRef(onProgress);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  // ファイルコンテンツのURL生成（サーバーからファイルを取得）- 最初に実行
  useEffect(() => {
    // 状態をリセット
    setVideoUrl(null);
    setImageUrl(null);

    if ((content.type === "video" || content.type === "image") && content.fileInfo?.storagePath) {
      // サーバーからファイルを取得するURLを生成
      const url = apiClient.getFileUrl(content.fileInfo.storagePath);
      if (content.type === "video") {
        setVideoUrl(url);
      } else {
        setImageUrl(url);
      }
    } else if (content.type === "csv" && content.csvInfo?.renderedImagePath) {
      // CSVの場合はレンダリング済み画像のURLを取得
      const url = apiClient.getFileUrl(content.csvInfo.renderedImagePath);
      setImageUrl(url);
    }
  }, [content.type, content.fileInfo, content.csvInfo]);

  // 動画のイベントリスナー設定（videoUrlが設定された後に実行）
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
      // 動画が再生可能になったら自動再生
      video.play().catch((err) => {
        logger.warn("ContentRenderer", "Auto-play failed", err);
      });
    };

    const handleError = () => {
      // 動画のデコードエラーなどが発生した場合、次のコンテンツにスキップ
      const errorMessage = video.error?.message || "Unknown video error";
      logger.error("ContentRenderer", `Video playback error: ${errorMessage}`);
      // エラー時も完了として扱い、次のコンテンツに進む
      setProgress(100);
      onProgressRef.current?.(100);
      onCompleteRef.current?.();
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("error", handleError);

    // 既に再生可能な状態なら再生開始
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

  // 非動画コンテンツのタイマー管理
  useEffect(() => {
    // 動画は別のuseEffectで管理
    if (content.type === "video") return;

    setProgress(0);
    const startTime = Date.now();

    const updateProgress = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const newProgress = Math.min((elapsed / duration) * 100, 100);
      setProgress(newProgress);
      onProgressRef.current?.(newProgress);

      if (newProgress >= 100) {
        onCompleteRef.current?.();
      }
    };

    intervalRef.current = window.setInterval(updateProgress, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [content.type, content.id, duration]);

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

      case "text":
        if (!content.textInfo) return null;
        return <TextRenderer textContent={content.textInfo} width={width} height={height} />;

      case "youtube": {
        if (!content.urlInfo?.url) return null;
        const videoId = extractYouTubeVideoId(content.urlInfo.url);
        if (!videoId) return null;
        return (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0`}
            style={{ width: "100%", height: "100%", border: "none" }}
            allow="autoplay; encrypted-media"
            title={content.name}
          />
        );
      }

      case "url":
        if (!content.urlInfo?.url) return null;
        return (
          <Box
            style={{
              width: "100%",
              height: "100%",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <iframe
              src={content.urlInfo.url}
              width="1920"
              height="1080"
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: "1920px",
                height: "1080px",
                transform: `translate(-50%, -50%) scale(${Math.min(width / 1920, height / 1080)})`,
                transformOrigin: "center",
                border: "none",
                backgroundColor: "white",
                pointerEvents: "none",
              }}
              title={content.name}
            />
          </Box>
        );

      case "weather": {
        if (!content.weatherInfo) return null;
        const { locations, weatherType, apiUrl } = content.weatherInfo;
        // 単一地点と複数地点でパラメータ名が異なる
        const locationsParam = locations.length === 1 ? `location=${locations[0]}` : `locations=${locations.join(",")}`;
        const weatherUrl = `${apiUrl}/api/image/${weatherType}?${locationsParam}`;

        return (
          <img
            src={weatherUrl}
            alt={content.name}
            style={commonStyle}
            onError={(e) => {
              logger.error("ContentRenderer", `Failed to load weather image: ${weatherUrl}`);
              e.currentTarget.src = ""; // Clear src to prevent infinite error loop
            }}
          />
        );
      }

      case "csv":
        // CSVコンテンツはimageUrlで表示
        return <img src={imageUrl || undefined} alt={content.name} style={commonStyle} />;

      default:
        return <Text>サポートされていないコンテンツタイプです</Text>;
    }
  };

  return <Box style={{ width, height, position: "relative", overflow: "hidden" }}>{renderContent()}</Box>;
});

// テキスト表示コンポーネント
interface TextRendererProps {
  textContent: TextContent;
  width: number;
  height: number;
}

function TextRenderer({ textContent, width, height }: TextRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || textContent.scrollType === "none") return;

    const scrollDistance =
      textContent.scrollType === "horizontal" ? container.scrollWidth - width : container.scrollHeight - height;
    const scrollDuration = (scrollDistance / textContent.scrollSpeed) * 1000; // スクロール速度に基づく

    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / scrollDuration, 1);

      if (textContent.scrollType === "horizontal") {
        container.scrollLeft = progress * scrollDistance;
      } else {
        container.scrollTop = progress * scrollDistance;
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [textContent, width, height]);

  const textStyle: CSSProperties = {
    fontFamily: textContent.fontFamily,
    fontSize: `${textContent.fontSize}px`,
    color: textContent.color,
    backgroundColor: textContent.backgroundColor,
    textAlign: textContent.textAlign,
    writingMode: textContent.writingMode === "vertical" ? "vertical-rl" : ("horizontal-tb" as const),
    whiteSpace: textContent.scrollType !== "none" ? "nowrap" : "pre-wrap",
    padding: "16px",
    width: textContent.scrollType === "horizontal" ? "max-content" : "100%",
    height: textContent.scrollType === "vertical" ? "max-content" : "100%",
    minHeight: "100%",
    display: "flex",
    alignItems: textContent.scrollType === "none" ? "center" : "flex-start",
    justifyContent:
      textContent.textAlign === "center" ? "center" : textContent.textAlign === "end" ? "flex-end" : "flex-start",
  };

  return (
    <Box
      ref={containerRef}
      style={{
        width,
        height,
        overflow: textContent.scrollType !== "none" ? "hidden" : "auto",
        backgroundColor: textContent.backgroundColor,
      }}
    >
      <Box style={textStyle}>{textContent.content}</Box>
    </Box>
  );
}
