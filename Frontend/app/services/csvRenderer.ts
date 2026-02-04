import { notifications } from "@mantine/notifications";
import type { CsvContent, CsvLayoutConfig, CsvStyleConfig } from "~/types/content";
import { generateCsvFromSelection, parseCsv } from "~/utils/csvParser";

interface CsvRenderOptions {
  csvData: string;
  selectedRows: number[];
  selectedColumns: number[];
  layout?: CsvLayoutConfig;
  style?: CsvStyleConfig;
  backgroundFile?: File;
  format?: "png" | "jpeg";
  apiUrl?: string;
}

interface CsvRenderResult {
  imageData: ArrayBuffer;
  format: "png" | "jpeg";
}

class CsvRendererService {
  private defaultApiUrl = "https://csv-renderer.onrender.com";

  /**
   * CSVデータを画像にレンダリング
   */
  async renderCsvToImage(options: CsvRenderOptions): Promise<CsvRenderResult> {
    const {
      csvData,
      selectedRows,
      selectedColumns,
      layout,
      style,
      backgroundFile,
      format = "png",
      apiUrl = this.defaultApiUrl,
    } = options;

    try {
      // 選択された行・列からCSVを生成
      const parsedCsv = parseCsv(csvData);
      const filteredCsv = generateCsvFromSelection(parsedCsv, selectedRows, selectedColumns, true);

      // FormDataを構築
      const formData = new FormData();

      // CSVファイルを追加
      const csvBlob = new Blob([filteredCsv], { type: "text/csv" });
      formData.append("csv", csvBlob, "data.csv");

      // レイアウト設定を追加
      if (layout) {
        formData.append("layout", JSON.stringify(layout));
      }

      // スタイル設定を追加
      if (style) {
        formData.append("style", JSON.stringify(style));
      }

      // 背景画像を追加
      if (backgroundFile) {
        formData.append("background", backgroundFile);
      }

      // 出力形式を追加
      formData.append("format", format);

      // APIにリクエスト送信
      const response = await fetch(`${apiUrl}/render`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`レンダリングエラー: ${response.status} - ${errorText}`);
      }

      const imageData = await response.arrayBuffer();

      return {
        imageData,
        format,
      };
    } catch (error) {
      console.error("CSV rendering error:", error);
      throw error;
    }
  }

  /**
   * CSVコンテンツから画像データを生成（サーバーアップロード用）
   */
  async generateCsvImageData(
    csvContent: Partial<CsvContent>,
    backgroundFile?: File,
  ): Promise<{ data: ArrayBuffer; format: "png" | "jpeg" }> {
    try {
      // 必須フィールドのチェック
      if (!csvContent.originalCsvData || !csvContent.selectedRows || !csvContent.selectedColumns) {
        throw new Error("CSVデータまたは選択情報が不足しています");
      }

      // 画像をレンダリング（編集されたデータがある場合はそれを使用）
      const result = await this.renderCsvToImage({
        csvData: csvContent.editedCsvData || csvContent.originalCsvData,
        selectedRows: csvContent.selectedRows,
        selectedColumns: csvContent.selectedColumns,
        layout: csvContent.layout,
        style: csvContent.style,
        backgroundFile,
        format: csvContent.format || "png",
        apiUrl: csvContent.apiUrl,
      });

      return {
        data: result.imageData,
        format: result.format,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "CSV画像の生成に失敗しました";
      notifications.show({
        title: "エラー",
        message,
        color: "red",
      });
      throw error;
    }
  }

  /**
   * プレビュー用の画像を生成（OPFSに保存せず）
   */
  async generatePreview(options: CsvRenderOptions): Promise<string> {
    try {
      const result = await this.renderCsvToImage(options);

      // ArrayBufferをBlobに変換してオブジェクトURLを作成
      const blob = new Blob([result.imageData], {
        type: result.format === "png" ? "image/png" : "image/jpeg",
      });

      return URL.createObjectURL(blob);
    } catch (error) {
      const message = error instanceof Error ? error.message : "プレビューの生成に失敗しました";
      notifications.show({
        title: "エラー",
        message,
        color: "red",
      });
      throw error;
    }
  }
}

export const csvRendererService = new CsvRendererService();
