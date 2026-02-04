import { Box, Text } from "@mantine/core";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ContentRenderer } from "~/components/playlist/ContentRenderer";
import { useContent } from "~/hooks/useContent";
import type { LayoutItem } from "~/types/layout";
import type { PlaylistItem } from "~/types/playlist";
import { logger } from "~/utils/logger";
import { PlaybackEngine } from "./PlaybackEngine";
import type { EngineConfig, EngineEvent, PlaybackStatus, RegionPlaybackState } from "./types";

interface SignageEngineProps {
  /** プレイリスト */
  playlist: PlaylistItem;
  /** レイアウト */
  layout: LayoutItem;
  /** 自動再生 */
  autoPlay?: boolean;
  /** エンジン設定 */
  config?: Partial<EngineConfig>;
  /** サイクル完了時のコールバック */
  onCycleComplete?: (cycleCount: number) => void;
  /** エラー時のコールバック */
  onError?: (error: string) => void;
  /** ステータス変更時のコールバック */
  onStatusChange?: (status: PlaybackStatus) => void;
  /** 再生コントロールを外部から取得するための ref */
  controlRef?: React.MutableRefObject<SignageEngineControl | null>;
}

export interface SignageEngineControl {
  play: () => void;
  pause: () => void;
  stop: () => void;
  getStatus: () => PlaybackStatus;
}

export const SignageEngine = memo(function SignageEngine({
  playlist,
  layout,
  autoPlay = true,
  config,
  onCycleComplete,
  onError,
  onStatusChange,
  controlRef,
}: SignageEngineProps) {
  const { getContentById } = useContent();
  const engineRef = useRef<PlaybackEngine | null>(null);
  const [regionStates, setRegionStates] = useState<Map<string, RegionPlaybackState>>(new Map());
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [_status, setStatus] = useState<PlaybackStatus>("idle");

  // コンテンツ変更を追跡するキー（強制再レンダリング用）
  const [contentKeys, setContentKeys] = useState<Map<string, number>>(new Map());

  // エンジン初期化
  // biome-ignore lint/correctness/useExhaustiveDependencies: playlist.id/layout.idの変更時のみ再初期化する（オブジェクト全体の依存は意図的に避ける）
  useEffect(() => {
    let isMounted = true;
    const engine = new PlaybackEngine(getContentById, config);
    engineRef.current = engine;

    const unsubscribe = engine.on((event: EngineEvent) => {
      if (!isMounted) return;

      switch (event.type) {
        case "statusChange":
          setStatus(event.status);
          onStatusChange?.(event.status);
          break;

        case "contentChange":
          // リージョン状態を更新
          setRegionStates(new Map(engine.getState().regions));
          // コンテンツキーを更新して ContentRenderer を再マウント
          setContentKeys((prev) => {
            const next = new Map(prev);
            next.set(event.regionId, (prev.get(event.regionId) ?? 0) + 1);
            return next;
          });
          break;

        case "cycleComplete":
          onCycleComplete?.(event.cycleCount);
          break;

        case "error":
          setError(event.error);
          onError?.(event.error);
          break;
      }
    });

    const init = async () => {
      try {
        await engine.init();
        await engine.load(playlist, layout);

        if (!isMounted) return;

        setRegionStates(new Map(engine.getState().regions));
        setIsReady(true);

        if (autoPlay) {
          // 少し遅延させてからスタート（DOMの準備を待つ）
          setTimeout(() => {
            if (isMounted && engineRef.current) {
              engineRef.current.play();
            }
          }, 100);
        }
      } catch (err) {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : "初期化エラー";
        setError(message);
        onError?.(message);
      }
    };

    init();

    return () => {
      isMounted = false;
      unsubscribe();
      engine.dispose();
    };
  }, [playlist.id, layout.id, autoPlay, config, getContentById, onCycleComplete, onError, onStatusChange]);

  // 外部コントロール用の ref を設定
  useEffect(() => {
    if (controlRef) {
      controlRef.current = {
        play: () => engineRef.current?.play(),
        pause: () => engineRef.current?.pause(),
        stop: () => engineRef.current?.stop(),
        getStatus: () => engineRef.current?.getState().status ?? "idle",
      };
    }
  }, [controlRef]);

  // キャンバスサイズ計算
  const canvasSize = useMemo(() => {
    const BASE_WIDTH = 1920;
    const BASE_HEIGHT = 1080;

    if (layout.orientation === "portrait-right" || layout.orientation === "portrait-left") {
      return { width: BASE_HEIGHT, height: BASE_WIDTH };
    }
    return { width: BASE_WIDTH, height: BASE_HEIGHT };
  }, [layout.orientation]);

  // コンテンツ完了時のコールバック（現在は使用しないが将来の拡張用）
  const handleContentComplete = useCallback((regionId: string) => {
    logger.debug("SignageEngine", `Content complete in region: ${regionId}`);
    // PlaybackEngine が自動的に次のコンテンツに進むので、ここでは特に何もしない
  }, []);

  if (error) {
    return (
      <Box
        w={canvasSize.width}
        h={canvasSize.height}
        bg="black"
        display="flex"
        style={{ alignItems: "center", justifyContent: "center" }}
      >
        <Text c="red" size="xl">
          {error}
        </Text>
      </Box>
    );
  }

  if (!isReady) {
    return (
      <Box
        w={canvasSize.width}
        h={canvasSize.height}
        bg="black"
        display="flex"
        style={{ alignItems: "center", justifyContent: "center", color: "white" }}
      >
        <Text size="xl">読み込み中...</Text>
      </Box>
    );
  }

  return (
    <Box pos="relative" w={canvasSize.width} h={canvasSize.height} bg="black" style={{ overflow: "hidden" }}>
      {layout.regions.map((region) => {
        const regionState = regionStates.get(region.id);
        const currentContent = regionState?.currentContent;
        const contentKey = contentKeys.get(region.id) ?? 0;

        if (!currentContent) {
          return (
            <Box
              key={region.id}
              pos="absolute"
              left={region.x}
              top={region.y}
              w={region.width}
              h={region.height}
              style={{
                zIndex: region.zIndex,
                backgroundColor: "#111",
              }}
            />
          );
        }

        return (
          <Box
            key={region.id}
            pos="absolute"
            left={region.x}
            top={region.y}
            w={region.width}
            h={region.height}
            style={{ zIndex: region.zIndex, overflow: "hidden" }}
          >
            <ContentRenderer
              key={`${region.id}-${contentKey}`}
              content={currentContent.content}
              duration={currentContent.duration}
              width={region.width}
              height={region.height}
              onComplete={() => handleContentComplete(region.id)}
            />
          </Box>
        );
      })}
    </Box>
  );
});
