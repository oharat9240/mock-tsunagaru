import { ActionIcon, Alert, AspectRatio, Box, Button, Divider, Group, List, Modal, Stack, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import {
  IconChevronLeft,
  IconChevronRight,
  IconEdit,
  IconExclamationCircle,
  IconFile,
  IconTrash,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useContent } from "~/hooks/useContent";
import type { ContentIndex, ContentItem, CsvContent, TextContent, WeatherContent } from "~/types/content";
import { getIframeSandboxAttributes } from "~/utils/urlValidator";
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

export const ContentPreviewModal = ({
  opened,
  onClose,
  contentId,
  allContents = [],
  onContentDeleted,
  onContentUpdated,
  onContentChange,
}: ContentPreviewModalProps) => {
  const [content, setContent] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { getContentById, updateContent, deleteContent, deleteContentForced, checkContentUsageStatus, getFileUrl } =
    useContent();

  useEffect(() => {
    if (!opened || !contentId) {
      setContent(null);
      setPreviewUrl(null);
      return;
    }

    const loadContent = async () => {
      setLoading(true);
      try {
        const contentData = await getContentById(contentId);
        setContent(contentData);

        // プレビューURL生成（サーバーから取得）
        if (contentData?.type === "image" || contentData?.type === "video") {
          if (contentData.fileInfo?.storagePath) {
            const url = getFileUrl(contentData.fileInfo.storagePath);
            setPreviewUrl(url);
          }
        } else if (contentData?.type === "csv" && contentData.csvInfo?.renderedImagePath) {
          // CSVの場合はレンダリング済み画像を表示
          const url = getFileUrl(contentData.csvInfo.renderedImagePath);
          setPreviewUrl(url);
        }
      } catch (error) {
        console.error("Failed to load content:", error);
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [opened, contentId, getContentById, getFileUrl]);

  const handleClose = () => {
    setPreviewUrl(null);
    onClose();
  };

  const renderPreview = () => {
    if (loading) {
      return (
        <Box h="400px" display="flex" style={{ alignItems: "center", justifyContent: "center" }}>
          <Text>読み込み中...</Text>
        </Box>
      );
    }

    if (!content) {
      return (
        <Box h="400px" display="flex" style={{ alignItems: "center", justifyContent: "center" }}>
          <Text>コンテンツが見つかりません</Text>
        </Box>
      );
    }

    // 画像プレビュー（CSVの場合も含む）
    if ((content.type === "image" || content.type === "csv") && previewUrl) {
      return (
        <Box ta="center" style={{ maxHeight: "70vh", overflow: "hidden" }}>
          <img
            src={previewUrl}
            alt={content.name}
            style={{
              maxWidth: "100%",
              maxHeight: "70vh",
              objectFit: "contain",
              borderRadius: "var(--mantine-radius-md)",
            }}
          />
        </Box>
      );
    }

    // 動画プレビュー
    if (content.type === "video" && previewUrl) {
      return (
        <Box ta="center" style={{ maxHeight: "70vh" }}>
          <video
            src={previewUrl}
            controls
            autoPlay
            style={{
              maxWidth: "100%",
              maxHeight: "70vh",
              borderRadius: "var(--mantine-radius-md)",
            }}
          >
            <track kind="captions" />
          </video>
        </Box>
      );
    }

    // YouTubeプレビュー
    if (content.type === "youtube" && content.urlInfo?.url) {
      const videoId = extractYouTubeVideoId(content.urlInfo.url);
      if (videoId) {
        return (
          <Box ta="center">
            <iframe
              width="100%"
              height="400"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              title={content.name}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ borderRadius: "var(--mantine-radius-md)" }}
            />
          </Box>
        );
      }
    }

    // 気象情報プレビュー
    if (content.type === "weather" && content.weatherInfo) {
      const { locations, weatherType, apiUrl } = content.weatherInfo;
      const locationsParam = locations.length === 1 ? `location=${locations[0]}` : `locations=${locations.join(",")}`;
      const weatherUrl = `${apiUrl}/api/image/${weatherType}?${locationsParam}`;

      return (
        <Box display="flex" style={{ alignItems: "center", justifyContent: "center" }}>
          <img
            src={weatherUrl}
            alt={content.name}
            style={{ maxWidth: "100%", maxHeight: "600px", objectFit: "contain" }}
            onError={(e) => {
              e.currentTarget.src =
                "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMDg5MWIyIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxNCI+5rCX6LGh5oOF5aCxPC90ZXh0Pjwvc3ZnPg==";
            }}
          />
        </Box>
      );
    }

    // テキストプレビュー
    if (content.type === "text" && content.textInfo) {
      const {
        content: textContent,
        writingMode,
        fontFamily,
        textAlign,
        color,
        backgroundColor,
        fontSize,
        scrollType = "none",
        scrollSpeed = 3,
      } = content.textInfo;

      // テキストの長さに応じて適切な幅を計算
      const singleLineText = textContent.replace(/\n/g, " ");
      const textLength = singleLineText.length;
      const estimatedWidth = Math.max(400, Math.min(textLength * fontSize * 0.6, 1200));

      // スクロールアニメーションのCSS
      const scrollAnimation =
        scrollType !== "none"
          ? `@keyframes textScrollModal {
              0% { transform: translate${scrollType === "horizontal" ? "X" : "Y"}(100%); }
              100% { transform: translate${scrollType === "horizontal" ? "X" : "Y"}(calc(-100% - ${estimatedWidth}px)); }
            }`
          : "";

      return (
        <Box
          display="flex"
          pos="relative"
          w="100%"
          style={{
            minHeight: "400px",
            backgroundColor,
            border: "1px solid #e5e5e5",
            borderRadius: "var(--mantine-radius-md)",
            alignItems: "center",
            justifyContent: textAlign === "center" ? "center" : textAlign === "end" ? "flex-end" : "flex-start",
            overflow: "hidden",
            maxWidth: "100%",
          }}
        >
          <style>{scrollAnimation}</style>
          <div
            style={{
              fontFamily,
              fontSize: `${fontSize}px`,
              color,
              writingMode: writingMode === "vertical" ? "vertical-rl" : "horizontal-tb",
              whiteSpace: "nowrap",
              padding: "20px",
              minWidth: `${estimatedWidth}px`,
              width: "max-content",
              ...(scrollType !== "none" ? { animation: `textScrollModal ${11 - scrollSpeed}s linear infinite` } : {}),
            }}
          >
            {singleLineText}
          </div>
        </Box>
      );
    }

    // URLプレビュー（iframe埋め込み）
    if (content.type === "url" && content.urlInfo?.url) {
      return (
        <AspectRatio ratio={16 / 9} maw="100%">
          <Box
            style={{
              width: "100%",
              height: "100%",
              position: "relative",
              overflow: "hidden",
              border: "1px solid #e5e5e5",
              borderRadius: "var(--mantine-radius-md)",
              backgroundColor: "#ffffff",
            }}
          >
            <Box
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                overflow: "hidden",
              }}
            >
              <iframe
                src={content.urlInfo.url}
                title={content.name}
                width="1920"
                height="1080"
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: "1920px",
                  height: "1080px",
                  transform: "translate(-50%, -50%) scale(var(--scale-factor))",
                  transformOrigin: "center",
                  border: "none",
                  backgroundColor: "white",
                  pointerEvents: "none",
                  // CSS変数でスケールファクターを設定
                  ["--scale-factor" as string]: "0.47", // 900px幅の場合: 900 / 1920 ≈ 0.47
                }}
                sandbox={getIframeSandboxAttributes()}
                loading="lazy"
              />
            </Box>
          </Box>
        </AspectRatio>
      );
    }

    // その他のタイプ
    return (
      <Box h="400px" display="flex" style={{ alignItems: "center", justifyContent: "center" }}>
        <Stack align="center" gap="md">
          <IconFile size={48} />
          <Text size="lg" fw={500}>
            {content.name}
          </Text>
          <Text size="sm" c="dimmed">
            このコンテンツタイプはプレビューできません
          </Text>
        </Stack>
      </Box>
    );
  };

  const getModalTitle = () => {
    if (!content) return "コンテンツプレビュー";
    return content.name;
  };

  const getCurrentContentIndex = () => {
    if (!contentId || !allContents.length) return -1;
    return allContents.findIndex((item) => item.id === contentId);
  };

  const canNavigatePrev = () => {
    const currentIndex = getCurrentContentIndex();
    return currentIndex > 0;
  };

  const canNavigateNext = () => {
    const currentIndex = getCurrentContentIndex();
    return currentIndex >= 0 && currentIndex < allContents.length - 1;
  };

  const handleNavigatePrev = () => {
    const currentIndex = getCurrentContentIndex();
    if (currentIndex > 0) {
      const prevContent = allContents[currentIndex - 1];
      onContentChange?.(prevContent.id);
    }
  };

  const handleNavigateNext = () => {
    const currentIndex = getCurrentContentIndex();
    if (currentIndex >= 0 && currentIndex < allContents.length - 1) {
      const nextContent = allContents[currentIndex + 1];
      onContentChange?.(nextContent.id);
    }
  };

  const handleEditStart = () => {
    setIsEditModalOpen(true);
  };

  const handleEditModalClose = () => {
    setIsEditModalOpen(false);
  };

  const handleEditSubmit = async (data: {
    id: string;
    name: string;
    tags: string[];
    textInfo?: TextContent;
    urlInfo?: { title?: string; description?: string };
    weatherInfo?: WeatherContent;
    csvInfo?: Partial<CsvContent> & { regenerateImage?: boolean };
    csvBackgroundFile?: File | null;
    csvFile?: File | null;
  }) => {
    try {
      // 更新データを構築
      const updateData: Parameters<typeof updateContent>[1] = {
        name: data.name,
        tags: data.tags,
        updatedAt: new Date().toISOString(),
      };

      // コンテンツタイプに応じて追加情報を設定
      if (data.textInfo) {
        updateData.textInfo = data.textInfo;
      }
      if (data.urlInfo && content) {
        // 既存のurlInfo取得のためコンテンツを再取得
        const existingContent = await getContentById(data.id);
        if (existingContent?.urlInfo) {
          updateData.urlInfo = {
            ...existingContent.urlInfo,
            ...data.urlInfo,
          };
        }
      }
      if (data.weatherInfo) {
        updateData.weatherInfo = data.weatherInfo;
      }
      if (data.csvInfo) {
        updateData.csvInfo = data.csvInfo as CsvContent;
      }

      await updateContent(data.id, updateData);
      onContentUpdated?.();

      // コンテンツを再読み込み
      const updatedContent = await getContentById(data.id);
      setContent(updatedContent);

      setIsEditModalOpen(false);
    } catch (error) {
      console.error("Failed to update content:", error);
      throw error; // ContentEditModalでエラーをキャッチできるように再throw
    }
  };

  const handleDelete = async () => {
    if (!content) return;

    try {
      // 使用状況をチェック
      const usageInfo = await checkContentUsageStatus(content.id);

      if (usageInfo.isUsed) {
        // 使用中の場合は強制削除の確認を表示
        modals.openConfirmModal({
          title: "コンテンツを削除",
          children: (
            <Box>
              <Text size="sm" mb="md">
                「{content.name}」を削除しますか？この操作は元に戻せません。
              </Text>
              <Text size="sm" mb="sm">
                このコンテンツは以下のプレイリストで使用されています：
              </Text>
              <List size="sm" mb="md">
                {usageInfo.playlists.map((playlist) => (
                  <List.Item key={playlist.id}>
                    <Text size="sm" fw={500}>
                      {playlist.name} (デバイス: {playlist.device})
                    </Text>
                  </List.Item>
                ))}
              </List>
              <Alert icon={<IconExclamationCircle size={16} />} color="orange" mb="md">
                削除すると、これらのプレイリストからも自動的に削除されます。
              </Alert>
            </Box>
          ),
          labels: { confirm: "削除", cancel: "キャンセル" },
          confirmProps: { color: "red" },
          onConfirm: async () => {
            try {
              await deleteContentForced(content.id);
              onContentDeleted?.();
              onClose();
            } catch (error) {
              console.error("Failed to delete content:", error);
            }
          },
        });
      } else {
        // 使用されていない場合は通常の削除確認
        modals.openConfirmModal({
          title: "コンテンツを削除",
          children: (
            <Box>
              <Text size="sm" mb="md">
                「{content.name}」を削除しますか？この操作は元に戻せません。
              </Text>
              <Alert icon={<IconExclamationCircle size={16} />} color="gray">
                このコンテンツはどのプレイリストでも使用されていません。
              </Alert>
            </Box>
          ),
          labels: { confirm: "削除", cancel: "キャンセル" },
          confirmProps: { color: "red" },
          onConfirm: async () => {
            try {
              await deleteContent(content.id);
              onContentDeleted?.();
              onClose();
            } catch (error) {
              console.error("Failed to delete content:", error);
            }
          },
        });
      }
    } catch (error) {
      console.error("Failed to check content usage:", error);
    }
  };

  const renderNavigationButtons = () => {
    if (!allContents.length || allContents.length <= 1) return null;

    const currentIndex = getCurrentContentIndex();
    const totalCount = allContents.length;

    return (
      <Group justify="space-between" align="center">
        <ActionIcon
          variant="light"
          disabled={!canNavigatePrev()}
          onClick={handleNavigatePrev}
          aria-label="前のコンテンツ"
        >
          <IconChevronLeft size={18} />
        </ActionIcon>

        <Text size="sm" c="dimmed">
          {currentIndex + 1} / {totalCount}
        </Text>

        <ActionIcon
          variant="light"
          disabled={!canNavigateNext()}
          onClick={handleNavigateNext}
          aria-label="次のコンテンツ"
        >
          <IconChevronRight size={18} />
        </ActionIcon>
      </Group>
    );
  };

  const renderActionButtons = () => {
    return (
      <Group justify="space-between">
        <Button variant="light" leftSection={<IconEdit size={16} />} onClick={handleEditStart}>
          編集
        </Button>

        <Button color="red" variant="light" leftSection={<IconTrash size={16} />} onClick={handleDelete}>
          削除
        </Button>
      </Group>
    );
  };

  const getContentInfo = () => {
    if (!content) return null;

    return (
      <Group gap="xs" mt="sm">
        <Text size="sm" c="dimmed">
          タイプ: {getContentTypeLabel(content.type)}
        </Text>
        {content.fileInfo?.size && (
          <Text size="sm" c="dimmed">
            サイズ: {formatFileSize(content.fileInfo.size)}
          </Text>
        )}
        {content.fileInfo?.metadata?.width && content.fileInfo?.metadata?.height && (
          <Text size="sm" c="dimmed">
            解像度: {content.fileInfo.metadata.width}×{content.fileInfo.metadata.height}
          </Text>
        )}
        {content.fileInfo?.metadata?.duration && (
          <Text size="sm" c="dimmed">
            再生時間: {formatDuration(content.fileInfo.metadata.duration)}
          </Text>
        )}
      </Group>
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={getModalTitle()}
      centered
      size="xl"
      styles={{
        content: {
          maxWidth: "90vw",
        },
      }}
    >
      <Stack gap="md">
        {/* ナビゲーションボタン */}
        {renderNavigationButtons()}

        {renderPreview()}

        <Divider />

        {/* コンテンツ情報 */}
        {getContentInfo()}

        {/* アクションボタン */}
        {renderActionButtons()}
      </Stack>

      {/* ContentEditModal */}
      {content && (
        <ContentEditModal
          opened={isEditModalOpen}
          onClose={handleEditModalClose}
          content={content as ContentIndex}
          onSubmit={handleEditSubmit}
        />
      )}
    </Modal>
  );
};

// ヘルパー関数
const extractYouTubeVideoId = (url: string): string | null => {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

const getContentTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    video: "動画",
    image: "画像",
    text: "テキスト",
    youtube: "YouTube",
    url: "URL",
  };
  return labels[type] || type;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
};

const formatDuration = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};
