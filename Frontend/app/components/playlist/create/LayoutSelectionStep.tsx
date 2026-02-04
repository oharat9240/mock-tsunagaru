import { Box, Button, Checkbox, Group, Paper, Select, Stack, Text } from "@mantine/core";
import { IconLayoutGrid, IconPlus } from "@tabler/icons-react";
import { InteractiveLayoutPreview } from "~/components/layout/InteractiveLayoutPreview";
import type { LayoutIndex, LayoutItem, Orientation, Region } from "~/types/layout";

interface LayoutSelectionStepProps {
  createNewLayout: boolean;
  setCreateNewLayout: (value: boolean) => void;
  layouts: LayoutIndex[];
  selectedLayoutId: string;
  selectedLayout: LayoutItem | null;
  tempLayoutData: { name: string; orientation: Orientation; regions: Region[] } | null;
  onLayoutSelect: (layoutId: string) => void;
  onCreateLayoutClick: () => void;
  errors: Partial<Record<string, string>>;
}

export const LayoutSelectionStep = ({
  createNewLayout,
  setCreateNewLayout,
  layouts,
  selectedLayoutId,
  selectedLayout,
  tempLayoutData,
  onLayoutSelect,
  onCreateLayoutClick,
  errors,
}: LayoutSelectionStepProps) => {
  const getOrientationLabel = (orientation: string) => {
    switch (orientation) {
      case "landscape":
        return "横";
      case "portrait-right":
        return "縦(右)";
      case "portrait-left":
        return "縦(左)";
      default:
        return orientation;
    }
  };

  return (
    <Stack gap="md">
      <Checkbox
        label="新しいレイアウトを作成する"
        checked={createNewLayout}
        onChange={(e) => {
          setCreateNewLayout(e.currentTarget.checked);
          if (e.currentTarget.checked) {
            onLayoutSelect("");
          }
        }}
      />

      {!createNewLayout && (
        <Select
          label="レイアウトを選択"
          placeholder="レイアウトを選択してください"
          required
          data={layouts.map((layout) => ({
            value: layout.id,
            label: `${layout.name} (${getOrientationLabel(layout.orientation)})`,
          }))}
          value={selectedLayoutId}
          onChange={(value) => value && onLayoutSelect(value)}
          error={errors.layoutId}
          searchable
        />
      )}

      {createNewLayout && !tempLayoutData && (
        <Paper p="xl" withBorder ta="center">
          <Box mb="8px">
            <IconLayoutGrid size={48} color="#868e96" />
          </Box>
          <Text c="dimmed" mb="md">
            新しいレイアウトを作成してください
          </Text>
          <Button leftSection={<IconPlus size={16} />} onClick={onCreateLayoutClick}>
            レイアウトを作成
          </Button>
        </Paper>
      )}

      {createNewLayout && tempLayoutData && (
        <Paper p="md" withBorder>
          <Group justify="space-between" mb="sm">
            <Text fw={600}>作成予定のレイアウト</Text>
            <Button variant="subtle" size="xs" onClick={onCreateLayoutClick}>
              編集
            </Button>
          </Group>
          <Group align="flex-start" gap="md">
            <InteractiveLayoutPreview
              layout={{
                id: "temp",
                name: tempLayoutData.name,
                orientation: tempLayoutData.orientation,
                regions: tempLayoutData.regions,
                createdAt: "",
                updatedAt: "",
              }}
              canvasWidth={300}
              canvasHeight={169}
            />
            <Stack gap="xs">
              <Text size="sm">
                <Text span fw={600}>
                  名前:
                </Text>{" "}
                {tempLayoutData.name}
              </Text>
              <Text size="sm">
                <Text span fw={600}>
                  向き:
                </Text>{" "}
                {getOrientationLabel(tempLayoutData.orientation)}
              </Text>
              <Text size="sm">
                <Text span fw={600}>
                  リージョン数:
                </Text>{" "}
                {tempLayoutData.regions.length}
              </Text>
            </Stack>
          </Group>
        </Paper>
      )}

      {selectedLayout && !createNewLayout && (
        <Paper p="md" withBorder>
          <Text fw={600} mb="sm">
            選択されたレイアウト
          </Text>
          <Group align="flex-start" gap="md">
            <InteractiveLayoutPreview layout={selectedLayout} canvasWidth={300} canvasHeight={169} />
            <Stack gap="xs">
              <Text size="sm">
                <Text span fw={600}>
                  名前:
                </Text>{" "}
                {selectedLayout.name}
              </Text>
              <Text size="sm">
                <Text span fw={600}>
                  向き:
                </Text>{" "}
                {getOrientationLabel(selectedLayout.orientation)}
              </Text>
              <Text size="sm">
                <Text span fw={600}>
                  リージョン数:
                </Text>{" "}
                {selectedLayout.regions.length}
              </Text>
            </Stack>
          </Group>
        </Paper>
      )}
    </Stack>
  );
};
