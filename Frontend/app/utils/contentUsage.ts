import type { PlaylistIndex, PlaylistItem } from "~/types/playlist";
import { logger } from "~/utils/logger";

export interface ContentUsageInfo {
  isUsed: boolean;
  usageCount: number;
  playlists: Array<{
    id: string;
    name: string;
    device: string | null;
    regionCount: number;
  }>;
}

/**
 * 指定されたコンテンツが使用されているかチェック
 */
export const checkContentUsage = async (
  contentId: string,
  getPlaylistsIndex: () => Promise<PlaylistIndex[]>,
  getPlaylistById: (id: string) => Promise<PlaylistItem | null>,
): Promise<ContentUsageInfo> => {
  try {
    const playlists = await getPlaylistsIndex();
    const usedInPlaylists: Array<{
      id: string;
      name: string;
      device: string | null;
      regionCount: number;
    }> = [];
    let totalUsageCount = 0;

    for (const playlistIndex of playlists) {
      try {
        const playlist = await getPlaylistById(playlistIndex.id);
        if (!playlist) continue;

        let playlistUsageCount = 0;
        for (const assignment of playlist.contentAssignments) {
          const usageInRegion = assignment.contentIds.filter((id: string) => id === contentId).length;
          playlistUsageCount += usageInRegion;
        }

        if (playlistUsageCount > 0) {
          usedInPlaylists.push({
            id: playlist.id,
            name: playlist.name,
            device: playlist.device,
            regionCount: playlistUsageCount,
          });
          totalUsageCount += playlistUsageCount;
        }
      } catch (error) {
        logger.warn("checkContentUsage", `Failed to check playlist ${playlistIndex.id}`, error);
      }
    }

    return {
      isUsed: usedInPlaylists.length > 0,
      usageCount: totalUsageCount,
      playlists: usedInPlaylists,
    };
  } catch (error) {
    logger.error("checkContentUsage", "Failed to check content usage", error);
    return {
      isUsed: false,
      usageCount: 0,
      playlists: [],
    };
  }
};

/**
 * 使用状況の説明文を生成
 */
export const generateUsageDescription = (usageInfo: ContentUsageInfo): string => {
  if (!usageInfo.isUsed) {
    return "";
  }

  const playlistNames = usageInfo.playlists.map((p) => `「${p.name}」`).join("、");

  if (usageInfo.playlists.length === 1) {
    return `このコンテンツは ${playlistNames} で使用されています。`;
  }

  return `このコンテンツは ${usageInfo.playlists.length}個のプレイリスト（${playlistNames}）で使用されています。`;
};
