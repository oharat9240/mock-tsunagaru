import { ActionIcon, Alert, Box, Button, Group, LoadingOverlay, Table, Text, Tooltip } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconEdit, IconExclamationCircle, IconEye, IconPlayerPlay, IconPlus, IconTrash } from "@tabler/icons-react";
import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import type { PlaylistFormData } from "~/components/modals/PlaylistCreateModal";
import { PlaylistCreateModal } from "~/components/modals/PlaylistCreateModal";
import type { PlaylistEditFormData } from "~/components/modals/PlaylistEditModal";
import { PlaylistEditModal } from "~/components/modals/PlaylistEditModal";
import { PlaylistPreviewModal } from "~/components/modals/PlaylistPreviewModal";
import { FullscreenPlayer } from "~/components/playlist/FullscreenPlayer";
import { usePlaylist } from "~/hooks/usePlaylist";
import {
  modalActionsAtom,
  playlistCreateModalAtom,
  playlistEditModalAtom,
  playlistFullscreenPlayerAtom,
  playlistPreviewModalAtom,
} from "~/states/modal";
import { playlistActionsAtom, playlistsAtom, playlistsErrorAtom, playlistsLoadingAtom } from "~/states/playlist";
import type { PlaylistItem } from "~/types/playlist";

export default function PlaylistPage() {
  const [playlists] = useAtom(playlistsAtom);
  const [loading] = useAtom(playlistsLoadingAtom);
  const [error] = useAtom(playlistsErrorAtom);
  const [createModalOpened] = useAtom(playlistCreateModalAtom);
  const [editModalState] = useAtom(playlistEditModalAtom);
  const [previewModalState] = useAtom(playlistPreviewModalAtom);
  const [fullscreenPlayerState] = useAtom(playlistFullscreenPlayerAtom);
  const [, dispatch] = useAtom(playlistActionsAtom);
  const [, modalDispatch] = useAtom(modalActionsAtom);
  const { getPlaylistsIndex, deletePlaylist, createPlaylist, getPlaylistById, updatePlaylist } = usePlaylist();

  // プレイリスト一覧を読み込み
  useEffect(() => {
    const loadPlaylists = async () => {
      dispatch({ type: "SET_LOADING", loading: true });
      dispatch({ type: "SET_ERROR", error: null });

      try {
        const playlistsData = await getPlaylistsIndex();
        dispatch({ type: "SET_PLAYLISTS", playlists: playlistsData });
      } catch (error) {
        dispatch({ type: "SET_ERROR", error: error instanceof Error ? error.message : "不明なエラーが発生しました" });
      } finally {
        dispatch({ type: "SET_LOADING", loading: false });
      }
    };

    loadPlaylists();
  }, [getPlaylistsIndex, dispatch]);

  const handleEdit = (id: string) => {
    modalDispatch({ type: "OPEN_PLAYLIST_EDIT", playlistId: id });
  };

  const handlePreview = (id: string) => {
    modalDispatch({ type: "OPEN_PLAYLIST_PREVIEW", playlistId: id });
  };

  const handlePlay = (id: string) => {
    modalDispatch({ type: "OPEN_PLAYLIST_FULLSCREEN", playlistId: id });
  };

  const handleFullscreenPlayerClose = () => {
    modalDispatch({ type: "CLOSE_PLAYLIST_FULLSCREEN" });
  };

  const handleDelete = async (id: string) => {
    modals.openConfirmModal({
      title: "プレイリストを削除",
      children: <Text size="sm">このプレイリストを削除しますか？この操作は元に戻せません。</Text>,
      labels: { confirm: "削除", cancel: "キャンセル" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await deletePlaylist(id);
          dispatch({ type: "REMOVE_PLAYLIST", id });
        } catch (error) {
          dispatch({ type: "SET_ERROR", error: error instanceof Error ? error.message : "削除に失敗しました" });
        }
      },
    });
  };

  const handleCreate = () => {
    modalDispatch({ type: "OPEN_PLAYLIST_CREATE" });
  };

  const handleCreateSubmit = async (data: PlaylistFormData) => {
    try {
      const newPlaylist = await createPlaylist({
        name: data.name,
        layoutId: data.layoutId,
        contentAssignments: data.contentAssignments,
        device: data.device,
      });

      // インデックス用のデータに変換
      const playlistIndex = {
        id: newPlaylist.id,
        name: newPlaylist.name,
        layoutId: newPlaylist.layoutId,
        contentCount: newPlaylist.contentAssignments.reduce((total, assignment) => {
          return total + assignment.contentIds.length;
        }, 0),
        device: newPlaylist.device,
        createdAt: newPlaylist.createdAt,
        updatedAt: newPlaylist.updatedAt,
      };

      dispatch({ type: "ADD_PLAYLIST", playlist: playlistIndex });
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        error: error instanceof Error ? error.message : "プレイリストの作成に失敗しました",
      });
      throw error;
    }
  };

  const handleCreateModalClose = () => {
    modalDispatch({ type: "CLOSE_PLAYLIST_CREATE" });
  };

  const handleEditModalClose = () => {
    modalDispatch({ type: "CLOSE_PLAYLIST_EDIT" });
  };

  const handlePreviewModalClose = () => {
    modalDispatch({ type: "CLOSE_PLAYLIST_PREVIEW" });
  };

  const handleEditSubmit = async (data: PlaylistEditFormData) => {
    if (!editModalState.playlistId) return;

    try {
      await updatePlaylist(editModalState.playlistId, {
        name: data.name,
        device: data.device,
        contentAssignments: data.contentAssignments,
      });

      // プレイリスト一覧を再読み込み
      const updatedPlaylists = await getPlaylistsIndex();
      dispatch({ type: "SET_PLAYLISTS", playlists: updatedPlaylists });
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        error: error instanceof Error ? error.message : "プレイリストの更新に失敗しました",
      });
      throw error;
    }
  };

  const [currentPlaylist, setCurrentPlaylist] = useState<PlaylistItem | null>(null);

  // 編集モーダルが開かれた時にプレイリストデータを取得
  useEffect(() => {
    const loadCurrentPlaylist = async () => {
      if (editModalState.opened && editModalState.playlistId) {
        try {
          const playlist = await getPlaylistById(editModalState.playlistId);
          setCurrentPlaylist(playlist);
        } catch (error) {
          dispatch({
            type: "SET_ERROR",
            error: error instanceof Error ? error.message : "プレイリストの読み込みに失敗しました",
          });
          modalDispatch({ type: "CLOSE_PLAYLIST_EDIT" });
        }
      }
    };

    loadCurrentPlaylist();
  }, [editModalState.opened, editModalState.playlistId, getPlaylistById, dispatch, modalDispatch]);

  return (
    <Box pos="relative">
      <LoadingOverlay visible={loading} />

      {error && !error.includes("Failed to read JSON") && (
        <Alert icon={<IconExclamationCircle size={16} />} color="red" mb="md">
          {error}
        </Alert>
      )}

      <Group justify="flex-end" mb="md">
        <Button leftSection={<IconPlus size={16} />} onClick={handleCreate}>
          新しいプレイリストを作成
        </Button>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>操作</Table.Th>
            <Table.Th>名前</Table.Th>
            <Table.Th>コンテンツ数</Table.Th>
            <Table.Th>デバイス</Table.Th>
            <Table.Th>作成日時</Table.Th>
            <Table.Th>操作</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {playlists.length === 0 && !loading ? (
            <Table.Tr>
              <Table.Td colSpan={6} ta="center" c="dimmed">
                プレイリストがありません
              </Table.Td>
            </Table.Tr>
          ) : (
            playlists.map((playlist) => (
              <Table.Tr key={playlist.id}>
                <Table.Td>
                  <Group gap="xs">
                    <Tooltip label="編集">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        size="sm"
                        onClick={() => handleEdit(playlist.id)}
                        aria-label="編集"
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="プレビュー">
                      <ActionIcon
                        variant="subtle"
                        color="green"
                        size="sm"
                        onClick={() => handlePreview(playlist.id)}
                        aria-label="プレビュー"
                      >
                        <IconEye size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="再生">
                      <ActionIcon
                        variant="subtle"
                        color="violet"
                        size="sm"
                        onClick={() => handlePlay(playlist.id)}
                        aria-label="再生"
                      >
                        <IconPlayerPlay size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text fw={500}>{playlist.name}</Text>
                </Table.Td>
                <Table.Td>
                  <Text>{playlist.contentCount}</Text>
                </Table.Td>
                <Table.Td>
                  <Text>{playlist.device}</Text>
                </Table.Td>
                <Table.Td>
                  <Text>{new Date(playlist.createdAt).toLocaleString("ja-JP")}</Text>
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => handleDelete(playlist.id)}
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

      <PlaylistCreateModal opened={createModalOpened} onClose={handleCreateModalClose} onSubmit={handleCreateSubmit} />
      <PlaylistEditModal
        opened={editModalState.opened}
        onClose={handleEditModalClose}
        onSubmit={handleEditSubmit}
        playlist={currentPlaylist}
      />
      <PlaylistPreviewModal
        opened={previewModalState.opened}
        onClose={handlePreviewModalClose}
        playlistId={previewModalState.playlistId}
        onPlay={handlePlay}
      />

      {/* フルスクリーンプレイヤー */}
      {fullscreenPlayerState.opened && fullscreenPlayerState.playlistId && (
        <FullscreenPlayer playlistId={fullscreenPlayerState.playlistId} onClose={handleFullscreenPlayerClose} />
      )}
    </Box>
  );
}
