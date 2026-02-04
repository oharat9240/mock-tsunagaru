import { Box, Button, Group, Paper, ScrollArea, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { ContentSelectionGrid } from "~/components/content/ContentSelectionGrid";
import { SelectedContentList } from "~/components/content/SelectedContentList";
import { InteractiveLayoutPreview } from "~/components/layout/InteractiveLayoutPreview";
import type { ContentIndex } from "~/types/content";
import type { LayoutItem } from "~/types/layout";
import type { ContentAssignment } from "~/types/playlist";

interface ContentAssignmentStepProps {
  layout: LayoutItem;
  contents: ContentIndex[];
  contentAssignments: ContentAssignment[];
  onContentAssignmentChange: (regionId: string, contentIds: string[]) => void;
  onContentReorder: (regionId: string, reorderedContentIds: string[]) => void;
  onContentAddClick: () => void;
  getContentDuration?: (regionId: string, contentId: string) => number | undefined;
}

export const ContentAssignmentStep = ({
  layout,
  contents,
  contentAssignments,
  onContentAssignmentChange,
  onContentReorder,
  onContentAddClick,
  getContentDuration,
}: ContentAssignmentStepProps) => {
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

  const handleRegionSelect = (regionId: string) => {
    setSelectedRegionId(regionId);
  };

  const getSelectedRegionAssignment = () => {
    if (!selectedRegionId) return null;
    return contentAssignments.find((assignment) => assignment.regionId === selectedRegionId);
  };

  const getAssignedContentCounts = () => {
    const counts: Record<string, number> = {};
    contentAssignments.forEach((assignment) => {
      counts[assignment.regionId] = assignment.contentIds.length;
    });
    return counts;
  };

  const regionAssignment = getSelectedRegionAssignment();

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
    <Group align="flex-start" gap="md" style={{ height: "100%", minHeight: "600px" }}>
      {/* 左側: レイアウトプレビュー */}
      <Box style={{ flex: "0 0 350px" }}>
        <Text fw={600} mb="sm">
          レイアウトプレビュー
        </Text>
        <InteractiveLayoutPreview
          layout={layout}
          selectedRegionId={selectedRegionId}
          onRegionClick={handleRegionSelect}
          assignedContentCounts={getAssignedContentCounts()}
          canvasWidth={350}
          canvasHeight={197}
        />
      </Box>

      {/* 中央: コンテンツ選択 */}
      <Box style={{ flex: "1 1 auto", height: "100%", display: "flex", flexDirection: "column" }}>
        {selectedRegionId ? (
          <>
            <Group justify="space-between" mb="sm">
              <Text fw={600}>
                リージョン {layout.regions.findIndex((r) => r.id === selectedRegionId) + 1} のコンテンツを選択
              </Text>
              <Button variant="light" size="xs" leftSection={<IconPlus size={14} />} onClick={onContentAddClick}>
                コンテンツを追加
              </Button>
            </Group>

            <ScrollArea style={{ flex: 1 }} type="auto">
              {contents.length === 0 ? (
                <Paper p="xl" withBorder style={{ textAlign: "center" }}>
                  <Text c="dimmed" mb="sm">
                    利用可能なコンテンツがありません
                  </Text>
                  <Text size="sm" c="dimmed" mb="md">
                    先にコンテンツを追加してください
                  </Text>
                  <Button variant="light" leftSection={<IconPlus size={16} />} onClick={onContentAddClick}>
                    コンテンツを追加
                  </Button>
                </Paper>
              ) : (
                <ContentSelectionGrid
                  contents={contents}
                  selectedContentIds={regionAssignment?.contentIds || []}
                  onSelectionChange={(contentIds) => onContentAssignmentChange(selectedRegionId, contentIds)}
                />
              )}
            </ScrollArea>
          </>
        ) : (
          <Paper
            p="xl"
            withBorder
            style={{
              textAlign: "center",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <Text c="dimmed">左側のレイアウトからリージョンを選択してください</Text>
          </Paper>
        )}
      </Box>

      {/* 右側: 選択されたコンテンツ一覧 */}
      {selectedRegionId && regionAssignment && regionAssignment.contentIds.length > 0 && (
        <Box
          style={{
            flex: "0 0 300px",
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Text fw={600} mb="sm">
            選択されたコンテンツ ({regionAssignment.contentIds.length}件)
          </Text>
          <ScrollArea style={{ flex: 1, minHeight: 0 }} type="auto" scrollbarSize={8}>
            <SelectedContentList
              selectedContents={contents.filter((c) => regionAssignment.contentIds.includes(c.id))}
              onReorder={(reorderedIds) => onContentReorder(selectedRegionId, reorderedIds)}
              contentDurations={
                getContentDuration
                  ? regionAssignment.contentIds.reduce(
                      (acc, contentId) => {
                        const duration = getContentDuration(selectedRegionId, contentId);
                        if (duration !== undefined) {
                          acc[contentId] = duration;
                        }
                        return acc;
                      },
                      {} as Record<string, number>,
                    )
                  : undefined
              }
            />
          </ScrollArea>
        </Box>
      )}
    </Group>
  );
};
