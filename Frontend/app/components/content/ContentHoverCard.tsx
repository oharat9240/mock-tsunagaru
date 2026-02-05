import { Box, Flex, Group, HoverCard, Image, Paper, Text } from "@mantine/core";
import { IconBroadcast, IconFile, IconPhoto, IconPlayerPlay, IconVideo } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { useContent } from "~/hooks/useContent";
import type { ContentIndex, ContentType } from "~/types/content";

interface ContentHoverCardProps {
  content: ContentIndex;
  children: React.ReactNode;
  disabled?: boolean;
}

interface PreviewState {
  loading: boolean;
  previewUrl?: string;
  error?: string;
}

export const ContentHoverCard = ({ content, children, disabled = false }: ContentHoverCardProps) => {
  const [previewState, setPreviewState] = useState<PreviewState>({ loading: false });
  const { getFileUrl } = useContent();

  // HoverCardの幅と高さを大きく設定
  const CARD_WIDTH = 400;
  const IMAGE_HEIGHT = 225; // 16:9のアスペクト比を維持

  const generateVideoPreview = useCallback(() => {
    // サムネイルがある場合はそれを使用
    if (content.thumbnailPath) {
      const thumbnailUrl = getFileUrl(content.thumbnailPath);
      setPreviewState({
        loading: false,
        previewUrl: thumbnailUrl,
      });
      return;
    }

    // サムネイルがない場合はプレースホルダーを表示
    setPreviewState({
      loading: false,
      previewUrl:
        "data:image/svg+xml;base64," +
        btoa(`
          <svg width="400" height="225" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#228be6"/>
            <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-size="16">
              Video Preview
            </text>
          </svg>
        `),
    });
  }, [content.thumbnailPath, getFileUrl]);

  const generateImagePreview = useCallback(() => {
    // ContentIndexから直接filePathを使用（APIから返される静的ファイルパス）
    if (content.filePath) {
      const fileUrl = getFileUrl(content.filePath);
      setPreviewState({
        loading: false,
        previewUrl: fileUrl,
      });
    } else {
      // フォールバック: プレースホルダー
      setPreviewState({
        loading: false,
        previewUrl:
          "data:image/svg+xml;base64," +
          btoa(`
            <svg width="400" height="225" xmlns="http://www.w3.org/2000/svg">
              <rect width="100%" height="100%" fill="#40c057"/>
              <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-size="16">
                Image Preview
              </text>
            </svg>
          `),
      });
    }
  }, [content.filePath, getFileUrl]);

  const generatePreview = useCallback(() => {
    setPreviewState({ loading: true });

    switch (content.type) {
      case "video":
        generateVideoPreview();
        break;
      case "image":
        generateImagePreview();
        break;
      case "hls":
        // HLSはプレースホルダー
        setPreviewState({
          loading: false,
          previewUrl:
            "data:image/svg+xml;base64," +
            btoa(`
                <svg width="400" height="225" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100%" height="100%" fill="#be4bdb"/>
                  <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-size="16">
                    HLS Stream
                  </text>
                </svg>
              `),
        });
        break;
      default:
        setPreviewState({ loading: false, error: "Unknown content type" });
    }
  }, [content.type, generateVideoPreview, generateImagePreview]);

  useEffect(() => {
    if (!disabled) {
      generatePreview();
    }
  }, [generatePreview, disabled]);

  const getTypeIcon = (type: ContentType) => {
    const iconProps = { size: 14 };
    switch (type) {
      case "video":
        return <IconVideo {...iconProps} />;
      case "image":
        return <IconPhoto {...iconProps} />;
      case "hls":
        return <IconBroadcast {...iconProps} />;
      default:
        return <IconFile {...iconProps} />;
    }
  };

  const getTypeColor = (type: ContentType) => {
    switch (type) {
      case "video":
        return "blue";
      case "image":
        return "green";
      case "hls":
        return "violet";
      default:
        return "gray";
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return "";
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
  };

  // プレビューを表示するタイプ
  const shouldShowPreview = content.type === "video" || content.type === "image";

  if (disabled || !shouldShowPreview) {
    return <>{children}</>;
  }

  const renderPreviewContent = () => {
    if (previewState.loading) {
      return (
        <Box w={CARD_WIDTH} h={300} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Text size="sm" c="dimmed">
            読み込み中...
          </Text>
        </Box>
      );
    }

    if (previewState.error) {
      return (
        <Box
          w={CARD_WIDTH}
          h={300}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
        >
          {getTypeIcon(content.type)}
          <Text size="xs" c="dimmed" mt="xs" ta="center">
            プレビュー未対応
          </Text>
        </Box>
      );
    }

    return (
      <Paper withBorder p={0} w={CARD_WIDTH}>
        <Box pos="relative">
          {/* プレビュー画像 */}
          <Box
            style={{
              height: IMAGE_HEIGHT,
              width: "100%",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#f8f9fa",
            }}
          >
            <Image
              src={previewState.previewUrl}
              alt={content.name}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
              }}
              fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIyNSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjFmM2Y0Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjOWNhM2FmIiBmb250LXNpemU9IjE2Ij5ObyBQcmV2aWV3PC90ZXh0Pjwvc3ZnPg=="
            />
          </Box>

          {/* オーバーレイアイコン */}
          {content.type === "video" && (
            <Flex
              pos="absolute"
              top="50%"
              left="50%"
              style={{ transform: "translate(-50%, -50%)", borderRadius: "50%" }}
              bg="rgba(0, 0, 0, 0.7)"
              p="8px"
              align="center"
              justify="center"
            >
              <IconPlayerPlay size={32} color="white" />
            </Flex>
          )}

          {/* タイプバッジ */}
          <Flex
            pos="absolute"
            top="4px"
            left="4px"
            bg={`${getTypeColor(content.type)}.6`}
            c="white"
            p="2px 6px"
            style={{ borderRadius: "4px", fontSize: "10px" }}
            align="center"
            gap="4px"
          >
            {getTypeIcon(content.type)}
          </Flex>
        </Box>

        {/* コンテンツ情報 */}
        <Box p="md">
          <Text size="md" fw={600} lineClamp={1} mb="xs">
            {content.name}
          </Text>

          <Group justify="space-between" mb="xs">
            {content.size && (
              <Text size="xs" c="dimmed">
                {formatFileSize(content.size)}
              </Text>
            )}
            <Text size="xs" c="dimmed">
              {new Date(content.createdAt).toLocaleDateString("ja-JP")}
            </Text>
          </Group>

          {/* タグ表示 */}
          {content.tags.length > 0 && (
            <Group gap={4}>
              {content.tags.slice(0, 3).map((tag) => (
                <Text
                  key={tag}
                  size="xs"
                  bg="gray.1"
                  c="gray.7"
                  style={{
                    padding: "2px 6px",
                    borderRadius: "4px",
                  }}
                >
                  {tag}
                </Text>
              ))}
              {content.tags.length > 3 && (
                <Text size="xs" c="dimmed">
                  +{content.tags.length - 3}
                </Text>
              )}
            </Group>
          )}
        </Box>
      </Paper>
    );
  };

  return (
    <HoverCard width={CARD_WIDTH} shadow="md" openDelay={300} closeDelay={100} position="right" withArrow>
      <HoverCard.Target>{children}</HoverCard.Target>
      <HoverCard.Dropdown p={0}>{renderPreviewContent()}</HoverCard.Dropdown>
    </HoverCard>
  );
};
