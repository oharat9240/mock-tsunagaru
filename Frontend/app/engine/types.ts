import type { ContentItem } from "~/types/content";
import type { LayoutItem, Region } from "~/types/layout";
import type { ContentAssignment, PlaylistItem } from "~/types/playlist";

// 再生状態
export type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "error";

// エンジン設定
export interface EngineConfig {
  /** ループ再生 */
  loop: boolean;
  /** デフォルト再生時間（秒）- 静止画・HLS用 */
  defaultDuration: number;
  /** プリロード開始までの時間（秒） */
  preloadLeadTime: number;
}

// 再生中のコンテンツ情報
export interface PlayingContent {
  content: ContentItem;
  startTime: number; // 開始時刻（エンジン時間）
  duration: number; // 再生時間（秒）
  endTime: number; // 終了時刻（エンジン時間）
}

// リージョンの再生状態
export interface RegionPlaybackState {
  regionId: string;
  region: Region;
  assignment: ContentAssignment;
  contents: ContentItem[];
  currentIndex: number;
  currentContent: PlayingContent | null;
  nextContent: PlayingContent | null;
  isPreloaded: boolean;
}

// エンジン全体の状態
export interface EngineState {
  status: PlaybackStatus;
  playlist: PlaylistItem | null;
  layout: LayoutItem | null;
  currentTime: number; // エンジン経過時間（秒）
  cycleCount: number; // ループ回数
  regions: Map<string, RegionPlaybackState>;
  error: string | null;
}

// イベント
export type EngineEvent =
  | { type: "statusChange"; status: PlaybackStatus }
  | { type: "contentChange"; regionId: string; content: ContentItem; index: number }
  | { type: "cycleComplete"; cycleCount: number }
  | { type: "error"; error: string }
  | { type: "preload"; regionId: string; content: ContentItem; startsIn: number }
  | { type: "timeUpdate"; currentTime: number };

export type EngineEventListener = (event: EngineEvent) => void;

// コンテンツローダー関数の型
export type ContentLoader = (id: string) => Promise<ContentItem | null>;

// デフォルト設定
export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  loop: true,
  defaultDuration: 10,
  preloadLeadTime: 3,
};
