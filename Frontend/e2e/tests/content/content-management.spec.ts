import { expect, test } from "@playwright/test";
import { ContentPage } from "../../fixtures/content-page";
import { setupAuth, setupTestData } from "../../utils/test-helpers";

test.describe
  .serial("コンテンツ管理", () => {
    let contentPage: ContentPage;

    test.beforeEach(async ({ page }) => {
      test.setTimeout(60000); // 初期化に時間がかかるため60秒に設定
      // 認証状態を設定
      await setupAuth(page);

      // テストデータをセットアップ（OPFSクリア＋テストデータ作成）
      await setupTestData(page);

      contentPage = new ContentPage(page);
      await contentPage.navigate();
    });

    test("コンテンツ管理ページが表示される", async ({ page }) => {
      // ページが正しく表示されることを確認
      await expect(page.getByRole("tab", { name: "コンテンツ管理" })).toHaveAttribute("aria-selected", "true");

      // フィルターボタンが表示されることを確認（ラベルをクリック可能か確認）
      await expect(contentPage.allFilter).toBeVisible();
      await expect(contentPage.videoFilter).toBeVisible();
      await expect(contentPage.imageFilter).toBeVisible();
      await expect(contentPage.textFilter).toBeVisible();

      // 追加ボタンが表示されることを確認
      await expect(contentPage.addContentButton).toBeVisible();

      // 検索ボックスが表示されることを確認
      await expect(contentPage.searchInput).toBeVisible();

      // ビュー切り替えボタンが表示されることを確認
      await expect(contentPage.tableViewButton).toBeVisible();
      await expect(contentPage.gridViewButton).toBeVisible();
    });

    test("ビューを切り替えできる", async ({ page }) => {
      // テーブルビューがデフォルトで表示されている
      await expect(page.getByRole("table")).toBeVisible();

      // グリッドビューに切り替え
      await contentPage.gridViewButton.click();

      // テーブルが非表示になることを確認
      await expect(page.getByRole("table")).not.toBeVisible();

      // テーブルビューに戻す
      await contentPage.tableViewButton.click();

      // テーブルが再び表示されることを確認
      await expect(page.getByRole("table")).toBeVisible();
    });

    test("コンテンツ追加モーダルが開く", async ({ page }) => {
      // コンテンツ追加ボタンをクリック
      await contentPage.addContentButton.click();

      // モーダルが表示されることを確認
      await expect(page.getByRole("dialog")).toBeVisible();

      // ファイルアップロードモードがデフォルトで選択されていることを確認
      await expect(page.getByRole("radiogroup").locator('input[value="file"]')).toBeChecked();

      // ドロップゾーンが表示されることを確認
      await expect(page.getByText("ファイルをドラッグ&ドロップするか、クリックして選択")).toBeVisible();

      // モーダルを閉じる（キャンセルボタンをクリック）
      await page.getByRole("button", { name: "キャンセル" }).click();
      await contentPage.waitForModalToClose();
    });

    test("フィルターボタンが動作する", async ({ page }) => {
      // すべてフィルターがデフォルトで選択されている
      await expect(page.getByRole("radiogroup").getByLabel("すべて")).toBeChecked();

      // 画像フィルターをクリック
      await contentPage.imageFilter.click();
      await expect(page.getByRole("radiogroup").getByLabel("画像")).toBeChecked();

      // 動画フィルターをクリック
      await contentPage.videoFilter.click();
      await expect(page.getByRole("radiogroup").getByLabel("動画")).toBeChecked();

      // テキストフィルターをクリック
      await contentPage.textFilter.click();
      await expect(page.getByRole("radiogroup").getByLabel("テキスト")).toBeChecked();

      // YouTubeフィルターをクリック
      await contentPage.youtubeFilter.click();
      await expect(page.getByRole("radiogroup").getByLabel("YouTube")).toBeChecked();

      // URLフィルターをクリック
      await contentPage.urlFilter.click();
      await expect(page.getByRole("radiogroup").getByLabel("URL")).toBeChecked();

      // 気象情報フィルターをクリック
      await contentPage.weatherFilter.click();
      await expect(page.getByRole("radiogroup").getByLabel("気象情報")).toBeChecked();

      // CSVフィルターをクリック
      await contentPage.csvFilter.click();
      await expect(page.getByRole("radiogroup").getByLabel("CSV")).toBeChecked();

      // すべてフィルターに戻す
      await contentPage.allFilter.click();
      await expect(page.getByRole("radiogroup").getByLabel("すべて")).toBeChecked();
    });

    test("検索ボックスに入力できる", async () => {
      // 検索ボックスにテキストを入力
      await contentPage.searchInput.fill("テスト検索");

      // 入力したテキストが表示されることを確認
      await expect(contentPage.searchInput).toHaveValue("テスト検索");

      // 検索をクリア
      await contentPage.searchInput.clear();

      // クリアされたことを確認
      await expect(contentPage.searchInput).toHaveValue("");
    });
  });
