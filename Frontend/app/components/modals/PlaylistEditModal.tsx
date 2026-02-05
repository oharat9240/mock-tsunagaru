import {
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Modal,
  Paper,
  Progress,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  useMantineColorScheme,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import {
  IconArrowLeft,
  IconArrowRight,
  IconBroadcast,
  IconCalendarEvent,
  IconDeviceFloppy,
  IconFile,
  IconPhoto,
  IconPlus,
  IconSearch,
  IconVideo,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { ContentSelectionGrid } from "~/components/content/ContentSelectionGrid";
import { SelectedContentList } from "~/components/content/SelectedContentList";
import { InteractiveLayoutPreview } from "~/components/layout/InteractiveLayoutPreview";
import { useContent } from "~/hooks/useContent";
import { useLayout } from "~/hooks/useLayout";
import { useSchedule } from "~/hooks/useSchedule";
import type { ContentIndex, ContentType } from "~/types/content";
import type { LayoutItem } from "~/types/layout";
import type { ContentAssignment, ContentDuration, PlaylistItem } from "~/types/playlist";
import type { ScheduleIndex } from "~/types/schedule";
import { WEEKDAY_LABELS } from "~/types/schedule";
import { logger } from "~/utils/logger";
import { ContentAddHandler } from "../content/ContentAddHandler";
import { ContentDurationModal } from "./ContentDurationModal";

export interface PlaylistEditFormData {
  name: string;
  device: string;
  contentAssignments: ContentAssignment[];
}

interface PlaylistEditModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (data: PlaylistEditFormData) => Promise<void>;
  playlist: PlaylistItem | null; // 編集対象のプレイリスト
}

type Step = "basic" | "content";

interface StepInfo {
  key: Step;
  title: string;
  description: string;
}

export const PlaylistEditModal = ({ opened, onClose, onSubmit, playlist }: PlaylistEditModalProps) => {
  const { colorScheme } = useMantineColorScheme();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>("basic");
  const [formData, setFormData] = useState<PlaylistEditFormData>({
    name: "",
    device: "",
    contentAssignments: [],
  });
  const [errors, setErrors] = useState<Partial<Record<keyof PlaylistEditFormData, string>>>({});
  const [layout, setLayout] = useState<LayoutItem | null>(null);
  const [contents, setContents] = useState<ContentIndex[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [originalData, setOriginalData] = useState<PlaylistEditFormData | null>(null);
  const [showContentAddModal, setShowContentAddModal] = useState(false);
  const [showDurationModal, setShowDurationModal] = useState(false);
  const [durationModalContent, setDurationModalContent] = useState<{
    contentId: string;
    contentName: string;
    contentType: string;
  } | null>(null);
  const [pendingContentSelection, setPendingContentSelection] = useState<{
    regionId: string;
    contentIds: string[];
  } | null>(null);

  // フィルター状態
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentType | "all">("all");
  const [contentSearchQuery, setContentSearchQuery] = useState("");
  const [schedules, setSchedules] = useState<ScheduleIndex[]>([]);

  const { getLayoutById } = useLayout();
  const { getContentsIndex, getContentById } = useContent();
  const { getSchedulesIndex } = useSchedule();

  const steps: StepInfo[] = [
    { key: "basic", title: "基本情報", description: "プレイリスト名とデバイスを編集" },
    { key: "content", title: "コンテンツ編集", description: "各リージョンのコンテンツを編集" },
  ];

  const getCurrentStepIndex = () => steps.findIndex((step) => step.key === currentStep);
  const getProgress = () => ((getCurrentStepIndex() + 1) / steps.length) * 100;

  const loadPlaylistLayout = useCallback(async () => {
    if (!playlist?.layoutId) return;

    try {
      const layoutData = await getLayoutById(playlist.layoutId);
      setLayout(layoutData);
    } catch (error) {
      logger.error("PlaylistEditModal", "Failed to load layout", error);
    }
  }, [playlist?.layoutId, getLayoutById]);

  const loadContents = useCallback(async () => {
    try {
      const contentsData = await getContentsIndex();
      setContents(contentsData);
    } catch (error) {
      logger.error("PlaylistEditModal", "Failed to load contents", error);
    }
  }, [getContentsIndex]);

  const loadSchedules = useCallback(async () => {
    try {
      const schedulesData = await getSchedulesIndex();
      setSchedules(schedulesData);
    } catch (error) {
      logger.error("PlaylistEditModal", "Failed to load schedules", error);
    }
  }, [getSchedulesIndex]);

  // プレイリストデータが変更されたときにフォームを初期化
  useEffect(() => {
    if (playlist && opened) {
      setCurrentStep("basic");
      setSelectedRegionId(null);
      loadPlaylistLayout();
      loadContents();
      loadSchedules();
    }
  }, [playlist, opened, loadPlaylistLayout, loadContents, loadSchedules]);

  // レイアウトが読み込まれたらcontentAssignmentsを初期化
  useEffect(() => {
    if (playlist && layout && opened) {
      // レイアウトの全リージョンに対してcontentAssignmentsを作成
      const mergedAssignments: ContentAssignment[] = layout.regions.map((region) => {
        const existingAssignment = playlist.contentAssignments?.find((assignment) => assignment.regionId === region.id);
        return existingAssignment || { regionId: region.id, contentIds: [], contentDurations: [] };
      });

      const initialData = {
        name: playlist.name,
        device: playlist.device || "",
        contentAssignments: mergedAssignments,
      };
      setFormData(initialData);
      setOriginalData(initialData);
    }
  }, [playlist, layout, opened]);

  // 変更があるかチェック
  const hasChanges = useCallback(() => {
    if (!originalData) return false;

    // 基本情報の変更チェック
    if (formData.name !== originalData.name || formData.device !== originalData.device) {
      return true;
    }

    // コンテンツ割り当ての変更チェック
    const currentAssignments = JSON.stringify(formData.contentAssignments);
    const originalAssignments = JSON.stringify(originalData.contentAssignments);

    return currentAssignments !== originalAssignments;
  }, [formData, originalData]);

  const validateCurrentStep = (): boolean => {
    const newErrors: Partial<Record<keyof PlaylistEditFormData, string>> = {};

    if (currentStep === "basic") {
      if (formData.name.trim().length === 0) {
        newErrors.name = "プレイリスト名は必須です";
      }
      if (formData.device.trim().length === 0) {
        newErrors.device = "デバイス名は必須です";
      }
    }

    // コンテンツステップでも基本情報のバリデーションを確認
    if (currentStep === "content") {
      if (formData.name.trim().length === 0) {
        newErrors.name = "プレイリスト名は必須です";
      }
      if (formData.device.trim().length === 0) {
        newErrors.device = "デバイス名は必須です";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) {
      return;
    }

    const currentIndex = getCurrentStepIndex();
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].key);
    }
  };

  const handlePrev = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].key);
    }
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        name: formData.name.trim(),
        device: formData.device.trim(),
        contentAssignments: formData.contentAssignments,
      });
      resetForm();
      onClose();
    } catch (error) {
      logger.error("PlaylistEditModal", "プレイリスト更新エラー", error);
      // エラーメッセージを表示
      modals.openConfirmModal({
        title: "更新エラー",
        children: <Text size="sm">プレイリストの更新中にエラーが発生しました。もう一度お試しください。</Text>,
        labels: { confirm: "OK", cancel: "" },
        cancelProps: { display: "none" },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (hasChanges()) {
      modals.openConfirmModal({
        title: "変更を破棄しますか？",
        children: <Text size="sm">保存されていない変更があります。本当に閉じてもよろしいですか？</Text>,
        labels: { confirm: "破棄して閉じる", cancel: "キャンセル" },
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

  const resetForm = () => {
    setCurrentStep("basic");
    setFormData({ name: "", device: "", contentAssignments: [] });
    setOriginalData(null);
    setErrors({});
    setLayout(null);
    setSelectedRegionId(null);
    setContentTypeFilter("all");
    setContentSearchQuery("");
  };

  const handleContentAssignmentChange = async (regionId: string, contentIds: string[]) => {
    // 新しく追加されたコンテンツをチェック
    const currentAssignment = formData.contentAssignments.find((a) => a.regionId === regionId);
    const currentContentIds = currentAssignment?.contentIds || [];
    const newContentIds = contentIds.filter((id) => !currentContentIds.includes(id));

    let newDurations: ContentDuration[] = currentAssignment?.contentDurations || [];

    if (newContentIds.length > 0) {
      // 新しいコンテンツの情報を取得
      const newContent = contents.find((c) => c.id === newContentIds[0]);
      if (newContent) {
        // 動画の場合は詳細情報から再生時間を取得
        if (newContent.type === "video") {
          try {
            const contentDetail = await getContentById(newContent.id);
            if (contentDetail?.fileInfo?.metadata?.duration) {
              newDurations = [
                ...newDurations,
                {
                  contentId: newContent.id,
                  duration: Math.ceil(contentDetail.fileInfo.metadata.duration),
                },
              ];
            }
          } catch (error) {
            logger.error("PlaylistEditModal", "Failed to get video duration", error);
          }
        }
        // その他のコンテンツ（画像、HLS）は再生時間設定が必要
        else {
          // 選択状態を一時保存
          setPendingContentSelection({ regionId, contentIds });
          setDurationModalContent({
            contentId: newContent.id,
            contentName: newContent.name,
            contentType: newContent.type,
          });
          setShowDurationModal(true);
          return;
        }
      }
    }

    // 削除されたコンテンツの再生時間情報も削除
    const removedContentIds = currentContentIds.filter((id) => !contentIds.includes(id));
    if (removedContentIds.length > 0) {
      newDurations = newDurations.filter((d) => !removedContentIds.includes(d.contentId));
    }

    setFormData((prev) => ({
      ...prev,
      contentAssignments: prev.contentAssignments.map((assignment) =>
        assignment.regionId === regionId ? { ...assignment, contentIds, contentDurations: newDurations } : assignment,
      ),
    }));
  };

  const handleContentReorder = async (regionId: string, reorderedContentIds: string[]) => {
    await handleContentAssignmentChange(regionId, reorderedContentIds);
  };

  const handleRegionSelect = (regionId: string) => {
    setSelectedRegionId(regionId);
  };

  const getSelectedRegionAssignment = () => {
    if (!selectedRegionId) return null;
    return formData.contentAssignments.find((assignment) => assignment.regionId === selectedRegionId);
  };

  const getAssignedContentCounts = () => {
    const counts: Record<string, number> = {};
    formData.contentAssignments.forEach((assignment) => {
      counts[assignment.regionId] = assignment.contentIds.length;
    });
    return counts;
  };

  const handleDurationSubmit = (duration: number) => {
    if (!durationModalContent) return;

    if (pendingContentSelection) {
      // 新しいコンテンツ選択を確定
      const { regionId, contentIds } = pendingContentSelection;
      const currentAssignment = formData.contentAssignments.find((a) => a.regionId === regionId);
      const newDurations: ContentDuration[] = [
        ...(currentAssignment?.contentDurations || []),
        {
          contentId: durationModalContent.contentId,
          duration,
        },
      ];

      setFormData((prev) => ({
        ...prev,
        contentAssignments: prev.contentAssignments.map((assignment) =>
          assignment.regionId === regionId ? { ...assignment, contentIds, contentDurations: newDurations } : assignment,
        ),
      }));

      setPendingContentSelection(null);
    } else if (selectedRegionId) {
      // 既存のコンテンツの再生時間を更新
      setFormData((prev) => {
        const updatedAssignments = prev.contentAssignments.map((assignment) => {
          if (assignment.regionId === selectedRegionId) {
            // 既存の再生時間情報を更新または追加
            const existingDurations = assignment.contentDurations || [];
            const updatedDurations = existingDurations.filter((d) => d.contentId !== durationModalContent.contentId);
            updatedDurations.push({
              contentId: durationModalContent.contentId,
              duration,
            });

            return {
              ...assignment,
              contentDurations: updatedDurations,
            };
          }
          return assignment;
        });

        return {
          ...prev,
          contentAssignments: updatedAssignments,
        };
      });
    }

    setShowDurationModal(false);
    setDurationModalContent(null);
  };

  const handleDurationCancel = () => {
    if (pendingContentSelection) {
      // 保留中のコンテンツ選択をキャンセル（選択を解除）
      setPendingContentSelection(null);
    }
    setShowDurationModal(false);
    setDurationModalContent(null);
  };

  const getContentDuration = (regionId: string, contentId: string): number | undefined => {
    const assignment = formData.contentAssignments.find((a) => a.regionId === regionId);
    const duration = assignment?.contentDurations?.find((d) => d.contentId === contentId);
    return duration?.duration;
  };

  // フィルター済みコンテンツの取得
  const getFilteredContents = useCallback(() => {
    let filtered = contents;

    // タイプフィルター
    if (contentTypeFilter !== "all") {
      filtered = filtered.filter((content) => content.type === contentTypeFilter);
    }

    // 検索フィルター
    if (contentSearchQuery.trim()) {
      const query = contentSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (content) =>
          content.name.toLowerCase().includes(query) ||
          content.tags.some((tag) => tag.toLowerCase().includes(query)) ||
          content.url?.toLowerCase().includes(query),
      );
    }

    return filtered;
  }, [contents, contentTypeFilter, contentSearchQuery]);

  const canGoNext = () => {
    return getCurrentStepIndex() < steps.length - 1;
  };

  const canGoPrev = () => {
    return getCurrentStepIndex() > 0;
  };

  // コンテンツ追加完了後のハンドラー
  const handleContentAdded = async () => {
    await loadContents(); // コンテンツリストを再読み込み
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case "basic":
        return (
          <Stack gap="md">
            <TextInput
              label="プレイリスト名"
              placeholder="プレイリスト名を入力してください"
              required
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              error={errors.name}
            />
            <TextInput
              label="デバイス名"
              placeholder="対象デバイス名を入力してください"
              required
              value={formData.device}
              onChange={(e) => setFormData((prev) => ({ ...prev, device: e.target.value }))}
              error={errors.device}
            />

            {/* レイアウト情報表示（編集不可） */}
            {layout && (
              <Paper p="md" withBorder bg={colorScheme === "dark" ? "dark.6" : "gray.0"}>
                <Text size="sm" fw={500} mb="xs">
                  使用中のレイアウト
                </Text>
                <Text size="sm" c="dimmed">
                  {layout.name} (
                  {layout.orientation === "landscape"
                    ? "横向き"
                    : layout.orientation === "portrait-right"
                      ? "縦向き(右)"
                      : "縦向き(左)"}{" "}
                  - {layout.regions.length}
                  リージョン)
                </Text>
                <Text size="xs" c="dimmed" mt="xs">
                  ※ レイアウトの変更はできません。新しいプレイリストを作成してください。
                </Text>
              </Paper>
            )}

            {/* スケジュール登録状況表示 */}
            {playlist && (
              <Paper p="md" withBorder bg={colorScheme === "dark" ? "dark.6" : "gray.0"}>
                <Group gap="xs" mb="sm">
                  <IconCalendarEvent size={18} />
                  <Text size="sm" fw={500}>
                    スケジュール登録状況
                  </Text>
                </Group>
                {(() => {
                  const playlistSchedules = schedules.filter(
                    (schedule) => schedule.eventType === "playlist" && schedule.playlistId === playlist.id,
                  );

                  if (playlistSchedules.length === 0) {
                    return (
                      <Text size="sm" c="dimmed">
                        このプレイリストはスケジュールに登録されていません
                      </Text>
                    );
                  }

                  return (
                    <Stack gap="xs">
                      {playlistSchedules.map((schedule) => (
                        <Paper key={schedule.id} p="xs" withBorder>
                          <Group justify="space-between" wrap="nowrap">
                            <Box>
                              <Text size="sm" fw={500}>
                                {schedule.name}
                              </Text>
                              <Group gap="xs" mt={4}>
                                <Text size="xs" c="dimmed">
                                  {schedule.time}
                                </Text>
                                <Group gap={4}>
                                  {schedule.weekdays.map((day) => (
                                    <Badge key={day} size="xs" variant="dot">
                                      {WEEKDAY_LABELS[day]}
                                    </Badge>
                                  ))}
                                </Group>
                              </Group>
                            </Box>
                            <Badge color={schedule.enabled ? "green" : "gray"} variant="filled" size="sm">
                              {schedule.enabled ? "有効" : "無効"}
                            </Badge>
                          </Group>
                        </Paper>
                      ))}
                      <Text size="xs" c="dimmed" ta="center" mt="xs">
                        {playlistSchedules.length}件のスケジュールに登録されています
                      </Text>
                    </Stack>
                  );
                })()}
              </Paper>
            )}
          </Stack>
        );

      case "content":
        return (
          <Box h="100%">
            {layout ? (
              layout.regions.length === 0 ? (
                <Paper p="md" withBorder>
                  <Text c="dimmed" ta="center">
                    このレイアウトにはリージョンがありません
                  </Text>
                </Paper>
              ) : (
                <Group align="flex-start" gap="lg" wrap="nowrap" h="100%">
                  {/* 左側: レイアウトプレビューと順序変更 */}
                  <Box
                    h="100%"
                    style={{
                      flex: "0 0 400px",
                      minWidth: "400px",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <Stack gap="lg" h="100%">
                      {/* レイアウトプレビュー */}
                      <Box>
                        <Text fw={600} mb="sm">
                          レイアウトプレビュー
                        </Text>
                        <InteractiveLayoutPreview
                          layout={layout}
                          selectedRegionId={selectedRegionId}
                          onRegionClick={handleRegionSelect}
                          assignedContentCounts={getAssignedContentCounts()}
                          canvasWidth={380}
                          canvasHeight={214}
                        />
                      </Box>

                      {/* 順序変更 */}
                      {selectedRegionId && (
                        <Box style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                          <Text fw={600} mb="sm">
                            順序変更
                          </Text>
                          <ScrollArea style={{ flex: 1, minHeight: 0 }} type="auto" scrollbarSize={8}>
                            <SelectedContentList
                              selectedContents={
                                (getSelectedRegionAssignment()
                                  ?.contentIds.map((contentId) => contents.find((content) => content.id === contentId))
                                  .filter(Boolean) as ContentIndex[]) || []
                              }
                              onReorder={(reorderedContentIds) => {
                                if (selectedRegionId) {
                                  handleContentReorder(selectedRegionId, reorderedContentIds);
                                }
                              }}
                              contentDurations={getSelectedRegionAssignment()?.contentDurations?.reduce(
                                (acc, duration) => {
                                  acc[duration.contentId] = duration.duration;
                                  return acc;
                                },
                                {} as Record<string, number>,
                              )}
                            />
                          </ScrollArea>
                        </Box>
                      )}
                    </Stack>
                  </Box>

                  {/* 右側: コンテンツ選択グリッド */}
                  <Box h="100%" style={{ flex: "1 1 auto", display: "flex", flexDirection: "column" }}>
                    {selectedRegionId ? (
                      <>
                        <Group justify="space-between" mb="sm">
                          <Text fw={600}>
                            リージョン {layout.regions.findIndex((r) => r.id === selectedRegionId) + 1}{" "}
                            のコンテンツを編集
                          </Text>
                          <Button
                            variant="light"
                            size="xs"
                            leftSection={<IconPlus size={14} />}
                            onClick={() => setShowContentAddModal(true)}
                          >
                            コンテンツを追加
                          </Button>
                        </Group>

                        {/* フィルター */}
                        <Group gap="md" mb="md">
                          <TextInput
                            placeholder="コンテンツを検索..."
                            leftSection={<IconSearch size={16} />}
                            rightSection={
                              contentSearchQuery ? (
                                <Button
                                  variant="subtle"
                                  size="xs"
                                  p={0}
                                  onClick={() => setContentSearchQuery("")}
                                  miw="auto"
                                  h="auto"
                                >
                                  <IconX size={14} />
                                </Button>
                              ) : null
                            }
                            value={contentSearchQuery}
                            onChange={(e) => setContentSearchQuery(e.target.value)}
                            flex={1}
                            size="sm"
                          />

                          <SegmentedControl
                            value={contentTypeFilter}
                            onChange={(value) => setContentTypeFilter(value as ContentType | "all")}
                            data={[
                              {
                                value: "all",
                                label: (
                                  <Group gap={4} align="center" justify="center" miw="60px" wrap="nowrap">
                                    <IconFile size={14} />
                                    <Text size="xs">すべて</Text>
                                  </Group>
                                ),
                              },
                              {
                                value: "video",
                                label: (
                                  <Group gap={4} align="center" justify="center" miw="60px" wrap="nowrap">
                                    <IconVideo size={14} />
                                    <Text size="xs">動画</Text>
                                  </Group>
                                ),
                              },
                              {
                                value: "image",
                                label: (
                                  <Group gap={4} align="center" justify="center" miw="60px" wrap="nowrap">
                                    <IconPhoto size={14} />
                                    <Text size="xs">画像</Text>
                                  </Group>
                                ),
                              },
                              {
                                value: "hls",
                                label: (
                                  <Group gap={4} align="center" justify="center" miw="60px" wrap="nowrap">
                                    <IconBroadcast size={14} />
                                    <Text size="xs">HLS</Text>
                                  </Group>
                                ),
                              },
                            ]}
                            size="xs"
                            fz="11px"
                          />
                        </Group>
                        <ScrollArea style={{ flex: 1 }} type="auto">
                          {(() => {
                            const filteredContents = getFilteredContents();
                            return contents.length === 0 ? (
                              <Paper p="xl" withBorder ta="center">
                                <Text c="dimmed" mb="sm">
                                  利用可能なコンテンツがありません
                                </Text>
                                <Text size="sm" c="dimmed" mb="md">
                                  先にコンテンツを追加してください
                                </Text>
                                <Button
                                  variant="filled"
                                  leftSection={<IconPlus size={16} />}
                                  onClick={() => setShowContentAddModal(true)}
                                >
                                  コンテンツを追加
                                </Button>
                              </Paper>
                            ) : filteredContents.length === 0 ? (
                              <Paper p="xl" withBorder ta="center">
                                <Text c="dimmed" mb="sm">
                                  条件に一致するコンテンツがありません
                                </Text>
                                <Text size="sm" c="dimmed">
                                  フィルターや検索条件を変更してください
                                </Text>
                              </Paper>
                            ) : (
                              <ContentSelectionGrid
                                contents={filteredContents}
                                selectedContentIds={getSelectedRegionAssignment()?.contentIds || []}
                                onSelectionChange={async (contentIds) => {
                                  if (selectedRegionId) {
                                    await handleContentAssignmentChange(selectedRegionId, contentIds);
                                  }
                                }}
                                loading={false}
                                maxItems={20}
                              />
                            );
                          })()}
                        </ScrollArea>
                      </>
                    ) : (
                      <Paper
                        p="xl"
                        withBorder
                        h="100%"
                        ta="center"
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                        }}
                      >
                        <Text c="dimmed" mb="sm">
                          左のレイアウトプレビューからリージョンを選択してください
                        </Text>
                        <Text size="sm" c="dimmed">
                          選択したリージョンのコンテンツを編集できます
                        </Text>
                      </Paper>
                    )}
                  </Box>
                </Group>
              )
            ) : (
              <Text c="dimmed">レイアウト情報を読み込み中...</Text>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  // コンテンツステップでは大きなモーダルサイズを使用
  const getModalSize = () => {
    if (currentStep === "content") {
      return "95%";
    }
    return "lg";
  };

  const getModalStyles = () => {
    if (currentStep === "content") {
      return {
        content: {
          maxWidth: "1600px",
          minWidth: "1200px",
          height: "900px",
          maxHeight: "95vh",
        },
        body: {
          height: "calc(900px - 60px)",
          padding: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column" as const,
        },
      };
    }
    return undefined;
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={handleClose}
        title="プレイリストを編集"
        centered
        size={getModalSize()}
        styles={getModalStyles()}
      >
        <Stack gap="lg" h="100%">
          {/* プログレスバー */}
          <Box px={currentStep === "content" ? 20 : 0} pt={currentStep === "content" ? 20 : 0}>
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={500}>
                {steps[getCurrentStepIndex()].title}
              </Text>
              <Text size="xs" c="dimmed">
                {getCurrentStepIndex() + 1} / {steps.length}
              </Text>
            </Group>
            <Progress value={getProgress()} size="sm" />
            <Text size="xs" c="dimmed" mt="xs">
              {steps[getCurrentStepIndex()].description}
            </Text>
          </Box>

          <Divider mx={currentStep === "content" ? 20 : 0} />

          {/* ステップコンテンツ */}
          <Box style={{ flex: 1, overflow: "hidden", minHeight: 0 }} px={currentStep === "content" ? 20 : 0}>
            {renderStepContent()}
          </Box>

          {/* ナビゲーションボタン */}
          <Group
            justify="space-between"
            mt={currentStep === "content" ? "sm" : "lg"}
            px={currentStep === "content" ? 20 : 0}
            pb={currentStep === "content" ? 16 : 0}
          >
            <Group>
              <Button variant="subtle" leftSection={<IconX size={16} />} onClick={handleClose} disabled={loading}>
                キャンセル
              </Button>
              {canGoPrev() && (
                <Button
                  variant="light"
                  leftSection={<IconArrowLeft size={16} />}
                  onClick={handlePrev}
                  disabled={loading}
                >
                  戻る
                </Button>
              )}
            </Group>

            <Group>
              {canGoNext() ? (
                <Button rightSection={<IconArrowRight size={16} />} onClick={handleNext} disabled={loading}>
                  次へ
                </Button>
              ) : (
                <Button leftSection={<IconDeviceFloppy size={16} />} onClick={handleSubmit} loading={loading}>
                  更新
                </Button>
              )}
            </Group>
          </Group>
        </Stack>
      </Modal>

      {/* コンテンツ追加モーダル */}
      <ContentAddHandler
        opened={showContentAddModal}
        onClose={() => setShowContentAddModal(false)}
        onContentAdded={handleContentAdded}
      />

      {/* 再生時間設定モーダル */}
      {durationModalContent && (
        <ContentDurationModal
          opened={showDurationModal}
          onClose={handleDurationCancel}
          contentName={durationModalContent.contentName}
          contentType={durationModalContent.contentType}
          currentDuration={
            selectedRegionId ? getContentDuration(selectedRegionId, durationModalContent.contentId) : undefined
          }
          onSubmit={handleDurationSubmit}
          onCancel={handleDurationCancel}
        />
      )}
    </>
  );
};
