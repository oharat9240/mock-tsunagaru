import { Box, Button, Group, Paper, ScrollArea, Stack, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useCallback, useState } from "react";
import { ContentSelectionGrid } from "~/components/content/ContentSelectionGrid";
import { SelectedContentList } from "~/components/content/SelectedContentList";
import { InteractiveLayoutPreview } from "~/components/layout/InteractiveLayoutPreview";
import type { ContentIndex, ContentType } from "~/types/content";
import type { LayoutItem } from "~/types/layout";
import type { PlaylistEditFormData } from "../PlaylistEditFormData";
import { ContentFilterSection } from "./ContentFilterSection";

interface ContentEditStepProps {
  layout: LayoutItem | null;
  contents: ContentIndex[];
  formData: PlaylistEditFormData;
  onContentAssignmentChange: (regionId: string, contentIds: string[]) => Promise<void>;
  onContentReorder: (regionId: string, reorderedContentIds: string[]) => void;
  onContentAddClick: () => void;
}

export const ContentEditStep = ({
  layout,
  contents,
  formData,
  onContentAssignmentChange,
  onContentReorder,
  onContentAddClick,
}: ContentEditStepProps) => {
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentType | "all">("all");
  const [contentSearchQuery, setContentSearchQuery] = useState("");

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

  if (!layout) {
    return <Text c="dimmed">レイアウト情報を読み込み中...</Text>;
  }

  if (layout.regions.length === 0) {
    return (
      <Paper p="md" withBorder>
        <Text c="dimmed" ta="center">
          このレイアウトにはリージョンがありません
        </Text>
      </Paper>
    );
  }

  return (
    <Group align="flex-start" gap="lg" wrap="nowrap" h="100%">
      {/* 左側: コンテンツ選択グリッド */}
      <Box h="100%" display="flex" style={{ flex: "1 1 auto", flexDirection: "column" }}>
        {selectedRegionId ? (
          <>
            <Group justify="space-between" mb="sm">
              <Text fw={600}>
                リージョン {layout.regions.findIndex((r) => r.id === selectedRegionId) + 1} のコンテンツを編集
              </Text>
              <Button variant="light" size="xs" leftSection={<IconPlus size={14} />} onClick={onContentAddClick}>
                コンテンツを追加
              </Button>
            </Group>

            {/* フィルター */}
            <ContentFilterSection
              contentSearchQuery={contentSearchQuery}
              setContentSearchQuery={setContentSearchQuery}
              contentTypeFilter={contentTypeFilter}
              setContentTypeFilter={setContentTypeFilter}
            />

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
                    <Button variant="filled" leftSection={<IconPlus size={16} />} onClick={onContentAddClick}>
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
                        await onContentAssignmentChange(selectedRegionId, contentIds);
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
            display="flex"
            style={{
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <Text c="dimmed" mb="sm">
              右のレイアウトプレビューからリージョンを選択してください
            </Text>
            <Text size="sm" c="dimmed">
              選択したリージョンのコンテンツを編集できます
            </Text>
          </Paper>
        )}
      </Box>

      {/* 右側: レイアウトプレビューと順序変更 */}
      <Box
        h="100%"
        display="flex"
        style={{
          flex: "0 0 400px",
          minWidth: "400px",
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
                      onContentReorder(selectedRegionId, reorderedContentIds);
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
    </Group>
  );
};
