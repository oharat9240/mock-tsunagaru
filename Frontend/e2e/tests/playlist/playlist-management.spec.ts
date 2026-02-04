import { expect, test } from "@playwright/test";
import { PlaylistPage } from "../../fixtures/playlist-page";
import { setupAuth, setupTestData } from "../../utils/test-helpers";

test.describe
  .serial("プレイリスト管理", () => {
    let playlistPage: PlaylistPage;

    test.beforeEach(async ({ page }) => {
      test.setTimeout(60000); // 初期化に時間がかかるため60秒に設定

      // 認証状態を設定
      await setupAuth(page);

      // テストデータをセットアップ（OPFSクリア＋テストデータ作成）
      await setupTestData(page);

      playlistPage = new PlaylistPage(page);
      await playlistPage.navigate();
    });

    test("プレイリスト一覧が表示される", async ({ page }) => {
      // ページが正しく表示されることを確認
      await expect(page.getByRole("tab", { name: "プレイリスト" })).toHaveAttribute("aria-selected", "true");

      // 作成ボタンが表示されることを確認
      await expect(playlistPage.createButton).toBeVisible();

      // テーブルヘッダーが表示されることを確認
      await expect(page.getByRole("cell", { name: "名前" })).toBeVisible();
      await expect(page.getByRole("cell", { name: "コンテンツ数" })).toBeVisible();
      await expect(page.getByRole("cell", { name: "デバイス" })).toBeVisible();
      await expect(page.getByRole("cell", { name: "作成日時" })).toBeVisible();
    });

    test("プレイリストを作成できる", async ({ page }) => {
      // 作成ボタンをクリック
      await playlistPage.createButton.click();

      // 基本情報を入力
      await playlistPage.fillPlaylistName("テストプレイリスト");
      // デバイスはデフォルトで設定されているのでスキップ
      await playlistPage.clickNext();

      // レイアウトを選択（最初のレイアウトを選択）
      const layoutCards = page.locator('[class*="Paper"]').filter({ has: page.getByRole("button", { name: "選択" }) });
      if ((await layoutCards.count()) > 0) {
        await layoutCards.first().getByRole("button", { name: "選択" }).click();
      } else {
        // レイアウトがない場合はキャンセル
        await page.getByRole("button", { name: "キャンセル" }).click();
        return;
      }
      await playlistPage.clickNext();

      // コンテンツを割り当て（最初のリージョンにコンテンツを追加）
      const addContentButtons = page.getByRole("button", { name: "コンテンツを追加" });
      if ((await addContentButtons.count()) > 0) {
        await addContentButtons.first().click();

        // コンテンツ選択モーダルが表示されたら
        const checkboxes = page.getByRole("checkbox");
        if ((await checkboxes.count()) > 0) {
          await checkboxes.first().click();
          await page.getByRole("button", { name: "選択したコンテンツを追加" }).click();
        }
      }

      // 作成を実行
      await playlistPage.clickCreate();

      // 成功通知を確認
      await playlistPage.waitForSuccessNotification();

      // モーダルが閉じるのを待つ
      await playlistPage.waitForModalToClose();

      // プレイリストが一覧に表示されることを確認
      await expect(page.getByText("テストプレイリスト")).toBeVisible();
      await expect(page.getByText("テストデバイス")).toBeVisible();
    });

    test("プレイリストを編集できる", async ({ page }) => {
      // 事前にテストデータが作成されているため、プレイリストが存在することを確認
      const playlistRows = page.getByRole("row").filter({ has: page.getByRole("button", { name: "編集" }) });
      await expect(playlistRows.first()).toBeVisible();

      // 最初のプレイリストの編集ボタンをクリック
      await playlistRows.first().getByRole("button", { name: "編集" }).click();

      // プレイリスト名を変更
      await page.getByLabel("プレイリスト名").clear();
      await page.getByLabel("プレイリスト名").fill("編集後のプレイリスト");

      // 次へボタンをクリック（コンテンツ編集ステップへ）
      await page.getByRole("button", { name: "次へ" }).click();

      // 保存（最後のステップで）
      await page.getByRole("button", { name: "更新" }).click();

      // モーダルが閉じるのを待つ（成功の証）
      await playlistPage.waitForModalToClose();

      // 少し待ってから確認
      await page.waitForTimeout(1000);

      // 変更が反映されていることを確認
      await expect(page.getByText("編集後のプレイリスト")).toBeVisible();
    });

    test("プレイリストをプレビューできる", async ({ page }) => {
      // 事前にテストデータが作成されているため、プレイリストが存在する
      const playlistRows = page.getByRole("row").filter({ has: page.getByRole("button", { name: "プレビュー" }) });
      await expect(playlistRows.first()).toBeVisible();

      // プレビューボタンをクリック
      await playlistRows.first().getByRole("button", { name: "プレビュー" }).click();

      // プレビューモーダルが表示されることを確認
      await expect(page.getByRole("dialog")).toBeVisible();

      // プレビュー内容が表示されることを確認（レイアウトプレビューが表示される）
      await expect(page.locator(".mantine-Modal-body")).toBeVisible();

      // モーダルを閉じる（Xボタンをクリック）
      await page.getByRole("button", { name: "Close" }).click();
      await playlistPage.waitForModalToClose();
    });

    test("プレイリストを削除できる", async ({ page }) => {
      // 事前にテストデータが作成されているため、プレイリストが存在する
      const playlistRows = page.getByRole("row").filter({ has: page.getByRole("button", { name: "削除" }) });
      const initialCount = await playlistRows.count();
      expect(initialCount).toBeGreaterThan(0);

      // 削除ボタンをクリック
      await page.getByRole("button", { name: "削除" }).first().click();

      // 確認ダイアログで削除を実行
      await page.getByRole("dialog").getByRole("button", { name: "削除" }).click();

      // プレイリストが削除されたことを確認
      const finalCount = await playlistRows.count();
      expect(finalCount).toBe(initialCount - 1);
    });

    test("プレイリストのコンテンツ割り当てを変更できる", async ({ page }) => {
      // 事前にテストデータが作成されているため、プレイリストが存在する
      const playlistRows = page.getByRole("row").filter({ has: page.getByRole("button", { name: "編集" }) });
      await expect(playlistRows.first()).toBeVisible();

      // 編集ボタンをクリック
      await playlistRows.first().getByRole("button", { name: "編集" }).click();

      // コンテンツ編集タブに移動
      await page.getByRole("tab", { name: "コンテンツ編集" }).click();

      // 最初のリージョンのコンテンツを確認
      const regionContent = page.locator(".mantine-Paper-root").first();
      const initialContentCount = await regionContent.locator('[role="button"]').count();

      // コンテンツを追加
      await regionContent.getByRole("button", { name: "コンテンツを追加" }).click();

      // 未選択のコンテンツを選択
      const checkboxes = page.getByRole("checkbox");
      if ((await checkboxes.count()) > 0) {
        await checkboxes.first().click();
        await page.getByRole("button", { name: "選択したコンテンツを追加" }).click();

        // コンテンツが追加されたことを確認
        const finalContentCount = await regionContent.locator('[role="button"]').count();
        expect(finalContentCount).toBeGreaterThan(initialContentCount);
      }

      // 保存
      await page.getByRole("button", { name: "更新" }).click();

      // 成功通知を確認
      await playlistPage.waitForSuccessNotification();
    });
  });
