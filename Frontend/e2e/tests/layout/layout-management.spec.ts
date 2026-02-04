import { expect, test } from "@playwright/test";
import { LayoutPage } from "../../fixtures/layout-page";
import { setupAuth, setupTestData } from "../../utils/test-helpers";

test.describe
  .serial("レイアウト管理", () => {
    let layoutPage: LayoutPage;

    test.beforeEach(async ({ page }) => {
      test.setTimeout(60000); // 初期化に時間がかかるため60秒に設定

      // 認証状態を設定
      await setupAuth(page);

      // テストデータをセットアップ（OPFSクリア＋テストデータ作成）
      await setupTestData(page);

      layoutPage = new LayoutPage(page);
      await layoutPage.navigate();
    });

    test("レイアウト一覧が表示される", async ({ page }) => {
      // ページが正しく表示されることを確認
      await expect(page.getByRole("tab", { name: "レイアウト" })).toHaveAttribute("aria-selected", "true");

      // 作成ボタンが表示されることを確認
      await expect(layoutPage.createButton).toBeVisible();

      // ビュー切り替えボタンが表示されることを確認
      await expect(layoutPage.gridViewButton).toBeVisible();
      await expect(layoutPage.tableViewButton).toBeVisible();
    });

    test("新しいレイアウトを作成できる", async ({ page }) => {
      // 作成ボタンをクリック
      await layoutPage.createButton.click();

      // モーダルが表示されることを確認
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByRole("heading", { name: "新しいレイアウトを作成" })).toBeVisible();

      // レイアウト名を入力
      await page.getByLabel("レイアウト名").fill("テストレイアウト");

      // 向きを選択（デフォルトは横向き）
      await expect(page.getByRole("textbox", { name: "画面向きの選択" })).toHaveValue("横向き (1920x1080)");

      // リージョンを追加
      await page.getByRole("button", { name: /リージョン矩形を追加/ }).click();

      // リージョンが追加されたことを確認（ボタンテキストで確認）
      await expect(page.getByRole("button", { name: /リージョン矩形を追加 \(1\/4\)/ })).toBeVisible();

      // 作成ボタンをクリック（モーダル内の作成ボタン）
      await page.getByRole("dialog").getByRole("button", { name: "作成", exact: true }).click();

      // モーダルが閉じることを確認
      await expect(page.getByRole("dialog")).not.toBeVisible();

      // 作成したレイアウトが一覧に表示されることを確認
      await expect(page.getByText("テストレイアウト")).toBeVisible();
    });

    test("レイアウトを編集できる", async ({ page }) => {
      // テストレイアウトを作成
      await layoutPage.createButton.click();

      // モーダルが表示されることを確認
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByRole("heading", { name: "新しいレイアウトを作成" })).toBeVisible();

      // レイアウト名を入力
      await page.getByLabel("レイアウト名").fill("編集テストレイアウト");

      // リージョンを追加
      await page.getByRole("button", { name: /リージョン矩形を追加/ }).click();

      // 作成ボタンをクリック（モーダル内の作成ボタン）
      await page.getByRole("dialog").getByRole("button", { name: "作成", exact: true }).click();

      // モーダルが閉じることを確認
      await expect(page.getByRole("dialog")).not.toBeVisible();

      // 作成したレイアウトが表示されることを確認
      await expect(page.getByText("編集テストレイアウト")).toBeVisible();

      // 編集ボタンをクリック（テーブルビューの編集アイコン）
      const layoutRow = page.locator("tr", { hasText: "編集テストレイアウト" });
      await layoutRow.getByRole("button", { name: "編集" }).click();

      // 編集モーダルが表示されることを確認
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByText("レイアウトを編集")).toBeVisible();

      // レイアウト名を変更
      await page.getByLabel("レイアウト名").clear();
      await page.getByLabel("レイアウト名").fill("編集後のレイアウト");

      // 保存ボタンをクリック
      await page.getByRole("button", { name: "保存" }).click();

      // モーダルが閉じることを確認
      await expect(page.getByRole("dialog")).not.toBeVisible();

      // 変更が反映されていることを確認
      await expect(page.getByText("編集後のレイアウト")).toBeVisible();
      await expect(page.getByText("編集テストレイアウト")).not.toBeVisible();
    });

    test("レイアウトをプレビューできる", async ({ page }) => {
      // テストレイアウトを作成
      await layoutPage.createButton.click();

      // モーダルが表示されることを確認
      await expect(page.getByRole("dialog")).toBeVisible();

      // レイアウト名を入力
      await page.getByLabel("レイアウト名").fill("プレビューテストレイアウト");

      // リージョンを追加
      await page.getByRole("button", { name: /リージョン矩形を追加/ }).click();

      // 作成ボタンをクリック（モーダル内の作成ボタン）
      await page.getByRole("dialog").getByRole("button", { name: "作成", exact: true }).click();

      // モーダルが閉じることを確認
      await expect(page.getByRole("dialog")).not.toBeVisible();

      // テーブルビューでプレビューアイコンをホバー
      const layoutRow = page.locator("tr", { hasText: "プレビューテストレイアウト" });
      const previewButton = layoutRow.getByRole("button", { name: "プレビュー" });
      await previewButton.hover();

      // プレビューボタンをクリック
      await previewButton.click();

      // プレビューモーダルが表示されることを確認
      await expect(page.getByRole("dialog", { name: "プレビュー" })).toBeVisible();

      // プレビュー内容が表示されることを確認（モーダル内のテキストを確認）
      await expect(page.getByRole("dialog").getByText("プレビューテストレイアウト")).toBeVisible();
      // リージョン詳細のテキストを確認
      await expect(page.getByRole("dialog").getByText("リージョン 1: 960×540")).toBeVisible();
    });

    test("レイアウトを削除できる", async ({ page }) => {
      // テストレイアウトを作成
      await layoutPage.createButton.click();

      // モーダルが表示されることを確認
      await expect(page.getByRole("dialog")).toBeVisible();

      // レイアウト名を入力
      await page.getByLabel("レイアウト名").fill("削除テストレイアウト");

      // リージョンを追加
      await page.getByRole("button", { name: /リージョン矩形を追加/ }).click();

      // 作成ボタンをクリック（モーダル内の作成ボタン）
      await page.getByRole("dialog").getByRole("button", { name: "作成", exact: true }).click();

      // モーダルが閉じることを確認
      await expect(page.getByRole("dialog")).not.toBeVisible();

      // レイアウトが存在することを確認
      await expect(page.getByText("削除テストレイアウト")).toBeVisible();

      // 削除ボタンをクリック（テーブルビューの削除アイコン）
      const layoutRow = page.locator("tr", { hasText: "削除テストレイアウト" });
      await layoutRow.getByRole("button", { name: "削除" }).click();

      // 確認ダイアログが表示されることを確認
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByText("このレイアウトを削除しますか？")).toBeVisible();

      // 削除を確認
      await page.getByRole("button", { name: "削除" }).click();

      // ダイアログが閉じることを確認
      await expect(page.getByRole("dialog")).not.toBeVisible();

      // レイアウトが削除されたことを確認
      await expect(page.getByText("削除テストレイアウト")).not.toBeVisible();
    });

    test("グリッドビューとテーブルビューを切り替えできる", async ({ page }) => {
      // デフォルトはテーブルビュー
      await expect(page.getByRole("table")).toBeVisible();
      // テーブルビューボタンがアクティブなことを確認
      // variant属性がないので、テーブルが表示されていることで確認
      await expect(page.getByRole("table")).toBeVisible();

      // グリッドビューに切り替え
      await layoutPage.gridViewButton.click();

      // グリッドが表示されることを確認
      await expect(page.getByRole("table")).not.toBeVisible();
      // グリッドビューが表示されることを確認
      // MantineのGridコンポーネントが表示されることを確認
      await expect(page.locator('[class*="Grid"]').first()).toBeVisible();

      // テーブルビューに戻す
      await layoutPage.tableViewButton.click();

      // テーブルが表示されることを確認
      await expect(page.getByRole("table")).toBeVisible();
      // テーブルビューボタンがアクティブなことを確認
      // variant属性がないので、テーブルが表示されていることで確認
      await expect(page.getByRole("table")).toBeVisible();
    });

    test("レイアウトエディタでリージョンを操作できる", async ({ page }) => {
      // 新しいレイアウトを作成
      await layoutPage.createButton.click();

      // モーダルが表示されることを確認
      await expect(page.getByRole("dialog")).toBeVisible();

      // レイアウト名を入力
      await page.getByLabel("レイアウト名").fill("リージョン操作テスト");

      // リージョンを3つ追加
      await page.getByRole("button", { name: /リージョン矩形を追加/ }).click();
      await page.getByRole("button", { name: /リージョン矩形を追加/ }).click();
      await page.getByRole("button", { name: /リージョン矩形を追加/ }).click();

      // リージョンが3つ存在することを確認（エディタ内で確認）
      const regions = page.locator("[data-moveable-target]");
      await expect(regions).toHaveCount(3);

      // 最初のリージョンを選択
      await regions.first().click();

      // リージョン名を変更（編集パネルで）
      const regionNameInput = page.getByLabel("リージョン名");
      await regionNameInput.clear();
      await regionNameInput.fill("メインコンテンツ");

      // Enterキーで確定
      await regionNameInput.press("Enter");

      // リージョン名が変更されたことを確認
      await expect(page.locator("[data-moveable-target]").first()).toContainText("メインコンテンツ");

      // 作成ボタンをクリック（モーダル内の作成ボタン）
      await page.getByRole("dialog").getByRole("button", { name: "作成", exact: true }).click();

      // モーダルが閉じることを確認
      await expect(page.getByRole("dialog")).not.toBeVisible();

      // レイアウトが作成されたことを確認
      await expect(page.getByText("リージョン操作テスト")).toBeVisible();
    });
  });
