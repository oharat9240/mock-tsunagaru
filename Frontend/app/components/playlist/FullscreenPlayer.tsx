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
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { SignageEngine, type SignageEngineControl } from "~/engine/SignageEngine";
import { useLayout } from "~/hooks/useLayout";
import { usePlaylist } from "~/hooks/usePlaylist";
import type { LayoutItem } from "~/types/layout";
import type { PlaylistItem } from "~/types/playlist";
import { logger } from "~/utils/logger";

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
  const engineControlRef = useRef<SignageEngineControl | null>(null);

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

  // エラーハンドラー
  const handleEngineError = useCallback((errorMsg: string) => {
    setError(errorMsg);
  }, []);

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
      {/* SignageEngineによる再生（プレビューと同一エンジン） */}
      {playlist && layout && (
        <Box
          pos="absolute"
          top="50%"
          left="50%"
          style={{
            transform: "translate(-50%, -50%)",
            transformOrigin: "center",
          }}
        >
          <SignageEngine
            playlist={playlist}
            layout={layout}
            scale={1}
            autoPlay={true}
            isPaused={isPaused}
            isMuted={isMuted}
            controlRef={engineControlRef}
            onError={handleEngineError}
          />
        </Box>
      )}

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
