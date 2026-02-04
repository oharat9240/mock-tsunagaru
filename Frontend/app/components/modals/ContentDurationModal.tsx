import { Button, Group, Modal, NumberInput, Stack, Text } from "@mantine/core";
import { IconClock, IconDeviceFloppy } from "@tabler/icons-react";
import { useState } from "react";

interface ContentDurationModalProps {
  opened: boolean;
  onClose: () => void;
  contentName: string;
  contentType: string;
  currentDuration?: number;
  onSubmit: (duration: number) => void;
  onCancel?: () => void;
}

export const ContentDurationModal = ({
  opened,
  onClose,
  contentName,
  contentType,
  currentDuration,
  onSubmit,
  onCancel,
}: ContentDurationModalProps) => {
  const [duration, setDuration] = useState<number>(currentDuration || 30);
  const [error, setError] = useState<string>("");

  const handleSubmit = () => {
    if (duration < 1) {
      setError("再生時間は1秒以上である必要があります");
      return;
    }
    if (duration > 3600) {
      setError("再生時間は1時間（3600秒）以内にしてください");
      return;
    }
    onSubmit(duration);
    onClose();
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onClose();
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };

  return (
    <Modal opened={opened} onClose={handleCancel} title="再生時間の設定" centered size="sm">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          <Text span fw={500}>
            {contentName}
          </Text>{" "}
          の再生時間を設定してください。
        </Text>

        {(contentType === "image" || contentType === "text" || contentType === "url") && (
          <Text size="xs" c="dimmed">
            このコンテンツタイプは自動的に再生時間を決定できないため、手動で設定する必要があります。
          </Text>
        )}

        {contentType === "youtube" && (
          <Text size="xs" c="dimmed">
            YouTube動画の再生時間を自動取得できませんでした。動画プレーヤーで確認した正確な時間を手動で入力してください。
          </Text>
        )}

        <NumberInput
          label="再生時間（秒）"
          placeholder="30"
          value={duration}
          onChange={(value) => {
            setDuration(Number(value) || 30);
            setError("");
          }}
          min={1}
          max={3600}
          step={1}
          leftSection={<IconClock size={16} />}
          error={error}
          description={`現在の設定: ${formatDuration(duration)}`}
        />

        <Group justify="flex-end">
          <Button variant="subtle" onClick={handleCancel}>
            キャンセル
          </Button>
          <Button leftSection={<IconDeviceFloppy size={16} />} onClick={handleSubmit}>
            設定
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
