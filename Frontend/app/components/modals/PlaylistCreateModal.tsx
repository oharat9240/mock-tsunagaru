import { Box, Button, Divider, Group, Modal, Paper, Progress, Stack, Text, TextInput } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconArrowLeft, IconArrowRight, IconDeviceFloppy, IconLayoutGrid, IconPlus, IconX } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ContentSelectionGrid } from "~/components/content/ContentSelectionGrid";
import { SelectedContentList } from "~/components/content/SelectedContentList";
import { InteractiveLayoutPreview } from "~/components/layout/InteractiveLayoutPreview";
import { LayoutSelectionGrid } from "~/components/layout/LayoutSelectionGrid";
import { useContent } from "~/hooks/useContent";
import { useLayout } from "~/hooks/useLayout";
import type { ContentIndex } from "~/types/content";
import type { LayoutIndex, LayoutItem, Orientation, Region } from "~/types/layout";
import type { ContentAssignment, ContentDuration } from "~/types/playlist";
import { logger } from "~/utils/logger";
import { ContentAddHandler } from "../content/ContentAddHandler";
import { ContentDurationModal } from "./ContentDurationModal";
import { LayoutFormModal } from "./LayoutFormModal";

export interface PlaylistFormData {
  name: string;
  device: string;
  layoutId: string;
  contentAssignments: ContentAssignment[];
}

interface PlaylistCreateModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (data: PlaylistFormData) => Promise<void>;
}

type Step = "basic" | "layout" | "content";

interface StepInfo {
  key: Step;
  title: string;
  description: string;
}

export const PlaylistCreateModal = ({ opened, onClose, onSubmit }: PlaylistCreateModalProps) => {
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>("basic");
  const [formData, setFormData] = useState<PlaylistFormData>({
    name: `プレイリスト ${new Date().toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })}`,
    device: "テストデバイス",
    layoutId: "",
    contentAssignments: [],
  });
  const [initialFormData, setInitialFormData] = useState<PlaylistFormData>({
    name: "",
    device: "テストデバイス",
    layoutId: "",
    contentAssignments: [],
  });
  const [errors, setErrors] = useState<Partial<Record<keyof PlaylistFormData, string>>>({});
  const [layouts, setLayouts] = useState<LayoutIndex[]>([]);
  const [selectedLayout, setSelectedLayout] = useState<LayoutItem | null>(null);
  const [contents, setContents] = useState<ContentIndex[]>([]);
  const [showLayoutForm, setShowLayoutForm] = useState(false);
  const [tempLayoutData, setTempLayoutData] = useState<{
    name: string;
    orientation: Orientation;
    regions: Region[];
  } | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
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

  const { getLayoutsIndex, getLayoutById, createLayout } = useLayout();
  const { getContentsIndex, getContentById } = useContent();

  const steps: StepInfo[] = [
    { key: "basic", title: "基本情報", description: "プレイリスト名とデバイスを設定" },
    { key: "layout", title: "レイアウト選択", description: "既存レイアウトを選択または新規作成" },
    { key: "content", title: "コンテンツ割り当て", description: "各リージョンにコンテンツを割り当て" },
  ];

  const getCurrentStepIndex = () => steps.findIndex((step) => step.key === currentStep);
  const getProgress = () => ((getCurrentStepIndex() + 1) / steps.length) * 100;

  const loadLayouts = useCallback(async () => {
    try {
      const layoutsData = await getLayoutsIndex();
      setLayouts(layoutsData);
    } catch (error) {
      logger.error("PlaylistCreateModal", "Failed to load layouts", error);
    }
  }, [getLayoutsIndex]);

  const loadContents = useCallback(async () => {
    try {
      const contentsData = await getContentsIndex();
      setContents(contentsData);
    } catch (error) {
      logger.error("PlaylistCreateModal", "Failed to load contents", error);
    }
  }, [getContentsIndex]);

  // データ読み込み
  useEffect(() => {
    if (opened) {
      const initializeData = async () => {
        await loadLayouts();
        await loadContents();

        // モーダルが開かれたときの初期値を記録
        const initialData = {
          name: `プレイリスト ${new Date().toLocaleString("ja-JP", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}`,
          device: "テストデバイス",
          layoutId: "",
          contentAssignments: [],
        };
        setFormData(initialData);
        setInitialFormData(initialData);
      };

      initializeData();
    }
  }, [opened, loadLayouts, loadContents]);

  // 変更を監視（初期値と比較）
  const hasChanges = useMemo(() => {
    return (
      formData.name.trim() !== initialFormData.name.trim() ||
      formData.device.trim() !== initialFormData.device.trim() ||
      formData.layoutId !== initialFormData.layoutId ||
      JSON.stringify(formData.contentAssignments) !== JSON.stringify(initialFormData.contentAssignments) ||
      tempLayoutData !== null
    );
  }, [formData, initialFormData, tempLayoutData]);

  const validateCurrentStep = (): boolean => {
    const newErrors: Partial<Record<keyof PlaylistFormData, string>> = {};

    if (currentStep === "basic") {
      if (formData.name.trim().length === 0) {
        newErrors.name = "プレイリスト名は必須です";
      }
      // デバイス名は固定値なのでバリデーション不要
    } else if (currentStep === "layout") {
      // 既存レイアウトの選択も新規レイアウトの作成もされていない場合はエラー
      if (formData.layoutId.trim().length === 0 && !tempLayoutData) {
        newErrors.layoutId = "レイアウトを選択するか、新しいレイアウトを作成してください";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (!validateCurrentStep()) {
      return;
    }

    const currentIndex = getCurrentStepIndex();
    if (currentIndex < steps.length - 1) {
      const nextStep = steps[currentIndex + 1].key;

      // レイアウト選択ステップからコンテンツステップに移る時
      if (currentStep === "layout" && nextStep === "content") {
        if (tempLayoutData) {
          // 新規レイアウト作成の場合
          const tempLayout: LayoutItem = {
            id: "temp-layout",
            name: tempLayoutData.name,
            orientation: tempLayoutData.orientation,
            regions: tempLayoutData.regions,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setSelectedLayout(tempLayout);

          // contentAssignmentsを初期化
          const assignments: ContentAssignment[] = tempLayoutData.regions.map((region) => ({
            regionId: region.id,
            contentIds: [],
            contentDurations: [],
          }));
          setFormData((prev) => ({ ...prev, contentAssignments: assignments }));
        } else if (formData.layoutId) {
          // 既存レイアウト選択の場合
          try {
            const layout = await getLayoutById(formData.layoutId);
            setSelectedLayout(layout);

            // レイアウトのリージョンに基づいてcontentAssignmentsを初期化
            if (layout) {
              const assignments: ContentAssignment[] = layout.regions.map((region) => ({
                regionId: region.id,
                contentIds: [],
                contentDurations: [],
              }));
              setFormData((prev) => ({ ...prev, contentAssignments: assignments }));
            }
          } catch (error) {
            logger.error("PlaylistCreateModal", "Failed to load layout", error);
            return;
          }
        }
      }

      setCurrentStep(nextStep);
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
      let layoutId = formData.layoutId;

      // 新規レイアウトを作成する場合
      if (tempLayoutData) {
        const newLayout = await createLayout({
          name: tempLayoutData.name,
          orientation: tempLayoutData.orientation,
          regions: tempLayoutData.regions,
        });
        layoutId = newLayout.id;
      }

      await onSubmit({
        name: formData.name.trim(),
        device: formData.device.trim(),
        layoutId,
        contentAssignments: formData.contentAssignments,
      });
      resetForm();
      onClose();
    } catch (error) {
      logger.error("PlaylistCreateModal", "プレイリスト作成エラー", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
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
    const newInitialData = {
      name: `プレイリスト ${new Date().toLocaleString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      device: "テストデバイス",
      layoutId: "",
      contentAssignments: [],
    };
    setFormData(newInitialData);
    setInitialFormData(newInitialData);
    setErrors({});
    setSelectedLayout(null);
    setShowLayoutForm(false);
    setTempLayoutData(null);
    setSelectedRegionId(null);
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
            logger.error("PlaylistCreateModal", "Failed to get video duration", error);
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

  const handleContentReorder = (regionId: string, reorderedContentIds: string[]) => {
    handleContentAssignmentChange(regionId, reorderedContentIds);
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

  const canGoNext = () => {
    return getCurrentStepIndex() < steps.length - 1;
  };

  const canGoPrev = () => {
    return getCurrentStepIndex() > 0;
  };

  const handleLayoutCreate = async (data: { name: string; orientation: Orientation; regions: Region[] }) => {
    setTempLayoutData(data);
    setShowLayoutForm(false);
    setFormData((prev) => ({ ...prev, layoutId: "" })); // 既存レイアウト選択をクリア

    // レイアウトが作成されたので、次のステップに進む
    const tempLayout: LayoutItem = {
      id: "temp-layout",
      name: data.name,
      orientation: data.orientation,
      regions: data.regions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSelectedLayout(tempLayout);

    // contentAssignmentsを初期化
    const assignments: ContentAssignment[] = data.regions.map((region) => ({
      regionId: region.id,
      contentIds: [],
      contentDurations: [],
    }));
    setFormData((prev) => ({ ...prev, contentAssignments: assignments }));

    // リージョン選択をリセット
    setSelectedRegionId(null);

    // コンテンツステップに移動
    setCurrentStep("content");
  };

  const handleLayoutFormClose = () => {
    setShowLayoutForm(false);
  };

  // コンテンツ追加完了後のハンドラー
  const handleContentAdded = async () => {
    await loadContents(); // コンテンツリストを再読み込み
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
              disabled
            />
          </Stack>
        );

      case "layout":
        return (
          <Stack gap="md">
            {layouts.length > 0 && (
              <Box>
                <Text size="sm" fw={500} mb="sm">
                  既存のレイアウトから選択
                </Text>
                <LayoutSelectionGrid
                  layouts={layouts}
                  selectedLayoutId={formData.layoutId}
                  onLayoutSelect={(layout) => {
                    setFormData((prev) => ({ ...prev, layoutId: layout.id }));
                    setTempLayoutData(null);
                  }}
                />
                {errors.layoutId && !tempLayoutData && (
                  <Text size="sm" c="red" mt="xs">
                    {errors.layoutId}
                  </Text>
                )}
              </Box>
            )}

            {layouts.length > 0 && <Divider label="または" labelPosition="center" />}

            <Box>
              <Text size="sm" fw={500} mb="sm">
                新しいレイアウトを作成
              </Text>
              {tempLayoutData ? (
                <Paper p="md" withBorder>
                  <Group justify="space-between" align="flex-start">
                    <Box>
                      <Text size="sm" fw={500}>
                        作成済みレイアウト: {tempLayoutData.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {tempLayoutData.orientation === "landscape"
                          ? "横向き"
                          : tempLayoutData.orientation === "portrait-right"
                            ? "縦向き(右)"
                            : "縦向き(左)"}{" "}
                        - {tempLayoutData.regions.length}リージョン
                      </Text>
                    </Box>
                    <Button
                      variant="subtle"
                      size="xs"
                      onClick={() => {
                        setTempLayoutData(null);
                      }}
                    >
                      削除
                    </Button>
                  </Group>
                </Paper>
              ) : (
                <Button
                  variant="light"
                  onClick={() => setShowLayoutForm(true)}
                  leftSection={<IconLayoutGrid size={16} />}
                  size="lg"
                  fullWidth
                >
                  新しいレイアウトを作成
                </Button>
              )}
            </Box>
          </Stack>
        );

      case "content":
        return (
          <Stack gap="md">
            {selectedLayout ? (
              selectedLayout.regions.length === 0 ? (
                <Paper p="md" withBorder>
                  <Text c="dimmed" ta="center">
                    このレイアウトにはリージョンがありません
                  </Text>
                </Paper>
              ) : (
                <Group align="flex-start" gap="md" mih="600px" wrap="nowrap">
                  <Stack>
                    {/* レイアウトプレビュー */}
                    <Box>
                      <InteractiveLayoutPreview
                        layout={selectedLayout}
                        selectedRegionId={selectedRegionId}
                        onRegionClick={handleRegionSelect}
                        assignedContentCounts={getAssignedContentCounts()}
                        canvasWidth={350}
                        canvasHeight={197}
                      />
                    </Box>
                    {/* 選択済みコンテンツ一覧 */}
                    <Box>
                      {selectedRegionId ? (
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
                      ) : (
                        <Paper p="md" withBorder style={{ minHeight: "120px" }}>
                          <Text size="sm" c="dimmed" ta="center">
                            リージョンを選択すると、選択済みコンテンツが表示されます
                          </Text>
                        </Paper>
                      )}
                    </Box>
                  </Stack>

                  {/* コンテンツ選択 */}
                  <Box style={{ flex: "1 1 auto" }}>
                    {selectedRegionId ? (
                      <>
                        <Group justify="space-between" mb="sm">
                          <Text fw={600}>
                            リージョン {selectedLayout.regions.findIndex((r) => r.id === selectedRegionId) + 1}{" "}
                            のコンテンツを選択
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
                        {contents.length === 0 ? (
                          <Paper p="xl" withBorder style={{ textAlign: "center" }}>
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
                        ) : (
                          <ContentSelectionGrid
                            contents={contents}
                            selectedContentIds={getSelectedRegionAssignment()?.contentIds || []}
                            onSelectionChange={(contentIds) => {
                              if (selectedRegionId) {
                                handleContentAssignmentChange(selectedRegionId, contentIds);
                              }
                            }}
                            loading={false}
                            maxItems={20}
                          />
                        )}
                      </>
                    ) : (
                      <Paper p="xl" withBorder style={{ textAlign: "center" }}>
                        <Text c="dimmed" mb="sm">
                          左のレイアウトプレビューからリージョンを選択してください
                        </Text>
                        <Text size="sm" c="dimmed">
                          選択したリージョンにコンテンツを割り当てることができます
                        </Text>
                      </Paper>
                    )}
                  </Box>
                </Group>
              )
            ) : (
              <Text c="dimmed">レイアウト情報を読み込み中...</Text>
            )}
          </Stack>
        );

      default:
        return null;
    }
  };

  // コンテンツ割り当てとレイアウト選択ステップでは大きなモーダルサイズを使用
  const getModalSize = () => {
    if (currentStep === "content") {
      return "95%";
    }
    if (currentStep === "layout") {
      return "xl";
    }
    return "lg";
  };

  const getModalStyles = () => {
    if (currentStep === "content") {
      return {
        content: {
          maxWidth: "1400px",
        },
      };
    }
    if (currentStep === "layout") {
      return {
        content: {
          maxWidth: "1000px",
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
        title="新しいプレイリストを作成"
        centered
        size={getModalSize()}
        styles={getModalStyles()}
      >
        <Stack gap="lg">
          {/* プログレスバー */}
          <Box>
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

          <Divider />

          {/* ステップコンテンツ */}
          {renderStepContent()}

          {/* ナビゲーションボタン */}
          <Group justify="space-between" mt="lg">
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
                  作成
                </Button>
              )}
            </Group>
          </Group>
        </Stack>
      </Modal>

      {/* レイアウト作成モーダル */}
      <LayoutFormModal
        opened={showLayoutForm}
        onClose={handleLayoutFormClose}
        onSubmit={handleLayoutCreate}
        title="新しいレイアウトを作成"
        submitButtonText="作成"
      />

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
