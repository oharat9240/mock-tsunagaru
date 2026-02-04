import { Group, NumberInput, Paper, Select, Stack, Title } from "@mantine/core";
import { IconLayout } from "@tabler/icons-react";
import { memo, useCallback, useState } from "react";
import type { CsvLayoutConfig } from "~/types/content";

interface CsvLayoutFormProps {
  initialLayout?: CsvLayoutConfig;
  onLayoutChange: (layout: CsvLayoutConfig) => void;
  selectedColumns: number;
}

// レイアウトプリセット
const LAYOUT_PRESETS: Record<string, CsvLayoutConfig> = {
  center: {
    table: { width: 1200, height: 800, x: 360, y: 140 },
    columns: { widths: "auto", alignment: [] },
    rows: { headerHeight: 50, rowHeight: 40 },
    padding: { cell: 10, table: 20 },
  },
  fullWidth: {
    table: { width: 1600, height: 900, x: 160, y: 90 },
    columns: { widths: "auto", alignment: [] },
    rows: { headerHeight: 60, rowHeight: 45 },
    padding: { cell: 15, table: 30 },
  },
  compact: {
    table: { width: 800, height: 600, x: 560, y: 240 },
    columns: { widths: "auto", alignment: [] },
    rows: { headerHeight: 40, rowHeight: 35 },
    padding: { cell: 8, table: 15 },
  },
  topLeft: {
    table: { width: 1000, height: 700, x: 50, y: 50 },
    columns: { widths: "auto", alignment: [] },
    rows: { headerHeight: 50, rowHeight: 40 },
    padding: { cell: 10, table: 20 },
  },
};

export const CsvLayoutForm = memo(({ initialLayout, onLayoutChange, selectedColumns }: CsvLayoutFormProps) => {
  const [layout, setLayout] = useState<CsvLayoutConfig>(initialLayout || LAYOUT_PRESETS.center);

  // プリセット適用
  const applyPreset = useCallback(
    (presetKey: string) => {
      const preset = LAYOUT_PRESETS[presetKey];
      if (preset) {
        const newLayout = {
          ...preset,
          columns: {
            ...preset.columns,
            alignment: Array(selectedColumns).fill("left"),
          },
        };
        setLayout(newLayout);
        onLayoutChange(newLayout);
      }
    },
    [selectedColumns, onLayoutChange],
  );

  // レイアウト値の更新
  const updateLayout = useCallback(
    (updates: Partial<CsvLayoutConfig>) => {
      const newLayout = {
        ...layout,
        ...updates,
        table: { ...layout.table, ...updates.table },
        columns: { ...layout.columns, ...updates.columns },
        rows: { ...layout.rows, ...updates.rows },
        padding: { ...layout.padding, ...updates.padding },
      };
      setLayout(newLayout);
      onLayoutChange(newLayout);
    },
    [layout, onLayoutChange],
  );

  // 列の配置を更新
  const updateColumnAlignment = useCallback(
    (index: number, alignment: "left" | "center" | "right") => {
      const newAlignment = [...layout.columns.alignment];
      newAlignment[index] = alignment;
      updateLayout({
        columns: {
          ...layout.columns,
          alignment: newAlignment,
        },
      });
    },
    [layout, updateLayout],
  );

  return (
    <Paper p="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={4}>レイアウト設定</Title>
          <Select
            placeholder="プリセットを選択"
            data={[
              { value: "center", label: "中央配置" },
              { value: "fullWidth", label: "フル幅" },
              { value: "compact", label: "コンパクト" },
              { value: "topLeft", label: "左上配置" },
            ]}
            onChange={(value) => value && applyPreset(value)}
            leftSection={<IconLayout size={16} />}
          />
        </Group>

        <Group grow>
          <NumberInput
            label="テーブル幅"
            value={layout.table.width}
            onChange={(value) => updateLayout({ table: { ...layout.table, width: Number(value) || 0 } })}
            min={100}
            max={1920}
            suffix="px"
          />
          <NumberInput
            label="テーブル高さ"
            value={layout.table.height}
            onChange={(value) => updateLayout({ table: { ...layout.table, height: Number(value) || 0 } })}
            min={100}
            max={1080}
            suffix="px"
          />
        </Group>

        <Group grow>
          <NumberInput
            label="X座標"
            value={layout.table.x}
            onChange={(value) => updateLayout({ table: { ...layout.table, x: Number(value) || 0 } })}
            min={0}
            max={1920 - layout.table.width}
            suffix="px"
          />
          <NumberInput
            label="Y座標"
            value={layout.table.y}
            onChange={(value) => updateLayout({ table: { ...layout.table, y: Number(value) || 0 } })}
            min={0}
            max={1080 - layout.table.height}
            suffix="px"
          />
        </Group>

        <Group grow>
          <NumberInput
            label="ヘッダー行高"
            value={layout.rows.headerHeight}
            onChange={(value) => updateLayout({ rows: { ...layout.rows, headerHeight: Number(value) || 0 } })}
            min={20}
            max={100}
            suffix="px"
          />
          <NumberInput
            label="データ行高"
            value={layout.rows.rowHeight}
            onChange={(value) => updateLayout({ rows: { ...layout.rows, rowHeight: Number(value) || 0 } })}
            min={20}
            max={100}
            suffix="px"
          />
        </Group>

        <Group grow>
          <NumberInput
            label="セル余白"
            value={layout.padding.cell}
            onChange={(value) => updateLayout({ padding: { ...layout.padding, cell: Number(value) || 0 } })}
            min={0}
            max={30}
            suffix="px"
          />
          <NumberInput
            label="テーブル余白"
            value={layout.padding.table}
            onChange={(value) => updateLayout({ padding: { ...layout.padding, table: Number(value) || 0 } })}
            min={0}
            max={50}
            suffix="px"
          />
        </Group>

        {/* 列の配置設定 */}
        {selectedColumns > 0 && (
          <Stack gap="xs">
            <Title order={5}>列の配置</Title>
            <Group gap="xs">
              {Array.from({ length: selectedColumns }, (_, i) => {
                const columnId = `column-${i}`;
                return (
                  <Select
                    key={columnId}
                    size="xs"
                    value={layout.columns.alignment[i] || "left"}
                    onChange={(value) => value && updateColumnAlignment(i, value as "left" | "center" | "right")}
                    data={[
                      { value: "left", label: "左" },
                      { value: "center", label: "中央" },
                      { value: "right", label: "右" },
                    ]}
                    w={80}
                  />
                );
              })}
            </Group>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
});

CsvLayoutForm.displayName = "CsvLayoutForm";
