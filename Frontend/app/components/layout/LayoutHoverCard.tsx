import { Box, Flex, Group, HoverCard, Paper, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { useLayout } from "~/hooks/useLayout";
import type { LayoutIndex, LayoutItem } from "~/types/layout";

interface LayoutHoverCardProps {
  layout: LayoutIndex;
  children: React.ReactNode;
  disabled?: boolean;
}

// レイアウトエディターと同じ色設定
const REGION_COLORS = [
  { bg: "rgba(74, 144, 226, 0.2)", border: "#4a90e2" }, // 青
  { bg: "rgba(82, 196, 26, 0.2)", border: "#52c41a" }, // 緑
  { bg: "rgba(250, 173, 20, 0.2)", border: "#faad14" }, // オレンジ
  { bg: "rgba(245, 34, 45, 0.2)", border: "#f5222d" }, // 赤
];

// レイアウトエディターと同じ座標系定数
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

export const LayoutHoverCard = ({ layout, children, disabled = false }: LayoutHoverCardProps) => {
  const [layoutDetails, setLayoutDetails] = useState<LayoutItem | null>(null);
  const [loading, setLoading] = useState(true);
  const { getLayoutById } = useLayout();

  // HoverCardの幅と高さを設定
  const CARD_WIDTH = 400;
  const scale = CARD_WIDTH / CANVAS_WIDTH;
  const CARD_HEIGHT = CANVAS_HEIGHT * scale; // 225px (16:9のアスペクト比を維持)

  useEffect(() => {
    if (!disabled) {
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
    }
  }, [layout.id, getLayoutById, disabled]);

  if (disabled) {
    return <>{children}</>;
  }

  const renderPreviewContent = () => {
    if (loading) {
      return (
        <Flex w={CARD_WIDTH} h={300} align="center" justify="center">
          <Text size="sm" c="dimmed">
            読み込み中...
          </Text>
        </Flex>
      );
    }

    if (!layoutDetails) {
      return (
        <Flex w={CARD_WIDTH} h={300} direction="column" align="center" justify="center">
          <Text size="xs" c="dimmed" ta="center">
            レイアウトプレビュー未対応
          </Text>
        </Flex>
      );
    }

    return (
      <Paper withBorder p={0} w={CARD_WIDTH}>
        <Box pos="relative">
          {/* レイアウトプレビュー */}
          <Box
            style={{
              height: CARD_HEIGHT,
              width: "100%",
              position: "relative",
              backgroundColor: "#f8f9fa",
              overflow: "hidden",
            }}
          >
            {layoutDetails.regions.map((region, index) => {
              const colors = REGION_COLORS[index % REGION_COLORS.length];
              return (
                <Box
                  key={region.id}
                  style={{
                    position: "absolute",
                    left: `${region.x * scale}px`,
                    top: `${region.y * scale}px`,
                    width: `${region.width * scale}px`,
                    height: `${region.height * scale}px`,
                    backgroundColor: colors.bg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: "2px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "10px",
                    color: colors.border,
                    fontWeight: 700,
                  }}
                >
                  リージョン {index + 1}
                </Box>
              );
            })}
          </Box>

          {/* 向きバッジ */}
          <Box
            pos="absolute"
            top="8px"
            left="8px"
            px="8px"
            py="4px"
            style={{
              backgroundColor:
                layout.orientation === "landscape"
                  ? "#228be6"
                  : layout.orientation === "portrait-right"
                    ? "#fa8c16"
                    : "#722ed1",
              color: "white",
              borderRadius: "4px",
              fontSize: "11px",
              fontWeight: 600,
            }}
          >
            {layout.orientation === "landscape"
              ? "横向き"
              : layout.orientation === "portrait-right"
                ? "縦向き(右)"
                : "縦向き(左)"}
          </Box>
        </Box>

        {/* レイアウト情報 */}
        <Box p="md">
          <Text size="md" fw={600} lineClamp={1} mb="xs">
            {layout.name}
          </Text>

          <Group justify="space-between" mb="xs">
            <Text size="xs" c="dimmed">
              リージョン数: {layout.regionCount}
            </Text>
            <Text size="xs" c="dimmed">
              {new Date(layout.createdAt).toLocaleDateString("ja-JP")}
            </Text>
          </Group>

          {layoutDetails && (
            <Box>
              <Text size="xs" c="dimmed" mb="xs">
                リージョン詳細:
              </Text>
              {layoutDetails.regions.map((region, index) => {
                const colors = REGION_COLORS[index % REGION_COLORS.length];
                return (
                  <Group key={region.id} gap="xs" mb={4}>
                    <Box
                      style={{
                        width: "12px",
                        height: "12px",
                        backgroundColor: colors.bg,
                        border: `1px solid ${colors.border}`,
                        borderRadius: "2px",
                      }}
                    />
                    <Text size="xs">
                      リージョン {index + 1}: {Math.round(region.width)}×{Math.round(region.height)}
                    </Text>
                  </Group>
                );
              })}
            </Box>
          )}
        </Box>
      </Paper>
    );
  };

  return (
    <HoverCard width={CARD_WIDTH} shadow="md" openDelay={300} closeDelay={100} position="right" withArrow>
      <HoverCard.Target>{children}</HoverCard.Target>
      <HoverCard.Dropdown p={0}>{renderPreviewContent()}</HoverCard.Dropdown>
    </HoverCard>
  );
};
