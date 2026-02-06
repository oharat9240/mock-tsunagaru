import {
  ActionIcon,
  Alert,
  AspectRatio,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  List,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconChevronLeft, IconChevronRight, IconEdit, IconExclamationCircle, IconTrash } from "@tabler/icons-react";
import Hls from "hls.js";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useContent } from "~/hooks/useContent";
import type { ContentIndex, ContentItem, HlsContent } from "~/types/content";
import { ContentEditModal } from "./ContentEditModal";

interface ContentPreviewModalProps {
  opened: boolean;
  onClose: () => void;
  contentId: string | null;
  allContents?: ContentIndex[];
  onContentDeleted?: () => void;
  onContentUpdated?: () => void;
  onContentChange?: (contentId: string) => void;
}

// HLSプレイヤーコンポーネント
const HlsPlayer = memo(function HlsPlayer({ url, isLive }: { url: string; isLive?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryIntervalRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWaitingForStream, setIsWaitingForStream] = useState(false);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const maxRetries = 3;
  const retryInterval = 5000; // 5秒ごとに再接続

  // HLS初期化関数
  const initHls = useCallback(
    (video: HTMLVideoElement) => {
      // 既存のHLSインスタンスを破棄
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      setError(null);
      setIsLoading(true);

      // HLS.jsがサポートされている場合
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: isLive, // ライブ配信の場合は低遅延モード
          liveSyncDurationCount: isLive ? 3 : 3,
          liveMaxLatencyDurationCount: isLive ? 10 : 10,
        });

        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.debug("[HlsPlayer] Manifest parsed - stream is live");
          setIsLoading(false);
          setIsWaitingForStream(false);
          setError(null);
          retryCountRef.current = 0;
          // ポーリングを停止
          if (retryIntervalRef.current) {
            clearInterval(retryIntervalRef.current);
            retryIntervalRef.current = null;
          }
          video.play().catch(() => {
            // 自動再生が拒否された場合は無視
          });
        });

        // ストリーム終了時
        hls.on(Hls.Events.BUFFER_EOS, () => {
          console.debug("[HlsPlayer] Buffer EOS - stream ended");
          hls.destroy();
          hlsRef.current = null;
          setIsWaitingForStream(true);
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            console.warn("[HlsPlayer] HLS error:", data.type, data.details);
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                if (retryCountRef.current < maxRetries) {
                  retryCountRef.current += 1;
                  hls.startLoad();
                } else {
                  // 最大リトライ回数に達したら待機モードに移行
                  setIsLoading(false);
                  hls.destroy();
                  hlsRef.current = null;
                  setIsWaitingForStream(true);
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                setIsLoading(false);
                hls.destroy();
                hlsRef.current = null;
                setIsWaitingForStream(true);
                break;
            }
          }
        });

        hlsRef.current = hls;
        return;
      }

      // Safari などネイティブHLSサポートの場合
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
        video.addEventListener("loadedmetadata", () => {
          setIsLoading(false);
          video.play().catch(() => {});
        });
        video.addEventListener("error", () => {
          setIsWaitingForStream(true);
        });
      } else {
        setError("このブラウザはHLSをサポートしていません");
      }
    },
    [url, isLive],
  );

  // 初期接続
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    setIsWaitingForStream(false);
    setConnectionAttempt(0);
    retryCountRef.current = 0;
    initHls(video);

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
    };
  }, [url, isLive, initHls]);

  // 配信待機中のポーリング
  useEffect(() => {
    if (!isWaitingForStream) {
      if (retryIntervalRef.current) {
        console.debug("[HlsPlayer] Stopping polling - stream is active");
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
      return;
    }

    if (!videoRef.current) return;

    console.debug("[HlsPlayer] Starting polling for stream availability");

    if (retryIntervalRef.current) {
      clearInterval(retryIntervalRef.current);
    }

    retryIntervalRef.current = window.setInterval(() => {
      console.debug("[HlsPlayer] Polling: attempting to reconnect...");
      retryCountRef.current = 0;
      setConnectionAttempt((prev) => prev + 1);
    }, retryInterval);

    return () => {
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
    };
  }, [isWaitingForStream]);

  // 再接続試行
  // biome-ignore lint/correctness/useExhaustiveDependencies: connectionAttemptの変更時のみ再接続
  useEffect(() => {
    if (connectionAttempt === 0 || !videoRef.current || !isWaitingForStream) return;

    console.debug("[HlsPlayer] Reconnection attempt #", connectionAttempt);
    const video = videoRef.current;
    setIsLoading(true);
    initHls(video);
  }, [connectionAttempt]);

  return (
    <Box pos="relative">
      {isLive && !isWaitingForStream && !error && (
        <Badge
          color="red"
          variant="filled"
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            zIndex: 10,
          }}
        >
          LIVE
        </Badge>
      )}
      <AspectRatio ratio={16 / 9}>
        {/* video要素は常にDOMに保持し、ポーリングが機能するようにする */}
        {/* biome-ignore lint/a11y/useMediaCaption: プレビュー用 */}
        <video
          ref={videoRef}
          controls={!isLive}
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            backgroundColor: "#1a1a1a",
            // 配信待機中やエラー時は非表示
            display: isWaitingForStream || error ? "none" : "block",
          }}
          onEnded={() => {
            // 配信終了時は待機状態に戻る
            if (hlsRef.current) {
              hlsRef.current.destroy();
              hlsRef.current = null;
            }
            setIsWaitingForStream(true);
          }}
        />
        {/* エラー表示 */}
        {error && (
          <Box
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#1a1a1a",
              position: "absolute",
              inset: 0,
            }}
          >
            <Stack align="center" gap="sm">
              <Text c="red" size="sm">
                {error}
              </Text>
              {isLive && (
                <Text c="dimmed" size="xs">
                  配信が開始されていない可能性があります
                </Text>
              )}
            </Stack>
          </Box>
        )}
        {/* 配信待機中表示 */}
        {isWaitingForStream && !error && (
          <Box
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#1a1a1a",
              gap: 8,
              position: "absolute",
              inset: 0,
            }}
          >
            <Text c="white">配信開始を待機中...</Text>
            <Text c="dimmed" size="xs">
              配信が開始されると自動的に表示されます
            </Text>
          </Box>
        )}
        {/* 読み込み中表示 */}
        {isLoading && !isWaitingForStream && !error && (
          <Box
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(0,0,0,0.5)",
            }}
          >
            <Text c="white">読み込み中...</Text>
          </Box>
        )}
      </AspectRatio>
    </Box>
  );
});

export const ContentPreviewModal = memo(function ContentPreviewModal({
  opened,
  onClose,
  contentId,
  allContents = [],
  onContentDeleted,
  onContentUpdated,
  onContentChange,
}: ContentPreviewModalProps) {
  const [content, setContent] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { getContentById, updateContent, deleteContent, deleteContentForced, checkContentUsageStatus, getFileUrl } =
    useContent();

  // 関数参照を安定化するためのref
  const getContentByIdRef = useRef(getContentById);
  const getFileUrlRef = useRef(getFileUrl);

  // refを常に最新に保つ
  useEffect(() => {
    getContentByIdRef.current = getContentById;
    getFileUrlRef.current = getFileUrl;
  });

  // コンテンツ読み込み関数（useCallbackでメモ化）
  const loadContent = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const loaded = await getContentByIdRef.current(id);
      setContent(loaded);

      // プレビューURLを設定
      if (loaded) {
        if (loaded.fileInfo?.storagePath) {
          setPreviewUrl(getFileUrlRef.current(loaded.fileInfo.storagePath));
        } else if (loaded.hlsInfo?.url) {
          setPreviewUrl(loaded.hlsInfo.url);
        } else {
          setPreviewUrl(null);
        }
      }
    } catch (error) {
      console.error("Failed to load content:", error);
      setContent(null);
      setPreviewUrl(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!opened || !contentId) {
      setContent(null);
      setPreviewUrl(null);
      return;
    }

    loadContent(contentId);
  }, [opened, contentId, loadContent]);

  const handleClose = () => {
    setContent(null);
    setPreviewUrl(null);
    onClose();
  };

  // ナビゲーション
  const currentIndex = allContents.findIndex((c) => c.id === contentId);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < allContents.length - 1;

  const handlePrevious = () => {
    if (hasPrevious && onContentChange) {
      onContentChange(allContents[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (hasNext && onContentChange) {
      onContentChange(allContents[currentIndex + 1].id);
    }
  };

  // 編集モーダルを開く
  const handleEdit = () => {
    setIsEditModalOpen(true);
  };

  // 編集の保存
  const handleEditSubmit = async (data: { id: string; name: string; tags: string[]; hlsInfo?: HlsContent }) => {
    try {
      await updateContent(data.id, {
        name: data.name,
        tags: data.tags,
        hlsInfo: data.hlsInfo,
      });
      // コンテンツを再読み込み（refを使用して安定化）
      const reloaded = await getContentByIdRef.current(data.id);
      setContent(reloaded);
      onContentUpdated?.();
    } catch (error) {
      console.error("Failed to update content:", error);
      throw error;
    }
  };

  // 削除
  const handleDelete = async () => {
    if (!content) return;

    // 使用状況をチェック
    const usageInfo = await checkContentUsageStatus(content.id);

    if (usageInfo.isUsed) {
      // 使用中の場合は確認ダイアログを表示
      modals.openConfirmModal({
        title: "コンテンツの削除確認",
        children: (
          <Stack gap="sm">
            <Alert color="yellow" icon={<IconExclamationCircle size={16} />}>
              このコンテンツは以下のプレイリストで使用されています
            </Alert>
            <List size="sm">
              {usageInfo.playlists.map((playlist) => (
                <List.Item key={playlist.id}>{playlist.name}</List.Item>
              ))}
            </List>
            <Text size="sm">削除すると、これらのプレイリストからも自動的に削除されます。</Text>
          </Stack>
        ),
        labels: { confirm: "削除する", cancel: "キャンセル" },
        confirmProps: { color: "red" },
        onConfirm: async () => {
          try {
            await deleteContentForced(content.id);
            onContentDeleted?.();
            handleClose();
          } catch (error) {
            console.error("Failed to delete content:", error);
          }
        },
      });
    } else {
      // 使用されていない場合は通常の確認ダイアログ
      modals.openConfirmModal({
        title: "コンテンツの削除確認",
        children: <Text size="sm">「{content.name}」を削除しますか？この操作は取り消せません。</Text>,
        labels: { confirm: "削除する", cancel: "キャンセル" },
        confirmProps: { color: "red" },
        onConfirm: async () => {
          try {
            await deleteContent(content.id);
            onContentDeleted?.();
            handleClose();
          } catch (error) {
            console.error("Failed to delete content:", error);
          }
        },
      });
    }
  };

  // 現在のコンテンツをContentIndexとして取得
  const currentContentIndex: ContentIndex | null = content
    ? {
        id: content.id,
        name: content.name,
        type: content.type,
        tags: content.tags,
        size: content.fileInfo?.size ?? null,
        url: content.hlsInfo?.url ?? null,
        createdAt: content.createdAt,
        updatedAt: content.updatedAt ?? null,
      }
    : null;

  const renderPreview = () => {
    if (!content || !previewUrl) {
      return (
        <Box
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "400px",
            backgroundColor: "#f5f5f5",
          }}
        >
          <Text c="dimmed">プレビューを表示できません</Text>
        </Box>
      );
    }

    switch (content.type) {
      case "video":
        return (
          <AspectRatio ratio={16 / 9}>
            {/* biome-ignore lint/a11y/useMediaCaption: 字幕は任意のプレビュー機能 */}
            <video
              key={`video-${content.id}`}
              src={previewUrl}
              controls
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </AspectRatio>
        );

      case "image":
        return (
          <AspectRatio ratio={16 / 9}>
            <img
              src={previewUrl}
              alt={content.name}
              style={{ width: "100%", height: "100%", objectFit: "contain", backgroundColor: "#f5f5f5" }}
            />
          </AspectRatio>
        );

      case "hls":
        return <HlsPlayer url={previewUrl} isLive={content.hlsInfo?.isLive} />;

      default:
        return (
          <Box
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "400px",
              backgroundColor: "#f5f5f5",
            }}
          >
            <Text c="dimmed">プレビューを表示できません</Text>
          </Box>
        );
    }
  };

  return (
    <>
      <Modal opened={opened} onClose={handleClose} title={content?.name || "コンテンツ"} centered size="lg">
        <Stack gap="md">
          {loading ? (
            <Box
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "400px",
              }}
            >
              <Text c="dimmed">読み込み中...</Text>
            </Box>
          ) : (
            renderPreview()
          )}

          {content && (
            <>
              <Divider />
              <Group justify="space-between">
                <Group gap="xs">
                  <ActionIcon
                    variant="subtle"
                    size="lg"
                    onClick={handlePrevious}
                    disabled={!hasPrevious}
                    aria-label="前のコンテンツ"
                  >
                    <IconChevronLeft size={20} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    size="lg"
                    onClick={handleNext}
                    disabled={!hasNext}
                    aria-label="次のコンテンツ"
                  >
                    <IconChevronRight size={20} />
                  </ActionIcon>
                </Group>
                <Group gap="xs">
                  <Button variant="subtle" leftSection={<IconEdit size={16} />} onClick={handleEdit}>
                    編集
                  </Button>
                  <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />} onClick={handleDelete}>
                    削除
                  </Button>
                </Group>
              </Group>
            </>
          )}
        </Stack>
      </Modal>

      {currentContentIndex && (
        <ContentEditModal
          opened={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          content={currentContentIndex}
          onSubmit={handleEditSubmit}
        />
      )}
    </>
  );
});
