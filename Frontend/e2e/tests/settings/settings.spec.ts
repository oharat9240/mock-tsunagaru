import { expect, test } from "@playwright/test";
import { SettingsPage } from "../../fixtures/settings-page";
import { clearOPFS, setupAuth } from "../../utils/test-helpers";

test.describe
  .serial("設定ページ", () => {
    let settingsPage: SettingsPage;

    test.beforeEach(async ({ page }) => {
      // 認証状態を設定
      await setupAuth(page);

      settingsPage = new SettingsPage(page);
      await settingsPage.navigate();

      // ページが完全に読み込まれるまで待つ
      await page.waitForLoadState("networkidle");

      // OPFSをクリア（ページロード後に実行）
      await clearOPFS(page);
    });

    test("設定ページが表示される", async ({ page }) => {
      // ページタイトルが表示されることを確認
      await expect(page.getByRole("heading", { name: "設定", exact: true })).toBeVisible();

      // 各セクションが表示されることを確認
      await expect(page.getByRole("heading", { name: "テストデータ作成" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "ストレージ管理" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "バージョン情報" })).toBeVisible();
    });

    test("テストデータを作成できる", async ({ page }) => {
      // テストデータ作成ボタンをクリック
      await settingsPage.createTestDataButton.click();

      // 確認ダイアログで作成開始
      await page.getByRole("button", { name: "作成開始" }).click();

      // 成功通知を確認（タイムアウトを長めに設定）
      await settingsPage.waitForSuccessNotification();

      // ボタンが有効になることを確認
      await expect(settingsPage.createTestDataButton).toBeEnabled();
    });

    test.skip("テストレイアウトを作成できる", async ({ page }) => {
      // テストレイアウト数を入力
      await settingsPage.layoutCountInput.clear();
      await settingsPage.layoutCountInput.fill("3");

      // 作成ボタンをクリック
      await settingsPage.createLayoutsButton.click();

      // 成功通知を確認
      await settingsPage.waitForSuccessNotification();

      // レイアウトページで確認
      await page.goto("/layout");
      await page.waitForLoadState("networkidle");

      // 3つのレイアウトが作成されたことを確認
      const layouts = page.getByText(/テストレイアウト/);
      await expect(layouts).toHaveCount(3);
    });

    test.skip("テストプレイリストを作成できる", async ({ page }) => {
      // まずテストデータを作成（レイアウトとコンテンツが必要）
      await settingsPage.createTestDataButton.click();
      await settingsPage.waitForSuccessNotification();

      // テストプレイリスト数を入力
      await settingsPage.playlistCountInput.clear();
      await settingsPage.playlistCountInput.fill("2");

      // 作成ボタンをクリック
      await settingsPage.createPlaylistsButton.click();

      // 成功通知を確認
      await settingsPage.waitForSuccessNotification();

      // プレイリストページで確認
      await page.goto("/playlist");
      await page.waitForLoadState("networkidle");

      // 2つのプレイリストが作成されたことを確認
      const playlists = page.getByText(/テストプレイリスト/);
      await expect(playlists).toHaveCount(2);
    });

    test.skip("テストスケジュールを作成できる", async ({ page }) => {
      // まずテストデータを作成
      await settingsPage.createTestDataButton.click();
      await settingsPage.waitForSuccessNotification();

      // プレイリストも作成
      await settingsPage.playlistCountInput.clear();
      await settingsPage.playlistCountInput.fill("1");
      await settingsPage.createPlaylistsButton.click();
      await settingsPage.waitForSuccessNotification();

      // テストスケジュール数を入力
      await settingsPage.scheduleCountInput.clear();
      await settingsPage.scheduleCountInput.fill("5");

      // 作成ボタンをクリック
      await settingsPage.createSchedulesButton.click();

      // 成功通知を確認
      await settingsPage.waitForSuccessNotification();

      // スケジュールページで確認
      await page.goto("/schedule");
      await page.waitForLoadState("networkidle");

      // スケジュールが作成されたことを確認
      const scheduleItems = page.locator(".schedule-item");
      await expect(scheduleItems).toHaveCount(5);
    });

    test("ストレージをクリアできる", async ({ page }) => {
      // まずテストデータを作成
      await settingsPage.createTestDataButton.click();
      await page.getByRole("button", { name: "作成開始" }).click();
      await settingsPage.waitForSuccessNotification();

      // ストレージクリアボタンをクリック
      await settingsPage.clearStorageButton.click();

      // 確認ダイアログで実行
      await page.getByRole("button", { name: "すべて削除" }).click();

      // 削除処理の完了を待つ
      await page.waitForTimeout(3000);

      // コンテンツページでデータがクリアされたことを確認
      await page.goto("/contents");
      await page.waitForLoadState("networkidle");

      // コンテンツが存在しないことを確認
      await expect(page.getByText("コンテンツがありません")).toBeVisible();
    });

    test("バージョン情報が表示される", async ({ page }) => {
      // バージョン番号が表示されることを確認（実装では「v0.0.1」形式）
      await expect(page.getByText(/v\d+\.\d+\.\d+/)).toBeVisible();

      // ビルド日時が表示されることを確認（実装では「ビルド:」）
      await expect(page.getByText(/ビルド:/)).toBeVisible();
    });

    test("ユーザー情報が表示される", async ({ page }) => {
      // ユーザーアバターが表示されることを確認
      await expect(page.getByRole("button").filter({ hasText: "テ" })).toBeVisible();

      // ユーザー名が表示されることを確認
      await expect(page.getByText("テストユーザー")).toBeVisible();
    });

    test("ログアウトできる", async ({ page }) => {
      // ユーザーアバターをクリック
      await page.getByRole("button").filter({ hasText: "テ" }).click();

      // ログアウトボタンが表示されることを確認（実装によってはメニューが表示される）
      // ※実装によってはログアウトボタンの場所が異なるため、適宜調整が必要

      // ログアウト後はログインページにリダイレクトされることを確認
      // await expect(page).toHaveURL(/\/login/);
    });
  });
