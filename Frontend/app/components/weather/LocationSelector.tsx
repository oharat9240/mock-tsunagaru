import { Box, Flex, Group, MultiSelect, Paper, Stack, Text } from "@mantine/core";
import { IconGripVertical, IconX } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useMemo, useState } from "react";
import { WEATHER_LOCATIONS } from "~/data/weatherLocations";

interface LocationSelectorProps {
  selectedLocations: string[]; // 選択された地点コードの配列
  onLocationsChange: (locations: string[]) => void;
  maxLocations?: number;
}

export const LocationSelector = ({ selectedLocations, onLocationsChange, maxLocations = 5 }: LocationSelectorProps) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // MultiSelect用のデータ形式に変換（グループ化された形式）
  const locationData = useMemo(() => {
    // 地域ごとにグループ化
    const groups = WEATHER_LOCATIONS.reduce(
      (acc, location) => {
        if (!acc[location.region]) {
          acc[location.region] = [];
        }
        acc[location.region].push({
          value: location.code,
          label: `${location.name}`,
        });
        return acc;
      },
      {} as Record<string, { value: string; label: string }[]>,
    );

    // Mantine v8のグループ形式に変換
    return Object.entries(groups).map(([group, items]) => ({
      group,
      items,
    }));
  }, []);

  // 地点コードから地点情報を取得するマップ
  const locationMap = useMemo(() => {
    return WEATHER_LOCATIONS.reduce(
      (acc, location) => {
        acc[location.code] = location;
        return acc;
      },
      {} as Record<string, (typeof WEATHER_LOCATIONS)[0]>,
    );
  }, []);

  // 選択数の制限
  const handleChange = (values: string[]) => {
    if (values.length <= maxLocations) {
      onLocationsChange(values);
    }
  };

  // ドラッグ&ドロップのハンドラー
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.setData("text/plain", index.toString());
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      const dragStartIndex = Number.parseInt(e.dataTransfer.getData("text/plain"), 10);

      if (dragStartIndex === dropIndex) {
        setDragIndex(null);
        setDragOverIndex(null);
        return;
      }

      const newLocations = [...selectedLocations];
      const [draggedItem] = newLocations.splice(dragStartIndex, 1);
      newLocations.splice(dropIndex, 0, draggedItem);

      // アニメーション用に少し遅延してからリセット
      setTimeout(() => {
        setDragIndex(null);
        setDragOverIndex(null);
      }, 50);

      onLocationsChange(newLocations);
    },
    [selectedLocations, onLocationsChange],
  );

  // 地点を削除
  const handleRemove = (code: string) => {
    onLocationsChange(selectedLocations.filter((loc) => loc !== code));
  };

  return (
    <Stack gap="md">
      <div>
        <Text size="sm" fw={500} mb={4}>
          地点選択
        </Text>
        <Text size="xs" c="dimmed">
          最大{maxLocations}地点まで選択できます（{selectedLocations.length}/{maxLocations}）
        </Text>
      </div>

      <MultiSelect
        data={locationData}
        value={selectedLocations}
        onChange={handleChange}
        placeholder="地点を選択してください"
        searchable
        clearable
        maxValues={maxLocations}
        nothingFoundMessage="該当する地点が見つかりません"
        comboboxProps={{ transitionProps: { transition: "pop", duration: 200 } }}
      />

      {/* 選択済み地点の並び替え可能なリスト */}
      {selectedLocations.length > 0 && (
        <Paper p="md" withBorder>
          <Group justify="space-between" mb="sm">
            <Text size="sm" fw={500}>
              選択した地点の表示順序
            </Text>
            <Text size="xs" c="dimmed">
              ドラッグして順序を変更
            </Text>
          </Group>

          <Stack gap="xs">
            <AnimatePresence>
              {selectedLocations.map((code, index) => {
                const location = locationMap[code];
                const isDragging = dragIndex === index;
                const isDragOver = dragOverIndex === index;

                return (
                  <div key={`wrapper-${code}`}>
                    {/* 挿入インジケーター */}
                    <AnimatePresence>
                      {isDragOver && dragIndex !== index && dragIndex !== null && (
                        <motion.div
                          key={`indicator-${code}`}
                          initial={{ opacity: 0, height: 0, scaleY: 0 }}
                          animate={{ opacity: 1, height: 4, scaleY: 1 }}
                          exit={{ opacity: 0, height: 0, scaleY: 0 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                          style={{
                            backgroundColor: "#4a90e2",
                            borderRadius: "2px",
                            margin: "4px 0",
                            transformOrigin: "center",
                          }}
                        />
                      )}
                    </AnimatePresence>

                    <motion.div
                      key={code}
                      layout
                      layoutId={`location-${code}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: isDragging ? 1.02 : 1,
                      }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{
                        layout: { duration: 0.3, ease: "easeInOut" },
                        opacity: { duration: 0.2 },
                        scale: { duration: 0.2, ease: "easeOut" },
                      }}
                    >
                      <Paper
                        p="xs"
                        withBorder
                        draggable
                        style={{
                          cursor: isDragging ? "grabbing" : "grab",
                          opacity: isDragging ? 0.9 : 1,
                          backgroundColor:
                            isDragOver && dragIndex !== index ? "var(--mantine-color-blue-0)" : undefined,
                          borderColor: isDragOver && dragIndex !== index ? "var(--mantine-color-blue-4)" : undefined,
                        }}
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index)}
                      >
                        <Group gap="sm" wrap="nowrap">
                          {/* 順序番号 */}
                          <Flex
                            miw="24px"
                            h="24px"
                            bg="#4a90e2"
                            style={{ borderRadius: "50%" }}
                            align="center"
                            justify="center"
                          >
                            <Text size="xs" c="white" fw={600}>
                              {index + 1}
                            </Text>
                          </Flex>

                          {/* ドラッグハンドル */}
                          <Box c="gray.5">
                            <IconGripVertical size={16} />
                          </Box>

                          {/* 地点情報 */}
                          <Box flex={1} style={{ overflow: "hidden" }}>
                            <Text size="sm" fw={500}>
                              {location?.name || code}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {location?.region || ""}
                            </Text>
                          </Box>

                          {/* 削除ボタン */}
                          <Box
                            c="gray.5"
                            style={{ cursor: "pointer" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemove(code);
                            }}
                          >
                            <IconX size={16} />
                          </Box>
                        </Group>
                      </Paper>
                    </motion.div>
                  </div>
                );
              })}
            </AnimatePresence>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
};
