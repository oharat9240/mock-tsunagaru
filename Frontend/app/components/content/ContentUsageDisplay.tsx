import { Alert, Badge, Box, Group, Loader, Paper, Stack, Text } from "@mantine/core";
import { IconAlertCircle, IconList, IconPlaylist } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { useLayout } from "~/hooks/useLayout";
import { usePlaylist } from "~/hooks/usePlaylist";
import type { LayoutItem } from "~/types/layout";
import type { PlaylistIndex } from "~/types/playlist";
import { logger } from "~/utils/logger";

interface ContentUsage {
  playlist: PlaylistIndex;
  layout: LayoutItem | null;
  regionUsage: Array<{
    regionId: string;
    regionName: string;
    usageCount: number;
  }>;
}

interface ContentUsageDisplayProps {
  contentId: string;
}

export const ContentUsageDisplay = ({ contentId }: ContentUsageDisplayProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usageList, setUsageList] = useState<ContentUsage[]>([]);

  const { getPlaylistsIndex, getPlaylistById } = usePlaylist();
  const { getLayoutById } = useLayout();

  const loadContentUsage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 全プレイリストを取得
      const playlists = await getPlaylistsIndex();
      const usages: ContentUsage[] = [];

      // 各プレイリストでコンテンツの使用状況をチェック
      for (const playlistIndex of playlists) {
        try {
          const playlist = await getPlaylistById(playlistIndex.id);
          if (!playlist) continue;

          // このプレイリストでコンテンツが使用されているかチェック
          const regionUsage: Array<{
            regionId: string;
            regionName: string;
            usageCount: number;
          }> = [];

          for (const assignment of playlist.contentAssignments) {
            const usageCount = assignment.contentIds.filter((id) => id === contentId).length;
            if (usageCount > 0) {
              // レイアウト情報を取得してリージョン名を決定
              let regionName = `リージョン ${assignment.regionId}`;

              try {
                if (playlist.layoutId) {
                  const layout = await getLayoutById(playlist.layoutId);
                  if (layout) {
                    const region = layout.regions.find((r) => r.id === assignment.regionId);
                    if (region) {
                      const regionIndex = layout.regions.findIndex((r) => r.id === assignment.regionId) + 1;
                      regionName = `リージョン ${regionIndex}`;
                    }
                  }
                }
              } catch (layoutError) {
                logger.warn("ContentUsageDisplay", "Failed to load layout for region name", layoutError);
              }

              regionUsage.push({
                regionId: assignment.regionId,
                regionName,
                usageCount,
              });
            }
          }

          // このプレイリストでコンテンツが使用されている場合は追加
          if (regionUsage.length > 0) {
            let layout: LayoutItem | null = null;
            try {
              if (playlist.layoutId) {
                layout = await getLayoutById(playlist.layoutId);
              }
            } catch (layoutError) {
              logger.warn("ContentUsageDisplay", "Failed to load layout", layoutError);
            }

            usages.push({
              playlist: playlistIndex,
              layout,
              regionUsage,
            });
          }
        } catch (playlistError) {
          logger.warn("ContentUsageDisplay", `Failed to load playlist ${playlistIndex.id}`, playlistError);
        }
      }

      setUsageList(usages);
    } catch (err) {
      logger.error("ContentUsageDisplay", "Failed to load content usage", err);
      setError("使用状況の読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [contentId, getPlaylistsIndex, getPlaylistById, getLayoutById]);

  useEffect(() => {
    if (contentId) {
      loadContentUsage();
    }
  }, [contentId, loadContentUsage]);

  if (loading) {
    return (
      <Box>
        <Text size="sm" fw={500} mb="sm">
          使用状況
        </Text>
        <Paper p="md" withBorder>
          <Group gap="sm">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              使用状況を確認中...
            </Text>
          </Group>
        </Paper>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Text size="sm" fw={500} mb="sm">
          使用状況
        </Text>
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          {error}
        </Alert>
      </Box>
    );
  }

  if (usageList.length === 0) {
    return (
      <Box>
        <Text size="sm" fw={500} mb="sm">
          使用状況
        </Text>
        <Paper p="md" withBorder>
          <Group gap="sm">
            <Box c="dimmed">
              <IconList size={16} />
            </Box>
            <Text size="sm" c="dimmed">
              このコンテンツはどのプレイリストでも使用されていません
            </Text>
          </Group>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Group gap="sm" mb="sm">
        <Text size="sm" fw={500}>
          使用状況
        </Text>
        <Badge variant="light" size="sm">
          {usageList.length}個のプレイリスト
        </Badge>
      </Group>

      <Stack gap="sm">
        {usageList.map((usage) => (
          <Paper key={usage.playlist.id} p="md" withBorder>
            <Stack gap="xs">
              <Group gap="sm" wrap="nowrap">
                <Box c="blue.6">
                  <IconPlaylist size={16} />
                </Box>
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" fw={500} style={{ wordBreak: "break-word" }}>
                    {usage.playlist.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    デバイス: {usage.playlist.device || "-"}
                  </Text>
                </Box>
              </Group>

              {usage.layout && (
                <Text size="xs" c="dimmed">
                  レイアウト: {usage.layout.name} (
                  {usage.layout.orientation === "landscape"
                    ? "横向き"
                    : usage.layout.orientation === "portrait-right"
                      ? "縦向き(右)"
                      : "縦向き(左)"}
                  )
                </Text>
              )}

              <Group gap="xs" mt="xs">
                {usage.regionUsage.map((region) => (
                  <Badge key={region.regionId} variant="light" size="xs" color="blue">
                    {region.regionName}
                    {region.usageCount > 1 && ` (${region.usageCount}回)`}
                  </Badge>
                ))}
              </Group>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
};
