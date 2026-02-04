import type { Locator } from "@playwright/test";
import { BasePage } from "./base-page";

export class LayoutPage extends BasePage {
  async navigate() {
    await this.goto("/layout");
    await this.waitForPageLoad();
  }

  // アクションボタン
  get createButton(): Locator {
    return this.page.getByRole("button", { name: "新しいレイアウトを作成" });
  }

  // ビュー切り替え
  get gridViewButton(): Locator {
    return this.page.getByRole("button", { name: "グリッドビュー" });
  }

  get tableViewButton(): Locator {
    return this.page.getByRole("button", { name: "テーブルビュー" });
  }

  // レイアウト作成モーダルの操作
  async fillLayoutName(name: string) {
    await this.page.getByLabel("レイアウト名").fill(name);
  }

  async selectAspectRatio(ratio: string) {
    await this.page.getByLabel("アスペクト比").click();
    await this.page.getByRole("option", { name: ratio }).click();
  }

  async clickCreate() {
    await this.page.getByRole("button", { name: "作成" }).click();
  }

  // レイアウトエディタの操作
  async addRegion() {
    await this.page.getByRole("button", { name: "リージョンを追加" }).click();
  }

  async selectRegion(index: number) {
    const regions = this.page.locator("[data-moveable-target]");
    await regions.nth(index).click();
  }

  async deleteSelectedRegion() {
    await this.page.getByRole("button", { name: "削除" }).click();
  }

  async saveLayout() {
    await this.page.getByRole("button", { name: "保存" }).click();
  }

  async cancelEdit() {
    await this.page.getByRole("button", { name: "キャンセル" }).click();
  }

  // レイアウトアイテムの取得
  getLayoutCard(name: string): Locator {
    return this.page.locator(`text="${name}"`).locator('xpath=ancestor::div[contains(@class, "mantine-Paper")]');
  }

  getLayoutRow(name: string): Locator {
    return this.page.getByRole("row").filter({ has: this.page.getByText(name) });
  }

  // 編集ボタン（グリッドビュー）
  getEditButton(layoutName: string): Locator {
    return this.getLayoutCard(layoutName).getByRole("button", { name: "編集" });
  }

  // 削除ボタン（グリッドビュー）
  getDeleteButton(layoutName: string): Locator {
    return this.getLayoutCard(layoutName).getByRole("button", { name: "削除" });
  }

  // 編集ボタン（テーブルビュー）
  getTableEditButton(layoutName: string): Locator {
    return this.getLayoutRow(layoutName).getByRole("button", { name: "編集" });
  }

  // 削除ボタン（テーブルビュー）
  getTableDeleteButton(layoutName: string): Locator {
    return this.getLayoutRow(layoutName).getByRole("button", { name: "削除" });
  }

  // 削除確認
  async confirmDelete() {
    await this.page.getByRole("button", { name: "削除", exact: true }).click();
  }

  async cancelDelete() {
    await this.page.getByRole("button", { name: "キャンセル" }).click();
  }

  // リージョンプロパティの編集
  async setRegionName(name: string) {
    await this.page.getByLabel("リージョン名").clear();
    await this.page.getByLabel("リージョン名").fill(name);
    await this.page.getByLabel("リージョン名").press("Enter");
  }

  async setRegionPosition(x: string, y: string) {
    await this.page.getByLabel("X座標").clear();
    await this.page.getByLabel("X座標").fill(x);
    await this.page.getByLabel("Y座標").clear();
    await this.page.getByLabel("Y座標").fill(y);
  }

  async setRegionSize(width: string, height: string) {
    await this.page.getByLabel("幅").clear();
    await this.page.getByLabel("幅").fill(width);
    await this.page.getByLabel("高さ").clear();
    await this.page.getByLabel("高さ").fill(height);
  }
}
