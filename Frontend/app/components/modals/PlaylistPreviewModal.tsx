import { Box, Button, Flex, Group, LoadingOverlay, Modal, Stack, Text, useMantineColorScheme } from "@mantine/core";
import { IconPlayerPlay } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLayout } from "~/hooks/useLayout";
import { usePlaylist } from "~/hooks/usePlaylist";
import type { LayoutItem } from "~/types/layout";
import type { PlaylistItem } from "~/types/playlist";
import { logger } from "~/utils/logger";
import { PreviewInfoPanel } from "../playlist/PreviewInfoPanel";
import { RegionPlayer, type RegionProgressInfo } from "../playlist/RegionPlayer";

interface PlaylistPreviewModalProps {
  opened: boolean;
  onClose: () => void;
  playlistId: string | null;
  onPlay?: (playlistId: string) => void;
}

export function PlaylistPreviewModal({ opened, onClose, playlistId, onPlay }: PlaylistPreviewModalProps) {
  const { colorScheme } = useMantineColorScheme();
  const { getPlaylistById } = usePlaylist();
  const { getLayoutById } = useLayout();
  const [playlist, setPlaylist] = useState<PlaylistItem | null>(null);
  const [layout, setLayout] = useState<LayoutItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressInfos, setProgressInfos] = useState<RegionProgressInfo[]>([]);

  // プレイリストとレイアウト情報を読み込み
  useEffect(() => {
    const loadData = async () => {
      if (!playlistId) return;

      setLoading(true);
      setError(null);

      try {
        // プレイリスト情報を取得
        const playlistData = await getPlaylistById(playlistId);
        if (!playlistData) {
          throw new Error("プレイリストが見つかりません");
        }
        setPlaylist(playlistData);

        // レイアウトIDが設定されているか確認
        if (!playlistData.layoutId) {
          throw new Error("プレイリストにレイアウトが設定されていません");
        }

        // レイアウト情報を取得
        const layoutData = await getLayoutById(playlistData.layoutId);
        if (!layoutData) {
          throw new Error("レイアウトが見つかりません");
        }
        setLayout(layoutData);

        // プログレス情報を初期化
        setProgressInfos([]);
      } catch (error) {
        logger.error("PlaylistPreviewModal", "Failed to load playlist data", error);
        setError(error instanceof Error ? error.message : "データの読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    };

    if (opened && playlistId) {
      loadData();
    }
  }, [opened, playlistId, getPlaylistById, getLayoutById]);

  // プログレス情報の更新ハンドラー（安定化）
  const handleProgressUpdate = useCallback((info: RegionProgressInfo) => {
    setProgressInfos((prev) => {
      const existingIndex = prev.findIndex((p) => p.regionId === info.regionId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = info;
        return updated;
      }
      return [...prev, info];
    });
  }, []);

  // レイアウトの向きに応じたキャンバスサイズを計算（メモ化）
  const canvasDimensions = useMemo(() => {
    if (!layout) return { width: 800, height: 600, scale: 1 };

    // レイアウトの実際のサイズを取得（ベースサイズ）
    const BASE_CANVAS_WIDTH = 1920;
    const BASE_CANVAS_HEIGHT = 1080;

    let layoutWidth: number;
    let layoutHeight: number;

    if (layout.orientation === "portrait-right" || layout.orientation === "portrait-left") {
      layoutWidth = BASE_CANVAS_HEIGHT; // 縦向きの場合は幅と高さを入れ替え
      layoutHeight = BASE_CANVAS_WIDTH;
    } else {
      layoutWidth = BASE_CANVAS_WIDTH;
      layoutHeight = BASE_CANVAS_HEIGHT;
    }

    // プレビューエリアの最大サイズ
    const maxPreviewWidth = 800;
    const maxPreviewHeight = 600;

    // スケールを計算（縦横比を保持）
    const scaleX = maxPreviewWidth / layoutWidth;
    const scaleY = maxPreviewHeight / layoutHeight;
    const scale = Math.min(scaleX, scaleY);

    return {
      width: layoutWidth * scale,
      height: layoutHeight * scale,
      scale,
    };
  }, [layout]);

  // リージョンプレイヤーのメモ化
  const regionPlayers = useMemo(() => {
    if (!layout || !playlist) return [];

    return layout.regions.map((region, index) => {
      const assignment = playlist.contentAssignments.find((a) => a.regionId === region.id);

      // スケールされたリージョンプロパティ
      const scaledRegion = {
        ...region,
        x: region.x * canvasDimensions.scale,
        y: region.y * canvasDimensions.scale,
        width: region.width * canvasDimensions.scale,
        height: region.height * canvasDimensions.scale,
      };

      if (!assignment) {
        return (
          <Box
            key={region.id}
            pos="absolute"
            left={scaledRegion.x}
            top={scaledRegion.y}
            w={scaledRegion.width}
            h={scaledRegion.height}
            display="flex"
            style={{
              zIndex: region.zIndex,
              backgroundColor: colorScheme === "dark" ? "var(--mantine-color-dark-6)" : "var(--mantine-color-gray-0)",
              border: `2px dashed ${colorScheme === "dark" ? "var(--mantine-color-dark-4)" : "var(--mantine-color-gray-4)"}`,
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              color: colorScheme === "dark" ? "var(--mantine-color-dark-2)" : "var(--mantine-color-gray-6)",
            }}
          >
            リージョン {index + 1}
            <br />
            (コンテンツ未設定)
          </Box>
        );
      }

      return (
        <RegionPlayer key={region.id} region={scaledRegion} assignment={assignment} onProgress={handleProgressUpdate} />
      );
    });
  }, [layout, playlist, canvasDimensions.scale, handleProgressUpdate, colorScheme]);

  // モーダルクローズ時のクリーンアップ
  const handleClose = () => {
    setPlaylist(null);
    setLayout(null);
    setProgressInfos([]);
    setError(null);
    onClose();
  };

  if (!opened) return null;

  const handlePlay = () => {
    if (playlistId && onPlay) {
      onClose();
      onPlay(playlistId);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="md">
          <Text fw={500}>プレイリストプレビュー</Text>
          {onPlay && playlistId && (
            <Button size="xs" color="violet" leftSection={<IconPlayerPlay size={14} />} onClick={handlePlay}>
              フルスクリーン再生
            </Button>
          )}
        </Group>
      }
      size="calc(100vw - 40px)"
      styles={{
        content: { height: "calc(100vh - 80px)" },
        body: { height: "100%", padding: 0 },
      }}
    >
      <LoadingOverlay visible={loading} />

      <Flex h="100%">
        {/* プレビューエリア */}
        <Box flex={1} p="xl" style={{ overflow: "auto" }}>
          {error ? (
            <Stack align="center" justify="center" h="100%">
              <Text c="red">{error}</Text>
              <Button onClick={handleClose}>閉じる</Button>
            </Stack>
          ) : playlist && layout ? (
            <Flex justify="center" align="center" h="100%">
              {/* プレビューキャンバス */}
              <Box
                pos="relative"
                w={canvasDimensions.width}
                h={canvasDimensions.height}
                style={{
                  border: `2px solid ${colorScheme === "dark" ? "var(--mantine-color-dark-4)" : "var(--mantine-color-gray-4)"}`,
                  backgroundColor:
                    colorScheme === "dark" ? "var(--mantine-color-dark-7)" : "var(--mantine-color-white)",
                  overflow: "hidden",
                  borderRadius: "8px",
                }}
              >
                {/* 各リージョンのプレイヤー（メモ化） */}
                {regionPlayers}
              </Box>
            </Flex>
          ) : (
            <Stack align="center" justify="center" h="100%">
              <Text>プレイリストを読み込み中...</Text>
            </Stack>
          )}
        </Box>

        {/* 情報パネル */}
        {playlist && <PreviewInfoPanel progressInfos={progressInfos} playlistName={playlist.name} />}
      </Flex>
    </Modal>
  );
}
