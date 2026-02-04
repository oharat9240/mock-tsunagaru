import { ActionIcon, Alert, Badge, Box, Button, Group, List, LoadingOverlay, Table, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import {
  IconEdit,
  IconExclamationCircle,
  IconEye,
  IconLayoutGrid,
  IconList,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useAtom } from "jotai";
import { useEffect } from "react";
import { LayoutGridView } from "~/components/layout/LayoutGridView";
import { LayoutHoverCard } from "~/components/layout/LayoutHoverCard";
import { LayoutCreateModal } from "~/components/modals/LayoutCreateModal";
import { LayoutEditModal } from "~/components/modals/LayoutEditModal";
import { useLayout } from "~/hooks/useLayout";
import {
  layoutActionsAtom,
  layoutsAtom,
  layoutsErrorAtom,
  layoutsLoadingAtom,
  layoutViewModeAtom,
} from "~/states/layout";
import { layoutCreateModalAtom, layoutEditModalAtom, modalActionsAtom } from "~/states/modal";
import type { Region } from "~/types/layout";

export default function LayoutPage() {
  const [layouts] = useAtom(layoutsAtom);
  const [layoutsLoading] = useAtom(layoutsLoadingAtom);
  const [layoutsError] = useAtom(layoutsErrorAtom);
  const [layoutViewMode, setLayoutViewMode] = useAtom(layoutViewModeAtom);
  const [layoutCreateModalOpened] = useAtom(layoutCreateModalAtom);
  const [layoutEditModal] = useAtom(layoutEditModalAtom);
  const [, layoutDispatch] = useAtom(layoutActionsAtom);
  const [, modalDispatch] = useAtom(modalActionsAtom);
  const { getLayoutsIndex, deleteLayout, createLayout, updateLayout, checkLayoutUsageStatus } = useLayout();

  // レイアウト一覧を読み込み
  useEffect(() => {
    const loadLayouts = async () => {
      layoutDispatch({ type: "SET_LOADING", loading: true });
      layoutDispatch({ type: "SET_ERROR", error: null });

      try {
        const layoutsData = await getLayoutsIndex();
        layoutDispatch({ type: "SET_LAYOUTS", layouts: layoutsData });
      } catch (error) {
        layoutDispatch({
          type: "SET_ERROR",
          error: error instanceof Error ? error.message : "不明なエラーが発生しました",
        });
      } finally {
        layoutDispatch({ type: "SET_LOADING", loading: false });
      }
    };

    loadLayouts();
  }, [getLayoutsIndex, layoutDispatch]);

  const handleLayoutEdit = (id: string) => {
    modalDispatch({ type: "OPEN_LAYOUT_EDIT", layoutId: id });
  };

  const handleLayoutDelete = async (id: string) => {
    modals.openConfirmModal({
      title: "レイアウトを削除",
      children: <Text size="sm">このレイアウトを削除しますか？この操作は元に戻せません。</Text>,
      labels: { confirm: "削除", cancel: "キャンセル" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await deleteLayout(id);
          layoutDispatch({ type: "REMOVE_LAYOUT", id });
        } catch (error) {
          layoutDispatch({ type: "SET_ERROR", error: error instanceof Error ? error.message : "削除に失敗しました" });
        }
      },
    });
  };

  const handleLayoutCreate = () => {
    modalDispatch({ type: "OPEN_LAYOUT_CREATE" });
  };

  const handleLayoutCreateSubmit = async (data: {
    name: string;
    orientation: "landscape" | "portrait-right" | "portrait-left";
    regions: Region[];
  }) => {
    try {
      const newLayout = await createLayout({
        name: data.name,
        orientation: data.orientation,
        regions: data.regions,
      });
      // LayoutIndexの形式に変換して追加
      const layoutIndex = {
        id: newLayout.id,
        name: newLayout.name,
        orientation: newLayout.orientation,
        regionCount: newLayout.regions.length,
        createdAt: newLayout.createdAt,
        updatedAt: newLayout.updatedAt,
      };
      layoutDispatch({ type: "ADD_LAYOUT", layout: layoutIndex });
    } catch (error) {
      layoutDispatch({
        type: "SET_ERROR",
        error: error instanceof Error ? error.message : "レイアウトの作成に失敗しました",
      });
      throw error;
    }
  };

  const handleLayoutModalClose = () => {
    modalDispatch({ type: "CLOSE_LAYOUT_CREATE" });
  };

  const handleLayoutEditSubmit = async (data: {
    name: string;
    orientation: "landscape" | "portrait-right" | "portrait-left";
    regions: Region[];
  }) => {
    if (!layoutEditModal.layoutId) return;

    try {
      // 使用状況をチェック
      const usageInfo = await checkLayoutUsageStatus(layoutEditModal.layoutId);

      if (usageInfo.isUsed) {
        // 使用中の場合は確認ダイアログを表示
        const confirmationPromise = new Promise<void>((resolve, reject) => {
          modals.openConfirmModal({
            title: "レイアウトの変更確認",
            children: (
              <div>
                <Text size="sm" mb="sm">
                  このレイアウトは以下のプレイリストで使用されています：
                </Text>
                <List size="sm" mb="sm">
                  {usageInfo.playlists.map((playlist) => (
                    <List.Item key={playlist.id}>
                      <Text size="sm" style={{ fontWeight: 500 }}>
                        {playlist.name} (デバイス: {playlist.device})
                      </Text>
                    </List.Item>
                  ))}
                </List>
                <Text size="sm">
                  変更を保存すると、これらのプレイリストに影響を与える可能性があります。続行しますか？
                </Text>
              </div>
            ),
            labels: { confirm: "変更を保存", cancel: "キャンセル" },
            confirmProps: { color: "orange" },
            onConfirm: () => resolve(),
            onCancel: () => reject(new Error("User cancelled")),
          });
        });

        await confirmationPromise;
      }

      const updatedLayout = await updateLayout(layoutEditModal.layoutId, {
        name: data.name,
        orientation: data.orientation,
        regions: data.regions,
      });
      // LayoutIndexの形式に変換して更新
      const layoutIndex = {
        id: updatedLayout.id,
        name: updatedLayout.name,
        orientation: updatedLayout.orientation,
        regionCount: updatedLayout.regions.length,
        createdAt: updatedLayout.createdAt,
        updatedAt: updatedLayout.updatedAt,
      };
      layoutDispatch({ type: "UPDATE_LAYOUT", layout: layoutIndex });
    } catch (error) {
      // ユーザーがキャンセルした場合は何もしない
      if (error instanceof Error && error.message === "User cancelled") {
        return;
      }
      layoutDispatch({
        type: "SET_ERROR",
        error: error instanceof Error ? error.message : "レイアウトの更新に失敗しました",
      });
      throw error;
    }
  };

  const handleLayoutEditModalClose = () => {
    modalDispatch({ type: "CLOSE_LAYOUT_EDIT" });
  };

  return (
    <Box pos="relative">
      <LoadingOverlay visible={layoutsLoading} />

      {layoutsError && !layoutsError.includes("Failed to read JSON") && (
        <Alert icon={<IconExclamationCircle size={16} />} color="red" mb="md">
          {layoutsError}
        </Alert>
      )}

      <Group justify="space-between" mb="md">
        <Group gap="sm">
          {/* ビュー切り替えボタン */}
          <Button.Group>
            <Button
              variant={layoutViewMode === "table" ? "filled" : "default"}
              color="blue"
              onClick={() => setLayoutViewMode("table")}
              aria-label="テーブルビュー"
            >
              <IconList size={18} />
            </Button>
            <Button
              variant={layoutViewMode === "grid" ? "filled" : "default"}
              color="blue"
              onClick={() => setLayoutViewMode("grid")}
              aria-label="グリッドビュー"
            >
              <IconLayoutGrid size={18} />
            </Button>
          </Button.Group>
        </Group>

        <Button leftSection={<IconPlus size={16} />} onClick={handleLayoutCreate}>
          新しいレイアウトを作成
        </Button>
      </Group>

      {/* ビューモードに応じた表示 */}
      {layoutViewMode === "table" ? (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={40} />
              <Table.Th>操作</Table.Th>
              <Table.Th>名前</Table.Th>
              <Table.Th>向き</Table.Th>
              <Table.Th>リージョン数</Table.Th>
              <Table.Th>作成日時</Table.Th>
              <Table.Th>操作</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {layouts.length === 0 && !layoutsLoading ? (
              <Table.Tr>
                <Table.Td colSpan={7} ta="center" c="dimmed">
                  レイアウトがありません
                </Table.Td>
              </Table.Tr>
            ) : (
              layouts.map((layout) => (
                <Table.Tr key={layout.id}>
                  <Table.Td>
                    <LayoutHoverCard layout={layout}>
                      <ActionIcon variant="subtle" color="gray" size="sm" aria-label="プレビュー">
                        <IconEye size={16} />
                      </ActionIcon>
                    </LayoutHoverCard>
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="blue"
                      size="sm"
                      onClick={() => handleLayoutEdit(layout.id)}
                      aria-label="編集"
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                  </Table.Td>
                  <Table.Td>
                    <Text fw={500}>{layout.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={
                        layout.orientation === "landscape"
                          ? "blue"
                          : layout.orientation === "portrait-right"
                            ? "orange"
                            : "violet"
                      }
                      variant="light"
                    >
                      {layout.orientation === "landscape"
                        ? "横向き"
                        : layout.orientation === "portrait-right"
                          ? "縦向き(右)"
                          : "縦向き(左)"}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text>{layout.regionCount}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text>{new Date(layout.createdAt).toLocaleString("ja-JP")}</Text>
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      onClick={() => handleLayoutDelete(layout.id)}
                      aria-label="削除"
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      ) : (
        <LayoutGridView
          layouts={layouts}
          loading={layoutsLoading}
          onLayoutClick={(layout) => {
            // レイアウトクリック時の処理
            handleLayoutEdit(layout.id);
          }}
          onLayoutEdit={(layout) => handleLayoutEdit(layout.id)}
          onLayoutDelete={(layout) => handleLayoutDelete(layout.id)}
        />
      )}

      <LayoutCreateModal
        opened={layoutCreateModalOpened}
        onClose={handleLayoutModalClose}
        onSubmit={handleLayoutCreateSubmit}
      />

      <LayoutEditModal
        opened={layoutEditModal.opened}
        layoutId={layoutEditModal.layoutId}
        onClose={handleLayoutEditModalClose}
        onSubmit={handleLayoutEditSubmit}
      />
    </Box>
  );
}
