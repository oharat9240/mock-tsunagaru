import { Box, Flex, Group, HoverCard, Image, Paper, Text } from "@mantine/core";
import {
  IconBrandYoutube,
  IconFile,
  IconFileText,
  IconLink,
  IconPhoto,
  IconPlayerPlay,
  IconVideo,
} from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { useContent } from "~/hooks/useContent";
import type { ContentIndex, ContentType } from "~/types/content";

const extractYouTubeVideoId = (url: string): string | null => {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

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
  const { getThumbnailUrl } = useContent();

  // HoverCardの幅と高さを大きく設定
  const CARD_WIDTH = 400;
  const IMAGE_HEIGHT = 225; // 16:9のアスペクト比を維持

  const generateFilePreview = useCallback(async () => {
    try {
      // 事前生成されたサムネイルを取得
      const thumbnailUrl = await getThumbnailUrl(content.id);

      if (thumbnailUrl) {
        setPreviewState({
          loading: false,
          previewUrl: thumbnailUrl,
        });
      } else {
        throw new Error("サムネイルが見つかりません");
      }
    } catch (_error) {
      // フォールバック: タイプ別プレースホルダー
      const typeLabels = {
        video: "Video",
        image: "Image",
        text: "Text",
      };
      const typeColors = {
        video: "#228be6",
        image: "#40c057",
        text: "#fd7e14",
      };

      const label = typeLabels[content.type as keyof typeof typeLabels] || "File";
      const color = typeColors[content.type as keyof typeof typeColors] || "#6c757d";

      setPreviewState({
        loading: false,
        previewUrl:
          "data:image/svg+xml;base64," +
          btoa(`
            <svg width="400" height="225" xmlns="http://www.w3.org/2000/svg">
              <rect width="100%" height="100%" fill="${color}"/>
              <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-size="16">
                ${label} Preview
              </text>
            </svg>
          `),
      });
    }
  }, [content.id, content.type, getThumbnailUrl]);

  const generateYouTubePreview = useCallback(async () => {
    try {
      if (!content.url) {
        throw new Error("YouTube URL が見つかりません");
      }

      const videoId = extractYouTubeVideoId(content.url);
      if (videoId) {
        setPreviewState({
          loading: false,
          previewUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        });
      } else {
        throw new Error("YouTube動画IDの抽出に失敗");
      }
    } catch (_error) {
      setPreviewState({
        loading: false,
        error: "YouTubeプレビュー生成に失敗",
      });
    }
  }, [content.url]);

  const generateUrlPreview = useCallback(async () => {
    try {
      const hostname = new URL(content.url || "").hostname;
      setPreviewState({
        loading: false,
        previewUrl:
          "data:image/svg+xml;base64," +
          btoa(`
          <svg width="400" height="225" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#7950f2"/>
            <text x="50%" y="30%" text-anchor="middle" dy=".3em" fill="white" font-size="14">
              Web Page
            </text>
            <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-size="12">
              ${hostname}
            </text>
            <text x="50%" y="70%" text-anchor="middle" dy=".3em" fill="white" font-size="10">
              Click to access
            </text>
          </svg>
        `),
      });
    } catch (_error) {
      setPreviewState({
        loading: false,
        error: "URLプレビュー生成に失敗",
      });
    }
  }, [content.url]);

  const generatePreview = useCallback(async () => {
    setPreviewState({ loading: true });

    try {
      switch (content.type) {
        case "video":
        case "image":
        case "text":
          await generateFilePreview();
          break;
        case "youtube":
          await generateYouTubePreview();
          break;
        case "url":
          await generateUrlPreview();
          break;
        default:
          setPreviewState({ loading: false, error: "Unknown content type" });
      }
    } catch (error) {
      console.error("Preview generation failed:", error);
      setPreviewState({
        loading: false,
        error: error instanceof Error ? error.message : "プレビュー生成に失敗しました",
      });
    }
  }, [content.type, generateFilePreview, generateYouTubePreview, generateUrlPreview]);

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
      case "text":
        return <IconFileText {...iconProps} />;
      case "youtube":
        return <IconBrandYoutube {...iconProps} />;
      case "url":
        return <IconLink {...iconProps} />;
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
      case "text":
        return "orange";
      case "youtube":
        return "red";
      case "url":
        return "purple";
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

  // プレビューを表示しないタイプの場合は、HoverCardを無効にする
  const shouldShowPreview = content.type === "video" || content.type === "image" || content.type === "youtube";

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
          {(content.type === "video" || content.type === "youtube") && (
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
            {content.url && !content.size && (
              <Text size="xs" c="dimmed" lineClamp={1} maw="120px">
                {new URL(content.url).hostname}
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
