/**
 * OPFS Lock mechanism for handling concurrent operations
 * タイムスタンプベースの競合検出とロック機構
 */

export class OPFSLock {
  private static instance: OPFSLock;
  private locks = new Map<string, Promise<void>>();
  private timestamps = new Map<string, number>();

  static getInstance(): OPFSLock {
    if (!OPFSLock.instance) {
      OPFSLock.instance = new OPFSLock();
    }
    return OPFSLock.instance;
  }

  /**
   * 指定されたキーでロックを取得し、操作を実行
   */
  async withLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    // 既存のロックがある場合は待機
    const existingLock = this.locks.get(key);
    if (existingLock) {
      await existingLock;
    }

    // 新しいロックを作成
    let resolve!: () => void;
    const lockPromise = new Promise<void>((res) => {
      resolve = res;
    });

    this.locks.set(key, lockPromise);

    try {
      const result = await operation();
      return result;
    } finally {
      // ロックを解除
      this.locks.delete(key);
      resolve?.();
    }
  }

  /**
   * ファイルの読み込み時刻を記録
   */
  recordReadTimestamp(filePath: string): void {
    this.timestamps.set(filePath, Date.now());
  }

  /**
   * ファイルが最後の読み込み以降に変更されていないかチェック
   */
  async checkForConflicts(filePath: string, lastModified?: number): Promise<boolean> {
    const recordedTime = this.timestamps.get(filePath);
    if (!recordedTime || !lastModified) {
      return false; // 競合なし（初回読み込みまたは比較データなし）
    }

    // 最後の読み込み時刻よりも新しい変更があるかチェック
    return lastModified > recordedTime;
  }

  /**
   * タイムスタンプをクリア
   */
  clearTimestamp(filePath: string): void {
    this.timestamps.delete(filePath);
  }

  /**
   * 全てのタイムスタンプをクリア
   */
  clearAllTimestamps(): void {
    this.timestamps.clear();
  }
}
