import type { ContentItem } from "~/types/content";
import type { LayoutItem } from "~/types/layout";
import type { PlaylistItem } from "~/types/playlist";
import { logger } from "~/utils/logger";
import { TimingController } from "./TimingController";
import {
  type ContentLoader,
  DEFAULT_ENGINE_CONFIG,
  type EngineConfig,
  type EngineEvent,
  type EngineEventListener,
  type EngineState,
  type PlaybackStatus,
  type RegionPlaybackState,
} from "./types";

/**
 * PlaybackEngine
 *
 * プレイリストの再生を統括するエンジン。
 * - レイアウトに基づいた複数リージョンの同時再生
 * - 各リージョン内のコンテンツ順次再生
 * - ループ再生対応
 */
export class PlaybackEngine {
  private config: EngineConfig;
  private timing: TimingController;
  private state: EngineState;
  private listeners: Set<EngineEventListener> = new Set();
  private animationFrameId: number | null = null;
  private contentLoader: ContentLoader;

  constructor(contentLoader: ContentLoader, config: Partial<EngineConfig> = {}) {
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...config };
    this.timing = new TimingController();
    this.contentLoader = contentLoader;
    this.state = this.createInitialState();
  }

  private createInitialState(): EngineState {
    return {
      status: "idle",
      playlist: null,
      layout: null,
      currentTime: 0,
      cycleCount: 0,
      regions: new Map(),
      error: null,
    };
  }

  /**
   * 初期化
   */
  async init(): Promise<void> {
    await this.timing.init();
    logger.info("PlaybackEngine", "Initialized");
  }

  /**
   * プレイリストを読み込んで再生準備
   */
  async load(playlist: PlaylistItem, layout: LayoutItem): Promise<void> {
    this.setStatus("loading");
    logger.info("PlaybackEngine", `Loading playlist: ${playlist.name}`);

    try {
      this.state.playlist = playlist;
      this.state.layout = layout;
      this.state.regions = new Map();
      this.state.cycleCount = 0;

      // 各リージョンの状態を初期化
      for (const region of layout.regions) {
        const assignment = playlist.contentAssignments.find((a) => a.regionId === region.id);

        if (!assignment || assignment.contentIds.length === 0) {
          logger.debug("PlaybackEngine", `Region ${region.id} has no content assignment`);
          continue;
        }

        // コンテンツを読み込み
        const contents: ContentItem[] = [];
        for (const contentId of assignment.contentIds) {
          const content = await this.contentLoader(contentId);
          if (content) {
            contents.push(content);
          } else {
            logger.warn("PlaybackEngine", `Content not found: ${contentId}`);
          }
        }

        if (contents.length === 0) {
          logger.warn("PlaybackEngine", `Region ${region.id} has no valid contents`);
          continue;
        }

        const regionState: RegionPlaybackState = {
          regionId: region.id,
          region,
          assignment,
          contents,
          currentIndex: 0,
          currentContent: null,
          nextContent: null,
          isPreloaded: false,
        };

        this.state.regions.set(region.id, regionState);
        logger.debug("PlaybackEngine", `Region ${region.id} loaded with ${contents.length} contents`);
      }

      this.setStatus("idle");
      logger.info("PlaybackEngine", `Playlist loaded: ${this.state.regions.size} regions`);
    } catch (error) {
      this.setStatus("error");
      this.state.error = error instanceof Error ? error.message : "読み込みエラー";
      logger.error("PlaybackEngine", "Failed to load playlist", error);
      throw error;
    }
  }

  /**
   * 再生開始
   */
  play(): void {
    if (this.state.status === "playing") return;
    if (!this.state.playlist || !this.state.layout) {
      throw new Error("プレイリストが読み込まれていません");
    }

    // AudioContext の resume（ユーザー操作イベント内で呼ばれることを想定）
    this.timing.resume();

    // 初回再生の場合は各リージョンの最初のコンテンツをセット
    if (this.state.status === "idle" || this.state.status === "error") {
      this.initializeRegionContents();
    }

    this.timing.start();
    this.setStatus("playing");
    this.startLoop();
    logger.info("PlaybackEngine", "Playback started");
  }

  /**
   * 一時停止
   */
  pause(): void {
    if (this.state.status !== "playing") return;
    this.timing.pause();
    this.setStatus("paused");
    this.stopLoop();
    logger.info("PlaybackEngine", "Playback paused");
  }

  /**
   * 停止
   */
  stop(): void {
    this.stopLoop();
    this.timing.reset();
    this.state.currentTime = 0;
    this.state.cycleCount = 0;

    // 各リージョンをリセット
    for (const regionState of this.state.regions.values()) {
      regionState.currentIndex = 0;
      regionState.currentContent = null;
      regionState.nextContent = null;
      regionState.isPreloaded = false;
    }

    this.setStatus("idle");
    logger.info("PlaybackEngine", "Playback stopped");
  }

  /**
   * 各リージョンの初期コンテンツを設定
   */
  private initializeRegionContents(): void {
    const currentTime = 0;

    for (const regionState of this.state.regions.values()) {
      if (regionState.contents.length === 0) continue;

      const content = regionState.contents[0];
      const duration = this.getContentDuration(content, regionState);

      regionState.currentContent = {
        content,
        startTime: currentTime,
        duration,
        endTime: currentTime + duration,
      };
      regionState.currentIndex = 0;

      this.emit({
        type: "contentChange",
        regionId: regionState.regionId,
        content,
        index: 0,
      });
    }
  }

  /**
   * メインループ開始
   */
  private startLoop(): void {
    const loop = () => {
      if (this.state.status !== "playing") return;

      const currentTime = this.timing.getCurrentTime();
      this.state.currentTime = currentTime;

      // 各リージョンの更新
      this.updateRegions(currentTime);

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  /**
   * メインループ停止
   */
  private stopLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * リージョンの状態を更新
   */
  private updateRegions(currentTime: number): void {
    let allRegionsComplete = true;

    for (const regionState of this.state.regions.values()) {
      if (!regionState.currentContent) continue;

      // コンテンツ終了チェック
      if (currentTime >= regionState.currentContent.endTime) {
        this.advanceToNextContent(regionState, currentTime);
      }

      // まだ完了していないリージョンがあるかチェック
      const isLastContent = regionState.currentIndex >= regionState.contents.length - 1;
      const isContentPlaying = regionState.currentContent && currentTime < regionState.currentContent.endTime;

      if (!isLastContent || isContentPlaying) {
        allRegionsComplete = false;
      }
    }

    // 全リージョン完了時
    if (allRegionsComplete) {
      if (this.config.loop) {
        this.startNewCycle();
      } else {
        this.stop();
      }
    }
  }

  /**
   * 次のコンテンツに進む
   */
  private advanceToNextContent(regionState: RegionPlaybackState, currentTime: number): void {
    const nextIndex = regionState.currentIndex + 1;

    if (nextIndex >= regionState.contents.length) {
      // このリージョンのコンテンツが全て終了
      // ループの場合は startNewCycle で処理される
      regionState.currentContent = null;
      return;
    }

    const content = regionState.contents[nextIndex];
    const duration = this.getContentDuration(content, regionState);

    regionState.currentIndex = nextIndex;
    regionState.currentContent = {
      content,
      startTime: currentTime,
      duration,
      endTime: currentTime + duration,
    };

    this.emit({
      type: "contentChange",
      regionId: regionState.regionId,
      content,
      index: nextIndex,
    });

    logger.debug(
      "PlaybackEngine",
      `Region ${regionState.regionId} advanced to content ${nextIndex + 1}/${regionState.contents.length}`,
    );
  }

  /**
   * 新しいサイクルを開始（ループ再生）
   */
  private startNewCycle(): void {
    this.state.cycleCount++;
    const currentTime = this.timing.getCurrentTime();

    for (const regionState of this.state.regions.values()) {
      if (regionState.contents.length === 0) continue;

      const content = regionState.contents[0];
      const duration = this.getContentDuration(content, regionState);

      regionState.currentIndex = 0;
      regionState.currentContent = {
        content,
        startTime: currentTime,
        duration,
        endTime: currentTime + duration,
      };

      this.emit({
        type: "contentChange",
        regionId: regionState.regionId,
        content,
        index: 0,
      });
    }

    this.emit({ type: "cycleComplete", cycleCount: this.state.cycleCount });
    logger.info("PlaybackEngine", `Cycle ${this.state.cycleCount} started`);
  }

  /**
   * コンテンツの再生時間を取得
   */
  private getContentDuration(content: ContentItem, regionState: RegionPlaybackState): number {
    // 設定された再生時間を探す
    const durationInfo = regionState.assignment.contentDurations.find((d) => d.contentId === content.id);

    if (durationInfo) {
      return durationInfo.duration;
    }

    // 動画の場合は実際の尺を使用
    if (content.type === "video" && content.fileInfo?.metadata?.duration) {
      return content.fileInfo.metadata.duration;
    }

    // YouTube の場合は長めにデフォルト設定（実際の尺が不明なため）
    if (content.type === "youtube") {
      return 60;
    }

    return this.config.defaultDuration;
  }

  /**
   * 現在の状態を取得
   */
  getState(): Readonly<EngineState> {
    return this.state;
  }

  /**
   * リージョンの再生状態を取得
   */
  getRegionState(regionId: string): RegionPlaybackState | undefined {
    return this.state.regions.get(regionId);
  }

  /**
   * 設定を取得
   */
  getConfig(): Readonly<EngineConfig> {
    return this.config;
  }

  /**
   * イベントリスナー登録
   * @returns アンサブスクライブ関数
   */
  on(listener: EngineEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: EngineEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        logger.error("PlaybackEngine", "Event listener error", error);
      }
    }
  }

  private setStatus(status: PlaybackStatus): void {
    if (this.state.status === status) return;
    this.state.status = status;
    this.emit({ type: "statusChange", status });
  }

  /**
   * クリーンアップ
   */
  dispose(): void {
    this.stopLoop();
    this.timing.dispose();
    this.listeners.clear();
    this.state = this.createInitialState();
    logger.info("PlaybackEngine", "Disposed");
  }
}
