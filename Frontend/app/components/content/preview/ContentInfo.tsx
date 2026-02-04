import { ActionIcon, Box, Group, Text, Tooltip } from "@mantine/core";
import { IconEdit, IconTrash } from "@tabler/icons-react";
import type { ContentIndex } from "~/types/content";

interface ContentInfoProps {
  content: ContentIndex;
  onEdit?: () => void;
  onDelete?: () => void;
  infoSectionHeight: number;
}

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return "";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
};

export const ContentInfo = ({ content, onEdit, onDelete, infoSectionHeight }: ContentInfoProps) => {
  return (
    <Box
      p="xs"
      style={{
        height: `${infoSectionHeight}px`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
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
    </Box>
  );
};
