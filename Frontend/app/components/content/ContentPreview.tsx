import { ActionIcon, Box, Flex, Group, Image, Paper, Text, Tooltip } from "@mantine/core";
import {
  IconBroadcast,
  IconDownload,
  IconEdit,
  IconFile,
  IconPhoto,
  IconPlayerPlay,
  IconTrash,
  IconVideo,
} from "@tabler/icons-react";
import { memo, useCallback, useEffect, useState } from "react";
import { useContent } from "~/hooks/useContent";
import type { ContentIndex, ContentType } from "~/types/content";

// HTMLエスケープ関数
const escapeHtml = (str: string): string => {
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return str.replace(/[&<>"']/g, (match) => htmlEscapes[match]);
};

// Constants
const PREVIEW_ASPECT_RATIO = 16 / 9;
const INFO_SECTION_HEIGHT = 80;
const BASE_WIDTH = 200;

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return "";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
};

interface ContentPreviewProps {
  content: ContentIndex;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDownload?: () => void;
  aspectRatio?: number;
}

interface PreviewState {
  loading: boolean;
  previewUrl?: string;
  error?: string;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
  };
}

export const ContentPreview = memo(
  ({ content, onClick, onEdit, onDelete, onDownload, aspectRatio = PREVIEW_ASPECT_RATIO }: ContentPreviewProps) => {
    const [previewState, setPreviewState] = useState<PreviewState>({ loading: false });
    const { getFileUrl } = useContent();

    // ダウンロード可能なコンテンツタイプかどうか
    const isDownloadable = content.type === "video" || content.type === "image";

    // Calculate heights based on constants
    const totalHeight = Math.round(BASE_WIDTH / PREVIEW_ASPECT_RATIO) + INFO_SECTION_HEIGHT;
    const imageHeight = totalHeight - INFO_SECTION_HEIGHT;

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
      const svgContent = `
          <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#228be6"/>
            <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-size="14">
              ${escapeHtml("動画")}プレビュー
            </text>
          </svg>
        `;

      const encodedSvg = btoa(
        encodeURIComponent(svgContent).replace(/%([0-9A-F]{2})/g, (_match, p1) => {
          return String.fromCharCode(Number.parseInt(p1, 16));
        }),
      );

      setPreviewState({
        loading: false,
        previewUrl: `data:image/svg+xml;base64,${encodedSvg}`,
      });
    }, [content.thumbnailPath, getFileUrl]);

    const generateImagePreview = useCallback(() => {
      // ContentIndexから直接filePathを使用（APIから返される静的ファイルパス）
      if (content.filePath) {
        const fileUrl = getFileUrl(content.filePath);
        setPreviewState({
          loading: false,
          previewUrl: fileUrl,
          metadata: {},
        });
      } else {
        // フォールバック: プレースホルダー
        const svgContent = `
            <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
              <rect width="100%" height="100%" fill="#40c057"/>
              <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-size="14">
                ${escapeHtml("画像")}プレビュー
              </text>
            </svg>
          `;

        const encodedSvg = btoa(
          encodeURIComponent(svgContent).replace(/%([0-9A-F]{2})/g, (_match, p1) => {
            return String.fromCharCode(Number.parseInt(p1, 16));
          }),
        );

        setPreviewState({
          loading: false,
          previewUrl: `data:image/svg+xml;base64,${encodedSvg}`,
        });
      }
    }, [content.filePath, getFileUrl]);

    const generateHlsPlaceholder = useCallback(() => {
      // HLSはプレースホルダーを表示
      const svgContent = `
          <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#be4bdb"/>
            <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-size="14">
              HLSストリーム
            </text>
          </svg>
        `;

      const encodedSvg = btoa(
        encodeURIComponent(svgContent).replace(/%([0-9A-F]{2})/g, (_match, p1) => {
          return String.fromCharCode(Number.parseInt(p1, 16));
        }),
      );

      setPreviewState({
        loading: false,
        previewUrl: `data:image/svg+xml;base64,${encodedSvg}`,
      });
    }, []);

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
          generateHlsPlaceholder();
          break;
        default:
          setPreviewState({ loading: false, error: "Unknown content type" });
      }
    }, [content.type, generateVideoPreview, generateImagePreview, generateHlsPlaceholder]);

    useEffect(() => {
      generatePreview();
    }, [generatePreview]);

    const getTypeIcon = (type: ContentType) => {
      const iconProps = { size: 16 };
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

    const formatDuration = (seconds: number): string => {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
    };

    // Shared component for content info section
    const ContentInfo = () => (
      <Flex p="xs" h={INFO_SECTION_HEIGHT} style={{ overflow: "hidden" }} direction="column" justify="space-between">
        {/* 1段目: 名前 */}
        <Tooltip label={content.name} disabled={content.name.length <= 20}>
          <Text size="sm" fw={500} lineClamp={1}>
            {content.name}
          </Text>
        </Tooltip>

        {/* 2段目: サイズ */}
        <Box>
          {content.size ? (
            <Text size="xs" c="dimmed">
              {formatFileSize(content.size)}
            </Text>
          ) : (
            <Text size="xs" c="transparent">
              &nbsp;
            </Text>
          )}
        </Box>

        {/* 3段目: 日付とボタン */}
        <Group justify="space-between" align="center">
          <Text size="xs" c="dimmed">
            {new Date(content.createdAt).toLocaleDateString("ja-JP")}
          </Text>

          <Group gap="xs" className="content-actions" style={{ opacity: 1, transition: "opacity 0.2s ease" }}>
            {isDownloadable && onDownload && (
              <ActionIcon
                size="xs"
                variant="subtle"
                color="green"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload();
                }}
                aria-label="ダウンロード"
              >
                <IconDownload size={12} />
              </ActionIcon>
            )}
            {onEdit && (
              <ActionIcon
                size="xs"
                variant="subtle"
                color="blue"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                aria-label="編集"
              >
                <IconEdit size={12} />
              </ActionIcon>
            )}
            {onDelete && (
              <ActionIcon
                size="xs"
                variant="subtle"
                color="red"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                aria-label="削除"
              >
                <IconTrash size={12} />
              </ActionIcon>
            )}
          </Group>
        </Group>
      </Flex>
    );

    if (previewState.loading) {
      return (
        <Paper
          withBorder
          p={0}
          w="100%"
          h={totalHeight}
          style={{
            cursor: onClick ? "pointer" : "default",
          }}
          styles={{
            root: {
              "&:hover .content-actions, &:focus-within .content-actions, &:active .content-actions": {
                opacity: 1,
              },
              "@media (hover: none)": {
                "& .content-actions": {
                  opacity: 1,
                },
              },
            },
          }}
          onClick={onClick}
        >
          <Box pos="relative">
            {/* ローディング表示 */}
            <Flex h={imageHeight} w="100%" style={{ overflow: "hidden" }} align="center" justify="center" bg="gray.0">
              <Text size="sm" c="dimmed">
                読み込み中...
              </Text>
            </Flex>

            {/* タイプバッジ */}
            <Flex
              pos="absolute"
              top="4px"
              left="4px"
              bg={`${getTypeColor(content.type)}.6`}
              c="white"
              p="2px 6px"
              fz="10px"
              style={{ borderRadius: "var(--mantine-radius-xs)" }}
              align="center"
              gap="4px"
            >
              {getTypeIcon(content.type)}
            </Flex>
          </Box>

          <ContentInfo />
        </Paper>
      );
    }

    if (previewState.error) {
      return (
        <Paper
          withBorder
          p={0}
          w="100%"
          h={totalHeight}
          style={{
            cursor: onClick ? "pointer" : "default",
          }}
          styles={{
            root: {
              "&:hover .content-actions, &:focus-within .content-actions, &:active .content-actions": {
                opacity: 1,
              },
              "@media (hover: none)": {
                "& .content-actions": {
                  opacity: 1,
                },
              },
            },
          }}
          onClick={onClick}
        >
          <Box pos="relative">
            {/* プレビューエラー表示 */}
            <Flex
              h={imageHeight}
              w="100%"
              style={{ overflow: "hidden" }}
              direction="column"
              align="center"
              justify="center"
              bg="gray.0"
            >
              {getTypeIcon(content.type)}
              <Text size="xs" c="dimmed" mt="xs" ta="center">
                プレビュー未対応
              </Text>
            </Flex>

            {/* タイプバッジ */}
            <Flex
              pos="absolute"
              top="4px"
              left="4px"
              bg={`${getTypeColor(content.type)}.6`}
              c="white"
              p="2px 6px"
              fz="10px"
              style={{ borderRadius: "var(--mantine-radius-xs)" }}
              align="center"
              gap="4px"
            >
              {getTypeIcon(content.type)}
            </Flex>
          </Box>

          <ContentInfo />
        </Paper>
      );
    }

    return (
      <Paper
        withBorder
        p={0}
        w="100%"
        style={{
          cursor: onClick ? "pointer" : "default",
          aspectRatio: aspectRatio.toString(),
        }}
        styles={{
          root: {
            "&:hover .content-actions, &:focus-within .content-actions, &:active .content-actions": {
              opacity: 1,
            },
            "@media (hover: none)": {
              "& .content-actions": {
                opacity: 1,
              },
            },
          },
        }}
        onClick={onClick}
      >
        <Box pos="relative">
          {/* プレビュー画像 */}
          <Flex h={imageHeight} w="100%" style={{ overflow: "hidden" }} align="center" justify="center" bg="gray.0">
            <Image
              src={previewState.previewUrl}
              alt={content.name}
              maw="100%"
              mah="100%"
              fit="contain"
              fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjFmM2Y0Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjOWNhM2FmIiBmb250LXNpemU9IjE0Ij5ObyBQcmV2aWV3PC90ZXh0Pjwvc3ZnPg=="
            />
          </Flex>

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
              <IconPlayerPlay size={24} color="white" />
            </Flex>
          )}

          {/* 時間表示（動画の場合） */}
          {content.type === "video" && previewState.metadata?.duration && (
            <Box
              pos="absolute"
              bottom="4px"
              right="4px"
              bg="rgba(0, 0, 0, 0.8)"
              c="white"
              p="2px 6px"
              fz="11px"
              style={{ borderRadius: "var(--mantine-radius-xs)" }}
            >
              {formatDuration(previewState.metadata.duration)}
            </Box>
          )}

          {/* タイプバッジ */}
          <Flex
            pos="absolute"
            top="4px"
            left="4px"
            bg={`${getTypeColor(content.type)}.6`}
            c="white"
            p="2px 6px"
            fz="10px"
            style={{ borderRadius: "var(--mantine-radius-xs)" }}
            align="center"
            gap="4px"
          >
            {getTypeIcon(content.type)}
          </Flex>
        </Box>

        <ContentInfo />
      </Paper>
    );
  },
);

ContentPreview.displayName = "ContentPreview";
