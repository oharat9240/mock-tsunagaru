import { expect, test } from "@playwright/test";

test.describe("認証", () => {
  test.beforeEach(async ({ page }) => {
    // 認証状態をクリア
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("tsunagaru-user"));
  });

  test("未認証の場合はログインページにリダイレクトされる", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("ログインできる", async ({ page }) => {
    await page.goto("/login");

    // ログインフォームが表示されることを確認
    await expect(page.getByRole("heading", { name: "もっく！つながるサイネージ" }).first()).toBeVisible();

    // ユーザーIDとパスワードを入力
    await page.getByLabel("ユーザーID").fill("testuser");
    await page.getByLabel("パスワード").fill("password");

    // ログインボタンをクリック
    await page.getByRole("button", { name: "ログイン" }).click();

    // ホームページにリダイレクトされることを確認
    await expect(page).toHaveURL(/\/playlist/);

    // ユーザー情報が表示されることを確認
    await expect(page.getByText("testuser")).toBeVisible();
  });

  test("必須フィールドが空の場合はログインできない", async ({ page }) => {
    await page.goto("/login");

    // 空のユーザーIDとパスワードではボタンが無効
    await expect(page.getByRole("button", { name: "ログイン" })).toBeDisabled();

    // ユーザーIDだけ入力してもボタンは無効
    await page.getByLabel("ユーザーID").fill("testuser");
    await expect(page.getByRole("button", { name: "ログイン" })).toBeDisabled();

    // パスワードも入力するとボタンが有効になる
    await page.getByLabel("パスワード").fill("password");
    await expect(page.getByRole("button", { name: "ログイン" })).toBeEnabled();
  });

  test("ログイン状態が維持される", async ({ page }) => {
    // ログイン
    await page.goto("/login");
    await page.getByLabel("ユーザーID").fill("testuser");
    await page.getByLabel("パスワード").fill("password");
    await page.getByRole("button", { name: "ログイン" }).click();

    // ホームページに遷移
    await expect(page).toHaveURL(/\/playlist/);

    // ページをリロード
    await page.reload();

    // ログイン状態が維持されていることを確認
    await expect(page).toHaveURL(/\/playlist/);
    await expect(page.getByText("testuser")).toBeVisible();
  });

  test("ログアウトできる", async ({ page }) => {
    // まずログイン
    await page.goto("/login");
    await page.getByLabel("ユーザーID").fill("testuser");
    await page.getByLabel("パスワード").fill("password");
    await page.getByRole("button", { name: "ログイン" }).click();

    // プレイリストページに遷移
    await expect(page).toHaveURL(/\/playlist/);

    // ユーザー情報をクリアしてログアウト（localStorageをクリア）
    await page.evaluate(() => localStorage.removeItem("tsunagaru-user"));

    // ページをリロード
    await page.reload();

    // ログインページにリダイレクトされることを確認
    await expect(page).toHaveURL(/\/login/);
  });

  test("保護されたページにアクセスしようとするとログインページにリダイレクトされる", async ({ page }) => {
    // 未認証で設定ページにアクセス
    await page.goto("/settings");

    // ログインページにリダイレクトされることを確認
    await expect(page).toHaveURL(/\/login/);

    // ログイン
    await page.getByLabel("ユーザーID").fill("testuser");
    await page.getByLabel("パスワード").fill("password");
    await page.getByRole("button", { name: "ログイン" }).click();

    // プレイリストページ（デフォルト）にリダイレクトされることを確認
    await expect(page).toHaveURL(/\/playlist/);
  });
});
