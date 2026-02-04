import { Box, useMantineColorScheme } from "@mantine/core";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useContent } from "~/hooks/useContent";
import type { ContentItem } from "~/types/content";
import type { Region } from "~/types/layout";
import type { ContentAssignment, ContentDuration } from "~/types/playlist";
import { logger } from "~/utils/logger";
import { ContentRenderer } from "./ContentRenderer";

interface RegionPlayerProps {
  region: Region;
  assignment: ContentAssignment;
  onProgress?: (info: RegionProgressInfo) => void;
}

export interface RegionProgressInfo {
  regionId: string;
  currentContentIndex: number;
  currentContentName: string;
  currentContentProgress: number; // 0-100
  totalProgress: number; // 0-100
  remainingTime: number; // 秒
  totalDuration: number; // 秒
  totalContents: number; // リージョン内の総コンテンツ数
}

export const RegionPlayer = memo(function RegionPlayer({ region, assignment, onProgress }: RegionPlayerProps) {
  const { colorScheme } = useMantineColorScheme();
  const { getContentById } = useContent();
  const [currentContentIndex, setCurrentContentIndex] = useState(0);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [contentDurations, setContentDurations] = useState<ContentDuration[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentContentProgress, setCurrentContentProgress] = useState(0);

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
            logger.warn("RegionPlayer", `Content not found: ${contentId}`);
          }
        }

        setContents(loadedContents);
        setContentDurations(assignment.contentDurations);
        setCurrentContentIndex(0);
        setCurrentContentProgress(0);
        setIsLoaded(true);
      } catch (error) {
        logger.error("RegionPlayer", "Failed to load contents", error);
      }
    };

    if (assignment.contentIds.length > 0) {
      loadContents();
    } else {
      setCurrentContentProgress(0);
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

  // 総再生時間を計算
  const getTotalDuration = useCallback(() => {
    return contents.reduce((total, content, _index) => {
      const durationInfo = contentDurations.find((d) => d.contentId === content.id);
      if (durationInfo) {
        return total + durationInfo.duration;
      }

      // デフォルト時間
      if (content.type === "video" && content.fileInfo?.metadata?.duration) {
        return total + content.fileInfo.metadata.duration;
      }

      return total + 10;
    }, 0);
  }, [contents, contentDurations]);

  // 経過時間を計算
  const getElapsedTime = useCallback(() => {
    let elapsed = 0;
    for (let i = 0; i < currentContentIndex; i++) {
      const content = contents[i];
      const durationInfo = contentDurations.find((d) => d.contentId === content.id);
      if (durationInfo) {
        elapsed += durationInfo.duration;
      } else if (content.type === "video" && content.fileInfo?.metadata?.duration) {
        elapsed += content.fileInfo.metadata.duration;
      } else {
        elapsed += 10;
      }
    }
    return elapsed;
  }, [currentContentIndex, contents, contentDurations]);

  // 次のコンテンツに進む（ループ対応）
  const handleContentComplete = useCallback(() => {
    setCurrentContentIndex((prev) => {
      // 最後のコンテンツの場合は先頭に戻る（ループ）
      if (prev >= contents.length - 1) {
        return 0;
      }
      // 次のコンテンツに進む
      return prev + 1;
    });
    // 次のコンテンツに進む時に進捗をリセット
    setCurrentContentProgress(0);
  }, [contents.length]);

  // コンテンツの進捗を受け取るコールバック
  const handleContentProgress = useCallback((progress: number) => {
    setCurrentContentProgress(progress);
  }, []);

  // プログレス情報を更新をメモ化して再レンダリングを防ぐ
  const stableTotalDuration = useMemo(() => getTotalDuration(), [getTotalDuration]);
  const stableElapsedTime = useMemo(() => getElapsedTime(), [getElapsedTime]);

  useEffect(() => {
    if (!isLoaded || contents.length === 0) return;

    const currentContent = contents[currentContentIndex];
    if (!currentContent) return;

    // 現在のコンテンツの経過時間を計算
    const currentDuration = getCurrentDuration();
    const currentElapsed = (currentContentProgress / 100) * currentDuration;
    const totalElapsed = stableElapsedTime + currentElapsed;

    const progressInfo: RegionProgressInfo = {
      regionId: region.id,
      currentContentIndex,
      currentContentName: currentContent.name,
      currentContentProgress: currentContentProgress,
      totalProgress: stableTotalDuration > 0 ? (totalElapsed / stableTotalDuration) * 100 : 0,
      remainingTime: stableTotalDuration - totalElapsed,
      totalDuration: stableTotalDuration,
      totalContents: contents.length,
    };

    onProgress?.(progressInfo);
  }, [
    currentContentIndex,
    contents,
    region.id,
    isLoaded,
    onProgress,
    stableTotalDuration,
    stableElapsedTime,
    currentContentProgress,
    getCurrentDuration,
  ]);

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
          backgroundColor: colorScheme === "dark" ? "var(--mantine-color-dark-6)" : "var(--mantine-color-gray-1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
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
          backgroundColor: colorScheme === "dark" ? "var(--mantine-color-dark-6)" : "var(--mantine-color-gray-0)",
          border: `2px dashed ${colorScheme === "dark" ? "var(--mantine-color-dark-4)" : "var(--mantine-color-gray-4)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "14px",
          color: colorScheme === "dark" ? "var(--mantine-color-dark-2)" : "var(--mantine-color-gray-6)",
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
      <ContentRenderer
        content={currentContent}
        duration={currentDuration}
        onComplete={handleContentComplete}
        onProgress={handleContentProgress}
        width={region.width}
        height={region.height}
      />
    </Box>
  );
});
