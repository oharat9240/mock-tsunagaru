import { expect, type Locator } from "@playwright/test";
import { BasePage } from "./base-page";

export class SchedulePage extends BasePage {
  async navigate() {
    await this.goto("/schedule");
    await this.waitForPageLoad();

    // スケジュールタブが選択されていない場合はクリック
    const scheduleTab = this.page.getByRole("tab", { name: "スケジュール" });
    const isSelected = await scheduleTab.getAttribute("aria-selected");
    if (isSelected !== "true") {
      await scheduleTab.click();
      await this.page.waitForTimeout(500);
    }
  }

  // 日付ナビゲーション
  get previousWeekButton(): Locator {
    // 左矢印のSVGを含むボタンを探す（ActionIcon）
    return this.page.locator("button:has(svg)").nth(4);
  }

  get nextWeekButton(): Locator {
    // 右矢印のSVGを含むボタンを探す（ActionIcon）
    return this.page.locator("button:has(svg)").nth(5);
  }

  get todayButton(): Locator {
    return this.page.getByRole("button", { name: "今週" });
  }

  get currentWeekText(): Locator {
    // 日付範囲のテキストを含む要素を探す
    return this.page.getByText(/\d{1,2}月\d{1,2}日 - \d{1,2}月\d{1,2}日/);
  }

  // タイムライン操作
  async clickTimeSlot(dayIndex: number, hour: number) {
    const slot = this.page.locator(`.schedule-slot[data-day="${dayIndex}"][data-hour="${hour}"]`);
    await slot.click();
  }

  getScheduleItem(playlistName: string): Locator {
    return this.page.locator(".schedule-item").filter({ hasText: playlistName });
  }

  // スケジュール編集モーダルの操作
  async selectPlaylist(playlistName: string) {
    await this.page.getByLabel("プレイリスト").click();
    await this.page.getByRole("option", { name: playlistName }).click();
  }

  async setStartTime(time: string) {
    await this.page.getByLabel("開始時刻").clear();
    await this.page.getByLabel("開始時刻").fill(time);
  }

  async setEndTime(time: string) {
    await this.page.getByLabel("終了時刻").clear();
    await this.page.getByLabel("終了時刻").fill(time);
  }

  async enableRepeat() {
    await this.page.getByLabel("繰り返し").click();
  }

  async selectRepeatType(type: "毎日" | "毎週" | "毎月") {
    await this.page.getByLabel("繰り返しタイプ").click();
    await this.page.getByRole("option", { name: type }).click();
  }

  async selectRepeatDays(days: string[]) {
    for (const day of days) {
      await this.page.getByLabel(day).click();
    }
  }

  async setRepeatEndDate(date: string) {
    await this.page.getByLabel("終了日").fill(date);
  }

  async saveSchedule() {
    await this.page.getByRole("button", { name: "保存" }).click();
  }

  async updateSchedule() {
    await this.page.getByRole("button", { name: "更新" }).click();
  }

  async deleteSchedule() {
    await this.page.getByRole("button", { name: "削除" }).click();
  }

  async confirmDelete() {
    await this.page.getByRole("button", { name: "削除", exact: true }).click();
  }

  // 週ビューと月ビューの切り替え
  get weekViewButton(): Locator {
    return this.page.getByRole("button", { name: "週表示" });
  }

  get monthViewButton(): Locator {
    return this.page.getByRole("button", { name: "月表示" });
  }

  // ドラッグアンドドロップ操作
  async dragScheduleItem(from: Locator, to: Locator) {
    await from.dragTo(to);
  }

  // スケジュールの検証
  async verifyScheduleExists(playlistName: string, time: string) {
    const schedule = this.getScheduleItem(playlistName).filter({ hasText: time });
    await expect(schedule).toBeVisible();
  }

  async verifyScheduleNotExists(playlistName: string) {
    await expect(this.getScheduleItem(playlistName)).not.toBeVisible();
  }
}
