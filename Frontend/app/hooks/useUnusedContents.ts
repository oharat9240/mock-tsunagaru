import { useCallback } from "react";
import { usePlaylist } from "~/hooks/usePlaylist";
import type { ContentIndex } from "~/types/content";
import { logger } from "~/utils/logger";

export const useUnusedContents = () => {
  const { getPlaylistsIndex, getPlaylistById } = usePlaylist();

  /**
   * 全てのプレイリストで使用されているコンテンツIDを取得
   */
  const getUsedContentIds = useCallback(async (): Promise<Set<string>> => {
    try {
      const usedIds = new Set<string>();

      // 全プレイリストを取得
      const playlists = await getPlaylistsIndex();

      // 各プレイリストの詳細を取得してコンテンツIDを収集
      for (const playlistIndex of playlists) {
        try {
          const playlist = await getPlaylistById(playlistIndex.id);
          if (!playlist) continue;

          // このプレイリストで使用されているコンテンツIDを追加
          for (const assignment of playlist.contentAssignments) {
            for (const contentId of assignment.contentIds) {
              usedIds.add(contentId);
            }
          }
        } catch (error) {
          logger.warn("useUnusedContents", `Failed to load playlist ${playlistIndex.id}`, error);
        }
      }

      return usedIds;
    } catch (error) {
      logger.error("useUnusedContents", "Failed to get used content IDs", error);
      throw new Error("使用中コンテンツの取得に失敗しました");
    }
  }, [getPlaylistsIndex, getPlaylistById]);

  /**
   * 未使用コンテンツのIDを取得
   */
  const getUnusedContentIds = useCallback(
    async (allContents: ContentIndex[]): Promise<Set<string>> => {
      try {
        const usedIds = await getUsedContentIds();
        const unusedIds = new Set<string>();

        // 全コンテンツから使用中のものを除外
        for (const content of allContents) {
          if (!usedIds.has(content.id)) {
            unusedIds.add(content.id);
          }
        }

        return unusedIds;
      } catch (error) {
        logger.error("useUnusedContents", "Failed to get unused content IDs", error);
        throw error;
      }
    },
    [getUsedContentIds],
  );

  return {
    getUsedContentIds,
    getUnusedContentIds,
  };
};
