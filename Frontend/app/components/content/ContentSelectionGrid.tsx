import { Box, Checkbox, Flex, SimpleGrid, Text } from "@mantine/core";
import { useViewportSize } from "@mantine/hooks";
import { useCallback } from "react";
import type { ContentIndex } from "~/types/content";
import { ContentPreview } from "./ContentPreview";

interface ContentSelectionGridProps {
  contents: ContentIndex[];
  selectedContentIds: string[];
  onSelectionChange: (contentIds: string[]) => void | Promise<void>;
  loading?: boolean;
  maxItems?: number; // 表示する最大アイテム数
}

interface GridConfig {
  cols: number;
  spacing: string;
}

export const ContentSelectionGrid = ({
  contents,
  selectedContentIds,
  onSelectionChange,
  loading = false,
  maxItems = 50, // デフォルトで50個まで表示
}: ContentSelectionGridProps) => {
  const { width } = useViewportSize();

  // レスポンシブグリッド設定（プレイリスト作成画面用に調整）
  const getGridConfig = (viewportWidth: number): GridConfig => {
    if (viewportWidth >= 1200) {
      return { cols: 4, spacing: "md" };
    }
    if (viewportWidth >= 992) {
      return { cols: 3, spacing: "md" };
    }
    if (viewportWidth >= 768) {
      return { cols: 3, spacing: "sm" };
    }
    if (viewportWidth >= 576) {
      return { cols: 2, spacing: "sm" };
    }
    return { cols: 2, spacing: "xs" };
  };

  const gridConfig = getGridConfig(width);

  // 表示するコンテンツを制限（直接計算）
  const visibleContents = contents.slice(0, maxItems);

  const handleContentToggle = useCallback(
    (contentId: string) => {
      const isSelected = selectedContentIds.includes(contentId);
      let newSelection: string[];

      if (isSelected) {
        // 選択解除: 配列から削除
        newSelection = selectedContentIds.filter((id) => id !== contentId);
      } else {
        // 選択: 配列の末尾に追加（順序を保持）
        newSelection = [...selectedContentIds, contentId];
      }

      onSelectionChange(newSelection);
    },
    [selectedContentIds, onSelectionChange],
  );

  if (contents.length === 0 && !loading) {
    return (
      <Flex align="center" justify="center" mih="200px" ta="center">
        <div>
          <Text size="lg" c="dimmed" mb="sm">
            利用可能なコンテンツがありません
          </Text>
          <Text size="sm" c="dimmed">
            先にコンテンツを追加してください
          </Text>
        </div>
      </Flex>
    );
  }

  return (
    <Box>
      {contents.length > maxItems && (
        <Text size="sm" c="dimmed" mb="md" ta="center">
          {contents.length}個中{maxItems}個のコンテンツを表示中
        </Text>
      )}

      <SimpleGrid cols={gridConfig.cols} spacing={gridConfig.spacing} verticalSpacing={gridConfig.spacing}>
        {visibleContents.map((content) => {
          const isSelected = selectedContentIds.includes(content.id);
          const selectionOrder = isSelected ? selectedContentIds.indexOf(content.id) + 1 : null;

          return (
            <Box key={content.id} pos="relative">
              {/* 順序番号またはチェックボックスオーバーレイ */}
              <Box
                pos="absolute"
                top="8px"
                right="8px"
                style={{
                  zIndex: 10,
                  backgroundColor: isSelected ? "#4a90e2" : "rgba(255, 255, 255, 0.9)",
                  borderRadius: "50%",
                  padding: "4px",
                  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                  minWidth: "24px",
                  minHeight: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
                onClick={() => handleContentToggle(content.id)}
              >
                {isSelected ? (
                  <Text size="xs" c="white" fw={600}>
                    {selectionOrder}
                  </Text>
                ) : (
                  <Checkbox
                    checked={false}
                    onChange={() => handleContentToggle(content.id)}
                    size="sm"
                    color="blue"
                    style={{ pointerEvents: "none" }}
                  />
                )}
              </Box>

              {/* 選択状態のオーバーレイ */}
              {isSelected && (
                <Box
                  pos="absolute"
                  top="0"
                  left="0"
                  right="0"
                  bottom="0"
                  style={{
                    zIndex: 5,
                    backgroundColor: "rgba(74, 144, 226, 0.2)",
                    border: "2px solid #4a90e2",
                    borderRadius: "4px",
                    pointerEvents: "none",
                  }}
                />
              )}

              {/* コンテンツプレビュー */}
              <Box
                style={{
                  cursor: "pointer",
                  transition: "transform 0.2s ease",
                  transform: isSelected ? "scale(0.98)" : "scale(1)",
                }}
                onClick={() => handleContentToggle(content.id)}
              >
                <ContentPreview content={content} aspectRatio={16 / 9} />
              </Box>
            </Box>
          );
        })}
      </SimpleGrid>

      {/* ローディング表示 */}
      {loading && (
        <Flex align="center" justify="center" p="xl">
          <Text size="sm" c="dimmed">
            読み込み中...
          </Text>
        </Flex>
      )}
    </Box>
  );
};
