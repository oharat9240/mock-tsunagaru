import { Box, Button, Flex, Group, Modal, Paper, Select, Stack, Text, TextInput } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconDeviceFloppy, IconGripVertical, IconX } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutEditor } from "~/components/layout/LayoutEditor";
import type { Orientation, Region } from "~/types/layout";

interface LayoutFormData {
  name: string;
  orientation: Orientation;
  regions: Region[];
}

interface LayoutFormModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (data: LayoutFormData) => Promise<void>;
  title: string;
  submitButtonText: string;
  initialData?: Partial<LayoutFormData>;
  additionalContent?: React.ReactNode;
}

export const LayoutFormModal = ({
  opened,
  onClose,
  onSubmit,
  title,
  submitButtonText,
  initialData,
  additionalContent,
}: LayoutFormModalProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<LayoutFormData>({
    name: "",
    orientation: "landscape",
    regions: [],
    ...initialData,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof LayoutFormData, string>>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const initialFormDataRef = useRef<LayoutFormData | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // 初期データとモーダル状態を監視
  useEffect(() => {
    if (opened) {
      const initialFormData = {
        name: "",
        orientation: "landscape" as Orientation,
        regions: [],
        ...initialData,
      };
      setFormData(initialFormData);
      initialFormDataRef.current = initialFormData;
      setHasChanges(false);
      // 遅延を除去して即座に初期化完了とする
      setIsInitialized(true);
    } else {
      // モーダルが閉じられた時にリセット
      setIsInitialized(false);
      setFormData({
        name: "",
        orientation: "landscape",
        regions: [],
      });
      setHasChanges(false);
      initialFormDataRef.current = null;
    }
  }, [opened, initialData]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof LayoutFormData, string>> = {};

    if (formData.name.trim().length === 0) {
      newErrors.name = "レイアウト名は必須です";
    }
    if (formData.regions.length === 0) {
      newErrors.regions = "少なくとも1つのリージョンが必要です";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        name: formData.name.trim(),
        orientation: formData.orientation,
        regions: formData.regions,
      });
      resetForm();
      onClose();
    } catch (error) {
      console.error("レイアウト操作エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: "", orientation: "landscape", regions: [] });
    setErrors({});
  };

  const handleClose = () => {
    if (hasChanges) {
      modals.openConfirmModal({
        title: "変更を破棄しますか？",
        children: <Text size="sm">保存されていない変更があります。本当に閉じてもよろしいですか？</Text>,
        labels: { confirm: "変更を破棄", cancel: "キャンセル" },
        confirmProps: { color: "red" },
        onConfirm: () => {
          resetForm();
          onClose();
        },
      });
    } else {
      resetForm();
      onClose();
    }
  };

  const handleRegionsChange = (regions: Region[]) => {
    setFormData((prev) => ({ ...prev, regions }));
    // リージョンが追加された場合、エラーをクリア
    if (regions.length > 0 && errors.regions) {
      setErrors((prev) => ({ ...prev, regions: undefined }));
    }
    // 変更を検知
    checkForChanges({ ...formData, regions });
  };

  // フォームデータの変更をチェック
  const checkForChanges = useCallback((currentData: LayoutFormData) => {
    if (!initialFormDataRef.current) return;

    const hasNameChange = currentData.name !== initialFormDataRef.current.name;
    const hasOrientationChange = currentData.orientation !== initialFormDataRef.current.orientation;
    const hasRegionsChange = JSON.stringify(currentData.regions) !== JSON.stringify(initialFormDataRef.current.regions);

    setHasChanges(hasNameChange || hasOrientationChange || hasRegionsChange);
  }, []);

  // ドラッグ&ドロップハンドラー
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

      // 現在の表示順序でソートされたリージョンを取得
      const sortedRegions = [...formData.regions].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));

      // ドラッグされたアイテムを新しい位置に移動
      const [draggedItem] = sortedRegions.splice(dragStartIndex, 1);
      sortedRegions.splice(dropIndex, 0, draggedItem);

      // 新しい順序に基づいてzIndexを更新（元のリージョン配列は保持）
      const zIndexMap = new Map<string, number>();
      sortedRegions.forEach((region, index) => {
        zIndexMap.set(region.id, sortedRegions.length - 1 - index);
      });

      // 元のリージョン配列を保持しつつ、zIndexだけを更新
      const updatedRegions = formData.regions.map((region) => ({
        ...region,
        zIndex: zIndexMap.get(region.id) || 0,
      }));

      // アニメーション用に少し遅延してからリセット
      setTimeout(() => {
        setDragIndex(null);
        setDragOverIndex(null);
      }, 50);

      const newData = { ...formData, regions: updatedRegions };
      setFormData(newData);
      checkForChanges(newData);
    },
    [formData, checkForChanges],
  );

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={title}
      centered
      size="95%"
      styles={{
        content: {
          maxWidth: "1100px",
          height: "min(75vh, 680px)",
          maxHeight: "min(75vh, 680px)",
          display: "flex",
          flexDirection: "column",
        },
        body: {
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          padding: "var(--mantine-spacing-md)",
        },
      }}
    >
      <Flex gap="md" w="100%" flex={1} direction="column" style={{ minHeight: 0 }}>
        {/* メインコンテンツエリア */}
        <Flex gap="md" w="100%" flex={1} style={{ minHeight: 0, overflow: "hidden" }}>
          {/* 左側: フォーム */}
          <Box w="380px" flex="0 0 380px" style={{ overflow: "auto" }}>
            <Stack gap="md">
              <TextInput
                label="レイアウト名"
                placeholder="レイアウト名を入力してください"
                required
                value={formData.name}
                onChange={(e) => {
                  const newData = { ...formData, name: e.target.value };
                  setFormData(newData);
                  checkForChanges(newData);
                }}
                error={errors.name}
                aria-required="true"
                aria-label="レイアウト名入力"
              />

              <Select
                label="向き"
                placeholder="向きを選択してください"
                required
                value={formData.orientation}
                onChange={(value) => {
                  const newData = { ...formData, orientation: value as Orientation };
                  setFormData(newData);
                  checkForChanges(newData);
                }}
                data={[
                  { value: "landscape", label: "横向き (1920x1080)" },
                  { value: "portrait-right", label: "縦向き右回転 (1080x1920)" },
                  { value: "portrait-left", label: "縦向き左回転 (1080x1920)" },
                ]}
                error={errors.orientation}
                aria-required="true"
                aria-label="画面向きの選択"
              />

              {errors.regions && (
                <Text c="red.6" size="sm">
                  {errors.regions}
                </Text>
              )}

              {/* リージョンの表示順序設定 */}
              {formData.regions.length > 1 && (
                <Box>
                  <Text size="sm" fw={500} mb="xs">
                    表示順序（上が前面、下が背面）
                  </Text>
                  <Stack gap="xs">
                    <AnimatePresence>
                      {[...formData.regions]
                        .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
                        .map((region, index) => {
                          const isDragging = dragIndex === index;
                          const isDragOver = dragOverIndex === index;
                          const originalIndex = formData.regions.findIndex((r) => r.id === region.id);

                          return (
                            <div key={`wrapper-${region.id}`}>
                              {/* 挿入インジケーター */}
                              <AnimatePresence>
                                {isDragOver && dragIndex !== index && dragIndex !== null && (
                                  <motion.div
                                    key={`indicator-${region.id}-${index}`}
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
                                key={region.id}
                                layout
                                layoutId={`region-${region.id}`}
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
                                  rotate: 1,
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
                                    backgroundColor: isDragOver && dragIndex !== index ? "#e3f2fd" : undefined,
                                    borderColor: isDragOver && dragIndex !== index ? "#4a90e2" : undefined,
                                  }}
                                  onDragStart={(e) => handleDragStart(e, index)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(e) => handleDragOver(e, index)}
                                  onDragLeave={handleDragLeave}
                                  onDrop={(e) => handleDrop(e, index)}
                                >
                                  <Group gap="sm" wrap="nowrap">
                                    {/* ドラッグハンドル */}
                                    <Box c="gray.5">
                                      <IconGripVertical size={16} />
                                    </Box>

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

                                    {/* リージョン情報 */}
                                    <Box flex={1}>
                                      <Text size="sm" fw={500}>
                                        リージョン {originalIndex + 1}
                                      </Text>
                                      <Text size="xs" c="dimmed">
                                        ({region.x}, {region.y}) {region.width}×{region.height}
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
                  <Text size="xs" c="dimmed" mt="xs">
                    ドラッグして順序を変更できます。上にあるリージョンほど前面に表示されます。
                  </Text>
                </Box>
              )}

              {/* 追加コンテンツ */}
              {additionalContent && (
                <Box mt="md" style={{ flex: 1, minHeight: 0 }}>
                  {additionalContent}
                </Box>
              )}
            </Stack>
          </Box>

          {/* 右側: レイアウトエディター */}
          <Box flex={1} style={{ minWidth: 0, overflow: "auto" }}>
            {isInitialized && (
              <LayoutEditor
                regions={formData.regions}
                onRegionsChange={handleRegionsChange}
                orientation={formData.orientation}
              />
            )}
          </Box>
        </Flex>

        {/* 下部ボタンエリア - 固定表示 */}
        <Box
          component="form"
          onSubmit={handleSubmit}
          style={{ flexShrink: 0, backgroundColor: "var(--mantine-color-body)" }}
        >
          <Group justify="flex-end" pt="md" style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}>
            <Button variant="subtle" leftSection={<IconX size={16} />} onClick={handleClose} disabled={loading}>
              キャンセル
            </Button>
            <Button type="submit" leftSection={<IconDeviceFloppy size={16} />} loading={loading}>
              {submitButtonText}
            </Button>
          </Group>
        </Box>
      </Flex>
    </Modal>
  );
};
