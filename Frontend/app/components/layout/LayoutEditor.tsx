import {
  ActionIcon,
  Box,
  Button,
  Flex,
  Group,
  NumberInput,
  Popover,
  Stack,
  Switch,
  Text,
  useMantineColorScheme,
} from "@mantine/core";
import { IconEdit, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import Moveable from "react-moveable";
import type { Orientation, Region } from "~/types/layout";

interface LayoutEditorProps {
  regions: Region[];
  onRegionsChange: (regions: Region[]) => void;
  orientation?: Orientation;
  canvasWidth?: number;
  canvasHeight?: number;
}

const BASE_CANVAS_WIDTH = 1920;
const BASE_CANVAS_HEIGHT = 1080;

// orientationに基づいてキャンバスの実際の幅と高さを取得
const getCanvasDimensions = (orientation: Orientation = "landscape") => {
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
const GRID_SIZE = 20;
const GRID_LINE_SPACING = 60; // グリッドライン間隔（仮想座標系での60px）

// リージョンの色設定
const REGION_COLORS = [
  { bg: "rgba(74, 144, 226, 0.2)", border: "#4a90e2", bgSelected: "rgba(74, 144, 226, 0.3)" }, // 青
  { bg: "rgba(82, 196, 26, 0.2)", border: "#52c41a", bgSelected: "rgba(82, 196, 26, 0.3)" }, // 緑
  { bg: "rgba(250, 173, 20, 0.2)", border: "#faad14", bgSelected: "rgba(250, 173, 20, 0.3)" }, // オレンジ
  { bg: "rgba(245, 34, 45, 0.2)", border: "#f5222d", bgSelected: "rgba(245, 34, 45, 0.3)" }, // 赤
];

// グリッドにスナップする関数
const snapToGrid = (value: number, gridSize: number = GRID_SIZE): number => {
  return Math.round(value / gridSize) * gridSize;
};

// リージョンの色を取得する関数
const getRegionColor = (regionIndex: number, isSelected = false) => {
  const color = REGION_COLORS[regionIndex % REGION_COLORS.length];
  return {
    backgroundColor: isSelected ? color.bgSelected : color.bg,
    borderColor: color.border,
  };
};

// グリッドラインを生成する関数
const generateGridLines = (
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
  isDark: boolean,
  virtualCanvasWidth: number,
  virtualCanvasHeight: number,
) => {
  const lines = [];
  const gridColor = isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.1)";

  // 縦のグリッドライン
  for (let x = 0; x <= virtualCanvasWidth; x += GRID_LINE_SPACING) {
    lines.push(
      <Box
        key={`vertical-${x}`}
        pos="absolute"
        bg={gridColor}
        style={{
          left: x * scale,
          top: 0,
          width: "1px",
          height: canvasHeight,
          pointerEvents: "none",
        }}
      />,
    );
  }

  // 横のグリッドライン
  for (let y = 0; y <= virtualCanvasHeight; y += GRID_LINE_SPACING) {
    lines.push(
      <Box
        key={`horizontal-${y}`}
        pos="absolute"
        bg={gridColor}
        style={{
          left: 0,
          top: y * scale,
          width: canvasWidth,
          height: "1px",
          pointerEvents: "none",
        }}
      />,
    );
  }

  return lines;
};

export const LayoutEditor = ({
  regions,
  onRegionsChange,
  orientation = "landscape",
  canvasWidth,
  canvasHeight,
}: LayoutEditorProps) => {
  const { colorScheme } = useMantineColorScheme();
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [editingRegion, setEditingRegion] = useState<string | null>(null);
  const [tempValues, setTempValues] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [containerSize, setContainerSize] = useState({ width: 600, height: 338 });
  const [freeTransform, setFreeTransform] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [_dragStartSelection, setDragStartSelection] = useState<string | null>(null);
  const [hasActuallyDragged, setHasActuallyDragged] = useState(false);
  const [isContainerReady, setIsContainerReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const outerContainerRef = useRef<HTMLDivElement>(null);

  // orientationに基づいて仮想キャンバスのサイズを取得（useMemoで安定化）
  const virtualCanvasDimensions = React.useMemo(() => getCanvasDimensions(orientation), [orientation]);

  // コンテナサイズを監視（固定サイズが指定されていない場合のみ）
  useEffect(() => {
    // 固定サイズが指定されている場合は動的サイズ計算をスキップ
    if (canvasWidth && canvasHeight) {
      setIsContainerReady(true);
      return;
    }

    const updateSize = () => {
      if (outerContainerRef.current) {
        const rect = outerContainerRef.current.getBoundingClientRect();
        // Stackコンテナの幅をそのまま使用（パディングは既に計算済み）
        const availableWidth = rect.width;
        const aspectRatio = virtualCanvasDimensions.height / virtualCanvasDimensions.width;
        const calculatedHeight = availableWidth * aspectRatio;

        setContainerSize({
          width: availableWidth,
          height: Math.min(calculatedHeight, 280), // 最大高さ制限をさらに縮小
        });
        setIsContainerReady(true);
      }
    };

    // ResizeObserverを使用して即座にサイズ検出
    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });

    if (outerContainerRef.current) {
      resizeObserver.observe(outerContainerRef.current);
      // 初期サイズを即座に設定
      updateSize();
    }

    window.addEventListener("resize", updateSize);
    return () => {
      window.removeEventListener("resize", updateSize);
      resizeObserver.disconnect();
    };
  }, [canvasWidth, canvasHeight, virtualCanvasDimensions]);

  // 提供されたサイズまたは動的サイズを使用
  const actualCanvasWidth = canvasWidth || containerSize.width;
  const actualCanvasHeight = canvasHeight || containerSize.height;

  // スケール計算 - コンテナの幅を最大限活用
  const scaleByWidth = actualCanvasWidth / virtualCanvasDimensions.width;
  const heightByWidth = virtualCanvasDimensions.height * scaleByWidth;

  // 高さ制限がある場合は高さベースでも計算
  const scaleByHeight = actualCanvasHeight / virtualCanvasDimensions.height;
  const _widthByHeight = virtualCanvasDimensions.width * scaleByHeight;

  // 両方の制約内に収まる最大スケールを選択
  const scale = heightByWidth <= actualCanvasHeight ? scaleByWidth : scaleByHeight;

  // 実際の表示サイズ
  const displayWidth = virtualCanvasDimensions.width * scale;
  const displayHeight = virtualCanvasDimensions.height * scale;

  const updateRegion = useCallback(
    (id: string, updates: Partial<Region>) => {
      const updatedRegions = regions.map((region) => (region.id === id ? { ...region, ...updates } : region));
      onRegionsChange(updatedRegions);
    },
    [regions, onRegionsChange],
  );

  const addRegion = useCallback(() => {
    if (regions.length >= 4) return;

    const newRegion: Region = {
      id: crypto.randomUUID(),
      x: 100,
      y: 100,
      width: virtualCanvasDimensions.width / 2,
      height: virtualCanvasDimensions.height / 2,
      zIndex: regions.length, // 新しいリージョンは最前面に
    };

    onRegionsChange([...regions, newRegion]);
  }, [regions, onRegionsChange, virtualCanvasDimensions]);

  const deleteRegion = useCallback(
    (id: string) => {
      onRegionsChange(regions.filter((region) => region.id !== id));
      setSelectedRegion(null);
      setEditingRegion(null);
    },
    [regions, onRegionsChange],
  );

  const handleEditOpen = (region: Region) => {
    setEditingRegion(region.id);
    setTempValues({
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
    });
  };

  const handleEditSave = () => {
    if (!editingRegion) return;

    updateRegion(editingRegion, tempValues);
    setEditingRegion(null);
  };

  const handleEditCancel = () => {
    setEditingRegion(null);
  };

  const selectedRegionData = selectedRegion ? regions.find((r) => r.id === selectedRegion) : null;

  // Force re-render of Moveable components when container is ready
  useEffect(() => {
    if (containerRef.current && isContainerReady) {
      // Force a re-render by updating a dummy state or using forceUpdate
      // This ensures Moveable components are properly initialized with correct container dimensions
    }
  }, [isContainerReady]);

  return (
    <Stack gap="xs" ref={outerContainerRef}>
      <Group justify="space-between">
        <Text size="sm" fw={500}>
          レイアウトエディター ({virtualCanvasDimensions.width}×{virtualCanvasDimensions.height})
        </Text>
        <Group gap="md">
          <Switch
            label="無段階変形"
            size="sm"
            checked={freeTransform}
            onChange={(event) => setFreeTransform(event.currentTarget.checked)}
          />
          <Button leftSection={<IconPlus size={16} />} size="xs" onClick={addRegion} disabled={regions.length >= 4}>
            リージョン矩形を追加 ({regions.length}/4)
          </Button>
        </Group>
      </Group>

      <div
        ref={containerRef}
        role="application"
        style={{
          position: "relative",
          width: displayWidth,
          height: displayHeight,
          border: `2px solid ${colorScheme === "dark" ? "var(--mantine-color-dark-4)" : "var(--mantine-color-gray-4)"}`,
          backgroundColor: colorScheme === "dark" ? "var(--mantine-color-dark-7)" : "var(--mantine-color-gray-0)",
          overflow: "hidden",
        }}
        onClick={() => setSelectedRegion(null)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            setSelectedRegion(null);
          }
        }}
      >
        {/* グリッドライン */}
        {generateGridLines(
          displayWidth,
          displayHeight,
          scale,
          colorScheme === "dark",
          virtualCanvasDimensions.width,
          virtualCanvasDimensions.height,
        )}

        {[...regions]
          .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
          .map((region) => {
            const index = regions.findIndex((r) => r.id === region.id);
            const isSelected = selectedRegion === region.id;
            const colors = getRegionColor(index, isSelected);

            return (
              <div key={region.id} style={{ position: "absolute", zIndex: region.zIndex || 0 }}>
                {/* 矩形 */}
                {/* biome-ignore lint/a11y/useSemanticElements: Avoiding button nesting issue */}
                <div
                  role="button"
                  tabIndex={0}
                  id={`region-${region.id}`}
                  style={{
                    position: "absolute",
                    left: region.x * scale,
                    top: region.y * scale,
                    width: region.width * scale,
                    height: region.height * scale,
                    backgroundColor: colors.backgroundColor,
                    border: isSelected ? `2px solid ${colors.borderColor}` : `1px solid ${colors.borderColor}`,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    // 実際にドラッグが発生しなかった場合のみ選択/選択解除を処理
                    if (!isDragging && !hasActuallyDragged) {
                      // 既に選択されている場合は選択解除、そうでなければ選択
                      if (selectedRegion === region.id) {
                        setSelectedRegion(null);
                      } else {
                        setSelectedRegion(region.id);
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!isDragging && !hasActuallyDragged) {
                        if (selectedRegion === region.id) {
                          setSelectedRegion(null);
                        } else {
                          setSelectedRegion(region.id);
                        }
                      }
                    }
                  }}
                >
                  <Text
                    size="xs"
                    c={colorScheme === "dark" ? "white" : "white"}
                    fw={700}
                    style={{
                      textShadow:
                        colorScheme === "dark" ? "1px 1px 2px rgba(0,0,0,0.8)" : "1px 1px 2px rgba(0,0,0,0.6)",
                    }}
                  >
                    リージョン {index + 1}
                  </Text>

                  {/* 編集ボタン */}
                  <Box pos="absolute" top={4} right={4}>
                    <Group gap={2}>
                      <Popover
                        opened={editingRegion === region.id}
                        onClose={handleEditCancel}
                        position="bottom-end"
                        withArrow
                      >
                        <Popover.Target>
                          <ActionIcon
                            size="xs"
                            variant="filled"
                            color="blue"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditOpen(region);
                            }}
                          >
                            <IconEdit size={10} />
                          </ActionIcon>
                        </Popover.Target>
                        <Popover.Dropdown>
                          <Stack gap="xs" miw={200} pos="relative">
                            {/* 閉じるボタン */}
                            <ActionIcon
                              size="xs"
                              variant="subtle"
                              color="gray"
                              onClick={handleEditCancel}
                              style={{
                                position: "absolute",
                                top: "4px",
                                right: "4px",
                                zIndex: 10,
                              }}
                            >
                              <IconX size={12} />
                            </ActionIcon>

                            <Text size="sm" fw={500}>
                              位置とサイズ
                            </Text>
                            <Group gap="xs">
                              <NumberInput
                                label="X"
                                size="xs"
                                min={0}
                                max={virtualCanvasDimensions.width - tempValues.width}
                                value={tempValues.x}
                                onChange={(value) => setTempValues((prev) => ({ ...prev, x: Number(value) || 0 }))}
                              />
                              <NumberInput
                                label="Y"
                                size="xs"
                                min={0}
                                max={virtualCanvasDimensions.height - tempValues.height}
                                value={tempValues.y}
                                onChange={(value) => setTempValues((prev) => ({ ...prev, y: Number(value) || 0 }))}
                              />
                            </Group>
                            <Group gap="xs">
                              <NumberInput
                                label="幅"
                                size="xs"
                                min={1}
                                max={virtualCanvasDimensions.width - tempValues.x}
                                value={tempValues.width}
                                onChange={(value) => setTempValues((prev) => ({ ...prev, width: Number(value) || 1 }))}
                              />
                              <NumberInput
                                label="高さ"
                                size="xs"
                                min={1}
                                max={virtualCanvasDimensions.height - tempValues.y}
                                value={tempValues.height}
                                onChange={(value) => setTempValues((prev) => ({ ...prev, height: Number(value) || 1 }))}
                              />
                            </Group>
                            <Group gap="xs" mt="xs">
                              <Button size="xs" onClick={handleEditSave}>
                                保存
                              </Button>
                              <Button size="xs" variant="light" onClick={handleEditCancel}>
                                キャンセル
                              </Button>
                            </Group>
                          </Stack>
                        </Popover.Dropdown>
                      </Popover>

                      <ActionIcon
                        size="xs"
                        variant="filled"
                        color="red"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteRegion(region.id);
                        }}
                      >
                        <IconTrash size={10} />
                      </ActionIcon>
                    </Group>
                  </Box>
                </div>

                {/* Moveable - 常に有効、選択時のみリサイズハンドルを表示 */}
                {containerRef.current && scale > 0 && isContainerReady && (
                  <Moveable
                    key={`${region.id}-${scale}-${displayWidth}-${displayHeight}`}
                    target={`#region-${region.id}`}
                    container={containerRef.current}
                    draggable
                    resizable={selectedRegion === region.id}
                    keepRatio={false}
                    throttleDrag={0}
                    throttleResize={0}
                    onDragStart={() => {
                      // ドラッグ開始時の選択状態を記録するが、まだ選択状態は変更しない
                      setDragStartSelection(selectedRegion);
                      setIsDragging(true);
                      setHasActuallyDragged(false);
                    }}
                    onDrag={(e) => {
                      // 実際にドラッグが開始された時点で選択状態にする
                      if (!hasActuallyDragged) {
                        setHasActuallyDragged(true);
                        setSelectedRegion(region.id);
                      }

                      const rawX = e.left / scale;
                      const rawY = e.top / scale;
                      const newX = freeTransform
                        ? Math.max(0, Math.min(virtualCanvasDimensions.width - region.width, Math.round(rawX)))
                        : Math.max(0, Math.min(virtualCanvasDimensions.width - region.width, snapToGrid(rawX)));
                      const newY = freeTransform
                        ? Math.max(0, Math.min(virtualCanvasDimensions.height - region.height, Math.round(rawY)))
                        : Math.max(0, Math.min(virtualCanvasDimensions.height - region.height, snapToGrid(rawY)));

                      e.target.style.left = `${newX * scale}px`;
                      e.target.style.top = `${newY * scale}px`;

                      // リアルタイム更新
                      updateRegion(region.id, { x: newX, y: newY });
                    }}
                    onDragEnd={() => {
                      // ドラッグ終了時にフラグをリセット（選択状態は維持）
                      setIsDragging(false);
                      setDragStartSelection(null);
                      setHasActuallyDragged(false);
                    }}
                    onResizeStart={() => {
                      // リサイズ開始時に自動選択（既に選択されているはずだが念のため）
                      setSelectedRegion(region.id);
                    }}
                    onResize={(e) => {
                      // 現在の位置を取得
                      let newX = region.x;
                      let newY = region.y;

                      // リサイズの方向を取得 (direction は [horizontal, vertical] の配列)
                      const direction = e.direction;

                      // 新しいサイズを計算
                      const rawWidth = e.width / scale;
                      const rawHeight = e.height / scale;

                      // 左側からリサイズしている場合、X座標を調整
                      if (direction[0] === -1) {
                        const deltaWidth = (region.width * scale - e.width) / scale;
                        newX = freeTransform
                          ? Math.max(0, Math.min(region.x + region.width - 1, Math.round(region.x + deltaWidth)))
                          : Math.max(
                              0,
                              Math.min(region.x + region.width - GRID_SIZE, snapToGrid(region.x + deltaWidth)),
                            );
                      }

                      // 上側からリサイズしている場合、Y座標を調整
                      if (direction[1] === -1) {
                        const deltaHeight = (region.height * scale - e.height) / scale;
                        newY = freeTransform
                          ? Math.max(0, Math.min(region.y + region.height - 1, Math.round(region.y + deltaHeight)))
                          : Math.max(
                              0,
                              Math.min(region.y + region.height - GRID_SIZE, snapToGrid(region.y + deltaHeight)),
                            );
                      }

                      // 新しい幅と高さを計算
                      const newWidth = freeTransform
                        ? Math.max(1, Math.min(virtualCanvasDimensions.width - newX, Math.round(rawWidth)))
                        : Math.max(GRID_SIZE, Math.min(virtualCanvasDimensions.width - newX, snapToGrid(rawWidth)));
                      const newHeight = freeTransform
                        ? Math.max(1, Math.min(virtualCanvasDimensions.height - newY, Math.round(rawHeight)))
                        : Math.max(GRID_SIZE, Math.min(virtualCanvasDimensions.height - newY, snapToGrid(rawHeight)));

                      // スタイルを更新
                      e.target.style.left = `${newX * scale}px`;
                      e.target.style.top = `${newY * scale}px`;
                      e.target.style.width = `${newWidth * scale}px`;
                      e.target.style.height = `${newHeight * scale}px`;

                      // リアルタイム更新
                      updateRegion(region.id, {
                        x: newX,
                        y: newY,
                        width: newWidth,
                        height: newHeight,
                      });
                    }}
                    onResizeEnd={() => {
                      // リアルタイム更新により不要
                    }}
                  />
                )}
              </div>
            );
          })}
      </div>

      {/* 選択中のリージョン情報 - コンパクト */}
      <Flex
        align="center"
        h={32}
        px="xs"
        style={{
          backgroundColor: selectedRegionData
            ? colorScheme === "dark"
              ? "var(--mantine-color-blue-9)"
              : "var(--mantine-color-blue-0)"
            : colorScheme === "dark"
              ? "var(--mantine-color-dark-6)"
              : "var(--mantine-color-gray-0)",
          borderRadius: "4px",
          fontSize: "11px",
          border: `1px solid ${colorScheme === "dark" ? "var(--mantine-color-dark-4)" : "var(--mantine-color-gray-3)"}`,
          flexShrink: 0,
        }}
      >
        <Text size="xs" fw={500} c={selectedRegionData ? undefined : "dimmed"}>
          {selectedRegionData
            ? `リージョン ${regions.findIndex((r) => r.id === selectedRegionData.id) + 1}: X:${selectedRegionData.x}, Y:${selectedRegionData.y}, 幅:${selectedRegionData.width}, 高さ:${selectedRegionData.height}`
            : "リージョンを選択してください"}
        </Text>
      </Flex>
    </Stack>
  );
};
