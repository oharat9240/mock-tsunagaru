import { Alert, Badge, Box, Group, Loader, Paper, ScrollArea, Stack, Text } from "@mantine/core";
import { IconAlertCircle, IconList, IconPlaylist } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { usePlaylist } from "~/hooks/usePlaylist";
import type { PlaylistIndex } from "~/types/playlist";
import { logger } from "~/utils/logger";

interface LayoutUsage {
  playlist: PlaylistIndex;
}

interface LayoutUsageDisplayProps {
  layoutId: string;
}

export const LayoutUsageDisplay = ({ layoutId }: LayoutUsageDisplayProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usageList, setUsageList] = useState<LayoutUsage[]>([]);

  const { getPlaylistsIndex, getPlaylistById } = usePlaylist();

  const loadLayoutUsage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 全プレイリストを取得
      const playlists = await getPlaylistsIndex();
      const usages: LayoutUsage[] = [];

      // 各プレイリストでレイアウトの使用状況をチェック
      for (const playlistIndex of playlists) {
        try {
          const playlist = await getPlaylistById(playlistIndex.id);
          if (!playlist) continue;

          // このプレイリストでレイアウトが使用されているかチェック
          if (playlist.layoutId === layoutId) {
            usages.push({
              playlist: playlistIndex,
            });
          }
        } catch (playlistError) {
          logger.warn("LayoutUsageDisplay", `Failed to load playlist ${playlistIndex.id}`, playlistError);
        }
      }

      setUsageList(usages);
    } catch (err) {
      logger.error("LayoutUsageDisplay", "Failed to load layout usage", err);
      setError("使用状況の読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [layoutId, getPlaylistsIndex, getPlaylistById]);

  useEffect(() => {
    if (layoutId) {
      loadLayoutUsage();
    }
  }, [layoutId, loadLayoutUsage]);

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
              このレイアウトはどのプレイリストでも使用されていません
            </Text>
          </Group>
        </Paper>
      </Box>
    );
  }

  return (
    <Box style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Group gap="sm" mb="sm">
        <Text size="sm" fw={500}>
          使用状況
        </Text>
        <Badge variant="light" size="sm">
          {usageList.length}個のプレイリスト
        </Badge>
      </Group>

      <ScrollArea style={{ flex: 1 }} type="auto">
        <Stack gap="sm">
          {usageList.map((usage) => (
            <Paper key={usage.playlist.id} p="md" withBorder>
              <Group gap="sm" wrap="nowrap">
                <Box c="blue.6">
                  <IconPlaylist size={16} />
                </Box>
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" fw={500} style={{ wordBreak: "break-word" }}>
                    {usage.playlist.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    デバイス: {usage.playlist.device}
                  </Text>
                </Box>
              </Group>
            </Paper>
          ))}
        </Stack>
      </ScrollArea>
    </Box>
  );
};
