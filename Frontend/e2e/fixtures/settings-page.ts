import { expect, type Locator } from "@playwright/test";
import { BasePage } from "./base-page";

export class SettingsPage extends BasePage {
  async navigate() {
    await this.goto("/settings");
    await this.waitForPageLoad();
  }

  // テストデータセクション
  get createTestDataButton(): Locator {
    return this.page.getByRole("button", { name: "テストデータを作成" });
  }

  get layoutCountInput(): Locator {
    return this.page.getByLabel("レイアウト数");
  }

  get createLayoutsButton(): Locator {
    return this.page.getByRole("button", { name: "レイアウト作成" });
  }

  get playlistCountInput(): Locator {
    return this.page.getByLabel("プレイリスト数");
  }

  get createPlaylistsButton(): Locator {
    return this.page.getByRole("button", { name: "プレイリスト作成" });
  }

  get scheduleCountInput(): Locator {
    return this.page.getByLabel("スケジュール数");
  }

  get createSchedulesButton(): Locator {
    return this.page.getByRole("button", { name: "スケジュール作成" });
  }

  // ストレージセクション
  get clearStorageButton(): Locator {
    return this.page.getByRole("button", { name: "すべてのデータを削除" });
  }

  get storageUsageText(): Locator {
    return this.page.locator(".storage-usage");
  }

  // データ管理
  async exportData() {
    await this.page.getByRole("button", { name: "データをエクスポート" }).click();
  }

  async importData(filePath: string) {
    await this.page.getByLabel("インポートファイル").setInputFiles(filePath);
  }

  // 確認ダイアログ
  async confirmClearStorage() {
    await this.page.getByRole("button", { name: "クリア", exact: true }).click();
  }

  async cancelClearStorage() {
    await this.page.getByRole("button", { name: "キャンセル" }).click();
  }

  // テストデータ作成の詳細設定
  async setContentTypes(types: string[]) {
    for (const type of types) {
      await this.page.getByLabel(type).check();
    }
  }

  async setContentCount(count: number) {
    await this.page.getByLabel("コンテンツ数").clear();
    await this.page.getByLabel("コンテンツ数").fill(count.toString());
  }

  // 待機処理
  async waitForTestDataCreation() {
    await this.page.waitForFunction(() => !document.querySelector('button:has-text("作成中...")'), { timeout: 30000 });
  }

  // バージョン情報
  get versionText(): Locator {
    return this.page.getByText(/バージョン: \d+\.\d+\.\d+/);
  }

  get buildDateText(): Locator {
    return this.page.getByText(/ビルド日時:/);
  }

  // 設定値の確認
  async verifyLayoutCount(count: number) {
    await expect(this.page.getByText(`${count}個のレイアウトが作成されました`)).toBeVisible();
  }

  async verifyPlaylistCount(count: number) {
    await expect(this.page.getByText(`${count}個のプレイリストが作成されました`)).toBeVisible();
  }

  async verifyScheduleCount(count: number) {
    await expect(this.page.getByText(`${count}個のスケジュールが作成されました`)).toBeVisible();
  }
}
