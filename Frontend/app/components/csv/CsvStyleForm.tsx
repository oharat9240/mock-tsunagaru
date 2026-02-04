import { ColorInput, Group, NumberInput, Paper, Select, Stack, Switch, Title } from "@mantine/core";
import { IconPalette } from "@tabler/icons-react";
import { memo, useCallback, useState } from "react";
import type { CsvStyleConfig } from "~/types/content";

interface CsvStyleFormProps {
  initialStyle?: CsvStyleConfig;
  onStyleChange: (style: CsvStyleConfig) => void;
}

// スタイルプリセット
const STYLE_PRESETS: Record<string, CsvStyleConfig> = {
  default: {
    font: { family: "Noto Sans CJK JP", size: 14, color: "#000000" },
    header: { backgroundColor: "#f0f0f0", fontWeight: "bold", color: "#000000" },
    table: { borderWidth: 1, borderColor: "#cccccc", backgroundColor: "rgba(255, 255, 255, 0.9)" },
    cell: { borderWidth: 1, borderColor: "#e0e0e0" },
  },
  modern: {
    font: { family: "Noto Sans CJK JP", size: 14, color: "#333333" },
    header: { backgroundColor: "#2c3e50", fontWeight: "bold", color: "#ffffff" },
    table: { borderWidth: 0, borderColor: "transparent", backgroundColor: "rgba(255, 255, 255, 0.95)" },
    cell: { borderWidth: 0, borderColor: "transparent", alternateRowColor: "#f8f9fa" },
  },
  colorful: {
    font: { family: "Noto Sans CJK JP", size: 15, color: "#2c3e50" },
    header: { backgroundColor: "#3498db", fontWeight: "bold", color: "#ffffff", fontSize: 18 },
    table: { borderWidth: 2, borderColor: "#3498db", backgroundColor: "rgba(255, 255, 255, 0.8)" },
    cell: { borderWidth: 1, borderColor: "#bdc3c7", alternateRowColor: "#ecf0f1" },
  },
  minimal: {
    font: { family: "Noto Sans CJK JP", size: 13, color: "#000000" },
    header: { backgroundColor: "transparent", fontWeight: "bold", color: "#000000" },
    table: { borderWidth: 0, borderColor: "transparent", backgroundColor: "transparent" },
    cell: { borderWidth: 0, borderColor: "transparent" },
  },
};

export const CsvStyleForm = memo(({ initialStyle, onStyleChange }: CsvStyleFormProps) => {
  const [style, setStyle] = useState<CsvStyleConfig>(initialStyle || STYLE_PRESETS.default);
  const [useAlternateRows, setUseAlternateRows] = useState(!!initialStyle?.cell.alternateRowColor);

  // プリセット適用
  const applyPreset = useCallback(
    (presetKey: string) => {
      const preset = STYLE_PRESETS[presetKey];
      if (preset) {
        setStyle(preset);
        setUseAlternateRows(!!preset.cell.alternateRowColor);
        onStyleChange(preset);
      }
    },
    [onStyleChange],
  );

  // スタイル値の更新
  const updateStyle = useCallback(
    (updates: Partial<CsvStyleConfig>) => {
      const newStyle = {
        ...style,
        ...updates,
        font: { ...style.font, ...updates.font },
        header: { ...style.header, ...updates.header },
        table: { ...style.table, ...updates.table },
        cell: { ...style.cell, ...updates.cell },
      };
      setStyle(newStyle);
      onStyleChange(newStyle);
    },
    [style, onStyleChange],
  );

  // 交互行色の切り替え
  const toggleAlternateRows = useCallback(
    (enabled: boolean) => {
      setUseAlternateRows(enabled);
      updateStyle({
        cell: {
          ...style.cell,
          alternateRowColor: enabled ? "#f8f9fa" : undefined,
        },
      });
    },
    [style, updateStyle],
  );

  return (
    <Paper p="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={4}>スタイル設定</Title>
          <Select
            placeholder="プリセットを選択"
            data={[
              { value: "default", label: "デフォルト" },
              { value: "modern", label: "モダン" },
              { value: "colorful", label: "カラフル" },
              { value: "minimal", label: "ミニマル" },
            ]}
            onChange={(value) => value && applyPreset(value)}
            leftSection={<IconPalette size={16} />}
          />
        </Group>

        {/* フォント設定 */}
        <Stack gap="sm">
          <Title order={5}>フォント</Title>
          <Group grow>
            <Select
              label="フォントファミリー"
              value={style.font.family}
              onChange={(value) => value && updateStyle({ font: { ...style.font, family: value } })}
              data={[
                { value: "Noto Sans CJK JP", label: "Noto Sans JP" },
                { value: "Arial", label: "Arial" },
                { value: "Helvetica", label: "Helvetica" },
                { value: "sans-serif", label: "Sans Serif" },
              ]}
            />
            <NumberInput
              label="フォントサイズ"
              value={style.font.size}
              onChange={(value) => updateStyle({ font: { ...style.font, size: Number(value) || 14 } })}
              min={10}
              max={24}
              suffix="px"
            />
            <ColorInput
              label="文字色"
              value={style.font.color}
              onChange={(value) => updateStyle({ font: { ...style.font, color: value } })}
            />
          </Group>
        </Stack>

        {/* ヘッダー設定 */}
        <Stack gap="sm">
          <Title order={5}>ヘッダー</Title>
          <Group grow>
            <ColorInput
              label="背景色"
              value={style.header.backgroundColor}
              onChange={(value) => updateStyle({ header: { ...style.header, backgroundColor: value } })}
            />
            <ColorInput
              label="文字色"
              value={style.header.color || style.font.color}
              onChange={(value) => updateStyle({ header: { ...style.header, color: value } })}
            />
            <Select
              label="フォントウェイト"
              value={style.header.fontWeight || "normal"}
              onChange={(value) =>
                value && updateStyle({ header: { ...style.header, fontWeight: value as "normal" | "bold" } })
              }
              data={[
                { value: "normal", label: "通常" },
                { value: "bold", label: "太字" },
              ]}
            />
          </Group>
        </Stack>

        {/* テーブル設定 */}
        <Stack gap="sm">
          <Title order={5}>テーブル</Title>
          <Group grow>
            <NumberInput
              label="枠線の太さ"
              value={style.table.borderWidth}
              onChange={(value) => updateStyle({ table: { ...style.table, borderWidth: Number(value) || 0 } })}
              min={0}
              max={5}
              suffix="px"
            />
            <ColorInput
              label="枠線の色"
              value={style.table.borderColor}
              onChange={(value) => updateStyle({ table: { ...style.table, borderColor: value } })}
            />
            <ColorInput
              label="背景色"
              value={style.table.backgroundColor}
              onChange={(value) => updateStyle({ table: { ...style.table, backgroundColor: value } })}
              placeholder="rgba(255, 255, 255, 0.9)"
            />
          </Group>
        </Stack>

        {/* セル設定 */}
        <Stack gap="sm">
          <Title order={5}>セル</Title>
          <Group grow>
            <NumberInput
              label="枠線の太さ"
              value={style.cell.borderWidth}
              onChange={(value) => updateStyle({ cell: { ...style.cell, borderWidth: Number(value) || 0 } })}
              min={0}
              max={5}
              suffix="px"
            />
            <ColorInput
              label="枠線の色"
              value={style.cell.borderColor}
              onChange={(value) => updateStyle({ cell: { ...style.cell, borderColor: value } })}
            />
          </Group>

          <Group>
            <Switch
              label="交互行色を使用"
              checked={useAlternateRows}
              onChange={(event) => toggleAlternateRows(event.currentTarget.checked)}
            />
            {useAlternateRows && (
              <ColorInput
                value={style.cell.alternateRowColor || "#f8f9fa"}
                onChange={(value) => updateStyle({ cell: { ...style.cell, alternateRowColor: value } })}
                placeholder="#f8f9fa"
              />
            )}
          </Group>
        </Stack>
      </Stack>
    </Paper>
  );
});

CsvStyleForm.displayName = "CsvStyleForm";
