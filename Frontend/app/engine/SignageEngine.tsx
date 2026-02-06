import { Box, Text } from "@mantine/core";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ContentRenderer } from "~/components/playlist/ContentRenderer";
import { useContent } from "~/hooks/useContent";
import type { LayoutItem } from "~/types/layout";
import type { PlaylistItem } from "~/types/playlist";
import { logger } from "~/utils/logger";
import { PlaybackEngine } from "./PlaybackEngine";
import type { EngineConfig, EngineEvent, PlaybackStatus, RegionPlaybackState } from "./types";

/** リージョン進捗情報 */
export interface RegionProgressInfo {
  regionId: string;
  currentContentIndex: number;
  currentContentName: string;
  currentContentProgress: number; // 0-100
  totalProgress: number; // 0-100
  remainingTime: number; // 秒
  totalDuration: number; // 秒
  totalContents: number;
}

/** コンテンツのdurationを取得するヘルパー */
function getContentDuration(
  content: RegionPlaybackState["contents"][number],
  assignment: RegionPlaybackState["assignment"],
  defaultDuration: number,
  detectedDurations?: Map<string, number>,
): number {
  const durationInfo = assignment.contentDurations.find((d) => d.contentId === content.id);
  if (durationInfo) {
    return durationInfo.duration;
  }
  if (content.type === "video") {
    // 1. メタデータから取得
    if (content.fileInfo?.metadata?.duration) {
      return content.fileInfo.metadata.duration;
    }
    // 2. 再生時に検出されたdurationを使用
    if (detectedDurations?.has(content.id)) {
      return detectedDurations.get(content.id)!;
    }
    // 3. 動画でdurationが不明な場合は大きな値を使用（進捗が遡らないようにする）
    // 検出後に正しい値に更新される
    return 3600;
  }
  return defaultDuration;
}

/** リージョンの総再生時間を計算 */
function calculateRegionTotalDuration(
  regionState: RegionPlaybackState,
  defaultDuration: number,
  detectedDurations?: Map<string, number>,
): number {
  return regionState.contents.reduce((total, content) => {
    return total + getContentDuration(content, regionState.assignment, defaultDuration, detectedDurations);
  }, 0);
}

/** 現在のコンテンツまでの経過時間を計算 */
function calculateElapsedTime(
  regionState: RegionPlaybackState,
  defaultDuration: number,
  detectedDurations?: Map<string, number>,
): number {
  let elapsed = 0;
  for (let i = 0; i < regionState.currentIndex; i++) {
    const content = regionState.contents[i];
    elapsed += getContentDuration(content, regionState.assignment, defaultDuration, detectedDurations);
  }
  return elapsed;
}

interface SignageEngineProps {
  /** プレイリスト */
  playlist: PlaylistItem;
  /** レイアウト */
  layout: LayoutItem;
  /** 自動再生 */
  autoPlay?: boolean;
  /** スケール（プレビュー用縮小表示） */
  scale?: number;
  /** 一時停止状態（外部制御） */
  isPaused?: boolean;
  /** ミュート状態 */
  isMuted?: boolean;
  /** エンジン設定 */
  config?: Partial<EngineConfig>;
  /** サイクル完了時のコールバック */
  onCycleComplete?: (cycleCount: number) => void;
  /** エラー時のコールバック */
  onError?: (error: string) => void;
  /** ステータス変更時のコールバック */
  onStatusChange?: (status: PlaybackStatus) => void;
  /** リージョン進捗更新時のコールバック */
  onRegionProgress?: (info: RegionProgressInfo) => void;
  /** 再生コントロールを外部から取得するための ref */
  controlRef?: React.MutableRefObject<SignageEngineControl | null>;
}

export interface SignageEngineControl {
  play: () => void;
  pause: () => void;
  stop: () => void;
  getStatus: () => PlaybackStatus;
  /** コンテンツ完了を通知（動画コンテンツ用） */
  notifyContentComplete: (regionId: string) => void;
}

export const SignageEngine = memo(function SignageEngine({
  playlist,
  layout,
  autoPlay = true,
  scale = 1,
  isPaused: externalPaused = false,
  isMuted = true,
  config,
  onCycleComplete,
  onError,
  onStatusChange,
  onRegionProgress,
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

  // エンジン時間（秒単位）
  const [engineTime, setEngineTime] = useState(0);

  // 動画のdurationを動的に保持（メタデータがない動画用）
  // キー: contentId、値: 検出されたduration
  const detectedDurationsRef = useRef<Map<string, number>>(new Map());

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

        case "contentChange": {
          // リージョン状態を更新
          const newRegions = new Map(engine.getState().regions);
          setRegionStates(newRegions);
          // コンテンツキーを更新して ContentRenderer を再マウント
          setContentKeys((prev) => {
            const next = new Map(prev);
            next.set(event.regionId, (prev.get(event.regionId) ?? 0) + 1);
            return next;
          });
          // リージョン進捗情報を通知
          const regionState = newRegions.get(event.regionId);
          if (regionState && onRegionProgress) {
            const defaultDuration = engine.getConfig().defaultDuration;
            const detectedDurations = detectedDurationsRef.current;
            // 総再生時間を計算
            const totalDuration = calculateRegionTotalDuration(regionState, defaultDuration, detectedDurations);
            // 現在までの経過時間を計算
            const elapsedTime = calculateElapsedTime(regionState, defaultDuration, detectedDurations);

            onRegionProgress({
              regionId: event.regionId,
              currentContentIndex: regionState.currentIndex,
              currentContentName: event.content.name,
              currentContentProgress: 0,
              totalProgress: totalDuration > 0 ? (elapsedTime / totalDuration) * 100 : 0,
              remainingTime: totalDuration - elapsedTime,
              totalDuration,
              totalContents: regionState.contents.length,
            });
          }
          break;
        }

        case "cycleComplete":
          onCycleComplete?.(event.cycleCount);
          break;

        case "error":
          setError(event.error);
          onError?.(event.error);
          break;

        case "timeUpdate": {
          setEngineTime(event.currentTime);

          // 各リージョンの進捗情報を更新
          if (onRegionProgress) {
            const currentRegions = engine.getState().regions;
            const defaultDuration = engine.getConfig().defaultDuration;
            const detectedDurations = detectedDurationsRef.current;

            for (const [regionId, regionState] of currentRegions) {
              if (!regionState.currentContent) continue;

              const totalDuration = calculateRegionTotalDuration(regionState, defaultDuration, detectedDurations);
              const elapsedBeforeCurrent = calculateElapsedTime(regionState, defaultDuration, detectedDurations);

              // 現在のコンテンツの実際のdurationを取得
              const currentContent = regionState.currentContent.content;
              const currentContentDuration = getContentDuration(
                currentContent,
                regionState.assignment,
                defaultDuration,
                detectedDurations,
              );

              // 現在のコンテンツ内での経過時間（負にならないようにクランプ）
              const currentContentElapsed = Math.max(0, event.currentTime - regionState.currentContent.startTime);
              const currentContentProgress =
                currentContentDuration > 0
                  ? Math.max(0, Math.min((currentContentElapsed / currentContentDuration) * 100, 100))
                  : 0;

              // 総経過時間（負にならないようにクランプ）
              const totalElapsed = Math.max(0, elapsedBeforeCurrent + currentContentElapsed);
              const totalProgress =
                totalDuration > 0 ? Math.max(0, Math.min((totalElapsed / totalDuration) * 100, 100)) : 0;

              onRegionProgress({
                regionId,
                currentContentIndex: regionState.currentIndex,
                currentContentName: regionState.currentContent.content.name,
                currentContentProgress,
                totalProgress,
                remainingTime: Math.max(totalDuration - totalElapsed, 0),
                totalDuration,
                totalContents: regionState.contents.length,
              });
            }
          }
          break;
        }

        case "preload":
          // プリロードイベントはログ出力のみ（将来の拡張用）
          logger.debug("SignageEngine", `Preload requested for region ${event.regionId}, starts in ${event.startsIn}s`);
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

  // 外部からの一時停止制御
  useEffect(() => {
    if (!isReady || !engineRef.current) return;

    if (externalPaused) {
      engineRef.current.pause();
    } else {
      engineRef.current.play();
    }
  }, [externalPaused, isReady]);

  // 外部コントロール用の ref を設定
  useEffect(() => {
    if (controlRef) {
      controlRef.current = {
        play: () => engineRef.current?.play(),
        pause: () => engineRef.current?.pause(),
        stop: () => engineRef.current?.stop(),
        getStatus: () => engineRef.current?.getState().status ?? "idle",
        notifyContentComplete: (regionId: string) => engineRef.current?.notifyContentComplete(regionId),
      };
    }
  }, [controlRef]);

  // キャンバスサイズ計算（scaleを適用）
  const canvasSize = useMemo(() => {
    const BASE_WIDTH = 1920;
    const BASE_HEIGHT = 1080;

    let width: number;
    let height: number;

    if (layout.orientation === "portrait-right" || layout.orientation === "portrait-left") {
      width = BASE_HEIGHT;
      height = BASE_WIDTH;
    } else {
      width = BASE_WIDTH;
      height = BASE_HEIGHT;
    }

    return {
      width: width * scale,
      height: height * scale,
      baseWidth: width,
      baseHeight: height,
    };
  }, [layout.orientation, scale]);

  // コンテンツ完了時のコールバック（動画コンテンツの完了通知用）
  const handleContentComplete = useCallback((regionId: string) => {
    logger.debug("SignageEngine", `Content complete in region: ${regionId}`);
    // PlaybackEngineに動画完了を通知して次のコンテンツに進む
    engineRef.current?.notifyContentComplete(regionId);
  }, []);

  // 動画のdurationが検出されたときのコールバック
  const handleDurationDetected = useCallback((contentId: string, duration: number) => {
    logger.debug("SignageEngine", `Duration detected for content ${contentId}: ${duration}s`);
    detectedDurationsRef.current.set(contentId, duration);
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

        // スケール適用したリージョン座標・サイズ
        const scaledX = region.x * scale;
        const scaledY = region.y * scale;
        const scaledWidth = region.width * scale;
        const scaledHeight = region.height * scale;

        if (!currentContent) {
          return (
            <Box
              key={region.id}
              pos="absolute"
              left={scaledX}
              top={scaledY}
              w={scaledWidth}
              h={scaledHeight}
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
            left={scaledX}
            top={scaledY}
            w={scaledWidth}
            h={scaledHeight}
            style={{ zIndex: region.zIndex, overflow: "hidden" }}
          >
            <ContentRenderer
              key={`${region.id}-${contentKey}`}
              content={currentContent.content}
              duration={currentContent.duration}
              width={scaledWidth}
              height={scaledHeight}
              engineTime={engineTime}
              contentStartTime={currentContent.startTime}
              isMuted={isMuted}
              onComplete={() => handleContentComplete(region.id)}
              onDurationDetected={(duration) => handleDurationDetected(currentContent.content.id, duration)}
            />
          </Box>
        );
      })}
    </Box>
  );
});
