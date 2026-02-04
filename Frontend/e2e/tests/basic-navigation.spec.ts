import { expect, test } from "@playwright/test";
import { BasePage } from "../fixtures/base-page";
import { setupAuth } from "../utils/test-helpers";

test.describe("基本的なナビゲーション", () => {
  let basePage: BasePage;

  test.beforeEach(async ({ page }) => {
    // 認証状態を設定
    await setupAuth(page);

    basePage = new BasePage(page);
    await page.goto("/");
    // ページが完全に読み込まれるまで待機
    await page.waitForLoadState("networkidle");
  });

  test("ホームページが正しく表示される", async ({ page }) => {
    // タイトルが設定されていない場合は、アプリケーション名が表示されていることを確認
    await expect(page.getByRole("heading", { name: "もっく！つながる" })).toBeVisible();
    await expect(basePage.homeLink).toBeVisible();
    await expect(basePage.settingsLink).toBeVisible();
    await expect(basePage.themeToggleButton).toBeVisible();
  });

  test("タブナビゲーションが正しく動作する", async ({ page }) => {
    // プレイリストタブはデフォルトで選択されている（/がリダイレクトされるため）
    await expect(page).toHaveURL(/\/playlist/);
    await expect(basePage.playlistTab).toHaveAttribute("aria-selected", "true");

    // スケジュールタブ
    await basePage.scheduleTab.click();
    await expect(page).toHaveURL(/\/schedule/);
    await expect(basePage.scheduleTab).toHaveAttribute("aria-selected", "true");

    // レイアウトタブ
    await basePage.layoutTab.click();
    await expect(page).toHaveURL(/\/layout/);
    await expect(basePage.layoutTab).toHaveAttribute("aria-selected", "true");

    // コンテンツ管理タブ
    await basePage.contentTab.click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/contents/);
    await expect(basePage.contentTab).toHaveAttribute("aria-selected", "true");

    // プレイリストタブに戻る
    await basePage.playlistTab.click();
    await expect(page).toHaveURL(/\/playlist/);
    await expect(basePage.playlistTab).toHaveAttribute("aria-selected", "true");
  });

  test("設定ページへのナビゲーション", async ({ page }) => {
    await basePage.settingsLink.click();
    await expect(page).toHaveURL(/\/settings/);
    // 設定ページのヘッダーを確認
    await expect(page.getByText("設定").first()).toBeVisible();
  });

  test("テーマ切り替えが動作する", async ({ page }) => {
    // 初期状態を確認
    const htmlElement = page.locator("html");
    const initialTheme = await htmlElement.getAttribute("data-mantine-color-scheme");

    // テーマを切り替え
    await basePage.themeToggleButton.click();

    // テーマが変更されたことを確認
    const newTheme = await htmlElement.getAttribute("data-mantine-color-scheme");
    expect(newTheme).not.toBe(initialTheme);

    // 再度切り替えて元に戻ることを確認
    await basePage.themeToggleButton.click();
    const finalTheme = await htmlElement.getAttribute("data-mantine-color-scheme");
    expect(finalTheme).toBe(initialTheme);
  });
});
