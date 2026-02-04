import { ActionIcon, AspectRatio, Box, Flex, Group, Image, Paper, Text, Tooltip } from "@mantine/core";
import {
  IconBrandYoutube,
  IconCloud,
  IconDownload,
  IconEdit,
  IconFile,
  IconFileSpreadsheet,
  IconFileText,
  IconLink,
  IconPhoto,
  IconPlayerPlay,
  IconTrash,
  IconVideo,
} from "@tabler/icons-react";
import { memo, useCallback, useEffect, useState } from "react";
import { useContent } from "~/hooks/useContent";
import type { ContentIndex, ContentType } from "~/types/content";
import { checkIframeEmbeddability, getIframeSandboxAttributes } from "~/utils/urlValidator";

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
const INFO_SECTION_HEIGHT = 80; // 情報エリアの高さを80pxに増加（3段レイアウト用）
const BASE_WIDTH = 200;

const extractYouTubeVideoId = (url: string): string | null => {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

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
  aspectRatio?: number; // 幅対高さの比率 (デフォルト: 3:2)
}

interface PreviewState {
  loading: boolean;
  previewUrl?: string;
  error?: string;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    isIframe?: boolean;
  };
}

export const ContentPreview = memo(
  ({ content, onClick, onEdit, onDelete, onDownload, aspectRatio = PREVIEW_ASPECT_RATIO }: ContentPreviewProps) => {
    const [previewState, setPreviewState] = useState<PreviewState>({ loading: false });
    const { getThumbnailUrl, getContentById } = useContent();

    // ダウンロード可能なコンテンツタイプかどうか
    const isDownloadable = content.type === "video" || content.type === "image";

    // Calculate heights based on constants
    const totalHeight = Math.round(BASE_WIDTH / PREVIEW_ASPECT_RATIO) + INFO_SECTION_HEIGHT;
    const imageHeight = totalHeight - INFO_SECTION_HEIGHT;

    const generateFilePreview = useCallback(async () => {
      try {
        // 事前生成されたサムネイルを取得
        const thumbnailUrl = await getThumbnailUrl(content.id);

        if (thumbnailUrl) {
          setPreviewState({
            loading: false,
            previewUrl: thumbnailUrl,
            metadata: {}, // メタデータは必要に応じて別途取得
          });
        } else {
          // サムネイルが存在しない場合はプレースホルダー
          throw new Error("サムネイルが見つかりません");
        }
      } catch (_error) {
        // フォールバック: タイプ別プレースホルダー
        const typeLabels = {
          video: "動画",
          image: "画像",
          text: "テキスト",
        };
        const typeColors = {
          video: "#228be6",
          image: "#40c057",
          text: "#fd7e14",
        };

        const label = typeLabels[content.type as keyof typeof typeLabels] || "ファイル";
        const color = typeColors[content.type as keyof typeof typeColors] || "#6c757d";

        const svgContent = `
            <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
              <rect width="100%" height="100%" fill="${color}"/>
              <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-size="14">
                ${escapeHtml(label)}プレビュー
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
    }, [content.id, content.type, getThumbnailUrl]);

    const generateYouTubePreview = useCallback(async () => {
      try {
        if (!content.url) {
          throw new Error("YouTube URL が見つかりません");
        }

        // YouTube動画IDを抽出
        const videoId = extractYouTubeVideoId(content.url);
        if (videoId) {
          // YouTubeサムネイルを使用
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
        if (!content.url) {
          throw new Error("URLが見つかりません");
        }

        // URLのiframe埋め込み可能性をチェック
        const { embeddable } = await checkIframeEmbeddability(content.url);

        if (!embeddable) {
          // 埋め込み不可能な場合はプレースホルダーを表示
          const svgContent = `
            <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
              <rect width="100%" height="100%" fill="#7950f2"/>
              <text x="50%" y="30%" text-anchor="middle" dy=".3em" fill="white" font-size="12">
                Webページ
              </text>
              <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-size="10">
                ${escapeHtml(new URL(content.url || "").hostname)}
              </text>
              <text x="50%" y="70%" text-anchor="middle" dy=".3em" fill="white" font-size="8">
                iframe埋め込み不可
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
        } else {
          // 埋め込み可能な場合はiframeのURLを設定
          setPreviewState({
            loading: false,
            previewUrl: content.url,
            metadata: { isIframe: true }, // iframeであることを示すフラグ
          });
        }
      } catch (_error) {
        setPreviewState({
          loading: false,
          error: "URLプレビュー生成に失敗",
        });
      }
    }, [content.url]);

    const generateTextPreview = useCallback(async () => {
      try {
        const contentDetail = await getContentById(content.id);
        if (!contentDetail?.textInfo) {
          throw new Error("テキスト情報が見つかりません");
        }

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
        } = contentDetail.textInfo;

        // スクロールアニメーションのCSS
        // SVG内では100% = estimatedWidth pxなので、-100% - estimatedWidth px = -200%相当
        const scrollAnimation =
          scrollType !== "none"
            ? `@keyframes textScroll {
              0% { transform: translate${scrollType === "horizontal" ? "X" : "Y"}(100%); }
              100% { transform: translate${scrollType === "horizontal" ? "X" : "Y"}(-200%); }
            }`
            : "";

        const animationStyle =
          scrollType !== "none" ? `animation: textScroll ${11 - scrollSpeed}s linear infinite;` : "";

        // テキストの長さに応じて適切な幅を計算
        const textLength = textContent.replace(/\n/g, " ").length;
        const estimatedWidth = Math.max(320, Math.min(textLength * Math.min(fontSize, 24) * 0.6, 800));

        // SVGをUTF-8対応でエンコード
        const svgContent = `
            <svg width="${estimatedWidth}" height="180" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${estimatedWidth} 180" preserveAspectRatio="xMidYMid slice">
              <defs>
                <style>
                  ${scrollAnimation}
                  .text-content {
                    font-family: ${fontFamily};
                    font-size: ${Math.min(fontSize, 24)}px;
                    fill: ${color};
                    text-anchor: ${textAlign === "center" ? "middle" : textAlign === "end" ? "end" : "start"};
                    writing-mode: ${writingMode === "vertical" ? "tb-rl" : "lr-tb"};
                    ${animationStyle}
                  }
                  .container {
                    overflow: visible;
                  }
                </style>
              </defs>
              <rect width="100%" height="100%" fill="${backgroundColor}"/>
              <foreignObject width="100%" height="100%" class="container">
                <div xmlns="http://www.w3.org/1999/xhtml" style="
                  width: 100%;
                  height: 100%;
                  display: flex;
                  align-items: center;
                  justify-content: ${textAlign === "center" ? "center" : textAlign === "end" ? "flex-end" : "flex-start"};
                  padding: 10px;
                  box-sizing: border-box;
                  font-family: ${fontFamily};
                  font-size: ${Math.min(fontSize, 24)}px;
                  color: ${color};
                  writing-mode: ${writingMode === "vertical" ? "vertical-rl" : "horizontal-tb"};
                  white-space: nowrap;
                  ${scrollType !== "none" ? animationStyle : ""}
                ">
                  ${escapeHtml(textContent.replace(/\n/g, " "))}
                </div>
              </foreignObject>
            </svg>
          `;

        // UTF-8文字列をbase64エンコード
        const encodedSvg = btoa(
          encodeURIComponent(svgContent).replace(/%([0-9A-F]{2})/g, (_match, p1) => {
            return String.fromCharCode(Number.parseInt(p1, 16));
          }),
        );

        setPreviewState({
          loading: false,
          previewUrl: `data:image/svg+xml;base64,${encodedSvg}`,
        });
      } catch (_error) {
        setPreviewState({
          loading: false,
          error: "テキストプレビュー生成に失敗",
        });
      }
    }, [content.id, getContentById]);

    const generateWeatherPreview = useCallback(async () => {
      try {
        const contentDetail = await getContentById(content.id);
        if (!contentDetail?.weatherInfo) {
          throw new Error("気象情報が見つかりません");
        }

        const { locations, weatherType, apiUrl } = contentDetail.weatherInfo;

        // 実際のAPI URLを構築
        const locationsParam = locations.length === 1 ? `location=${locations[0]}` : `locations=${locations.join(",")}`;
        const weatherUrl = `${apiUrl}/api/image/${weatherType}?${locationsParam}`;

        // 実際の気象情報画像URLをプレビューとして使用
        setPreviewState({
          loading: false,
          previewUrl: weatherUrl,
        });
      } catch (_error) {
        // フォールバック用のSVGプレビュー
        const svgContent = `
          <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#0891b2"/>
            <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-size="14">
              気象情報
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
    }, [content.id, getContentById]);

    const generateCsvPreview = useCallback(async () => {
      try {
        const contentDetail = await getContentById(content.id);
        if (!contentDetail?.csvInfo) {
          throw new Error("CSV情報が見つかりません");
        }

        // 生成された画像を取得
        const thumbnailUrl = await getThumbnailUrl(content.id);

        if (thumbnailUrl) {
          setPreviewState({
            loading: false,
            previewUrl: thumbnailUrl,
          });
        } else {
          // サムネイルが見つからない場合はフォールバック
          throw new Error("生成された画像が見つかりません");
        }
      } catch (_error) {
        // フォールバック用のSVGプレビュー
        const svgContent = `
          <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#10b981"/>
            <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-size="14">
              CSVデータ
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
    }, [content.id, getContentById, getThumbnailUrl]);

    const generatePreview = useCallback(async () => {
      setPreviewState({ loading: true });

      try {
        switch (content.type) {
          case "video":
          case "image":
            await generateFilePreview();
            break;
          case "text":
            await generateTextPreview();
            break;
          case "youtube":
            await generateYouTubePreview();
            break;
          case "url":
            await generateUrlPreview();
            break;
          case "weather":
            await generateWeatherPreview();
            break;
          case "csv":
            await generateCsvPreview();
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
    }, [
      content.type,
      generateFilePreview,
      generateYouTubePreview,
      generateUrlPreview,
      generateTextPreview,
      generateWeatherPreview,
      generateCsvPreview,
    ]);

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
        case "text":
          return <IconFileText {...iconProps} />;
        case "youtube":
          return <IconBrandYoutube {...iconProps} />;
        case "url":
          return <IconLink {...iconProps} />;
        case "weather":
          return <IconCloud {...iconProps} />;
        case "csv":
          return <IconFileSpreadsheet {...iconProps} />;
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
        case "weather":
          return "teal";
        case "csv":
          return "green";
        default:
          return "gray";
      }
    };

    const formatDuration = (seconds: number): string => {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
    };

    // Shared component for content info section (3段レイアウト)
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
            {content.type === "url" && previewState.metadata?.isIframe ? (
              <AspectRatio ratio={16 / 9} w="100%" h="100%">
                <Box
                  style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                  }}
                >
                  <iframe
                    src={previewState.previewUrl}
                    title={content.name}
                    width="1920"
                    height="1080"
                    sandbox={getIframeSandboxAttributes()}
                    loading="lazy"
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
                      // グリッドビューの場合のスケールファクター
                      ["--scale-factor" as string]: `${BASE_WIDTH / 1920}`, // 200px幅の場合: 200 / 1920 ≈ 0.104
                    }}
                  />
                </Box>
              </AspectRatio>
            ) : (
              <Image
                src={previewState.previewUrl}
                alt={content.name}
                maw="100%"
                mah="100%"
                fit="contain"
                fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjFmM2Y0Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjOWNhM2FmIiBmb250LXNpemU9IjE0Ij5ObyBQcmV2aWV3PC90ZXh0Pjwvc3ZnPg=="
              />
            )}
          </Flex>

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
              <IconPlayerPlay size={24} color="white" />
            </Flex>
          )}

          {/* 時間表示（動画の場合） */}
          {(content.type === "video" || content.type === "youtube") && previewState.metadata?.duration && (
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
