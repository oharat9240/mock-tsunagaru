import type { Locator } from "@playwright/test";
import { BasePage } from "./base-page";

export type ContentType = "video" | "image" | "text" | "youtube" | "url" | "weather" | "csv";

export class ContentPage extends BasePage {
  async navigate() {
    await this.goto("/contents");
    await this.waitForPageLoad();
  }

  // フィルター要素
  get searchInput(): Locator {
    return this.page.getByPlaceholder("コンテンツを検索");
  }

  get allFilter(): Locator {
    return this.page
      .getByRole("radiogroup", { name: "コンテンツタイプフィルター" })
      .locator('label:has-text("すべて")');
  }

  get videoFilter(): Locator {
    return this.page.getByRole("radiogroup", { name: "コンテンツタイプフィルター" }).locator('label:has-text("動画")');
  }

  get imageFilter(): Locator {
    return this.page.getByRole("radiogroup", { name: "コンテンツタイプフィルター" }).locator('label:has-text("画像")');
  }

  get textFilter(): Locator {
    return this.page
      .getByRole("radiogroup", { name: "コンテンツタイプフィルター" })
      .locator('label:has-text("テキスト")');
  }

  get youtubeFilter(): Locator {
    return this.page
      .getByRole("radiogroup", { name: "コンテンツタイプフィルター" })
      .locator('label:has-text("YouTube")');
  }

  get urlFilter(): Locator {
    return this.page.getByRole("radiogroup", { name: "コンテンツタイプフィルター" }).locator('label:has-text("URL")');
  }

  get weatherFilter(): Locator {
    return this.page
      .getByRole("radiogroup", { name: "コンテンツタイプフィルター" })
      .locator('label:has-text("気象情報")');
  }

  get csvFilter(): Locator {
    return this.page.getByRole("radiogroup", { name: "コンテンツタイプフィルター" }).locator('label:has-text("CSV")');
  }

  get unusedFilter(): Locator {
    return this.page
      .getByRole("radiogroup", { name: "コンテンツタイプフィルター" })
      .locator('label:has-text("未使用")');
  }

  // ビュー切り替え
  get tableViewButton(): Locator {
    return this.page.getByRole("button", { name: "テーブルビュー" });
  }

  get gridViewButton(): Locator {
    return this.page.getByRole("button", { name: "グリッドビュー" });
  }

  // アクションボタン
  get addContentButton(): Locator {
    return this.page.getByRole("button", { name: "コンテンツを追加" });
  }

  // コンテンツアイテムの取得
  getContentItem(name: string): Locator {
    return this.page.locator(`text="${name}"`).first().locator('xpath=ancestor::div[contains(@class, "mantine")]');
  }

  // コンテンツアイテムの編集ボタン
  getEditButton(contentName: string): Locator {
    return this.getContentItem(contentName).getByRole("button", { name: "編集" });
  }

  // コンテンツアイテムの削除ボタン
  getDeleteButton(contentName: string): Locator {
    return this.getContentItem(contentName).getByRole("button", { name: "削除" });
  }

  // コンテンツ追加モーダルの操作
  async selectContentType(type: ContentType) {
    const typeMap: Record<ContentType, string> = {
      video: "動画",
      image: "画像",
      text: "テキスト",
      youtube: "YouTube",
      url: "URL",
      weather: "気象情報",
      csv: "CSV",
    };

    await this.page.getByRole("dialog").locator(`label:has-text("${typeMap[type]}")`).click();
  }

  async clickNext() {
    await this.page.getByRole("button", { name: "次へ" }).click();
  }

  async fillContentName(name: string) {
    await this.page.getByLabel("コンテンツ名").fill(name);
  }

  async selectFile(filePath: string) {
    await this.page.getByLabel("ファイルを選択").setInputFiles(filePath);
  }

  async fillYouTubeUrl(url: string) {
    await this.page.getByLabel("YouTube URL").fill(url);
  }

  async fillUrl(url: string) {
    await this.page.getByLabel("URL").fill(url);
  }

  async fillTextContent(text: string) {
    await this.page.getByLabel("テキストコンテンツ").fill(text);
  }

  async clickUpload() {
    await this.page.getByRole("button", { name: "アップロード" }).click();
  }

  async clickSave() {
    await this.page.getByRole("button", { name: "保存" }).click();
  }

  // プレビューモーダルの操作
  async openPreview(contentName: string) {
    await this.getContentItem(contentName).click();
  }

  get previewEditButton(): Locator {
    return this.page.getByLabel("テスト画像").getByRole("button", { name: "編集" });
  }

  get previewDeleteButton(): Locator {
    return this.page.getByLabel("テスト画像").getByRole("button", { name: "削除" });
  }

  // 削除確認モーダル
  async confirmDelete() {
    await this.page.getByRole("button", { name: "削除", exact: true }).click();
  }

  async cancelDelete() {
    await this.page.getByRole("button", { name: "キャンセル" }).click();
  }
}
