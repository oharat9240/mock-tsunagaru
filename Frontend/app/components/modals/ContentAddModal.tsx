import {
  Alert,
  Box,
  Button,
  ColorInput,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  useMantineColorScheme,
} from "@mantine/core";
import { Dropzone, type FileWithPath } from "@mantine/dropzone";
import {
  IconAlertCircle,
  IconCloud,
  IconCloudUpload,
  IconDeviceFloppy,
  IconFile,
  IconLink,
  IconPencil,
  IconTableOptions,
  IconX,
} from "@tabler/icons-react";
import { memo, useState } from "react";
import { CsvContentForm } from "~/components/csv/CsvContentForm";
import { LocationSelector } from "~/components/weather/LocationSelector";
import { csvRendererService } from "~/services/csvRenderer";
import {
  ACCEPTED_MIME_TYPES,
  type CsvContent,
  FONT_FAMILIES,
  type TextContent,
  type WeatherContent,
} from "~/types/content";
import { checkIframeEmbeddability, normalizeUrl } from "~/utils/urlValidator";

type ContentMode = "file" | "url" | "text" | "weather" | "csv";

interface ContentAddModalProps {
  opened: boolean;
  onClose: () => void;
  onFileSubmit: (files: FileWithPath[], names?: string[]) => Promise<void>;
  onUrlSubmit: (data: { url: string; name?: string; title?: string; description?: string }) => Promise<void>;
  onTextSubmit: (data: { name: string; textInfo: TextContent }) => Promise<void>;
  onWeatherSubmit?: (data: { name: string; weatherInfo: WeatherContent }) => Promise<void>;
  onCsvSubmit?: (data: {
    name: string;
    csvData: Partial<CsvContent>;
    backgroundFile?: File;
    csvFile?: File;
  }) => Promise<void>;
}

// 定数
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const DEFAULT_FONT_SIZE = 16;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 200;

// 受け入れ可能なMIMEタイプを配列に変換
const getAllAcceptedMimeTypes = () => {
  return [...ACCEPTED_MIME_TYPES.video, ...ACCEPTED_MIME_TYPES.image, ...ACCEPTED_MIME_TYPES.text];
};

export const ContentAddModal = memo(
  ({
    opened,
    onClose,
    onFileSubmit,
    onUrlSubmit,
    onTextSubmit,
    onWeatherSubmit,
    onCsvSubmit,
  }: ContentAddModalProps) => {
    const { colorScheme } = useMantineColorScheme();
    const [mode, setMode] = useState<ContentMode>("file");
    const [loading, setLoading] = useState(false);

    // ファイルアップロード関連の状態
    const [selectedFiles, setSelectedFiles] = useState<FileWithPath[]>([]);
    const [fileNames, setFileNames] = useState<string[]>([]);

    // URL追加関連の状態
    const [url, setUrl] = useState("");
    const [name, setName] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [urlValidationError, setUrlValidationError] = useState<string | null>(null);
    const [isValidatingUrl, setIsValidatingUrl] = useState(false);

    // テキスト関連の状態
    const [textName, setTextName] = useState("");
    const [textContent, setTextContent] = useState("");
    const [writingMode, setWritingMode] = useState<"horizontal" | "vertical">("horizontal");
    const [fontFamily, setFontFamily] = useState("Inter, sans-serif");
    const [textAlign, setTextAlign] = useState<"start" | "center" | "end">("start");
    const [color, setColor] = useState("#000000");
    const [backgroundColor, setBackgroundColor] = useState("#ffffff");
    const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
    const [scrollType, setScrollType] = useState<"none" | "horizontal" | "vertical">("none");
    const [scrollSpeed, setScrollSpeed] = useState(3);

    // 気象情報関連の状態
    const [weatherName, setWeatherName] = useState("");
    const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
    const [weatherType, setWeatherType] = useState<"current" | "weekly">("weekly");

    // CSV関連の状態
    const [csvName, setCsvName] = useState("");
    const [csvData, setCsvData] = useState<Partial<CsvContent>>({});
    const [csvBackgroundFile, setCsvBackgroundFile] = useState<File | undefined>();
    const [csvFile, setCsvFile] = useState<File | undefined>();
    const [csvPreviewUrl, setCsvPreviewUrl] = useState<string | null>(null);

    const handleClose = () => {
      if (loading) return;

      // 状態をリセット
      setMode("file");
      setSelectedFiles([]);
      setFileNames([]);
      setUrl("");
      setName("");
      setTitle("");
      setDescription("");
      setUrlValidationError(null);
      setIsValidatingUrl(false);
      setTextName("");
      setTextContent("");
      setWritingMode("horizontal");
      setFontFamily("Inter, sans-serif");
      setTextAlign("start");
      setColor("#000000");
      setBackgroundColor("#ffffff");
      setFontSize(DEFAULT_FONT_SIZE);
      setScrollType("none");
      setScrollSpeed(3);
      setWeatherName("");
      setSelectedLocations([]);
      setWeatherType("weekly");
      setCsvName("");
      setCsvData({});
      setCsvBackgroundFile(undefined);
      setCsvFile(undefined);
      // プレビューURLをクリーンアップ
      if (csvPreviewUrl) {
        URL.revokeObjectURL(csvPreviewUrl);
        setCsvPreviewUrl(null);
      }

      onClose();
    };

    const handleFileDrop = (files: FileWithPath[]) => {
      setSelectedFiles(files);
      // ファイル名を初期化（オリジナルのファイル名から拡張子を除去）
      const names = files.map((file) => {
        const lastDotIndex = file.name.lastIndexOf(".");
        return lastDotIndex > 0 ? file.name.substring(0, lastDotIndex) : file.name;
      });
      setFileNames(names);
    };

    const handleFileNameChange = (index: number, name: string) => {
      setFileNames((prev) => {
        const newNames = [...prev];
        newNames[index] = name;
        return newNames;
      });
    };

    const handleFileSubmit = async () => {
      if (selectedFiles.length === 0) return;

      setLoading(true);
      try {
        await onFileSubmit(selectedFiles, fileNames);
        handleClose();
      } catch (error) {
        console.error("File upload failed:", error);
      } finally {
        setLoading(false);
      }
    };

    const handleUrlSubmit = async () => {
      if (!url.trim()) return;

      // URLの正規化
      const normalizedUrl = normalizeUrl(url.trim());

      // iframe埋め込み可能性チェック
      setIsValidatingUrl(true);
      setUrlValidationError(null);

      try {
        const { embeddable, reason } = await checkIframeEmbeddability(normalizedUrl);

        if (!embeddable) {
          setUrlValidationError(reason || "このURLはiframeに埋め込めません");
          return;
        }

        setLoading(true);
        await onUrlSubmit({
          url: normalizedUrl,
          name: name.trim() || undefined,
          title: title.trim() || undefined,
          description: description.trim() || undefined,
        });
        handleClose();
      } catch (error) {
        console.error("URL content creation failed:", error);
        setUrlValidationError("URL登録中にエラーが発生しました");
      } finally {
        setLoading(false);
        setIsValidatingUrl(false);
      }
    };

    const handleTextSubmit = async () => {
      if (!textName.trim() || !textContent.trim()) return;

      setLoading(true);
      try {
        await onTextSubmit({
          name: textName.trim(),
          textInfo: {
            content: textContent.trim(),
            writingMode,
            fontFamily,
            textAlign,
            color,
            backgroundColor,
            fontSize,
            scrollType,
            scrollSpeed,
          },
        });
        handleClose();
      } catch (error) {
        console.error("Rich text content creation failed:", error);
      } finally {
        setLoading(false);
      }
    };

    const handleWeatherSubmit = async () => {
      if (!onWeatherSubmit || !weatherName.trim() || selectedLocations.length === 0) return;

      setLoading(true);
      try {
        const weatherInfo: WeatherContent = {
          locations: selectedLocations,
          weatherType,
          apiUrl: "https://jma-proxy.deno.dev",
        };
        await onWeatherSubmit({ name: weatherName.trim(), weatherInfo });
        handleClose();
      } catch (error) {
        console.error("Weather content creation failed:", error);
      } finally {
        setLoading(false);
      }
    };

    const handleCsvSubmit = async () => {
      if (!onCsvSubmit || !csvName.trim() || !csvData.originalCsvData) return;

      setLoading(true);
      try {
        await onCsvSubmit({
          name: csvName.trim(),
          csvData,
          backgroundFile: csvBackgroundFile,
          csvFile,
        });
        handleClose();
      } catch (error) {
        console.error("CSV content creation failed:", error);
      } finally {
        setLoading(false);
      }
    };

    const formatFileSize = (bytes: number): string => {
      if (bytes === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
    };

    const isFileMode = mode === "file";
    const isUrlMode = mode === "url";
    const isTextMode = mode === "text";
    const isWeatherMode = mode === "weather";
    const isCsvMode = mode === "csv";

    const canSubmit = isFileMode
      ? selectedFiles.length > 0
      : isUrlMode
        ? url.trim().length > 0
        : isTextMode
          ? textName.trim().length > 0 && textContent.trim().length > 0
          : isWeatherMode
            ? weatherName.trim().length > 0 && selectedLocations.length > 0
            : csvName.trim().length > 0 && csvData.originalCsvData;

    return (
      <Modal opened={opened} onClose={handleClose} title="コンテンツを追加" centered size={isCsvMode ? "xl" : "lg"}>
        <Stack gap="md">
          {/* モード切り替え */}
          <SegmentedControl
            value={mode}
            onChange={(value) => setMode(value as ContentMode)}
            data={[
              {
                label: (
                  <Group gap="xs" justify="center">
                    <IconCloudUpload size={16} />
                    <Text size="sm">ファイル</Text>
                  </Group>
                ),
                value: "file",
              },
              {
                label: (
                  <Group gap="xs" justify="center">
                    <IconLink size={16} />
                    <Text size="sm">URL</Text>
                  </Group>
                ),
                value: "url",
              },
              {
                label: (
                  <Group gap="xs" justify="center">
                    <IconPencil size={16} />
                    <Text size="sm">テキスト</Text>
                  </Group>
                ),
                value: "text",
              },
              ...(onWeatherSubmit
                ? [
                    {
                      label: (
                        <Group gap="xs" justify="center">
                          <IconCloud size={16} />
                          <Text size="sm">気象情報</Text>
                        </Group>
                      ),
                      value: "weather",
                    },
                  ]
                : []),
              ...(onCsvSubmit
                ? [
                    {
                      label: (
                        <Group gap="xs" justify="center">
                          <IconTableOptions size={16} />
                          <Text size="sm">CSV</Text>
                        </Group>
                      ),
                      value: "csv",
                    },
                  ]
                : []),
            ]}
            fullWidth
          />

          {/* ファイルアップロードモード */}
          {isFileMode &&
            (selectedFiles.length === 0 ? (
              <Dropzone
                onDrop={handleFileDrop}
                accept={getAllAcceptedMimeTypes()}
                maxSize={MAX_FILE_SIZE}
                multiple
                styles={{
                  root: {
                    border: `2px dashed ${colorScheme === "dark" ? "var(--mantine-color-dark-4)" : "var(--mantine-color-gray-4)"}`,
                    borderRadius: "var(--mantine-radius-md)",
                    backgroundColor:
                      colorScheme === "dark" ? "var(--mantine-color-dark-6)" : "var(--mantine-color-gray-0)",
                    transition: "all 0.2s ease",
                    cursor: "pointer",
                    "&:hover": {
                      borderColor: "var(--mantine-color-blue-6)",
                      backgroundColor:
                        colorScheme === "dark" ? "var(--mantine-color-dark-5)" : "var(--mantine-color-blue-0)",
                    },
                    "&[data-accept]": {
                      borderColor: "var(--mantine-color-green-6)",
                      backgroundColor:
                        colorScheme === "dark" ? "var(--mantine-color-dark-5)" : "var(--mantine-color-green-0)",
                    },
                    "&[data-reject]": {
                      borderColor: "var(--mantine-color-red-6)",
                      backgroundColor:
                        colorScheme === "dark" ? "var(--mantine-color-dark-5)" : "var(--mantine-color-red-0)",
                    },
                  },
                }}
              >
                <Group justify="center" gap="xl" mih={220} style={{ pointerEvents: "none" }}>
                  <Dropzone.Accept>
                    <Box c="green.6">
                      <IconCloudUpload size={50} stroke={1.5} />
                    </Box>
                  </Dropzone.Accept>
                  <Dropzone.Reject>
                    <Box c="red.6">
                      <IconX size={50} stroke={1.5} />
                    </Box>
                  </Dropzone.Reject>
                  <Dropzone.Idle>
                    <Box c="blue.6">
                      <IconCloudUpload size={50} stroke={1.5} />
                    </Box>
                  </Dropzone.Idle>

                  <Box>
                    <Text size="xl" inline fw={500} ta="center">
                      ファイルをドラッグ&ドロップするか、クリックして選択
                    </Text>
                    <Text size="sm" c="dimmed" inline mt={7} display="block" ta="center">
                      動画、画像、テキストファイルをアップロードできます（最大500MB）
                    </Text>
                    <Text size="xs" c="dimmed" mt="xs" display="block">
                      対応形式：MP4, AVI, MOV, WMV, PNG, JPG, GIF, TXT, PDF
                    </Text>
                  </Box>
                </Group>
              </Dropzone>
            ) : (
              <Stack gap="sm">
                <Text size="sm" fw={500}>
                  選択されたファイル ({selectedFiles.length}個)
                </Text>
                {selectedFiles.map((file, index) => (
                  <Group key={`${file.name}-${file.size}-${file.lastModified}`} gap="sm" align="flex-start">
                    <IconFile size={20} />
                    <Box style={{ flex: 1 }}>
                      <TextInput
                        label="表示名"
                        value={fileNames[index] || ""}
                        onChange={(event) => handleFileNameChange(index, event.currentTarget.value)}
                        placeholder="ファイルの表示名を入力"
                        size="sm"
                      />
                      <Text size="xs" c="dimmed" mt="xs">
                        {file.name} ({formatFileSize(file.size)})
                      </Text>
                    </Box>
                  </Group>
                ))}
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={() => {
                    setSelectedFiles([]);
                    setFileNames([]);
                  }}
                  aria-label="ファイル選択をクリア"
                >
                  ファイル選択をやり直す
                </Button>
              </Stack>
            ))}

          {/* URL追加モード */}
          {isUrlMode && (
            <Stack gap="md">
              <TextInput
                label="URL *"
                placeholder="https://example.com"
                value={url}
                onChange={(event) => {
                  setUrl(event.currentTarget.value);
                  setUrlValidationError(null);
                }}
                required
                error={urlValidationError}
                aria-required="true"
                aria-label="URL入力"
              />
              {urlValidationError && (
                <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                  {urlValidationError}
                </Alert>
              )}
              <TextInput
                label="表示名"
                placeholder="カスタム表示名（省略可）"
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
                aria-label="表示名入力"
              />
              <TextInput
                label="タイトル"
                placeholder="コンテンツのタイトル（省略可）"
                value={title}
                onChange={(event) => setTitle(event.currentTarget.value)}
              />
              <TextInput
                label="説明"
                placeholder="コンテンツの説明（省略可）"
                value={description}
                onChange={(event) => setDescription(event.currentTarget.value)}
              />
            </Stack>
          )}

          {/* テキストモード */}
          {isTextMode && (
            <Stack gap="md">
              <TextInput
                label="コンテンツ名"
                placeholder="テキストコンテンツの名前を入力してください"
                required
                value={textName}
                onChange={(event) => setTextName(event.currentTarget.value)}
                aria-required="true"
                aria-label="コンテンツ名入力"
              />

              <Textarea
                label="テキストコンテンツ"
                placeholder="表示したいテキストを入力してください"
                required
                minRows={4}
                value={textContent}
                onChange={(event) => setTextContent(event.currentTarget.value)}
                aria-required="true"
                aria-label="テキストコンテンツ入力"
              />

              <Group grow>
                <Select
                  label="書字方向"
                  value={writingMode}
                  onChange={(value) => setWritingMode(value as "horizontal" | "vertical")}
                  data={[
                    { value: "horizontal", label: "横書き" },
                    { value: "vertical", label: "縦書き" },
                  ]}
                  aria-label="書字方向の選択"
                />

                <Select
                  label="整列位置"
                  value={textAlign}
                  onChange={(value) => setTextAlign(value as "start" | "center" | "end")}
                  data={
                    writingMode === "horizontal"
                      ? [
                          { value: "start", label: "左揃え" },
                          { value: "center", label: "中央揃え" },
                          { value: "end", label: "右揃え" },
                        ]
                      : [
                          { value: "start", label: "上揃え" },
                          { value: "center", label: "中央揃え" },
                          { value: "end", label: "下揃え" },
                        ]
                  }
                  aria-label="テキストの整列位置"
                />
              </Group>

              <Group grow>
                <Select
                  label="フォント"
                  value={fontFamily}
                  onChange={(value) => setFontFamily(value || "Inter, sans-serif")}
                  data={FONT_FAMILIES}
                  searchable
                  aria-label="フォントの選択"
                />

                <NumberInput
                  label="フォントサイズ"
                  value={fontSize}
                  onChange={(value) => setFontSize(Number(value) || DEFAULT_FONT_SIZE)}
                  min={MIN_FONT_SIZE}
                  max={MAX_FONT_SIZE}
                  suffix="px"
                />
              </Group>

              <Group grow>
                <ColorInput
                  label="文字色"
                  value={color}
                  onChange={setColor}
                  format="hex"
                  swatches={["#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff"]}
                />

                <ColorInput
                  label="背景色"
                  value={backgroundColor}
                  onChange={setBackgroundColor}
                  format="hex"
                  swatches={["#ffffff", "#000000", "#f5f5f5", "#e5e5e5", "#d4d4d4", "#a3a3a3", "#737373", "#525252"]}
                />
              </Group>

              <Group grow>
                <Select
                  label="スクロール方向"
                  value={scrollType}
                  onChange={(value) => setScrollType(value as "none" | "horizontal" | "vertical")}
                  data={[
                    { value: "none", label: "スクロールなし" },
                    { value: "horizontal", label: "横スクロール" },
                    { value: "vertical", label: "縦スクロール" },
                  ]}
                  aria-label="スクロール方向の選択"
                />

                <NumberInput
                  label="スクロール速度"
                  value={scrollSpeed}
                  onChange={(value) => setScrollSpeed(Number(value) || 3)}
                  min={1}
                  max={10}
                  disabled={scrollType === "none"}
                  description="1: 遅い - 10: 速い"
                />
              </Group>

              {/* プレビュー */}
              <Box>
                <Text size="sm" fw={500} mb="xs">
                  プレビュー
                </Text>
                <Box
                  p="md"
                  style={{
                    backgroundColor,
                    border: `1px solid ${colorScheme === "dark" ? "var(--mantine-color-dark-4)" : "var(--mantine-color-gray-3)"}`,
                    borderRadius: "var(--mantine-radius-sm)",
                    minHeight: "100px",
                    writingMode: writingMode === "vertical" ? "vertical-rl" : "horizontal-tb",
                    textAlign,
                    fontFamily,
                    fontSize: `${fontSize}px`,
                    color,
                    display: "flex",
                    alignItems:
                      writingMode === "horizontal"
                        ? textAlign === "start"
                          ? "flex-start"
                          : textAlign === "center"
                            ? "center"
                            : "flex-end"
                        : "stretch",
                    justifyContent:
                      writingMode === "vertical"
                        ? textAlign === "start"
                          ? "flex-start"
                          : textAlign === "center"
                            ? "center"
                            : "flex-end"
                        : "stretch",
                  }}
                >
                  {textContent || "プレビューテキスト"}
                </Box>
              </Box>
            </Stack>
          )}

          {/* 気象情報モード */}
          {isWeatherMode && (
            <Stack gap="md">
              <TextInput
                label="コンテンツ名"
                placeholder="例: 東京の週間天気予報"
                value={weatherName}
                onChange={(e) => setWeatherName(e.target.value)}
                required
              />

              <Select
                label="表示タイプ"
                placeholder="表示する天気情報のタイプを選択"
                value={weatherType}
                onChange={(value) => setWeatherType(value as "current" | "weekly")}
                data={[
                  { value: "current", label: "現在の天気" },
                  { value: "weekly", label: "週間天気予報" },
                ]}
                required
              />

              <LocationSelector
                selectedLocations={selectedLocations}
                onLocationsChange={setSelectedLocations}
                maxLocations={5}
              />
            </Stack>
          )}

          {/* CSVモード */}
          {isCsvMode && (
            <Stack gap="md">
              <TextInput
                label="コンテンツ名"
                placeholder="例: 月間売上データ"
                value={csvName}
                onChange={(e) => setCsvName(e.target.value)}
                required
              />

              <CsvContentForm
                initialData={csvData}
                onDataChange={setCsvData}
                onBackgroundFileChange={setCsvBackgroundFile}
                onCsvFileChange={setCsvFile}
                previewUrl={csvPreviewUrl}
                onPreviewRequest={async () => {
                  try {
                    // デバッグ: どのデータが使用されているか確認
                    console.log("Preview data:", {
                      hasEditedData: !!csvData.editedCsvData,
                      hasOriginalData: !!csvData.originalCsvData,
                      editedDataLength: csvData.editedCsvData?.length,
                      originalDataLength: csvData.originalCsvData?.length,
                      selectedRows: csvData.selectedRows,
                      selectedColumns: csvData.selectedColumns,
                    });

                    // プレビュー生成（編集されたデータがあればそれを使用）
                    const previewUrl = await csvRendererService.generatePreview({
                      csvData: csvData.editedCsvData || csvData.originalCsvData || "",
                      selectedRows: csvData.selectedRows || [],
                      selectedColumns: csvData.selectedColumns || [],
                      layout: csvData.layout,
                      style: csvData.style,
                      backgroundFile: csvBackgroundFile || undefined,
                      format: csvData.format || "png",
                    });

                    // 古いプレビューURLをクリーンアップ
                    if (csvPreviewUrl) {
                      URL.revokeObjectURL(csvPreviewUrl);
                    }
                    // 新しいプレビューURLを設定
                    setCsvPreviewUrl(previewUrl);
                  } catch (error) {
                    console.error("Preview generation failed:", error);
                  }
                }}
              />
            </Stack>
          )}

          {/* アクションボタン */}
          <Group justify="flex-end">
            <Button variant="subtle" onClick={handleClose} disabled={loading}>
              キャンセル
            </Button>
            <Button
              leftSection={
                isFileMode ? (
                  <IconDeviceFloppy size={16} />
                ) : isUrlMode ? (
                  <IconLink size={16} />
                ) : isTextMode ? (
                  <IconPencil size={16} />
                ) : isWeatherMode ? (
                  <IconCloud size={16} />
                ) : (
                  <IconTableOptions size={16} />
                )
              }
              onClick={
                isFileMode
                  ? handleFileSubmit
                  : isUrlMode
                    ? handleUrlSubmit
                    : isTextMode
                      ? handleTextSubmit
                      : isWeatherMode
                        ? handleWeatherSubmit
                        : handleCsvSubmit
              }
              loading={loading || isValidatingUrl}
              disabled={!canSubmit || !!urlValidationError}
            >
              {isFileMode
                ? "アップロード"
                : isUrlMode
                  ? "URLを追加"
                  : isTextMode
                    ? "テキストを追加"
                    : isWeatherMode
                      ? "気象情報を追加"
                      : "CSVコンテンツを追加"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    );
  },
);

ContentAddModal.displayName = "ContentAddModal";
