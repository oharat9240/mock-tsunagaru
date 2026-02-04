import type { Locator, Page } from "@playwright/test";

export class BasePage {
  protected page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(path: string) {
    await this.page.goto(path);
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState("networkidle");
  }

  // 共通のナビゲーション要素
  get homeLink(): Locator {
    return this.page.getByRole("link", { name: "ホーム" });
  }

  get settingsLink(): Locator {
    return this.page.getByRole("link", { name: "設定" });
  }

  get themeToggleButton(): Locator {
    return this.page.getByRole("button", { name: "テーマ切り替え" });
  }

  // タブナビゲーション
  get playlistTab(): Locator {
    return this.page.getByRole("tab", { name: "プレイリスト" });
  }

  get scheduleTab(): Locator {
    return this.page.getByRole("tab", { name: "スケジュール" });
  }

  get layoutTab(): Locator {
    return this.page.getByRole("tab", { name: "レイアウト" });
  }

  get contentTab(): Locator {
    return this.page.getByRole("tab", { name: "コンテンツ管理" });
  }

  // 共通のモーダル操作
  async closeModal() {
    const closeButton = this.page
      .getByRole("button")
      .filter({ has: this.page.locator("svg") })
      .first();
    await closeButton.click();
  }

  async waitForModalToClose() {
    await this.page.waitForFunction(() => {
      const modals = document.querySelectorAll('[role="dialog"]');
      return modals.length === 0 || Array.from(modals).every((modal) => !modal.isConnected);
    });
  }

  // 共通のアラート操作
  async waitForSuccessNotification() {
    // Mantine通知システムのセレクタを使用 - タイトル要素を使用して厳密にする
    await this.page
      .locator('[class*="mantine-Notification-title"]')
      .filter({ hasText: /成功|完了|失敗/ })
      .first()
      .waitFor({ timeout: 30000 });
  }

  async waitForErrorNotification() {
    await this.page.getByRole("alert").filter({ hasText: "エラー" }).waitFor();
  }
}
