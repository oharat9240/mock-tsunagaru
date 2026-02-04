/**
 * TimingController
 *
 * AudioContext を基準時計として使用し、高精度なタイミング制御を提供する。
 * AudioContext.currentTime はサンプル精度（~0.02ms）で動作し、
 * JavaScript の setTimeout/setInterval よりも信頼性が高い。
 */
export class TimingController {
  private audioContext: AudioContext | null = null;
  private startTime = 0;
  private pausedAt = 0;
  private isPaused = false;
  private totalPausedDuration = 0;

  /**
   * 初期化
   * AudioContext を作成し、再生可能な状態にする
   */
  async init(): Promise<void> {
    this.audioContext = new AudioContext();

    // AudioContext はユーザー操作後に resume が必要な場合がある
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  /**
   * 再生開始
   */
  start(): void {
    if (!this.audioContext) {
      throw new Error("TimingController is not initialized");
    }

    if (this.isPaused) {
      // 一時停止からの復帰
      const pauseDuration = this.audioContext.currentTime - this.pausedAt;
      this.totalPausedDuration += pauseDuration;
      this.isPaused = false;
    } else {
      // 新規開始
      this.startTime = this.audioContext.currentTime;
      this.totalPausedDuration = 0;
    }
  }

  /**
   * 一時停止
   */
  pause(): void {
    if (!this.audioContext || this.isPaused) return;
    this.pausedAt = this.audioContext.currentTime;
    this.isPaused = true;
  }

  /**
   * リセット（停止）
   */
  reset(): void {
    if (!this.audioContext) return;
    this.startTime = this.audioContext.currentTime;
    this.pausedAt = 0;
    this.isPaused = false;
    this.totalPausedDuration = 0;
  }

  /**
   * 現在のエンジン時間を取得（秒）
   * 一時停止中の時間は含まれない
   */
  getCurrentTime(): number {
    if (!this.audioContext) return 0;

    if (this.isPaused) {
      return this.pausedAt - this.startTime - this.totalPausedDuration;
    }

    return this.audioContext.currentTime - this.startTime - this.totalPausedDuration;
  }

  /**
   * 一時停止中かどうか
   */
  getIsPaused(): boolean {
    return this.isPaused;
  }

  /**
   * AudioContext の状態を取得
   */
  getAudioContextState(): AudioContextState | null {
    return this.audioContext?.state ?? null;
  }

  /**
   * AudioContext が suspended の場合に resume する
   * ユーザー操作イベント内で呼び出す必要がある
   */
  async resume(): Promise<void> {
    if (this.audioContext?.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  /**
   * クリーンアップ
   */
  dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.startTime = 0;
    this.pausedAt = 0;
    this.isPaused = false;
    this.totalPausedDuration = 0;
  }
}
