import { Paper, Stack, Text, TextInput } from "@mantine/core";
import type { LayoutItem } from "~/types/layout";
import type { PlaylistEditFormData } from "../PlaylistEditFormData";

interface BasicInfoStepProps {
  formData: PlaylistEditFormData;
  setFormData: (updater: (prev: PlaylistEditFormData) => PlaylistEditFormData) => void;
  errors: Partial<Record<keyof PlaylistEditFormData, string>>;
  layout: LayoutItem | null;
}

export const BasicInfoStep = ({ formData, setFormData, errors, layout }: BasicInfoStepProps) => {
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
        <Paper p="md" withBorder bg="gray.0">
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
    </Stack>
  );
};
