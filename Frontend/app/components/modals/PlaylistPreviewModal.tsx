import { Box, Button, Flex, Group, LoadingOverlay, Modal, Stack, Text, useMantineColorScheme } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { IconPlayerPlay } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type RegionProgressInfo, SignageEngine, type SignageEngineControl } from "~/engine/SignageEngine";
import { useLayout } from "~/hooks/useLayout";
import { usePlaylist } from "~/hooks/usePlaylist";
import type { LayoutItem } from "~/types/layout";
import type { PlaylistItem } from "~/types/playlist";
import { logger } from "~/utils/logger";
import { PreviewInfoPanel } from "../playlist/PreviewInfoPanel";

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
  const controlRef = useRef<SignageEngineControl | null>(null);
  const { ref: previewAreaRef, width: previewAreaWidth, height: previewAreaHeight } = useElementSize();

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
      } catch (err) {
        logger.error("PlaylistPreviewModal", "Failed to load playlist data", err);
        setError(err instanceof Error ? err.message : "データの読み込みに失敗しました");
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

  // レイアウトの向きに応じたスケールを計算（メモ化）
  // プレビューエリアの実際のサイズに基づいて、スクロールが不要なサイズに収まるようにする
  const previewScale = useMemo(() => {
    if (!layout) return 1;

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

    // プレビューエリアの実際のサイズを使用（パディング分を考慮）
    // useElementSizeで取得したサイズが0の場合はフォールバック値を使用
    const padding = 48; // p="xl" = 24px * 2
    const maxPreviewWidth = previewAreaWidth > 0 ? previewAreaWidth - padding : 800;
    const maxPreviewHeight = previewAreaHeight > 0 ? previewAreaHeight - padding : 600;

    // スケールを計算（縦横比を保持、スクロールが発生しないように）
    const scaleX = maxPreviewWidth / layoutWidth;
    const scaleY = maxPreviewHeight / layoutHeight;
    return Math.min(scaleX, scaleY, 1); // 最大スケール1を超えないようにする
  }, [layout, previewAreaWidth, previewAreaHeight]);

  // モーダルクローズ時のクリーンアップ
  const handleClose = useCallback(() => {
    // エンジンを停止
    controlRef.current?.stop();
    setPlaylist(null);
    setLayout(null);
    setProgressInfos([]);
    setError(null);
    onClose();
  }, [onClose]);

  // エラーハンドラー
  const handleError = useCallback((errorMsg: string) => {
    setError(errorMsg);
  }, []);

  if (!opened) return null;

  const handlePlay = () => {
    if (playlistId && onPlay) {
      handleClose();
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
        content: { height: "calc(100vh - 80px)", overflow: "hidden" },
        body: { height: "calc(100% - 62px)", padding: 0 }, // ヘッダー分（62px）を引く
      }}
    >
      <LoadingOverlay visible={loading} />

      <Flex h="100%">
        {/* プレビューエリア */}
        <Box ref={previewAreaRef} flex={1} p="xl" style={{ overflow: "hidden" }}>
          {error ? (
            <Stack align="center" justify="center" h="100%">
              <Text c="red">{error}</Text>
              <Button onClick={handleClose}>閉じる</Button>
            </Stack>
          ) : playlist && layout ? (
            <Flex justify="center" align="center" h="100%">
              {/* SignageEngineによるプレビュー（フルスクリーン再生と同一エンジン） */}
              <Box
                style={{
                  border: `2px solid ${colorScheme === "dark" ? "var(--mantine-color-dark-4)" : "var(--mantine-color-gray-4)"}`,
                  borderRadius: "8px",
                  overflow: "hidden",
                }}
              >
                <SignageEngine
                  playlist={playlist}
                  layout={layout}
                  scale={previewScale}
                  autoPlay={true}
                  isMuted={false}
                  controlRef={controlRef}
                  onRegionProgress={handleProgressUpdate}
                  onError={handleError}
                />
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
