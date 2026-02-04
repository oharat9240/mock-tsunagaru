import { ActionIcon, Alert, Badge, Box, Button, Group, List, LoadingOverlay, Table, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import {
  IconDownload,
  IconEdit,
  IconExclamationCircle,
  IconEye,
  IconLayoutGrid,
  IconList,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useAtom } from "jotai";
import { useCallback, useEffect } from "react";
import { ContentAddHandler } from "~/components/content/ContentAddHandler";
import { ContentFilters } from "~/components/content/ContentFilters";
import { ContentGridView } from "~/components/content/ContentGridView";
import { ContentHoverCard } from "~/components/content/ContentHoverCard";
import { ContentEditModal } from "~/components/modals/ContentEditModal";
import { ContentPreviewModal } from "~/components/modals/ContentPreviewModal";
import { useContent } from "~/hooks/useContent";
import { useUnusedContents } from "~/hooks/useUnusedContents";
import {
  contentActionsAtom,
  contentAddModalAtom,
  contentEditModalAtom,
  contentModalActionsAtom,
  contentsErrorAtom,
  contentsLoadingAtom,
  contentViewModeAtom,
  filteredContentsAtom,
} from "~/states/content";
import { contentPreviewModalAtom, modalActionsAtom } from "~/states/modal";
import {
  type ContentType,
  type CsvContent,
  CsvContentSchema,
  type TextContent,
  type WeatherContent,
} from "~/types/content";
import { formatFileSize, getContentTypeBadge } from "~/utils/contentTypeUtils";
import { logger } from "~/utils/logger";

export default function ContentsPage() {
  // コンテンツ関連の状態
  const [contents] = useAtom(filteredContentsAtom);
  const [contentsLoading] = useAtom(contentsLoadingAtom);
  const [contentsError] = useAtom(contentsErrorAtom);
  const [contentViewMode, setContentViewMode] = useAtom(contentViewModeAtom);
  const [contentAddModalOpened] = useAtom(contentAddModalAtom);
  const [contentEditModal] = useAtom(contentEditModalAtom);
  const [, contentDispatch] = useAtom(contentActionsAtom);
  const [, contentModalDispatch] = useAtom(contentModalActionsAtom);
  const [contentPreviewModal] = useAtom(contentPreviewModalAtom);
  const [, modalDispatch] = useAtom(modalActionsAtom);

  const {
    getContentsIndex,
    deleteContentSafely,
    deleteContentForced,
    checkContentUsageStatus,
    updateContent,
    getContentById,
    downloadContent,
  } = useContent();

  const { getUnusedContentIds } = useUnusedContents();

  // 未使用状態を更新するヘルパー関数
  const refreshUnusedStatus = useCallback(
    async (contentsData: typeof contents) => {
      try {
        const unusedIds = await getUnusedContentIds(contentsData);
        contentDispatch({ type: "SET_UNUSED_CONTENT_IDS", unusedIds });
      } catch (error) {
        logger.error("Contents", "Failed to refresh unused status", error);
      }
    },
    [getUnusedContentIds, contentDispatch],
  );

  // コンテンツ一覧と未使用状態を読み込み
  useEffect(() => {
    const loadContents = async () => {
      contentDispatch({ type: "SET_LOADING", loading: true });
      contentDispatch({ type: "SET_ERROR", error: null });

      try {
        // コンテンツ一覧を取得
        const contentsData = await getContentsIndex();
        contentDispatch({ type: "SET_CONTENTS", contents: contentsData });

        // 未使用コンテンツIDを取得
        const unusedIds = await getUnusedContentIds(contentsData);
        contentDispatch({ type: "SET_UNUSED_CONTENT_IDS", unusedIds });
      } catch (error) {
        contentDispatch({
          type: "SET_ERROR",
          error: error instanceof Error ? error.message : "不明なエラーが発生しました",
        });
      } finally {
        contentDispatch({ type: "SET_LOADING", loading: false });
      }
    };

    loadContents();
  }, [getContentsIndex, getUnusedContentIds, contentDispatch]);

  // コンテンツ関連のハンドラー
  const handleContentDelete = async (id: string, contentName: string) => {
    try {
      // 使用状況をチェック
      const usageInfo = await checkContentUsageStatus(id);

      if (usageInfo.isUsed) {
        // 使用中の場合は強制削除の確認を表示
        modals.openConfirmModal({
          title: "コンテンツを削除",
          children: (
            <Box>
              <Text size="sm" mb="md">
                「{contentName}」を削除しますか？この操作は元に戻せません。
              </Text>
              <Text size="sm" mb="sm">
                このコンテンツは以下のプレイリストで使用されています：
              </Text>
              <List size="sm" mb="md">
                {usageInfo.playlists.map((playlist) => (
                  <List.Item key={playlist.id}>
                    <Text size="sm" style={{ fontWeight: 500 }}>
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
              await deleteContentForced(id);
              contentDispatch({ type: "REMOVE_CONTENT", id });
              // 削除後に未使用状態を更新
              const contentsData = await getContentsIndex();
              await refreshUnusedStatus(contentsData);
            } catch (error) {
              contentDispatch({
                type: "SET_ERROR",
                error: error instanceof Error ? error.message : "削除に失敗しました",
              });
            }
          },
        });
        return;
      }

      // 使用されていない場合は通常の削除確認
      modals.openConfirmModal({
        title: "コンテンツを削除",
        children: (
          <Box>
            <Text size="sm" mb="md">
              「{contentName}」を削除しますか？この操作は元に戻せません。
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
            await deleteContentSafely(id);
            contentDispatch({ type: "REMOVE_CONTENT", id });
            // 削除後に未使用状態を更新
            const contentsData = await getContentsIndex();
            await refreshUnusedStatus(contentsData);
          } catch (error) {
            contentDispatch({
              type: "SET_ERROR",
              error: error instanceof Error ? error.message : "削除に失敗しました",
            });
          }
        },
      });
    } catch (error) {
      contentDispatch({
        type: "SET_ERROR",
        error: error instanceof Error ? error.message : "使用状況の確認に失敗しました",
      });
    }
  };

  const handleContentAdd = () => {
    contentModalDispatch({ type: "OPEN_CONTENT_ADD" });
  };

  const handleContentClick = (contentId: string, contentType: ContentType) => {
    // 動画、画像、YouTube、URL、テキスト、気象情報、CSVでプレビューモーダルを開く
    if (
      contentType === "video" ||
      contentType === "image" ||
      contentType === "youtube" ||
      contentType === "url" ||
      contentType === "text" ||
      contentType === "weather" ||
      contentType === "csv"
    ) {
      modalDispatch({ type: "OPEN_CONTENT_PREVIEW", contentId });
    }
  };

  // コンテンツ追加完了後のハンドラー
  const handleContentAdded = async () => {
    // コンテンツ一覧を再読み込み
    const contentsData = await getContentsIndex();
    contentDispatch({ type: "SET_CONTENTS", contents: contentsData });
    // 未使用状態も更新
    await refreshUnusedStatus(contentsData);
  };

  const handleContentAddModalClose = () => {
    contentModalDispatch({ type: "CLOSE_CONTENT_ADD" });
  };

  const handleContentEditSubmit = async (data: {
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
      if (data.urlInfo) {
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
        // 既存のCSV情報を取得して、更新データとマージ
        const existingContent = await getContentById(data.id);
        if (existingContent?.csvInfo) {
          // 既存のcsvInfoと新しいデータをマージして完全なCsvContentを作成
          const mergedCsvInfo = {
            ...existingContent.csvInfo,
            ...data.csvInfo,
          };

          // Zodでバリデーション
          try {
            updateData.csvInfo = CsvContentSchema.parse(mergedCsvInfo);
          } catch (error) {
            console.error("CSV content validation failed:", error);
            throw new Error("CSVコンテンツの更新データが不正です");
          }
        }

        updateData.csvBackgroundFile = data.csvBackgroundFile || undefined;
        updateData.csvFile = data.csvFile || undefined;
      }

      const updatedContent = await updateContent(data.id, updateData);

      // インデックス形式に変換して状態を更新
      const contentIndex = {
        id: updatedContent.id,
        name: updatedContent.name,
        type: updatedContent.type,
        size: updatedContent.fileInfo?.size,
        url: updatedContent.urlInfo?.url,
        tags: updatedContent.tags,
        createdAt: updatedContent.createdAt,
        updatedAt: updatedContent.updatedAt,
      };

      contentDispatch({ type: "UPDATE_CONTENT", id: data.id, content: contentIndex });
      // 編集後に未使用状態を更新（名前やタグの変更があるため）
      const contentsData = await getContentsIndex();
      await refreshUnusedStatus(contentsData);

      // 成功したらモーダルを閉じる
      handleContentEditModalClose();
    } catch (error) {
      logger.error("Contents", "Content edit failed", error);
      contentDispatch({ type: "SET_ERROR", error: `コンテンツの編集に失敗しました: ${error}` });
      throw error; // エラーを再throwしてContentEditModalでキャッチできるようにする
    }
  };

  const handleContentEditModalClose = () => {
    contentModalDispatch({ type: "CLOSE_CONTENT_EDIT" });
  };

  return (
    <Box pos="relative">
      <LoadingOverlay visible={contentsLoading} />

      {contentsError && !contentsError.includes("Failed to read JSON") && (
        <Alert icon={<IconExclamationCircle size={16} />} color="red" mb="md">
          {contentsError}
        </Alert>
      )}

      <Group justify="space-between" mb="md">
        <ContentFilters />
        <Group gap="sm">
          {/* ビュー切り替えボタン */}
          <Button.Group>
            <Button
              variant={contentViewMode === "table" ? "filled" : "default"}
              color="blue"
              onClick={() => setContentViewMode("table")}
              aria-label="テーブルビュー"
            >
              <IconList size={18} />
            </Button>
            <Button
              variant={contentViewMode === "grid" ? "filled" : "default"}
              color="blue"
              onClick={() => setContentViewMode("grid")}
              aria-label="グリッドビュー"
            >
              <IconLayoutGrid size={18} />
            </Button>
          </Button.Group>

          {/* コンテンツ追加ボタン */}
          <Button leftSection={<IconPlus size={16} />} onClick={handleContentAdd}>
            コンテンツを追加
          </Button>
        </Group>
      </Group>

      {/* ビューモードに応じた表示 */}
      {contentViewMode === "table" ? (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={60}>編集</Table.Th>
              <Table.Th w={40} />
              <Table.Th>種別</Table.Th>
              <Table.Th>名前</Table.Th>
              <Table.Th>サイズ/URL</Table.Th>
              <Table.Th>作成日時</Table.Th>
              <Table.Th w={60}>操作</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {contents.length === 0 && !contentsLoading ? (
              <Table.Tr>
                <Table.Td colSpan={7} ta="center" c="dimmed">
                  コンテンツがありません
                </Table.Td>
              </Table.Tr>
            ) : (
              contents.map((content) => {
                const isPreviewable =
                  content.type === "video" ||
                  content.type === "image" ||
                  content.type === "youtube" ||
                  content.type === "url" ||
                  content.type === "text" ||
                  content.type === "weather" ||
                  content.type === "csv";
                return (
                  <Table.Tr
                    key={content.id}
                    style={{
                      cursor: isPreviewable ? "pointer" : "default",
                    }}
                    onClick={() => handleContentClick(content.id, content.type)}
                  >
                    <Table.Td>
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          contentModalDispatch({ type: "OPEN_CONTENT_EDIT", content });
                        }}
                        aria-label="編集"
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Table.Td>
                    <Table.Td>
                      {isPreviewable && (
                        <ContentHoverCard content={content}>
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="sm"
                            onClick={(e) => e.stopPropagation()}
                            aria-label="プレビュー"
                          >
                            <IconEye size={16} />
                          </ActionIcon>
                        </ContentHoverCard>
                      )}
                    </Table.Td>
                    <Table.Td>{getContentTypeBadge(content.type)}</Table.Td>
                    <Table.Td>
                      <Text fw={500}>{content.name}</Text>
                      {content.tags.length > 0 && (
                        <Group gap={4} mt={2}>
                          {content.tags.map((tag) => (
                            <Badge key={tag} size="xs" variant="outline">
                              {tag}
                            </Badge>
                          ))}
                        </Group>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {content.size ? (
                        <Text size="sm">{formatFileSize(content.size)}</Text>
                      ) : content.url ? (
                        <Text size="sm" maw={200} truncate>
                          {content.url}
                        </Text>
                      ) : (
                        <Text size="sm" c="dimmed">
                          -
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{new Date(content.createdAt).toLocaleString("ja-JP")}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        {(content.type === "video" || content.type === "image") && (
                          <ActionIcon
                            variant="subtle"
                            color="green"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadContent(content.id);
                            }}
                            aria-label="ダウンロード"
                          >
                            <IconDownload size={16} />
                          </ActionIcon>
                        )}
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleContentDelete(content.id, content.name);
                          }}
                          aria-label="削除"
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })
            )}
          </Table.Tbody>
        </Table>
      ) : (
        <ContentGridView
          contents={contents}
          loading={contentsLoading}
          onContentClick={(content) => {
            handleContentClick(content.id, content.type);
          }}
          onContentEdit={(content) => {
            contentModalDispatch({ type: "OPEN_CONTENT_EDIT", content });
          }}
          onContentDelete={(content) => {
            handleContentDelete(content.id, content.name);
          }}
          onContentDownload={(content) => {
            downloadContent(content.id);
          }}
        />
      )}

      <ContentAddHandler
        opened={contentAddModalOpened}
        onClose={handleContentAddModalClose}
        onContentAdded={handleContentAdded}
      />

      <ContentPreviewModal
        opened={contentPreviewModal.opened}
        onClose={() => modalDispatch({ type: "CLOSE_CONTENT_PREVIEW" })}
        contentId={contentPreviewModal.contentId}
        allContents={contents}
        onContentDeleted={() => {
          // コンテンツ一覧と未使用状態を再読み込み
          const loadContents = async () => {
            try {
              const contentsData = await getContentsIndex();
              contentDispatch({ type: "SET_CONTENTS", contents: contentsData });
              // 未使用状態も更新
              const unusedIds = await getUnusedContentIds(contentsData);
              contentDispatch({ type: "SET_UNUSED_CONTENT_IDS", unusedIds });
            } catch (error) {
              contentDispatch({
                type: "SET_ERROR",
                error: error instanceof Error ? error.message : "不明なエラーが発生しました",
              });
            }
          };
          loadContents();
        }}
        onContentUpdated={() => {
          // コンテンツ一覧と未使用状態を再読み込み
          const loadContents = async () => {
            try {
              const contentsData = await getContentsIndex();
              contentDispatch({ type: "SET_CONTENTS", contents: contentsData });
              // 未使用状態も更新
              const unusedIds = await getUnusedContentIds(contentsData);
              contentDispatch({ type: "SET_UNUSED_CONTENT_IDS", unusedIds });
            } catch (error) {
              contentDispatch({
                type: "SET_ERROR",
                error: error instanceof Error ? error.message : "不明なエラーが発生しました",
              });
            }
          };
          loadContents();
        }}
        onContentChange={(newContentId) => {
          modalDispatch({ type: "OPEN_CONTENT_PREVIEW", contentId: newContentId });
        }}
      />

      {contentEditModal.content && (
        <ContentEditModal
          opened={contentEditModal.opened}
          onClose={handleContentEditModalClose}
          content={contentEditModal.content}
          onSubmit={handleContentEditSubmit}
        />
      )}
    </Box>
  );
}
