import {
  Button,
  Checkbox,
  FileInput,
  Group,
  Image,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconFile, IconRefresh, IconTableOptions } from "@tabler/icons-react";
import { memo, useCallback, useEffect, useState } from "react";
import type { CsvContent, CsvLayoutConfig, CsvStyleConfig } from "~/types/content";
import { type ParsedCsv, parseCsvFile } from "~/utils/csvParser";
import { BackgroundImageSelector } from "./BackgroundImageSelector";
import { CsvLayoutForm } from "./CsvLayoutForm";
import { CsvStyleForm } from "./CsvStyleForm";

// セル編集用のメモ化されたコンポーネント
interface EditableCellProps {
  value: string;
  onChange: (value: string) => void;
}

const EditableCell = memo(({ value, onChange }: EditableCellProps) => {
  return (
    <TextInput
      size="xs"
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      styles={{ input: { padding: "4px 8px", minHeight: "unset" } }}
    />
  );
});

EditableCell.displayName = "EditableCell";

interface CsvContentFormProps {
  initialData?: Partial<CsvContent>;
  onDataChange: (data: Partial<CsvContent>) => void;
  onPreviewRequest?: () => Promise<void>;
  onBackgroundFileChange?: (file: File | undefined) => void;
  onCsvFileChange?: (file: File | undefined) => void;
  previewUrl?: string | null;
}

export const CsvContentForm = memo(
  ({
    initialData,
    onDataChange,
    onPreviewRequest,
    onBackgroundFileChange,
    onCsvFileChange,
    previewUrl,
  }: CsvContentFormProps) => {
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [parsedCsv, setParsedCsv] = useState<ParsedCsv | null>(null);
    const [editedCsv, setEditedCsv] = useState<ParsedCsv | null>(null);
    const [selectedRows, setSelectedRows] = useState<number[]>(initialData?.selectedRows || []);
    const [selectedColumns, setSelectedColumns] = useState<number[]>(initialData?.selectedColumns || []);
    const [layout, setLayout] = useState<CsvLayoutConfig | undefined>(initialData?.layout);
    const [style, setStyle] = useState<CsvStyleConfig | undefined>(initialData?.style);
    const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);

    // CSVファイルの解析
    const handleCsvUpload = useCallback(
      async (file: File | null) => {
        if (!file) {
          setCsvFile(null);
          setParsedCsv(null);
          setEditedCsv(null);
          setSelectedRows([]);
          setSelectedColumns([]);
          onCsvFileChange?.(undefined);
          return;
        }

        try {
          setCsvFile(file);
          onCsvFileChange?.(file);
          const parsed = await parseCsvFile(file);
          setParsedCsv(parsed);
          setEditedCsv(parsed); // 編集用データも初期化

          // デフォルトで全ての行と列を選択
          const allRows = Array.from({ length: parsed.totalRows }, (_, i) => i);
          const allColumns = Array.from({ length: parsed.totalColumns }, (_, i) => i);
          setSelectedRows(allRows);
          setSelectedColumns(allColumns);

          // CSVデータを親コンポーネントに通知
          onDataChange({
            originalCsvData: await file.text(),
            selectedRows: allRows,
            selectedColumns: allColumns,
          });
        } catch (error) {
          console.error("Failed to parse CSV:", error);
        }
      },
      [onDataChange, onCsvFileChange],
    );

    // 行の選択/解除
    const toggleRow = useCallback((rowIndex: number) => {
      setSelectedRows((prev) => {
        const newRows = prev.includes(rowIndex)
          ? prev.filter((i) => i !== rowIndex)
          : [...prev, rowIndex].sort((a, b) => a - b);
        return newRows;
      });
    }, []);

    // 列の選択/解除
    const toggleColumn = useCallback((colIndex: number) => {
      setSelectedColumns((prev) => {
        const newCols = prev.includes(colIndex)
          ? prev.filter((i) => i !== colIndex)
          : [...prev, colIndex].sort((a, b) => a - b);
        return newCols;
      });
    }, []);

    // 全行選択/解除
    const toggleAllRows = useCallback(() => {
      if (!parsedCsv) return;

      if (selectedRows.length === parsedCsv.totalRows) {
        setSelectedRows([]);
      } else {
        setSelectedRows(Array.from({ length: parsedCsv.totalRows }, (_, i) => i));
      }
    }, [parsedCsv, selectedRows]);

    // 全列選択/解除
    const toggleAllColumns = useCallback(() => {
      if (!parsedCsv) return;

      if (selectedColumns.length === parsedCsv.totalColumns) {
        setSelectedColumns([]);
      } else {
        setSelectedColumns(Array.from({ length: parsedCsv.totalColumns }, (_, i) => i));
      }
    }, [parsedCsv, selectedColumns]);

    // セルの編集
    const handleCellEdit = useCallback((rowIndex: number, colIndex: number, value: string) => {
      setEditedCsv((prev) => {
        if (!prev) return prev;

        // 既存の配列を直接変更せずに、新しい配列を作成
        const newRows = prev.rows.map((row, rIdx) => {
          if (rIdx === rowIndex) {
            return row.map((cell, cIdx) => (cIdx === colIndex ? value : cell));
          }
          return row;
        });

        return {
          ...prev,
          rows: newRows,
        };
      });
    }, []);

    // ヘッダーの編集
    const handleHeaderEdit = useCallback((colIndex: number, value: string) => {
      setEditedCsv((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          headers: prev.headers.map((header, idx) => (idx === colIndex ? value : header)),
        };
      });
    }, []);

    // 初期値に戻す
    const resetToOriginal = useCallback(() => {
      if (!parsedCsv) return;
      setEditedCsv(parsedCsv);
      setIsEditing(false);
    }, [parsedCsv]);

    // 編雈データがCSV文字列に変換
    const convertEditedCsvToString = useCallback(() => {
      if (!editedCsv) return "";

      const headerRow = editedCsv.headers.join(",");
      const dataRows = editedCsv.rows.map((row) => row.join(",")).join("\n");

      return `${headerRow}\n${dataRows}`;
    }, [editedCsv]);

    // 編集完了時のハンドラー
    const handleEditingComplete = useCallback(() => {
      setIsEditing(false);
      if (editedCsv) {
        const csvData = convertEditedCsvToString();
        onDataChange({
          originalCsvData: csvFile ? undefined : initialData?.originalCsvData,
          selectedRows,
          selectedColumns,
          layout,
          style,
          editedCsvData: csvData,
        });
      }
    }, [
      editedCsv,
      convertEditedCsvToString,
      csvFile,
      initialData?.originalCsvData,
      selectedRows,
      selectedColumns,
      layout,
      style,
      onDataChange,
    ]);

    // データ変更を親コンポーネントに通知（編集中のCSVデータは除外）
    // biome-ignore lint/correctness/useExhaustiveDependencies: isEditingとeditedCsvは編集中の再レンダリングを防ぐため意図的に除外
    useEffect(() => {
      if (parsedCsv && !isEditing) {
        onDataChange({
          originalCsvData: csvFile ? undefined : initialData?.originalCsvData,
          selectedRows,
          selectedColumns,
          layout,
          style,
          // 編集データがある場合は含める（編集が完了している場合のみ）
          ...(editedCsv && !isEditing ? { editedCsvData: convertEditedCsvToString() } : {}),
        });
      }
    }, [
      selectedRows,
      selectedColumns,
      layout,
      style,
      parsedCsv,
      csvFile,
      initialData?.originalCsvData,
      onDataChange,
      // isEditingとeditedCsvは意図的に依存配列から除外
    ]);

    // 初期データの設定用のフラグ
    const [isInitialized, setIsInitialized] = useState(false);

    // 初期データからCSVファイルを設定
    useEffect(() => {
      // 既に初期化済みの場合はスキップ
      if (isInitialized || !initialData) return;

      if ("originalCsvFile" in initialData && initialData.originalCsvFile instanceof File) {
        handleCsvUpload(initialData.originalCsvFile);
        setIsInitialized(true);
      } else if (initialData.originalCsvData) {
        // 初期データがあるがファイルがない場合（編集時など）
        setSelectedRows(initialData.selectedRows || []);
        setSelectedColumns(initialData.selectedColumns || []);

        // まず元のCSVデータをパース
        try {
          const originalLines = initialData.originalCsvData.split("\n");
          const originalHeaders = originalLines[0].split(",");
          const originalRows = originalLines.slice(1).map((line) => line.split(","));
          const originalParsed = {
            headers: originalHeaders,
            rows: originalRows,
            totalRows: originalRows.length,
            totalColumns: originalHeaders.length,
          };
          setParsedCsv(originalParsed);

          // 編集データがある場合はそれを使用、なければ元のデータを使用
          if (initialData.editedCsvData) {
            try {
              const editedLines = initialData.editedCsvData.split("\n");
              const editedHeaders = editedLines[0].split(",");
              const editedRows = editedLines.slice(1).map((line) => line.split(","));
              setEditedCsv({
                headers: editedHeaders,
                rows: editedRows,
                totalRows: editedRows.length,
                totalColumns: editedHeaders.length,
              });
              setIsEditing(true);
            } catch (error) {
              console.error("Failed to parse edited CSV data:", error);
              setEditedCsv(originalParsed);
            }
          } else {
            setEditedCsv(originalParsed);
          }
        } catch (error) {
          console.error("Failed to parse original CSV data:", error);
        }
        setIsInitialized(true);
      }
    }, [isInitialized, initialData, handleCsvUpload]);

    return (
      <Stack gap="lg">
        {/* CSVファイルアップロード */}
        <Paper p="md" withBorder>
          <Stack gap="sm">
            <Group justify="space-between">
              <Title order={4}>CSVファイル</Title>
              {csvFile && (
                <Text size="sm" c="dimmed">
                  {csvFile.name}
                </Text>
              )}
            </Group>
            <FileInput
              accept=".csv,text/csv"
              placeholder="CSVファイルを選択"
              value={csvFile}
              onChange={handleCsvUpload}
              leftSection={<IconFile size={16} />}
              rightSection={
                csvFile && (
                  <Button size="xs" variant="subtle" onClick={() => handleCsvUpload(null)}>
                    クリア
                  </Button>
                )
              }
            />
          </Stack>
        </Paper>

        {/* CSVデータプレビューと選択 */}
        {parsedCsv && (
          <Paper p="md" withBorder>
            <Stack gap="md">
              <Group justify="space-between">
                <Title order={4}>データ選択</Title>
                <Group gap="xs">
                  <Text size="sm" c="dimmed">
                    {selectedRows.length}/{parsedCsv.totalRows} 行, {selectedColumns.length}/{parsedCsv.totalColumns} 列
                  </Text>
                  <Button
                    size="xs"
                    variant={isEditing ? "filled" : "light"}
                    onClick={() => {
                      if (isEditing) {
                        handleEditingComplete();
                      } else {
                        setIsEditing(true);
                      }
                    }}
                  >
                    {isEditing ? "編集を終了" : "セルを編集"}
                  </Button>
                  {isEditing && editedCsv !== parsedCsv && (
                    <Button
                      size="xs"
                      variant="subtle"
                      leftSection={<IconRefresh size={14} />}
                      onClick={resetToOriginal}
                    >
                      初期値に戻す
                    </Button>
                  )}
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconTableOptions size={14} />}
                    onClick={async () => {
                      if (onPreviewRequest) {
                        setIsLoadingPreview(true);
                        try {
                          await onPreviewRequest();
                        } finally {
                          setIsLoadingPreview(false);
                        }
                      }
                    }}
                    loading={isLoadingPreview}
                    disabled={isLoadingPreview}
                  >
                    プレビュー
                  </Button>
                </Group>
              </Group>

              <ScrollArea h={400}>
                <Table striped highlightOnHover withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th w={40}>
                        <Checkbox
                          checked={selectedRows.length === parsedCsv.totalRows}
                          indeterminate={selectedRows.length > 0 && selectedRows.length < parsedCsv.totalRows}
                          onChange={toggleAllRows}
                        />
                      </Table.Th>
                      {(editedCsv || parsedCsv).headers.map((header, colIndex) => (
                        <Table.Th key={`col-${colIndex}-${header}`}>
                          <Group gap="xs" wrap="nowrap">
                            <Checkbox
                              checked={selectedColumns.includes(colIndex)}
                              onChange={() => toggleColumn(colIndex)}
                            />
                            {isEditing ? (
                              <EditableCell
                                value={editedCsv?.headers[colIndex] || header}
                                onChange={(value) => handleHeaderEdit(colIndex, value)}
                              />
                            ) : (
                              <Text size="sm" truncate>
                                {editedCsv?.headers[colIndex] || header || `列${colIndex + 1}`}
                              </Text>
                            )}
                          </Group>
                        </Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(editedCsv || parsedCsv).rows.map((row, rowIndex) => (
                      <Table.Tr
                        key={`row-${rowIndex}-${row.join("-").substring(0, 20)}`}
                        bg={selectedRows.includes(rowIndex) ? "blue.0" : undefined}
                      >
                        <Table.Td>
                          <Checkbox checked={selectedRows.includes(rowIndex)} onChange={() => toggleRow(rowIndex)} />
                        </Table.Td>
                        {row.map((cell, colIndex) => (
                          <Table.Td
                            // biome-ignore lint/suspicious/noArrayIndexKey: CSV cells have fixed positions
                            key={`cell-${rowIndex}-${colIndex}`}
                            bg={
                              selectedColumns.includes(colIndex)
                                ? selectedRows.includes(rowIndex)
                                  ? "blue.1"
                                  : "gray.0"
                                : undefined
                            }
                          >
                            {isEditing ? (
                              <EditableCell
                                value={editedCsv?.rows[rowIndex]?.[colIndex] || cell}
                                onChange={(value) => handleCellEdit(rowIndex, colIndex, value)}
                              />
                            ) : (
                              <Text size="sm" truncate>
                                {editedCsv?.rows[rowIndex]?.[colIndex] || cell}
                              </Text>
                            )}
                          </Table.Td>
                        ))}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>

              <Group gap="xs">
                <Button size="xs" variant="light" onClick={toggleAllColumns}>
                  全列選択/解除
                </Button>
              </Group>
            </Stack>
          </Paper>
        )}

        {/* レイアウト設定 */}
        {parsedCsv && (
          <CsvLayoutForm initialLayout={layout} onLayoutChange={setLayout} selectedColumns={selectedColumns.length} />
        )}

        {/* スタイル設定 */}
        {parsedCsv && <CsvStyleForm initialStyle={style} onStyleChange={setStyle} />}

        {/* 背景画像アップロード */}
        <Paper p="md" withBorder>
          <BackgroundImageSelector
            value={backgroundFile}
            onChange={setBackgroundFile}
            onFileChange={onBackgroundFileChange}
          />
        </Paper>

        {/* プレビュー表示エリア */}
        {previewUrl && (
          <Paper p="md" withBorder>
            <Stack gap="sm">
              <Title order={4}>プレビュー</Title>
              <Image src={previewUrl} alt="CSV Preview" fit="contain" radius="md" style={{ maxHeight: 400 }} />
            </Stack>
          </Paper>
        )}
      </Stack>
    );
  },
);

CsvContentForm.displayName = "CsvContentForm";
