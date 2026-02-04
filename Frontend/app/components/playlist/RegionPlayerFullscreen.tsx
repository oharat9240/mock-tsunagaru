import { Box } from "@mantine/core";
import { memo, useCallback, useEffect, useState } from "react";
import { useContent } from "~/hooks/useContent";
import type { ContentItem } from "~/types/content";
import type { Region } from "~/types/layout";
import type { ContentAssignment, ContentDuration } from "~/types/playlist";
import { logger } from "~/utils/logger";
import { ContentRendererFullscreen } from "./ContentRendererFullscreen";

interface RegionPlayerFullscreenProps {
  region: Region;
  assignment: ContentAssignment;
  isPaused: boolean;
  isMuted: boolean;
}

export const RegionPlayerFullscreen = memo(function RegionPlayerFullscreen({
  region,
  assignment,
  isPaused,
  isMuted,
}: RegionPlayerFullscreenProps) {
  const { getContentById } = useContent();
  const [currentContentIndex, setCurrentContentIndex] = useState(0);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [contentDurations, setContentDurations] = useState<ContentDuration[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // コンテンツとその再生時間を読み込み
  useEffect(() => {
    const loadContents = async () => {
      try {
        const loadedContents: ContentItem[] = [];

        for (const contentId of assignment.contentIds) {
          const content = await getContentById(contentId);
          if (content) {
            loadedContents.push(content);
          } else {
            logger.warn("RegionPlayerFullscreen", `Content not found: ${contentId}`);
          }
        }

        setContents(loadedContents);
        setContentDurations(assignment.contentDurations);
        setCurrentContentIndex(0);
        setIsLoaded(true);
      } catch (error) {
        logger.error("RegionPlayerFullscreen", "Failed to load contents", error);
      }
    };

    if (assignment.contentIds.length > 0) {
      loadContents();
    } else {
      setIsLoaded(true);
    }
  }, [assignment, getContentById]);

  // 現在のコンテンツの再生時間を取得
  const getCurrentDuration = useCallback(() => {
    if (currentContentIndex >= contents.length) return 0;

    const currentContent = contents[currentContentIndex];
    const durationInfo = contentDurations.find((d) => d.contentId === currentContent.id);

    if (durationInfo) {
      return durationInfo.duration;
    }

    // デフォルト時間（動画の場合は実際の尺、その他は10秒）
    if (currentContent.type === "video" && currentContent.fileInfo?.metadata?.duration) {
      return currentContent.fileInfo.metadata.duration;
    }

    return 10; // デフォルト10秒
  }, [currentContentIndex, contents, contentDurations]);

  // 次のコンテンツに進む（ループ対応）
  const handleContentComplete = useCallback(() => {
    setCurrentContentIndex((prev) => {
      if (prev >= contents.length - 1) {
        return 0;
      }
      return prev + 1;
    });
  }, [contents.length]);

  if (!isLoaded) {
    return (
      <Box
        style={{
          position: "absolute",
          left: region.x,
          top: region.y,
          width: region.width,
          height: region.height,
          zIndex: region.zIndex,
          backgroundColor: "#1a1a1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#666",
        }}
      >
        読み込み中...
      </Box>
    );
  }

  if (contents.length === 0) {
    return (
      <Box
        style={{
          position: "absolute",
          left: region.x,
          top: region.y,
          width: region.width,
          height: region.height,
          zIndex: region.zIndex,
          backgroundColor: "#1a1a1a",
          border: "2px dashed #444",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "14px",
          color: "#666",
        }}
      >
        コンテンツが設定されていません
      </Box>
    );
  }

  const currentContent = contents[currentContentIndex];
  const currentDuration = getCurrentDuration();

  return (
    <Box
      style={{
        position: "absolute",
        left: region.x,
        top: region.y,
        width: region.width,
        height: region.height,
        zIndex: region.zIndex,
        overflow: "hidden",
      }}
    >
      <ContentRendererFullscreen
        content={currentContent}
        duration={currentDuration}
        onComplete={handleContentComplete}
        width={region.width}
        height={region.height}
        isPaused={isPaused}
        isMuted={isMuted}
      />
    </Box>
  );
});
