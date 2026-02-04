import { expect, test } from "@playwright/test";
import { SchedulePage } from "../../fixtures/schedule-page";
import { setupAuth, setupTestData } from "../../utils/test-helpers";

test.describe
  .serial("スケジュール管理", () => {
    let schedulePage: SchedulePage;

    test.beforeEach(async ({ page }) => {
      test.setTimeout(60000); // 初期化に時間がかかるため60秒に設定
      // 認証状態を設定
      await setupAuth(page);

      // テストデータをセットアップ（OPFSクリア＋テストデータ作成）
      await setupTestData(page);

      schedulePage = new SchedulePage(page);
      await schedulePage.navigate();
    });

    test("スケジュール画面が表示される", async ({ page }) => {
      // ページが正しく表示されることを確認
      await expect(page.getByRole("tab", { name: "スケジュール" })).toHaveAttribute("aria-selected", "true");

      // 日付ナビゲーションが表示されることを確認
      await expect(schedulePage.todayButton).toBeVisible();
      // ナビゲーションボタンの存在を確認（SVGアイコンを含むボタンとして）
      const navButtons = page.getByRole("button").filter({ has: page.locator("svg") });
      await expect(navButtons.count()).resolves.toBeGreaterThan(2); // 少なくとも左右ナビゲーションボタンが存在

      // スケジュールビューが表示されることを確認（週間スケジュールのヘッダー）
      await expect(page.getByRole("heading", { name: "週間スケジュール" })).toBeVisible();
    });

    test("週の切り替えができる", async ({ page }) => {
      // スケジュールページにいることを確認
      await expect(page.getByRole("tab", { name: "スケジュール" })).toHaveAttribute("aria-selected", "true");

      // 週間スケジュールヘッダーが表示されるまで待つ
      await expect(page.getByRole("heading", { name: "週間スケジュール" })).toBeVisible();

      // 今週ボタンがあることを確認
      await expect(schedulePage.todayButton).toBeVisible();

      // ナビゲーションボタンが動作することを確認（前の週へ移動）
      await schedulePage.previousWeekButton.click();
      await page.waitForTimeout(500);

      // 次の週へ移動
      await schedulePage.nextWeekButton.click();
      await page.waitForTimeout(500);

      // 今週ボタンで現在の週に戻る
      await schedulePage.todayButton.click();
      await page.waitForTimeout(500);

      // 今日ハイライトが表示されることを確認（現在の週に戻ったことの証明）
      await expect(page.locator(".today-highlight")).toBeVisible();
    });

    test("今日ボタンで現在の週に戻れる", async ({ page }) => {
      // 次の週へ移動を複数回実行
      await schedulePage.nextWeekButton.click();
      await schedulePage.nextWeekButton.click();
      await schedulePage.nextWeekButton.click();

      // 今日ボタンをクリック
      await schedulePage.todayButton.click();

      // 現在の週に戻ったことを確認（今日の日付が強調表示される）
      await expect(page.locator(".today-highlight")).toBeVisible();
    });

    test("スケジュールを追加できる", async ({ page }) => {
      // タイムラインの空きスロットをクリック
      const emptySlot = page.locator(".schedule-slot").first();
      await emptySlot.click();

      // スケジュール編集モーダルが表示されることを確認
      await expect(page.getByRole("dialog")).toBeVisible();

      // プレイリストを選択
      await page.getByLabel("プレイリスト").click();
      await page.getByRole("option").first().click();

      // 時間を設定
      await page.getByLabel("開始時刻").clear();
      await page.getByLabel("開始時刻").fill("10:00");
      await page.getByLabel("終了時刻").clear();
      await page.getByLabel("終了時刻").fill("12:00");

      // 保存
      await page.getByRole("button", { name: "保存" }).click();

      // 成功通知を確認
      await schedulePage.waitForSuccessNotification();

      // スケジュールが表示されることを確認
      await expect(page.locator(".schedule-item")).toBeVisible();
    });

    test("スケジュールを編集できる", async ({ page }) => {
      // スケジュールを追加
      const emptySlot = page.locator(".schedule-slot").first();
      await emptySlot.click();
      await page.getByLabel("プレイリスト").click();
      await page.getByRole("option").first().click();
      await page.getByLabel("開始時刻").clear();
      await page.getByLabel("開始時刻").fill("14:00");
      await page.getByLabel("終了時刻").clear();
      await page.getByLabel("終了時刻").fill("16:00");
      await page.getByRole("button", { name: "保存" }).click();
      await schedulePage.waitForSuccessNotification();

      // スケジュールアイテムをクリックして編集
      await page.locator(".schedule-item").first().click();

      // 時間を変更
      await page.getByLabel("開始時刻").clear();
      await page.getByLabel("開始時刻").fill("15:00");
      await page.getByLabel("終了時刻").clear();
      await page.getByLabel("終了時刻").fill("17:00");

      // 保存
      await page.getByRole("button", { name: "更新" }).click();

      // 成功通知を確認
      await schedulePage.waitForSuccessNotification();

      // 変更が反映されていることを確認
      await expect(page.locator(".schedule-item").filter({ hasText: "15:00" })).toBeVisible();
    });

    test("スケジュールを削除できる", async ({ page }) => {
      // スケジュールを追加
      const emptySlot = page.locator(".schedule-slot").first();
      await emptySlot.click();
      await page.getByLabel("プレイリスト").click();
      await page.getByRole("option").first().click();
      await page.getByRole("button", { name: "保存" }).click();
      await schedulePage.waitForSuccessNotification();

      // スケジュールアイテムが存在することを確認
      await expect(page.locator(".schedule-item")).toBeVisible();

      // スケジュールアイテムをクリック
      await page.locator(".schedule-item").first().click();

      // 削除ボタンをクリック
      await page.getByRole("button", { name: "削除" }).click();

      // 確認ダイアログで削除を実行
      await page.getByRole("button", { name: "削除", exact: true }).click();

      // 成功通知を確認
      await schedulePage.waitForSuccessNotification();

      // スケジュールが削除されたことを確認
      await expect(page.locator(".schedule-item")).not.toBeVisible();
    });

    test("繰り返しスケジュールを作成できる", async ({ page }) => {
      // タイムラインの空きスロットをクリック
      const emptySlot = page.locator(".schedule-slot").first();
      await emptySlot.click();

      // プレイリストを選択
      await page.getByLabel("プレイリスト").click();
      await page.getByRole("option").first().click();

      // 繰り返し設定を有効化
      await page.getByLabel("繰り返し").click();

      // 繰り返しタイプを選択
      await page.getByLabel("繰り返しタイプ").click();
      await page.getByRole("option", { name: "毎日" }).click();

      // 終了日を設定
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);
      await page.getByLabel("終了日").fill(endDate.toISOString().split("T")[0]);

      // 保存
      await page.getByRole("button", { name: "保存" }).click();

      // 成功通知を確認
      await schedulePage.waitForSuccessNotification();

      // 複数のスケジュールが作成されたことを確認
      const scheduleItems = page.locator(".schedule-item");
      await expect(scheduleItems).toHaveCount(7); // 7日分
    });
  });
