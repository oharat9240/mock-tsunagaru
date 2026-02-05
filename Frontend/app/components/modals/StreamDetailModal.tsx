import {
  ActionIcon,
  Badge,
  Box,
  Button,
  CopyButton,
  Divider,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconCheck, IconCopy, IconRefresh } from "@tabler/icons-react";
import { memo, useCallback, useEffect, useState } from "react";
import { apiClient } from "~/services/apiClient";
import type { Stream, StreamStatus } from "~/types/stream";

interface StreamDetailModalProps {
  opened: boolean;
  onClose: () => void;
  streamId: string | null;
  onStreamDeleted?: () => void;
  onStreamUpdated?: () => void;
}

const StatusBadge = memo(function StatusBadge({ status }: { status: StreamStatus }) {
  switch (status) {
    case "live":
      return (
        <Badge color="red" variant="filled" size="lg">
          LIVE
        </Badge>
      );
    case "offline":
      return (
        <Badge color="gray" variant="filled" size="lg">
          オフライン
        </Badge>
      );
    case "error":
      return (
        <Badge color="yellow" variant="filled" size="lg">
          エラー
        </Badge>
      );
    default:
      return null;
  }
});

export const StreamDetailModal = memo(function StreamDetailModal({
  opened,
  onClose,
  streamId,
  onStreamDeleted,
  onStreamUpdated,
}: StreamDetailModalProps) {
  const [stream, setStream] = useState<Stream | null>(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const loadStream = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const loaded = await apiClient.getStream<Stream>(id);
      setStream(loaded);
    } catch (error) {
      console.error("Failed to load stream:", error);
      setStream(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!opened || !streamId) {
      setStream(null);
      return;
    }
    loadStream(streamId);
  }, [opened, streamId, loadStream]);

  // 配信状態のポーリング
  useEffect(() => {
    if (!opened || !streamId) return;

    const interval = setInterval(async () => {
      try {
        const status = await apiClient.getStreamStatus<{ status: StreamStatus; lastLiveAt: string | null }>(streamId);
        setStream((prev) => (prev ? { ...prev, status: status.status, lastLiveAt: status.lastLiveAt } : null));
      } catch (error) {
        console.error("Failed to fetch stream status:", error);
      }
    }, 5000); // 5秒ごとにポーリング

    return () => clearInterval(interval);
  }, [opened, streamId]);

  const handleClose = () => {
    setStream(null);
    onClose();
  };

  const handleRegenerateKey = async () => {
    if (!stream) return;

    modals.openConfirmModal({
      title: "ストリームキーの再生成",
      children: (
        <Text size="sm">
          ストリームキーを再生成しますか？現在のキーは無効になり、OBSの設定を更新する必要があります。
        </Text>
      ),
      labels: { confirm: "再生成する", cancel: "キャンセル" },
      confirmProps: { color: "orange" },
      onConfirm: async () => {
        setRegenerating(true);
        try {
          const result = await apiClient.regenerateStreamKey<{ streamKey: string; hlsUrl: string }>(stream.id);
          setStream((prev) => (prev ? { ...prev, streamKey: result.streamKey, hlsUrl: result.hlsUrl } : null));
          onStreamUpdated?.();
        } catch (error) {
          console.error("Failed to regenerate stream key:", error);
        } finally {
          setRegenerating(false);
        }
      },
    });
  };

  const handleDelete = async () => {
    if (!stream) return;

    modals.openConfirmModal({
      title: "ライブ配信の削除",
      children: (
        <Text size="sm">
          「{stream.name}」を削除しますか？関連するコンテンツも削除されます。この操作は取り消せません。
        </Text>
      ),
      labels: { confirm: "削除する", cancel: "キャンセル" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await apiClient.deleteStream(stream.id);
          onStreamDeleted?.();
          handleClose();
        } catch (error) {
          console.error("Failed to delete stream:", error);
        }
      },
    });
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="ライブ配信詳細" centered size="lg">
      {loading ? (
        <Box style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px" }}>
          <Text c="dimmed">読み込み中...</Text>
        </Box>
      ) : stream ? (
        <Stack gap="md">
          {/* ヘッダー */}
          <Group justify="space-between">
            <Text fw={600} size="lg">
              {stream.name}
            </Text>
            <StatusBadge status={stream.status} />
          </Group>

          {stream.description && (
            <Text size="sm" c="dimmed">
              {stream.description}
            </Text>
          )}

          <Divider />

          {/* OBS接続情報 */}
          <Text fw={500}>OBS接続設定</Text>

          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              サーバー URL
            </Text>
            <Group gap="xs">
              <TextInput value={stream.rtmpUrl} readOnly style={{ flex: 1 }} />
              <CopyButton value={stream.rtmpUrl} timeout={2000}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? "コピーしました" : "コピー"} withArrow>
                    <ActionIcon color={copied ? "teal" : "gray"} variant="subtle" onClick={copy}>
                      {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
          </Stack>

          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              ストリームキー
            </Text>
            <Group gap="xs">
              <TextInput value={stream.streamKey} readOnly style={{ flex: 1 }} type="password" />
              <CopyButton value={stream.streamKey} timeout={2000}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? "コピーしました" : "コピー"} withArrow>
                    <ActionIcon color={copied ? "teal" : "gray"} variant="subtle" onClick={copy}>
                      {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
              <Tooltip label="キーを再生成" withArrow>
                <ActionIcon
                  color="orange"
                  variant="subtle"
                  onClick={handleRegenerateKey}
                  loading={regenerating}
                  disabled={stream.status === "live"}
                >
                  <IconRefresh size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
            {stream.status === "live" && (
              <Text size="xs" c="red">
                配信中はストリームキーを再生成できません
              </Text>
            )}
          </Stack>

          <Divider />

          {/* HLS URL */}
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              HLS URL（視聴用）
            </Text>
            <Group gap="xs">
              <TextInput value={stream.hlsUrl} readOnly style={{ flex: 1 }} />
              <CopyButton value={stream.hlsUrl} timeout={2000}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? "コピーしました" : "コピー"} withArrow>
                    <ActionIcon color={copied ? "teal" : "gray"} variant="subtle" onClick={copy}>
                      {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
          </Stack>

          {stream.lastLiveAt && (
            <Text size="xs" c="dimmed">
              最終配信: {new Date(stream.lastLiveAt).toLocaleString("ja-JP")}
            </Text>
          )}

          <Divider />

          {/* アクション */}
          <Group justify="flex-end">
            <Button variant="subtle" color="red" onClick={handleDelete}>
              削除
            </Button>
            <Button variant="subtle" onClick={handleClose}>
              閉じる
            </Button>
          </Group>
        </Stack>
      ) : (
        <Box style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px" }}>
          <Text c="dimmed">ストリームが見つかりません</Text>
        </Box>
      )}
    </Modal>
  );
});
