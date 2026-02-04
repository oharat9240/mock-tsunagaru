import { ActionIcon, Box, Group, LoadingOverlay, Text, Tooltip } from "@mantine/core";
import {
  IconMaximize,
  IconMinimize,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerStop,
  IconVolume,
  IconVolumeOff,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { SignageEngine, type SignageEngineControl } from "~/engine";
import { useLayout } from "~/hooks/useLayout";
import { usePlaylist } from "~/hooks/usePlaylist";
import type { LayoutItem } from "~/types/layout";
import type { PlaylistItem } from "~/types/playlist";
import { logger } from "~/utils/logger";

export default function Player() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const playlistId = searchParams.get("playlist");

  const { getPlaylistById } = usePlaylist();
  const { getLayoutById } = useLayout();

  const [playlist, setPlaylist] = useState<PlaylistItem | null>(null);
  const [layout, setLayout] = useState<LayoutItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI状態
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [cycleCount, setCycleCount] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const engineControlRef = useRef<SignageEngineControl | null>(null);

  // データ読み込み
  useEffect(() => {
    const load = async () => {
      if (!playlistId) {
        setError("プレイリストIDが指定されていません");
        setLoading(false);
        return;
      }

      try {
        const pl = await getPlaylistById(playlistId);
        if (!pl) throw new Error("プレイリストが見つかりません");
        if (!pl.layoutId) throw new Error("レイアウトが設定されていません");

        const ly = await getLayoutById(pl.layoutId);
        if (!ly) throw new Error("レイアウトが見つかりません");

        setPlaylist(pl);
        setLayout(ly);
      } catch (e) {
        setError(e instanceof Error ? e.message : "読み込みエラー");
        logger.error("Player", "Failed to load data", e);
      } finally {
        setLoading(false);
      }
    };

    load();
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
      logger.error("Player", "Fullscreen toggle failed", err);
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

  // 再生/一時停止トグル
  const togglePlayPause = useCallback(() => {
    if (!engineControlRef.current) return;

    if (isPaused) {
      engineControlRef.current.play();
      setIsPaused(false);
    } else {
      engineControlRef.current.pause();
      setIsPaused(true);
    }
  }, [isPaused]);

  // 停止
  const handleStop = useCallback(() => {
    engineControlRef.current?.stop();
    setIsPaused(true);
  }, []);

  // 閉じる
  const handleClose = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    navigate(-1);
  }, [navigate]);

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlayPause();
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
            handleClose();
          }
          break;
      }
      resetControlsTimeout();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, toggleFullscreen, handleClose, resetControlsTimeout, togglePlayPause]);

  // キャンバスサイズ計算（スケーリング対応）
  const canvasDimensions = useMemo(() => {
    if (!layout) return { width: 1920, height: 1080, scale: 1 };

    const BASE_WIDTH = 1920;
    const BASE_HEIGHT = 1080;

    let layoutWidth: number;
    let layoutHeight: number;

    if (layout.orientation === "portrait-right" || layout.orientation === "portrait-left") {
      layoutWidth = BASE_HEIGHT;
      layoutHeight = BASE_WIDTH;
    } else {
      layoutWidth = BASE_WIDTH;
      layoutHeight = BASE_HEIGHT;
    }

    return {
      width: layoutWidth,
      height: layoutHeight,
      scale: 1,
    };
  }, [layout]);

  // サイクル完了時
  const handleCycleComplete = useCallback((count: number) => {
    setCycleCount(count);
    logger.info("Player", `Cycle ${count} completed`);
  }, []);

  // エラー時
  const handleEngineError = useCallback((err: string) => {
    logger.error("Player", `Engine error: ${err}`);
    setError(err);
  }, []);

  if (loading) {
    return (
      <Box ref={containerRef} pos="fixed" top={0} left={0} w="100vw" h="100vh" bg="black" style={{ zIndex: 9999 }}>
        <LoadingOverlay visible loaderProps={{ color: "white" }} />
      </Box>
    );
  }

  if (error || !playlist || !layout) {
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
          {error || "データの読み込みに失敗しました"}
        </Text>
        <ActionIcon variant="filled" color="gray" size="xl" onClick={handleClose}>
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
      {/* サイネージエンジン */}
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
        <SignageEngine
          playlist={playlist}
          layout={layout}
          autoPlay
          controlRef={engineControlRef}
          onCycleComplete={handleCycleComplete}
          onError={handleEngineError}
          onStatusChange={(status) => {
            setIsPaused(status === "paused" || status === "idle");
          }}
        />
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
          <Group gap="md">
            <Text c="white" fw={500}>
              {playlist.name}
            </Text>
            <Text c="dimmed" size="sm">
              サイクル: {cycleCount}
            </Text>
          </Group>

          <Group gap="xs">
            <Tooltip label={isPaused ? "再生 (Space/K)" : "一時停止 (Space/K)"}>
              <ActionIcon variant="subtle" color="gray" size="lg" onClick={togglePlayPause} style={{ color: "white" }}>
                {isPaused ? <IconPlayerPlay size={24} /> : <IconPlayerPause size={24} />}
              </ActionIcon>
            </Tooltip>

            <Tooltip label="停止">
              <ActionIcon variant="subtle" color="gray" size="lg" onClick={handleStop} style={{ color: "white" }}>
                <IconPlayerStop size={24} />
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
              <ActionIcon variant="subtle" color="gray" size="lg" onClick={handleClose} style={{ color: "white" }}>
                <IconX size={24} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Box>
    </Box>
  );
}
