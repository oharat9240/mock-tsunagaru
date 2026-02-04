import { Stack, TextInput } from "@mantine/core";
import type { PlaylistFormData } from "~/types/playlistForm";

interface BasicInfoStepProps {
  formData: PlaylistFormData;
  setFormData: React.Dispatch<React.SetStateAction<PlaylistFormData>>;
  errors: Partial<Record<keyof PlaylistFormData, string>>;
}

export const BasicInfoStep = ({ formData, setFormData, errors }: BasicInfoStepProps) => {
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
    </Stack>
  );
};
