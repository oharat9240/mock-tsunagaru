import type { PlaylistIndex, PlaylistItem } from "~/types/playlist";
import { logger } from "~/utils/logger";

export interface LayoutUsageInfo {
  isUsed: boolean;
  usageCount: number;
  playlists: Array<{
    id: string;
    name: string;
    device: string | null;
  }>;
}

/**
 * 指定されたレイアウトが使用されているかチェック
 */
export const checkLayoutUsage = async (
  layoutId: string,
  getPlaylistsIndex: () => Promise<PlaylistIndex[]>,
  getPlaylistById: (id: string) => Promise<PlaylistItem | null>,
): Promise<LayoutUsageInfo> => {
  try {
    const playlists = await getPlaylistsIndex();
    const usedInPlaylists: Array<{
      id: string;
      name: string;
      device: string | null;
    }> = [];

    for (const playlistIndex of playlists) {
      try {
        const playlist = await getPlaylistById(playlistIndex.id);
        if (!playlist) continue;

        // プレイリストのlayoutIdと一致するかチェック
        if (playlist.layoutId === layoutId) {
          usedInPlaylists.push({
            id: playlist.id,
            name: playlist.name,
            device: playlist.device,
          });
        }
      } catch (error) {
        logger.warn("checkLayoutUsage", `Failed to check playlist ${playlistIndex.id}`, error);
      }
    }

    return {
      isUsed: usedInPlaylists.length > 0,
      usageCount: usedInPlaylists.length,
      playlists: usedInPlaylists,
    };
  } catch (error) {
    logger.error("checkLayoutUsage", "Failed to check layout usage", error);
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
export const generateLayoutUsageDescription = (usageInfo: LayoutUsageInfo): string => {
  if (!usageInfo.isUsed) {
    return "";
  }

  const playlistNames = usageInfo.playlists.map((p) => `「${p.name}」`).join("、");

  if (usageInfo.playlists.length === 1) {
    return `このレイアウトは ${playlistNames} で使用されています。`;
  }

  return `このレイアウトは ${usageInfo.playlists.length}個のプレイリスト（${playlistNames}）で使用されています。`;
};
