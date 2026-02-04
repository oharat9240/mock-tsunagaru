import type { Locator } from "@playwright/test";
import { BasePage } from "./base-page";

export class PlaylistPage extends BasePage {
  async navigate() {
    await this.goto("/playlist");
    await this.waitForPageLoad();
  }

  // アクションボタン
  get createButton(): Locator {
    return this.page.getByRole("button", { name: "新しいプレイリストを作成" });
  }

  // プレイリスト作成モーダルの操作
  async fillPlaylistName(name: string) {
    await this.page.getByLabel("プレイリスト名").fill(name);
  }

  async selectDevice(device: string) {
    await this.page.getByLabel("デバイス").click();
    await this.page.getByRole("option", { name: device }).click();
  }

  async clickNext() {
    await this.page.getByRole("button", { name: "次へ" }).click();
  }

  async clickBack() {
    await this.page.getByRole("button", { name: "戻る" }).click();
  }

  async clickCreate() {
    await this.page.getByRole("button", { name: "作成" }).click();
  }

  // レイアウト選択
  async selectLayout(layoutName: string) {
    const layoutCard = this.page
      .locator(`text=${layoutName}`)
      .locator('xpath=ancestor::div[contains(@class, "mantine-Paper")]');
    await layoutCard.getByRole("button", { name: "選択" }).click();
  }

  // コンテンツ割り当て
  async addContentToRegion(regionIndex: number, contentNames: string[]) {
    const regions = this.page.locator("[data-region]");
    const targetRegion = regions.nth(regionIndex);

    // コンテンツを追加ボタンをクリック
    await targetRegion.getByRole("button", { name: "コンテンツを追加" }).click();

    // コンテンツを選択
    for (const contentName of contentNames) {
      await this.page.getByRole("checkbox", { name: contentName }).click();
    }

    // 追加を実行
    await this.page.getByRole("button", { name: "選択したコンテンツを追加" }).click();
  }

  // プレイリストアイテムの取得
  getPlaylistRow(name: string): Locator {
    return this.page.getByRole("row").filter({ has: this.page.getByText(name) });
  }

  // 編集ボタン
  getEditButton(playlistName: string): Locator {
    return this.getPlaylistRow(playlistName).getByRole("button", { name: "編集" });
  }

  // プレビューボタン
  getPreviewButton(playlistName: string): Locator {
    return this.getPlaylistRow(playlistName).getByRole("button", { name: "プレビュー" });
  }

  // 削除ボタン
  getDeleteButton(playlistName: string): Locator {
    return this.getPlaylistRow(playlistName).getByRole("button", { name: "削除" });
  }

  // 削除確認
  async confirmDelete() {
    await this.page.getByRole("button", { name: "削除", exact: true }).click();
  }

  async cancelDelete() {
    await this.page.getByRole("button", { name: "キャンセル" }).click();
  }
}
