import { useCallback } from "react";
import { apiClient } from "~/services/apiClient";
import type { PlaylistIndex, PlaylistItem } from "~/types/playlist";
import { PlaylistItemSchema, PlaylistsIndexSchema } from "~/types/playlist";
import { logger } from "~/utils/logger";

export const usePlaylist = () => {
  /**
   * プレイリスト一覧を取得
   */
  const getPlaylistsIndex = useCallback(async (): Promise<PlaylistIndex[]> => {
    try {
      const indexData = await apiClient.getPlaylistsIndex<PlaylistIndex>();
      if (!indexData || indexData.length === 0) {
        return [];
      }

      // Zodでバリデーション
      const validated = PlaylistsIndexSchema.parse(indexData);
      return validated;
    } catch (error) {
      logger.error("Playlist", "プレイリスト一覧の取得に失敗しました", error);
      return [];
    }
  }, []);

  /**
   * 個別のプレイリスト詳細を取得
   */
  const getPlaylistById = useCallback(async (id: string): Promise<PlaylistItem | null> => {
    try {
      const playlistData = await apiClient.getPlaylist<PlaylistItem>(id);
      if (!playlistData) {
        return null;
      }

      // Zodでバリデーション
      const validated = PlaylistItemSchema.parse(playlistData);
      return validated;
    } catch (error) {
      logger.error("Playlist", `プレイリスト詳細の取得に失敗しました: ${id}`, error);
      return null;
    }
  }, []);

  /**
   * プレイリストを作成
   */
  const createPlaylist = useCallback(
    async (playlistData: Omit<PlaylistItem, "id" | "createdAt" | "updatedAt">): Promise<PlaylistItem> => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      const newPlaylist: PlaylistItem = {
        id,
        ...playlistData,
        createdAt: now,
        updatedAt: now,
      };

      // Zodでバリデーション
      const validated = PlaylistItemSchema.parse(newPlaylist);

      try {
        // 個別ファイルに保存
        await apiClient.savePlaylist(id, validated);

        // インデックスを更新
        const currentIndex = await getPlaylistsIndex();

        // コンテンツ総数を計算
        const contentCount = validated.contentAssignments.reduce((total, assignment) => {
          return total + assignment.contentIds.length;
        }, 0);

        const newIndex: PlaylistIndex = {
          id: validated.id,
          name: validated.name,
          layoutId: validated.layoutId,
          contentCount,
          device: validated.device,
          createdAt: validated.createdAt,
          updatedAt: validated.updatedAt,
        };

        const updatedIndex = [...currentIndex, newIndex];
        await apiClient.savePlaylistsIndex(updatedIndex);

        return validated;
      } catch (error) {
        // エラーが発生した場合はクリーンアップ
        try {
          await apiClient.deletePlaylist(id);
        } catch {
          // クリーンアップエラーは無視
        }
        throw new Error(`プレイリストの作成に失敗しました: ${error}`);
      }
    },
    [getPlaylistsIndex],
  );

  /**
   * プレイリストを更新
   */
  const updatePlaylist = useCallback(
    async (id: string, updateData: Partial<Omit<PlaylistItem, "id" | "createdAt">>): Promise<PlaylistItem> => {
      try {
        // 既存データを取得
        const playlistData = await apiClient.getPlaylist<PlaylistItem>(id);
        if (!playlistData) {
          throw new Error("プレイリストが見つかりません");
        }

        // Zodでバリデーション
        const existingPlaylist = PlaylistItemSchema.parse(playlistData);

        const updatedPlaylist: PlaylistItem = {
          ...existingPlaylist,
          ...updateData,
          updatedAt: new Date().toISOString(),
        };

        // Zodでバリデーション
        const validated = PlaylistItemSchema.parse(updatedPlaylist);

        // 個別ファイルを更新
        await apiClient.savePlaylist(id, validated);

        // インデックスを更新
        const currentIndex = await getPlaylistsIndex();

        // コンテンツ総数を計算
        const contentCount = validated.contentAssignments.reduce((total, assignment) => {
          return total + assignment.contentIds.length;
        }, 0);

        const updatedIndex = currentIndex.map((item) =>
          item.id === id
            ? {
                id: validated.id,
                name: validated.name,
                layoutId: validated.layoutId,
                contentCount,
                device: validated.device,
                createdAt: validated.createdAt,
                updatedAt: validated.updatedAt,
              }
            : item,
        );

        await apiClient.savePlaylistsIndex(updatedIndex);

        return validated;
      } catch (error) {
        throw new Error(`プレイリストの更新に失敗しました: ${error}`);
      }
    },
    [getPlaylistsIndex],
  );

  /**
   * プレイリストを削除
   */
  const deletePlaylist = useCallback(
    async (id: string): Promise<void> => {
      try {
        // 個別ファイルを削除
        await apiClient.deletePlaylist(id);

        // インデックスから削除
        const currentIndex = await getPlaylistsIndex();
        const updatedIndex = currentIndex.filter((item) => item.id !== id);
        await apiClient.savePlaylistsIndex(updatedIndex);
      } catch (error) {
        throw new Error(`プレイリストの削除に失敗しました: ${error}`);
      }
    },
    [getPlaylistsIndex],
  );

  return {
    getPlaylistsIndex,
    getPlaylistById,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
  };
};
