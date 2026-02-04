import { Box, Flex, Image } from "@mantine/core";
import { IconPlayerPlay } from "@tabler/icons-react";
import type { PreviewState } from "~/hooks/useContentPreview";
import type { ContentType } from "~/types/content";
import { ContentTypeBadge } from "./ContentTypeBadge";

interface PreviewImageProps {
  contentName: string;
  contentType: ContentType;
  previewState: PreviewState;
  imageHeight: number;
}

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

export const PreviewImage = ({ contentName, contentType, previewState, imageHeight }: PreviewImageProps) => {
  return (
    <Box pos="relative">
      {/* プレビュー画像 */}
      <Box
        style={{
          height: imageHeight,
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
          alt={contentName}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
          }}
          fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjFmM2Y0Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjOWNhM2FmIiBmb250LXNpemU9IjE0Ij5ObyBQcmV2aWV3PC90ZXh0Pjwvc3ZnPg=="
        />
      </Box>

      {/* オーバーレイアイコン */}
      {(contentType === "video" || contentType === "youtube") && (
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
      {(contentType === "video" || contentType === "youtube") && previewState.metadata?.duration && (
        <Box
          pos="absolute"
          bottom="4px"
          right="4px"
          bg="rgba(0, 0, 0, 0.8)"
          c="white"
          p="2px 6px"
          style={{ borderRadius: "4px", fontSize: "11px" }}
        >
          {formatDuration(previewState.metadata.duration)}
        </Box>
      )}

      {/* タイプバッジ */}
      <ContentTypeBadge contentType={contentType} />
    </Box>
  );
};
