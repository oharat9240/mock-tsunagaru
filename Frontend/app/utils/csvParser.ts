/**
 * CSVパーサーユーティリティ
 */

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  totalRows: number;
  totalColumns: number;
}

/**
 * CSV文字列をパースして配列に変換
 * @param csvString CSV文字列
 * @param delimiter 区切り文字（デフォルト: カンマ）
 * @returns パース結果
 */
export function parseCsv(csvString: string, delimiter = ","): ParsedCsv {
  // 改行コードを統一
  const normalizedCsv = csvString.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 空行を除去して行に分割
  const lines = normalizedCsv.split("\n").filter((line) => line.trim());

  if (lines.length === 0) {
    return {
      headers: [],
      rows: [],
      totalRows: 0,
      totalColumns: 0,
    };
  }

  // ヘッダー行をパース
  const headers = parseRow(lines[0], delimiter);

  // データ行をパース
  const rows = lines.slice(1).map((line) => parseRow(line, delimiter));

  return {
    headers,
    rows,
    totalRows: rows.length,
    totalColumns: headers.length,
  };
}

/**
 * CSV行をパース（ダブルクォート対応）
 * @param row CSV行
 * @param delimiter 区切り文字
 * @returns パースされた値の配列
 */
export function parseRow(row: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    const nextChar = row[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // エスケープされたダブルクォート
        current += '"';
        i++; // 次の文字をスキップ
      } else {
        // クォートの開始/終了
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // フィールドの区切り
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  // 最後のフィールドを追加
  result.push(current.trim());

  return result;
}

/**
 * 選択された行と列からCSVを生成
 * @param parsedCsv パース済みCSVデータ
 * @param selectedRows 選択された行のインデックス
 * @param selectedColumns 選択された列のインデックス
 * @param includeHeader ヘッダーを含むかどうか
 * @returns 新しいCSV文字列
 */
export function generateCsvFromSelection(
  parsedCsv: ParsedCsv,
  selectedRows: number[],
  selectedColumns: number[],
  includeHeader = true,
): string {
  const lines: string[] = [];

  // ヘッダー行
  if (includeHeader) {
    const selectedHeaders = selectedColumns.map((colIndex) => escapeField(parsedCsv.headers[colIndex] || ""));
    lines.push(selectedHeaders.join(","));
  }

  // データ行
  for (const rowIndex of selectedRows) {
    if (rowIndex < parsedCsv.rows.length) {
      const row = parsedCsv.rows[rowIndex];
      const selectedFields = selectedColumns.map((colIndex) => escapeField(row[colIndex] || ""));
      lines.push(selectedFields.join(","));
    }
  }

  return lines.join("\n");
}

/**
 * CSVフィールドをエスケープ
 * @param field フィールド値
 * @returns エスケープされた値
 */
function escapeField(field: string): string {
  // カンマ、改行、ダブルクォートが含まれる場合はダブルクォートで囲む
  if (field.includes(",") || field.includes("\n") || field.includes('"')) {
    // ダブルクォートをエスケープ
    const escaped = field.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  return field;
}

/**
 * CSVファイルを読み込んでパース
 * @param file CSVファイル
 * @returns パース結果
 */
export async function parseCsvFile(file: File): Promise<ParsedCsv> {
  const text = await file.text();
  return parseCsv(text);
}
