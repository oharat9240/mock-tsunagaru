import { ActionIcon, Badge, Box, Group, Table, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { showNotification } from "@mantine/notifications";
import { IconEdit, IconEye, IconTrash, IconX } from "@tabler/icons-react";
import { ContentHoverCard } from "~/components/content/ContentHoverCard";
import type { ContentIndex } from "~/types/content";
import { formatFileSize, getContentTypeBadge } from "~/utils/contentTypeUtils";
import { logger } from "~/utils/logger";

interface ContentTableViewProps {
  contents: ContentIndex[];
  loading: boolean;
  onContentClick: (contentId: string) => void;
  onContentEdit: (content: ContentIndex) => void;
  onContentDelete: (contentId: string, contentName: string) => Promise<void>;
  checkContentUsageStatus: (
    contentId: string,
  ) => Promise<{ isUsed: boolean; playlists: Array<{ id: string; name: string }> }>;
}

export const ContentTableView = ({
  contents,
  loading,
  onContentClick,
  onContentEdit,
  onContentDelete,
  checkContentUsageStatus,
}: ContentTableViewProps) => {
  const handleDelete = async (content: ContentIndex) => {
    try {
      // 使用状況をチェック
      const usageInfo = await checkContentUsageStatus(content.id);

      if (usageInfo.isUsed) {
        // 使用中の場合は削除できない旨を表示
        modals.openConfirmModal({
          title: "削除できません",
          children: (
            <Box>
              <Text size="sm" mb="md">
                このコンテンツは以下のプレイリストで使用されているため削除できません：
              </Text>
              <Box mb="md">
                {usageInfo.playlists.map((playlist) => (
                  <Badge key={playlist.id} variant="light" mb="xs" mr="xs">
                    {playlist.name}
                  </Badge>
                ))}
              </Box>
              <Text size="sm" c="dimmed">
                削除するには、まずプレイリストからコンテンツを削除してください。
              </Text>
            </Box>
          ),
          labels: { confirm: "OK", cancel: "" },
          cancelProps: { display: "none" },
        });
        return;
      }

      // 使用されていない場合は削除確認
      modals.openConfirmModal({
        title: "コンテンツの削除",
        children: (
          <Text size="sm">
            「{content.name}」を削除してもよろしいですか？
            <br />
            この操作は元に戻せません。
          </Text>
        ),
        labels: { confirm: "削除", cancel: "キャンセル" },
        confirmProps: { color: "red" },
        onConfirm: async () => {
          try {
            await onContentDelete(content.id, content.name);
            showNotification({
              title: "削除完了",
              message: "コンテンツが削除されました",
              color: "green",
            });
          } catch (error) {
            logger.error("ContentTableView", "Content deletion failed", error);
            const errorMessage = error instanceof Error ? error.message : "コンテンツの削除中にエラーが発生しました";
            showNotification({
              title: "削除エラー",
              message: errorMessage,
              color: "red",
              icon: <IconX size={18} />,
              autoClose: false,
            });
          }
        },
      });
    } catch (error) {
      logger.error("ContentTableView", "Usage check failed", error);
      showNotification({
        title: "エラー",
        message: "使用状況の確認中にエラーが発生しました",
        color: "red",
      });
    }
  };

  if (loading) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        読み込み中...
      </Text>
    );
  }

  if (contents.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        コンテンツがありません。「コンテンツを追加」ボタンから新しいコンテンツを追加してください。
      </Text>
    );
  }

  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>名前</Table.Th>
          <Table.Th>タイプ</Table.Th>
          <Table.Th>サイズ</Table.Th>
          <Table.Th>タグ</Table.Th>
          <Table.Th>作成日時</Table.Th>
          <Table.Th>操作</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {contents.map((content) => (
          <Table.Tr key={content.id}>
            <Table.Td>
              <ContentHoverCard content={content}>
                <Text
                  size="sm"
                  style={{ cursor: "pointer" }}
                  c="blue"
                  td="underline"
                  onClick={() => onContentClick(content.id)}
                >
                  {content.name}
                </Text>
              </ContentHoverCard>
            </Table.Td>
            <Table.Td>{getContentTypeBadge(content.type)}</Table.Td>
            <Table.Td>
              <Text size="sm">{formatFileSize(content.size ?? undefined)}</Text>
            </Table.Td>
            <Table.Td>
              <Group gap={4}>
                {content.tags.map((tag) => (
                  <Badge key={tag} size="sm" variant="light">
                    {tag}
                  </Badge>
                ))}
              </Group>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{new Date(content.createdAt).toLocaleString("ja-JP")}</Text>
            </Table.Td>
            <Table.Td>
              <Group gap="xs">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  onClick={() => onContentClick(content.id)}
                  aria-label="プレビュー"
                >
                  <IconEye size={16} />
                </ActionIcon>
                <ActionIcon size="sm" variant="subtle" onClick={() => onContentEdit(content)} aria-label="編集">
                  <IconEdit size={16} />
                </ActionIcon>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="red"
                  onClick={() => handleDelete(content)}
                  aria-label="削除"
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
};
