import { Box, Flex, SimpleGrid, Text } from "@mantine/core";
import { useViewportSize } from "@mantine/hooks";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ContentIndex } from "~/types/content";
import { ContentPreview } from "./ContentPreview";

interface ContentGridViewProps {
  contents: ContentIndex[];
  onContentClick?: (content: ContentIndex) => void;
  onContentEdit?: (content: ContentIndex) => void;
  onContentDelete?: (content: ContentIndex) => void;
  onContentDownload?: (content: ContentIndex) => void;
  loading?: boolean;
}

interface GridConfig {
  cols: number;
  spacing: string;
}

// Responsive breakpoints and configurations
const BREAKPOINTS = {
  XL: 1200,
  LG: 992,
  MD: 768,
  SM: 576,
} as const;

const GRID_CONFIGS = {
  XL: { cols: 6, spacing: "md" },
  LG: { cols: 5, spacing: "md" },
  MD: { cols: 4, spacing: "sm" },
  SM: { cols: 3, spacing: "sm" },
  XS: { cols: 2, spacing: "xs" },
} as const;

// Virtual scrolling constants
const INITIAL_LOAD = 24;
const LOAD_MORE_COUNT = 12;
const OBSERVER_ROOT_MARGIN = "100px";
const OBSERVER_THRESHOLD = 0.1;

// Layout constants
const EMPTY_STATE_MIN_HEIGHT = "300px";
const LOADER_TRIGGER_HEIGHT = "20px";

// レスポンシブグリッド設定関数（コンポーネント外で定義）
const getGridConfig = (viewportWidth: number): GridConfig => {
  if (viewportWidth >= BREAKPOINTS.XL) {
    return GRID_CONFIGS.XL;
  }
  if (viewportWidth >= BREAKPOINTS.LG) {
    return GRID_CONFIGS.LG;
  }
  if (viewportWidth >= BREAKPOINTS.MD) {
    return GRID_CONFIGS.MD;
  }
  if (viewportWidth >= BREAKPOINTS.SM) {
    return GRID_CONFIGS.SM;
  }
  return GRID_CONFIGS.XS;
};

export const ContentGridView = memo(
  ({ contents, onContentClick, onContentEdit, onContentDelete, onContentDownload, loading = false }: ContentGridViewProps) => {
    const { width } = useViewportSize();
    const [visibleContents, setVisibleContents] = useState<ContentIndex[]>([]);
    const [hasMore, setHasMore] = useState(true);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    const gridConfig = useMemo(() => getGridConfig(width), [width]);

    // Virtual scrolling uses constants defined above

    useEffect(() => {
      // コンテンツが変更されたら初期化
      setVisibleContents(contents.slice(0, INITIAL_LOAD));
      setHasMore(contents.length > INITIAL_LOAD);
    }, [contents]);

    const loadMoreContents = useCallback(() => {
      const currentLength = visibleContents.length;
      const nextBatch = contents.slice(currentLength, currentLength + LOAD_MORE_COUNT);

      if (nextBatch.length > 0) {
        setVisibleContents((prev) => [...prev, ...nextBatch]);
      }

      if (currentLength + nextBatch.length >= contents.length) {
        setHasMore(false);
      }
    }, [contents, visibleContents.length]);

    useEffect(() => {
      // Intersection Observer設定
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !loading) {
            loadMoreContents();
          }
        },
        {
          rootMargin: OBSERVER_ROOT_MARGIN,
          threshold: OBSERVER_THRESHOLD,
        },
      );

      if (loadMoreRef.current) {
        observerRef.current.observe(loadMoreRef.current);
      }

      return () => {
        if (observerRef.current) {
          observerRef.current.disconnect();
        }
      };
    }, [hasMore, loading, loadMoreContents]);

    const handleContentClick = (content: ContentIndex) => {
      if (onContentClick) {
        onContentClick(content);
      } else {
        // デフォルトの動作: URLの場合は新しいタブで開く
        if (content.type === "youtube" || content.type === "url") {
          if (content.url) {
            window.open(content.url, "_blank", "noopener,noreferrer");
          }
        }
      }
    };

    if (contents.length === 0 && !loading) {
      return (
        <Flex align="center" justify="center" mih={EMPTY_STATE_MIN_HEIGHT} ta="center">
          <div>
            <Text size="lg" c="dimmed" mb="sm">
              コンテンツがありません
            </Text>
            <Text size="sm" c="dimmed">
              ファイルをアップロードするか、URLを追加してください
            </Text>
          </div>
        </Flex>
      );
    }

    return (
      <Box>
        <SimpleGrid cols={gridConfig.cols} spacing={gridConfig.spacing} verticalSpacing={gridConfig.spacing}>
          {visibleContents.map((content) => (
            <ContentPreview
              key={content.id}
              content={content}
              onClick={() => handleContentClick(content)}
              onEdit={onContentEdit ? () => onContentEdit(content) : undefined}
              onDelete={onContentDelete ? () => onContentDelete(content) : undefined}
              onDownload={onContentDownload ? () => onContentDownload(content) : undefined}
            />
          ))}
        </SimpleGrid>

        {/* 無限スクロール用のトリガー要素 */}
        {hasMore && (
          <Box ref={loadMoreRef} h={LOADER_TRIGGER_HEIGHT} mt="20px">
            <Text ta="center" size="sm" c="dimmed">
              {loading ? "読み込み中..." : ""}
            </Text>
          </Box>
        )}

        {/* ローディング中の追加コンテンツ表示 */}
        {loading && hasMore && (
          <SimpleGrid cols={gridConfig.cols} spacing={gridConfig.spacing} verticalSpacing={gridConfig.spacing} mt="md">
            {Array.from({ length: LOAD_MORE_COUNT }, (_, index) => {
              const uniqueKey = `loading-skeleton-${Date.now()}-${Math.random()}-${index}`;
              return (
                <Flex
                  key={uniqueKey}
                  w="100%"
                  bg="gray.1"
                  style={{
                    borderRadius: "4px",
                    aspectRatio: (16 / 9).toString(),
                  }}
                  align="center"
                  justify="center"
                >
                  <Text size="xs" c="dimmed">
                    読み込み中...
                  </Text>
                </Flex>
              );
            })}
          </SimpleGrid>
        )}

        {/* 全件表示完了メッセージ */}
        {!hasMore && visibleContents.length > 0 && (
          <Box mt="xl" mb="md">
            <Text ta="center" size="sm" c="dimmed">
              全 {contents.length} 件のコンテンツを表示しました
            </Text>
          </Box>
        )}
      </Box>
    );
  },
);

ContentGridView.displayName = "ContentGridView";
