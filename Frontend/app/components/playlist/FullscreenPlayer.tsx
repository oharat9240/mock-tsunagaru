import { ActionIcon, Box, Group, Text, Tooltip } from "@mantine/core";
import {
  IconMaximize,
  IconMinimize,
  IconPlayerPause,
  IconPlayerPlay,
  IconVolume,
  IconVolumeOff,
  IconX,
} from "@tabler/icons-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLayout } from "~/hooks/useLayout";
import { usePlaylist } from "~/hooks/usePlaylist";
import type { LayoutItem } from "~/types/layout";
import type { PlaylistItem } from "~/types/playlist";
import { logger } from "~/utils/logger";
import { RegionPlayerFullscreen } from "./RegionPlayerFullscreen";

interface FullscreenPlayerProps {
  playlistId: string;
  onClose: () => void;
}

export const FullscreenPlayer = memo(function FullscreenPlayer({ playlistId, onClose }: FullscreenPlayerProps) {
  const { getPlaylistById } = usePlaylist();
  const { getLayoutById } = useLayout();
  const [playlist, setPlaylist] = useState<PlaylistItem | null>(null);
  const [layout, setLayout] = useState<LayoutItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<number | null>(null);

  // データ読み込み
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const playlistData = await getPlaylistById(playlistId);
        if (!playlistData) {
          throw new Error("プレイリストが見つかりません");
        }
        setPlaylist(playlistData);

        if (!playlistData.layoutId) {
          throw new Error("プレイリストにレイアウトが設定されていません");
        }

        const layoutData = await getLayoutById(playlistData.layoutId);
        if (!layoutData) {
          throw new Error("レイアウトが見つかりません");
        }
        setLayout(layoutData);
      } catch (error) {
        logger.error("FullscreenPlayer", "Failed to load data", error);
        setError(error instanceof Error ? error.message : "データの読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [playlistId, getPlaylistById, getLayoutById]);

  // フルスクリーン切り替え
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      logger.error("FullscreenPlayer", "Fullscreen toggle failed", err);
    }
  }, []);

  // フルスクリーン状態の監視
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // コントロールの自動非表示
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  // マウス移動でコントロール表示
  const handleMouseMove = useCallback(() => {
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          setIsPaused((prev) => !prev);
          break;
        case "m":
          e.preventDefault();
          setIsMuted((prev) => !prev);
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "Escape":
          if (!isFullscreen) {
            onClose();
          }
          break;
      }
      resetControlsTimeout();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, toggleFullscreen, onClose, resetControlsTimeout]);

  // キャンバスサイズの計算
  const canvasDimensions = useMemo(() => {
    if (!layout) return { width: 1920, height: 1080, scale: 1 };

    const BASE_CANVAS_WIDTH = 1920;
    const BASE_CANVAS_HEIGHT = 1080;

    let layoutWidth: number;
    let layoutHeight: number;

    if (layout.orientation === "portrait-right" || layout.orientation === "portrait-left") {
      layoutWidth = BASE_CANVAS_HEIGHT;
      layoutHeight = BASE_CANVAS_WIDTH;
    } else {
      layoutWidth = BASE_CANVAS_WIDTH;
      layoutHeight = BASE_CANVAS_HEIGHT;
    }

    return {
      width: layoutWidth,
      height: layoutHeight,
      scale: 1,
    };
  }, [layout]);

  // リージョンプレイヤーの生成
  const regionPlayers = useMemo(() => {
    if (!layout || !playlist) return [];

    return layout.regions.map((region, index) => {
      const assignment = playlist.contentAssignments.find((a) => a.regionId === region.id);

      if (!assignment) {
        return (
          <Box
            key={region.id}
            pos="absolute"
            left={region.x}
            top={region.y}
            w={region.width}
            h={region.height}
            display="flex"
            style={{
              zIndex: region.zIndex,
              backgroundColor: "#1a1a1a",
              border: "2px dashed #444",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              color: "#666",
            }}
          >
            リージョン {index + 1}
            <br />
            (コンテンツ未設定)
          </Box>
        );
      }

      return (
        <RegionPlayerFullscreen
          key={region.id}
          region={region}
          assignment={assignment}
          isPaused={isPaused}
          isMuted={isMuted}
        />
      );
    });
  }, [layout, playlist, isPaused, isMuted]);

  if (loading) {
    return (
      <Box
        ref={containerRef}
        pos="fixed"
        top={0}
        left={0}
        w="100vw"
        h="100vh"
        bg="black"
        style={{ zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <Text c="white" size="xl">
          読み込み中...
        </Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        ref={containerRef}
        pos="fixed"
        top={0}
        left={0}
        w="100vw"
        h="100vh"
        bg="black"
        style={{
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
        }}
      >
        <Text c="red" size="xl">
          {error}
        </Text>
        <ActionIcon variant="filled" color="gray" size="xl" onClick={onClose}>
          <IconX size={24} />
        </ActionIcon>
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      pos="fixed"
      top={0}
      left={0}
      w="100vw"
      h="100vh"
      bg="black"
      style={{ zIndex: 9999, cursor: showControls ? "default" : "none" }}
      onMouseMove={handleMouseMove}
    >
      {/* プレイヤーキャンバス */}
      <Box
        pos="absolute"
        top="50%"
        left="50%"
        w={canvasDimensions.width}
        h={canvasDimensions.height}
        style={{
          transform: "translate(-50%, -50%)",
          transformOrigin: "center",
          overflow: "hidden",
        }}
      >
        {regionPlayers}
      </Box>

      {/* コントロールバー */}
      <Box
        pos="absolute"
        bottom={0}
        left={0}
        right={0}
        p="md"
        style={{
          background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
          opacity: showControls ? 1 : 0,
          transition: "opacity 0.3s ease",
          pointerEvents: showControls ? "auto" : "none",
        }}
      >
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <Text c="white" fw={500}>
              {playlist?.name}
            </Text>
          </Group>

          <Group gap="xs">
            <Tooltip label={isPaused ? "再生 (Space/K)" : "一時停止 (Space/K)"}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                onClick={() => setIsPaused((prev) => !prev)}
                style={{ color: "white" }}
              >
                {isPaused ? <IconPlayerPlay size={24} /> : <IconPlayerPause size={24} />}
              </ActionIcon>
            </Tooltip>

            <Tooltip label={isMuted ? "ミュート解除 (M)" : "ミュート (M)"}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                onClick={() => setIsMuted((prev) => !prev)}
                style={{ color: "white" }}
              >
                {isMuted ? <IconVolumeOff size={24} /> : <IconVolume size={24} />}
              </ActionIcon>
            </Tooltip>

            <Tooltip label={isFullscreen ? "フルスクリーン解除 (F)" : "フルスクリーン (F)"}>
              <ActionIcon variant="subtle" color="gray" size="lg" onClick={toggleFullscreen} style={{ color: "white" }}>
                {isFullscreen ? <IconMinimize size={24} /> : <IconMaximize size={24} />}
              </ActionIcon>
            </Tooltip>

            <Tooltip label="閉じる (Esc)">
              <ActionIcon variant="subtle" color="gray" size="lg" onClick={onClose} style={{ color: "white" }}>
                <IconX size={24} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Box>
    </Box>
  );
});
