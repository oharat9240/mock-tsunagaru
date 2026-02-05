import {
  ActionIcon,
  Badge,
  Button,
  CopyButton,
  Divider,
  Group,
  Modal,
  Stack,
  TagsInput,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconCheck, IconCopy, IconDeviceFloppy, IconRefresh } from "@tabler/icons-react";
import { memo, useCallback, useEffect, useState } from "react";
import { ContentUsageDisplay } from "~/components/content/ContentUsageDisplay";
import { useContent } from "~/hooks/useContent";
import { apiClient } from "~/services/apiClient";
import type { ContentIndex, HlsContent } from "~/types/content";
import type { Stream, StreamStatus } from "~/types/stream";

interface ContentEditModalProps {
  opened: boolean;
  onClose: () => void;
  content: ContentIndex;
  onSubmit: (data: { id: string; name: string; tags: string[]; hlsInfo?: HlsContent }) => Promise<void>;
}

// ストリーム状態バッジ
const StatusBadge = memo(function StatusBadge({ status }: { status: StreamStatus }) {
  switch (status) {
    case "live":
      return (
        <Badge color="red" variant="filled" size="sm">
          LIVE
        </Badge>
      );
    case "offline":
      return (
        <Badge color="gray" variant="filled" size="sm">
          オフライン
        </Badge>
      );
    case "error":
      return (
        <Badge color="yellow" variant="filled" size="sm">
          エラー
        </Badge>
      );
    default:
      return null;
  }
});

export const ContentEditModal = memo(({ opened, onClose, content, onSubmit }: ContentEditModalProps) => {
  const { getContentById } = useContent();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  // HLS専用
  const [hlsUrl, setHlsUrl] = useState("");

  // ライブ配信専用
  const [isLive, setIsLive] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [stream, setStream] = useState<Stream | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  // ストリーム情報を取得（streamIdまたはcontentIdで検索）
  const loadStream = useCallback(async (streamIdOrContentId: string, byContentId = false) => {
    try {
      if (byContentId) {
        // contentIdでストリームを検索
        const streams = await apiClient.getStreams<Stream>();
        const found = streams.find((s) => s.contentId === streamIdOrContentId);
        if (found) {
          setStream(found);
          setStreamId(found.id);
        } else {
          setStream(null);
        }
      } else {
        // streamIdで直接取得
        const loaded = await apiClient.getStream<Stream>(streamIdOrContentId);
        setStream(loaded);
      }
    } catch (error) {
      console.error("Failed to load stream:", error);
      setStream(null);
    }
  }, []);

  useEffect(() => {
    const loadContent = async () => {
      if (!content?.id) return;

      setName(content.name);
      setTags(content.tags);

      // HLSコンテンツの場合、詳細を取得
      if (content.type === "hls") {
        const fullContent = await getContentById(content.id);
        if (fullContent?.hlsInfo) {
          setHlsUrl(fullContent.hlsInfo.url || "");
          setIsLive(fullContent.hlsInfo.isLive || false);
          setStreamId(fullContent.hlsInfo.streamId || null);

          // ライブ配信の場合、ストリーム情報を取得
          if (fullContent.hlsInfo.isLive) {
            if (fullContent.hlsInfo.streamId) {
              // streamIdがある場合は直接取得
              loadStream(fullContent.hlsInfo.streamId);
            } else {
              // streamIdがない場合はcontentIdで検索
              loadStream(content.id, true);
            }
          }
        }
      }
    };

    if (opened) {
      loadContent();
    } else {
      // モーダルが閉じられた時にリセット
      setIsLive(false);
      setStreamId(null);
      setStream(null);
    }
  }, [content, opened, getContentById, loadStream]);

  // 配信状態のポーリング（ライブ配信の場合のみ）
  useEffect(() => {
    if (!opened || !streamId || !isLive) return;

    const interval = setInterval(async () => {
      try {
        const status = await apiClient.getStreamStatus<{ status: StreamStatus; lastLiveAt: string | null }>(streamId);
        setStream((prev) => (prev ? { ...prev, status: status.status, lastLiveAt: status.lastLiveAt } : null));
      } catch (error) {
        console.error("Failed to fetch stream status:", error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [opened, streamId, isLive]);

  const handleClose = () => {
    if (loading) return;
    setName("");
    setTags([]);
    setHlsUrl("");
    setIsLive(false);
    setStreamId(null);
    setStream(null);
    onClose();
  };

  // ストリームキー再生成
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
        } catch (error) {
          console.error("Failed to regenerate stream key:", error);
        } finally {
          setRegenerating(false);
        }
      },
    });
  };

  const handleSubmit = async () => {
    if (!content || !name.trim()) return;

    setLoading(true);
    try {
      const updateData: {
        id: string;
        name: string;
        tags: string[];
        hlsInfo?: HlsContent;
      } = {
        id: content.id,
        name: name.trim(),
        tags,
      };

      // HLSコンテンツの場合、URLを更新
      if (content.type === "hls" && hlsUrl.trim()) {
        updateData.hlsInfo = {
          url: hlsUrl.trim(),
        };
      }

      await onSubmit(updateData);
      handleClose();
    } catch (error) {
      console.error("Content update failed:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!content) return null;

  const isHlsType = content.type === "hls";
  const isFileType = content.type === "video" || content.type === "image";
  const isLiveStream = isHlsType && isLive && stream;

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={isLiveStream ? "ライブ配信を編集" : "コンテンツを編集"}
      centered
      size={isLiveStream ? "lg" : "md"}
    >
      <Stack gap="md">
        {/* ライブ配信の場合、ステータスを表示 */}
        {isLiveStream && (
          <Group justify="space-between">
            <Text fw={500}>配信状態</Text>
            <StatusBadge status={stream.status} />
          </Group>
        )}

        <TextInput
          label="コンテンツ名"
          placeholder="コンテンツの名前を入力"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          required
        />

        <TagsInput label="タグ" placeholder="タグを入力してEnterキーで追加" value={tags} onChange={setTags} />

        {/* 通常のHLSコンテンツの場合のみURL編集を表示 */}
        {isHlsType && !isLive && (
          <TextInput
            label="HLS URL (m3u8)"
            placeholder="https://example.com/stream.m3u8"
            value={hlsUrl}
            onChange={(event) => setHlsUrl(event.currentTarget.value)}
          />
        )}

        {/* ライブ配信のストリーム情報 */}
        {isLiveStream && (
          <>
            <Divider label="OBS接続設定" labelPosition="center" />

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
          </>
        )}

        {/* コンテンツ使用状況の表示（ファイルコンテンツのみ） */}
        {isFileType && <ContentUsageDisplay contentId={content.id} />}

        <Group justify="flex-end">
          <Button variant="subtle" onClick={handleClose} disabled={loading}>
            キャンセル
          </Button>
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={handleSubmit}
            loading={loading}
            disabled={!name.trim()}
          >
            保存
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
});

ContentEditModal.displayName = "ContentEditModal";
