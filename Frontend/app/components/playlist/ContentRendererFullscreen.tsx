import { Box, Text } from "@mantine/core";
import type { CSSProperties } from "react";
import { memo, useEffect, useRef, useState } from "react";
import { apiClient } from "~/services/apiClient";
import type { ContentItem, TextContent } from "~/types/content";
import { extractYouTubeVideoId } from "~/types/content";

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
    } else if (content.type === "csv" && content.csvInfo?.renderedImagePath) {
      const url = apiClient.getFileUrl(content.csvInfo.renderedImagePath);
      setImageUrl(url);
    }
  }, [content.type, content.fileInfo, content.csvInfo]);

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

      case "text":
        if (!content.textInfo) return null;
        return (
          <TextRendererFullscreen textContent={content.textInfo} width={width} height={height} isPaused={isPaused} />
        );

      case "youtube": {
        if (!content.urlInfo?.url) return null;
        const videoId = extractYouTubeVideoId(content.urlInfo.url);
        if (!videoId) return null;
        return (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=${isPaused ? 0 : 1}&mute=${isMuted ? 1 : 0}&controls=0&modestbranding=1&rel=0`}
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
        const locationsParam = locations.length === 1 ? `location=${locations[0]}` : `locations=${locations.join(",")}`;
        const weatherUrl = `${apiUrl}/api/image/${weatherType}?${locationsParam}`;

        return <img src={weatherUrl} alt={content.name} style={commonStyle} />;
      }

      case "csv":
        return <img src={imageUrl || undefined} alt={content.name} style={commonStyle} />;

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

// テキスト表示コンポーネント（フルスクリーン版）
interface TextRendererFullscreenProps {
  textContent: TextContent;
  width: number;
  height: number;
  isPaused: boolean;
}

function TextRendererFullscreen({ textContent, width, height, isPaused }: TextRendererFullscreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const scrollPositionRef = useRef<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || textContent.scrollType === "none") return;

    const scrollDistance =
      textContent.scrollType === "horizontal" ? container.scrollWidth - width : container.scrollHeight - height;
    const scrollDuration = (scrollDistance / textContent.scrollSpeed) * 1000;

    let startTime: number | null = null;
    let pauseOffset = 0;

    const animate = (currentTime: number) => {
      if (isPaused) {
        // 一時停止中は現在の位置を保存
        if (startTime !== null) {
          pauseOffset = currentTime - startTime;
        }
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      if (startTime === null) {
        startTime = currentTime - pauseOffset;
      }

      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / scrollDuration, 1);

      if (textContent.scrollType === "horizontal") {
        container.scrollLeft = progress * scrollDistance;
      } else {
        container.scrollTop = progress * scrollDistance;
      }

      scrollPositionRef.current = progress;

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [textContent, width, height, isPaused]);

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
