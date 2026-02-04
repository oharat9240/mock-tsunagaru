import { Box, Flex, Paper, Text, useMantineColorScheme } from "@mantine/core";
import { useCallback } from "react";
import type { LayoutItem } from "~/types/layout";

interface InteractiveLayoutPreviewProps {
  layout: LayoutItem;
  selectedRegionId?: string | null;
  onRegionClick?: (regionId: string) => void;
  assignedContentCounts?: Record<string, number>;
  canvasWidth?: number;
  canvasHeight?: number;
}

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

// リージョンの色設定
const REGION_COLORS = [
  { bg: "rgba(74, 144, 226, 0.2)", border: "#4a90e2", bgSelected: "rgba(74, 144, 226, 0.4)" }, // 青
  { bg: "rgba(82, 196, 26, 0.2)", border: "#52c41a", bgSelected: "rgba(82, 196, 26, 0.4)" }, // 緑
  { bg: "rgba(250, 173, 20, 0.2)", border: "#faad14", bgSelected: "rgba(250, 173, 20, 0.4)" }, // オレンジ
  { bg: "rgba(245, 34, 45, 0.2)", border: "#f5222d", bgSelected: "rgba(245, 34, 45, 0.4)" }, // 赤
];

// リージョンの色を取得する関数
const getRegionColor = (regionIndex: number, isSelected = false) => {
  const color = REGION_COLORS[regionIndex % REGION_COLORS.length];
  return {
    backgroundColor: isSelected ? color.bgSelected : color.bg,
    borderColor: color.border,
  };
};

export const InteractiveLayoutPreview = ({
  layout,
  selectedRegionId,
  onRegionClick,
  assignedContentCounts = {},
  canvasWidth = 600,
  canvasHeight = 338,
}: InteractiveLayoutPreviewProps) => {
  const { colorScheme } = useMantineColorScheme();
  const canvasDimensions = getCanvasDimensions(layout.orientation);
  const scale = Math.min(canvasWidth / canvasDimensions.width, canvasHeight / canvasDimensions.height);
  const actualCanvasWidth = canvasDimensions.width * scale;
  const actualCanvasHeight = canvasDimensions.height * scale;

  const handleRegionClick = useCallback(
    (regionId: string) => {
      if (onRegionClick) {
        onRegionClick(regionId);
      }
    },
    [onRegionClick],
  );

  return (
    <Box>
      <Text size="sm" mb="xs" ta="center" c="dimmed">
        {layout.name} (
        {layout.orientation === "landscape"
          ? "横向き"
          : layout.orientation === "portrait-right"
            ? "縦向き(右)"
            : "縦向き(左)"}{" "}
        - {layout.regions.length}リージョン)
      </Text>

      <Paper
        withBorder
        p="md"
        pos="relative"
        w={actualCanvasWidth}
        h={actualCanvasHeight}
        mx="auto"
        bg="gray.0"
        style={{ overflow: "hidden" }}
      >
        {/* キャンバス背景 */}
        <Box
          pos="absolute"
          top={0}
          left={0}
          w={actualCanvasWidth}
          h={actualCanvasHeight}
          bg={colorScheme === "dark" ? "dark.6" : "gray.1"}
          style={{ borderRadius: "4px" }}
        />

        {/* リージョン表示 */}
        {layout.regions.map((region, index) => {
          const isSelected = selectedRegionId === region.id;
          const contentCount = assignedContentCounts[region.id] || 0;
          const regionColor = getRegionColor(index, isSelected);

          return (
            <Flex
              key={region.id}
              direction="column"
              align="center"
              justify="center"
              style={{
                position: "absolute",
                left: region.x * scale,
                top: region.y * scale,
                width: region.width * scale,
                height: region.height * scale,
                backgroundColor: regionColor.backgroundColor,
                border: `2px solid ${regionColor.borderColor}`,
                borderRadius: "4px",
                cursor: onRegionClick ? "pointer" : "default",
                transition: "all 0.2s ease",
                zIndex: isSelected ? 10 : 5,
                boxShadow: isSelected ? `0 0 0 2px ${regionColor.borderColor}` : "none",
              }}
              onClick={() => handleRegionClick(region.id)}
            >
              <Text size="xs" fw={600} c={isSelected ? "dark" : "dimmed"} ta="center" style={{ pointerEvents: "none" }}>
                リージョン {index + 1}
              </Text>
              <Text size="xs" c={isSelected ? "dark" : "dimmed"} ta="center" style={{ pointerEvents: "none" }}>
                {region.width} × {region.height}
              </Text>
              {contentCount > 0 && (
                <Text size="xs" fw={600} c="blue" ta="center" style={{ pointerEvents: "none" }}>
                  {contentCount}個のコンテンツ
                </Text>
              )}
            </Flex>
          );
        })}

        {/* 選択状態のガイド */}
        {!selectedRegionId && onRegionClick && layout.regions.length > 0 && (
          <Box
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
              pointerEvents: "none",
              zIndex: 1,
            }}
          >
            <Text size="sm" c="dimmed" fw={500}>
              リージョンをクリックして選択
            </Text>
          </Box>
        )}
      </Paper>
    </Box>
  );
};
