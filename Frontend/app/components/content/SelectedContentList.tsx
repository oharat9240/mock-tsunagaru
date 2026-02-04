import { Box, Flex, Group, Paper, Stack, Text } from "@mantine/core";
import { IconGripVertical } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useState } from "react";
import type { ContentIndex } from "~/types/content";

interface SelectedContentListProps {
  selectedContents: ContentIndex[];
  onReorder: (reorderedContentIds: string[]) => void;
  contentDurations?: Record<string, number>; // contentId -> duration
}

export const SelectedContentList = ({ selectedContents, onReorder, contentDurations }: SelectedContentListProps) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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

      const newContents = [...selectedContents];
      const [draggedItem] = newContents.splice(dragStartIndex, 1);
      newContents.splice(dropIndex, 0, draggedItem);

      // アニメーション用に少し遅延してからリセット
      setTimeout(() => {
        setDragIndex(null);
        setDragOverIndex(null);
      }, 50);

      onReorder(newContents.map((content) => content.id));
    },
    [selectedContents, onReorder],
  );

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  if (selectedContents.length === 0) {
    return (
      <Paper p="md" withBorder mih="120px">
        <Text size="sm" c="dimmed" ta="center">
          コンテンツを選択すると、ここに順序付きで表示されます
        </Text>
      </Paper>
    );
  }

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="sm">
        <Text size="sm" fw={500}>
          選択済み ({selectedContents.length}件)
        </Text>
        <Text size="xs" c="dimmed">
          ドラッグして順序を変更
        </Text>
      </Group>

      <Stack gap="xs">
        <AnimatePresence>
          {selectedContents.map((content, index) => {
            const isDragging = dragIndex === index;
            const isDragOver = dragOverIndex === index;

            return (
              <div key={`wrapper-${content.id}`}>
                {/* 挿入インジケーター */}
                <AnimatePresence>
                  {isDragOver && dragIndex !== index && dragIndex !== null && (
                    <motion.div
                      key={`indicator-${content.id}-${index}`}
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
                  key={content.id}
                  layout
                  layoutId={`content-${content.id}`}
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
                  whileDrag={{
                    scale: 1.05,
                    rotate: 2,
                    zIndex: 100,
                    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
                  }}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.1}
                >
                  <Paper
                    p="xs"
                    withBorder
                    draggable
                    style={{
                      cursor: isDragging ? "grabbing" : "grab",
                      opacity: isDragging ? 0.9 : 1,
                      backgroundColor: isDragOver && dragIndex !== index ? "blue.0" : undefined,
                      borderColor: isDragOver && dragIndex !== index ? "blue.4" : undefined,
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

                      {/* サムネイル */}
                      <Flex
                        w="40px"
                        h="30px"
                        bg="gray.1"
                        c="gray.6"
                        style={{
                          borderRadius: "4px",
                          flexShrink: 0,
                          fontSize: "10px",
                        }}
                        align="center"
                        justify="center"
                      >
                        {content.type === "image" ? "📷" : content.type === "video" ? "🎬" : "📄"}
                      </Flex>

                      {/* コンテンツ情報 */}
                      <Box flex={1} style={{ overflow: "hidden" }}>
                        <Text size="sm" fw={500} lineClamp={1}>
                          {content.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {content.type === "image" ? "画像" : content.type === "video" ? "動画" : "その他"}
                          {content.size && ` • ${(content.size / 1024 / 1024).toFixed(1)}MB`}
                          {contentDurations?.[content.id] && ` • ${formatDuration(contentDurations[content.id])}`}
                        </Text>
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
  );
};
