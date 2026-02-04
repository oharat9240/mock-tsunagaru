import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Page } from "@playwright/test";

// テストデータのパス
export const TEST_DATA_PATH = path.join(process.cwd(), "e2e", "test-data");

// 認証状態を設定するヘルパー関数
export async function setupAuth(page: Page) {
  // localStorageにユーザー情報を設定
  await page.addInitScript(() => {
    const testUser = {
      id: "test-user-id",
      email: "test@example.com",
      name: "テストユーザー",
      role: "admin",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem("tsunagaru-user", JSON.stringify(testUser));
  });
}

// テスト用のファイルを作成
export async function createTestImage(filename = "test-image.png"): Promise<string> {
  const dir = path.join(TEST_DATA_PATH, "images");
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, filename);

  // 1x1の赤いピクセルのPNG画像
  const buffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49,
    0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb4,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);

  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function createTestVideo(filename = "test-video.mp4"): Promise<string> {
  const dir = path.join(TEST_DATA_PATH, "videos");
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, filename);

  // 最小限のMP4ファイルヘッダー
  const buffer = Buffer.from([
    0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00, 0x69, 0x73, 0x6f,
    0x6d, 0x69, 0x73, 0x6f, 0x32, 0x61, 0x76, 0x63, 0x31, 0x6d, 0x70, 0x34, 0x31,
  ]);

  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function createTestCSV(filename = "test-data.csv"): Promise<string> {
  const dir = path.join(TEST_DATA_PATH, "csv");
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, filename);
  const content = `名前,年齢,部署
田中太郎,35,営業部
佐藤花子,28,開発部
鈴木次郎,42,管理部`;

  await fs.writeFile(filePath, content, "utf-8");
  return filePath;
}

// テストデータのクリーンアップ
export async function cleanupTestData() {
  try {
    await fs.rm(TEST_DATA_PATH, { recursive: true, force: true });
  } catch (_error) {
    // ディレクトリが存在しない場合は無視
  }
}

// OPFSのクリア（ブラウザコンテキスト内で実行）
export async function clearOPFS(page: Page) {
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    // @ts-expect-error - values() is not in the TypeScript definitions but exists in the browser
    for await (const entry of root.values()) {
      if (entry.kind === "directory") {
        await root.removeEntry(entry.name, { recursive: true });
      } else {
        await root.removeEntry(entry.name);
      }
    }
  });
}

// 待機ヘルパー
export async function waitForContentToLoad(page: Page) {
  await page.waitForSelector('text="全"', { timeout: 10000 });
}

// スクリーンショット撮影ヘルパー
export async function takeScreenshot(page: Page, name: string) {
  const screenshotDir = path.join(process.cwd(), "e2e", "screenshots");
  await fs.mkdir(screenshotDir, { recursive: true });

  await page.screenshot({
    path: path.join(screenshotDir, `${name}.png`),
    fullPage: true,
  });
}

// デバッグヘルパー
export async function debugPause(page: Page, message?: string) {
  if (process.env.DEBUG) {
    console.log(`🔍 Debug pause: ${message || "Paused for debugging"}`);
    await page.pause();
  }
}

/**
 * テスト用の初期状態を作成する
 * 1. OPFSをクリア
 * 2. 設定ページでテストデータを作成
 * 3. 成功通知を待つ
 */
export async function setupTestData(page: Page) {
  // 設定ページに移動（ここでアプリケーションが初期化される）
  await page.goto("/settings");
  await page.waitForLoadState("networkidle");

  // OPFSをクリア（アプリケーション初期化後に実行）
  await clearOPFS(page);

  // OPFSクリア後、ページをリロードして状態を更新
  await page.reload();
  await page.waitForLoadState("networkidle");

  // テストデータ作成ボタンが有効になるまで待つ（ストレージ情報の読み込みを待つ）
  await page.waitForSelector('button:has-text("テストデータを作成"):not([disabled])', {
    timeout: 30000,
    state: "visible",
  });

  // テストデータ作成ボタンをクリック
  await page.getByRole("button", { name: "テストデータを作成" }).click();

  // 確認ダイアログで作成開始
  await page.getByRole("button", { name: "作成開始" }).click();

  // 成功通知を待つ（最大30秒）- 完全成功または部分成功を許可
  await page
    .locator('[class*="mantine-Notification-title"]')
    .filter({ hasText: /テストデータ作成完了|一部のテストデータ作成に失敗/ })
    .first()
    .waitFor({ timeout: 30000 });

  // 通知が消えるまで少し待つ
  await page.waitForTimeout(1000);
}
