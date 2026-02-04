import { ActionIcon, Box, Flex, Group, Paper, Text, Tooltip } from "@mantine/core";
import { IconEdit, IconTrash } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { useLayout } from "~/hooks/useLayout";
import type { LayoutIndex, LayoutItem } from "~/types/layout";

interface LayoutPreviewProps {
  layout: LayoutIndex;
  onClick?: () => void;
  onEdit?: (layout: LayoutIndex) => void;
  onDelete?: (layout: LayoutIndex) => void;
}

// レイアウトエディターと同じ色設定
const REGION_COLORS = [
  { bg: "rgba(74, 144, 226, 0.2)", border: "#4a90e2" }, // 青
  { bg: "rgba(82, 196, 26, 0.2)", border: "#52c41a" }, // 緑
  { bg: "rgba(250, 173, 20, 0.2)", border: "#faad14" }, // オレンジ
  { bg: "rgba(245, 34, 45, 0.2)", border: "#f5222d" }, // 赤
];

// レイアウトエディターと同じ座標系定数
const BASE_CANVAS_WIDTH = 1920;
const BASE_CANVAS_HEIGHT = 1080;

// orientationに基づいてキャンバスの実際の幅と高さを取得
const getCanvasDimensions = (orientation: string) => {
  if (orientation === "portrait-right" || orientation === "portrait-left") {
    return {
      width: BASE_CANVAS_HEIGHT, // 縦向きの場合は幅と高さを入れ替え
      height: BASE_CANVAS_WIDTH,
    };
  }
  return {
    width: BASE_CANVAS_WIDTH,
    height: BASE_CANVAS_HEIGHT,
  };
};

export const LayoutPreview = ({ layout, onClick, onEdit, onDelete }: LayoutPreviewProps) => {
  const [layoutDetails, setLayoutDetails] = useState<LayoutItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [containerWidth, setContainerWidth] = useState(200); // デフォルト値
  const containerRef = useRef<HTMLDivElement>(null);
  const { getLayoutById } = useLayout();

  // コンテナサイズを監視
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerWidth(rect.width);
      }
    };

    // 初期サイズ設定
    updateSize();

    // リサイズイベントリスナー
    window.addEventListener("resize", updateSize);

    // ResizeObserver for more accurate container size changes
    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateSize);
      resizeObserver.disconnect();
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: layout.updatedAt is intentionally included to trigger re-fetch when layout is updated
  useEffect(() => {
    const loadLayoutDetails = async () => {
      try {
        setLoading(true);
        const details = await getLayoutById(layout.id);
        setLayoutDetails(details);
      } catch (error) {
        console.error("Failed to load layout details:", error);
      } finally {
        setLoading(false);
      }
    };

    loadLayoutDetails();
  }, [layout.id, layout.updatedAt, getLayoutById]);

  // プレビューのアスペクト比とサイズ設定（動的幅計算）
  const canvasDimensions = getCanvasDimensions(layout.orientation);
  const previewWidth = containerWidth;
  const scale = previewWidth / canvasDimensions.width; // 動的スケール
  const previewHeight = canvasDimensions.height * scale; // 正確な高さ
  const totalHeight = Math.round(previewHeight) + 60; // プレビュー + 情報エリア

  const renderRegions = () => {
    if (!layoutDetails || loading) {
      return (
        <Flex w="100%" h="100%" align="center" justify="center" bg="gray.0" c="gray.5" fz="xs">
          {loading ? "読み込み中..." : "プレビュー未対応"}
        </Flex>
      );
    }

    // レイアウトエディターと同じ座標系でスケーリング
    // 1920×1080の絶対座標系をプレビューサイズに合わせてスケーリング
    // 統一スケールを使用してアスペクト比を正確に保持

    return (
      <Box w="100%" h="100%" pos="relative" bg="#f8f9fa">
        {layoutDetails.regions.map((region, index) => {
          const colors = REGION_COLORS[index % REGION_COLORS.length];
          return (
            <Flex
              key={region.id}
              pos="absolute"
              bg={colors.bg}
              fz="8px"
              c="white"
              fw={700}
              align="center"
              justify="center"
              style={{
                left: `${region.x * scale}px`,
                top: `${region.y * scale}px`,
                width: `${region.width * scale}px`,
                height: `${region.height * scale}px`,
                border: `1px solid ${colors.border}`,
                borderRadius: "2px",
                textShadow: "1px 1px 2px rgba(0,0,0,0.6)",
              }}
            >
              リージョン {index + 1}
            </Flex>
          );
        })}
      </Box>
    );
  };

  const getOrientationBadgeColor = () => {
    switch (layout.orientation) {
      case "landscape":
        return "#228be6"; // 青
      case "portrait-right":
        return "#fa8c16"; // オレンジ
      case "portrait-left":
        return "#722ed1"; // 紫
      default:
        return "#40c057";
    }
  };

  return (
    <Paper
      ref={containerRef}
      withBorder
      p={0}
      w="100%"
      h={totalHeight}
      style={{
        cursor: onClick ? "pointer" : "default",
      }}
      onClick={onClick}
    >
      <Box pos="relative">
        {/* レイアウトプレビュー */}
        <Box
          style={{
            height: `${previewHeight}px`,
            width: `${previewWidth}px`,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {renderRegions()}
        </Box>
      </Box>

      {/* レイアウト情報 */}
      <Box p="xs" h="60px" style={{ overflow: "hidden" }}>
        <Tooltip label={layout.name} disabled={layout.name.length <= 20}>
          <Text size="sm" fw={500} lineClamp={1}>
            {layout.name}
          </Text>
        </Tooltip>

        <Group justify="space-between" align="center" mt={4}>
          <Group gap="xs">
            <Text size="xs" c="dimmed">
              {new Date(layout.createdAt).toLocaleDateString("ja-JP")}
            </Text>
            <Text
              size="xs"
              style={{
                color: getOrientationBadgeColor(),
                fontWeight: 500,
              }}
            >
              {layout.orientation === "landscape"
                ? "横向き"
                : layout.orientation === "portrait-right"
                  ? "縦向き(右)"
                  : "縦向き(左)"}
            </Text>
          </Group>

          <Group gap="xs">
            {onEdit && (
              <ActionIcon
                size="xs"
                variant="subtle"
                color="blue"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(layout);
                }}
                aria-label="編集"
              >
                <IconEdit size={12} />
              </ActionIcon>
            )}
            {onDelete && (
              <ActionIcon
                size="xs"
                variant="subtle"
                color="red"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(layout);
                }}
                aria-label="削除"
              >
                <IconTrash size={12} />
              </ActionIcon>
            )}
          </Group>
        </Group>
      </Box>
    </Paper>
  );
};
