import {
  Box,
  Button,
  ColorInput,
  Divider,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  TagsInput,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { IconDeviceFloppy } from "@tabler/icons-react";
import { memo, useEffect, useState } from "react";
import { ContentUsageDisplay } from "~/components/content/ContentUsageDisplay";
import { CsvContentForm } from "~/components/csv/CsvContentForm";
import { LocationSelector } from "~/components/weather/LocationSelector";
import { useContent } from "~/hooks/useContent";
import { csvRendererService } from "~/services/csvRenderer";
import {
  type ContentIndex,
  type CsvContent,
  FONT_FAMILIES,
  type TextContent,
  type WeatherContent,
} from "~/types/content";
import { OPFSManager } from "~/utils/storage/opfs";

interface ContentEditModalProps {
  opened: boolean;
  onClose: () => void;
  content: ContentIndex;
  onSubmit: (data: {
    id: string;
    name: string;
    tags: string[];
    textInfo?: TextContent;
    urlInfo?: { title?: string; description?: string };
    weatherInfo?: WeatherContent;
    csvInfo?: Partial<CsvContent> & { regenerateImage?: boolean };
    csvBackgroundFile?: File | null;
    csvFile?: File | null;
  }) => Promise<void>;
}

// 定数
const DEFAULT_FONT_SIZE = 16;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 200;

export const ContentEditModal = memo(({ opened, onClose, content, onSubmit }: ContentEditModalProps) => {
  const { getContentById } = useContent();
  const opfs = OPFSManager.getInstance();
  const [loading, setLoading] = useState(false);

  // 基本情報
  const [name, setName] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  // テキスト関連の状態（type === "text"の場合のみ使用）
  const [textContent, setTextContent] = useState("");
  const [writingMode, setWritingMode] = useState<"horizontal" | "vertical">("horizontal");
  const [fontFamily, setFontFamily] = useState("Inter, sans-serif");
  const [textAlign, setTextAlign] = useState<"start" | "center" | "end">("start");
  const [color, setColor] = useState("#000000");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [scrollType, setScrollType] = useState<"none" | "horizontal" | "vertical">("none");
  const [scrollSpeed, setScrollSpeed] = useState(3);

  // URL情報（type === "url" or "youtube"の場合のみ使用）
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // 気象情報関連の状態（type === "weather"の場合のみ使用）
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [weatherType, setWeatherType] = useState<"current" | "weekly">("weekly");

  // CSV関連の状態（type === "csv"の場合のみ使用）
  const [csvData, setCsvData] = useState<Partial<CsvContent>>({});
  const [csvBackgroundFile, setCsvBackgroundFile] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreviewUrl, setCsvPreviewUrl] = useState<string | null>(null);

  // モーダルが閉じられたときにローディング状態をリセット
  useEffect(() => {
    if (!opened) {
      setLoading(false);
      // プレビューURLをクリーンアップ
      if (csvPreviewUrl) {
        URL.revokeObjectURL(csvPreviewUrl);
        setCsvPreviewUrl(null);
      }
    }
  }, [opened, csvPreviewUrl]);

  // contentが変更されたときに状態を初期化
  useEffect(() => {
    if (!content) return;

    setName(content.name);
    setTags(content.tags);

    // 実際のコンテンツ詳細データを取得して初期化
    const loadContentDetails = async () => {
      try {
        const contentDetail = await getContentById(content.id);

        if (content.type === "text" && contentDetail?.textInfo) {
          const {
            content: textContent,
            writingMode: mode,
            fontFamily: font,
            textAlign: align,
            color: textColor,
            backgroundColor: bgColor,
            fontSize: size,
            scrollType: scroll,
            scrollSpeed: speed,
          } = contentDetail.textInfo;

          setTextContent(textContent);
          setWritingMode(mode);
          setFontFamily(font);
          setTextAlign(align);
          setColor(textColor);
          setBackgroundColor(bgColor);
          setFontSize(size);
          setScrollType(scroll || "none");
          setScrollSpeed(speed || 3);
        } else if (content.type === "text") {
          // フォールバック: テキストのデフォルト値
          setTextContent("");
          setWritingMode("horizontal");
          setFontFamily("Inter, sans-serif");
          setTextAlign("start");
          setColor("#000000");
          setBackgroundColor("#ffffff");
          setFontSize(DEFAULT_FONT_SIZE);
          setScrollType("none");
          setScrollSpeed(3);
        } else if ((content.type === "url" || content.type === "youtube") && contentDetail?.urlInfo) {
          setTitle(contentDetail.urlInfo.title || "");
          setDescription(contentDetail.urlInfo.description || "");
        } else if (content.type === "url" || content.type === "youtube") {
          setTitle("");
          setDescription("");
        } else if (content.type === "weather" && contentDetail?.weatherInfo) {
          setSelectedLocations(contentDetail.weatherInfo.locations);
          setWeatherType(contentDetail.weatherInfo.weatherType);
        } else if (content.type === "weather") {
          setSelectedLocations([]);
          setWeatherType("weekly");
        } else if (content.type === "csv" && contentDetail?.csvInfo) {
          setCsvData(contentDetail.csvInfo);

          // オリジナルCSVファイルを読み込む
          if (contentDetail.csvInfo.originalCsvFilePath && contentDetail.csvInfo.originalCsvFileName) {
            try {
              const csvFileData = await opfs.readFile(contentDetail.csvInfo.originalCsvFilePath);
              const csvBlob = new Blob([csvFileData], { type: "text/csv" });
              const csvFile = new File([csvBlob], contentDetail.csvInfo.originalCsvFileName, { type: "text/csv" });
              setCsvData((prev) => ({ ...prev, originalCsvFile: csvFile }));
            } catch (error) {
              console.error("Failed to load CSV file:", error);
            }
          }

          // 背景画像ファイルを読み込む
          if (contentDetail.csvInfo.backgroundPath && contentDetail.csvInfo.backgroundFileName) {
            try {
              const bgFileData = await opfs.readFile(contentDetail.csvInfo.backgroundPath);
              const bgBlob = new Blob([bgFileData], { type: "image/*" });
              const bgFile = new File([bgBlob], contentDetail.csvInfo.backgroundFileName, { type: "image/*" });
              setCsvBackgroundFile(bgFile);
            } catch (error) {
              console.error("Failed to load background file:", error);
            }
          }
        } else if (content.type === "csv") {
          setCsvData({});
        }
      } catch (error) {
        console.error("Failed to load content details:", error);
        // エラー時はデフォルト値を使用
        if (content.type === "text") {
          setTextContent("");
          setWritingMode("horizontal");
          setFontFamily("Inter, sans-serif");
          setTextAlign("start");
          setColor("#000000");
          setBackgroundColor("#ffffff");
          setFontSize(DEFAULT_FONT_SIZE);
          setScrollType("none");
          setScrollSpeed(3);
        } else if (content.type === "url" || content.type === "youtube") {
          setTitle("");
          setDescription("");
        } else if (content.type === "weather") {
          setSelectedLocations([]);
          setWeatherType("weekly");
        } else if (content.type === "csv") {
          setCsvData({});
        }
      }
    };

    loadContentDetails();
  }, [content, getContentById, opfs]);

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setLoading(true);
    try {
      const tagArray = tags;

      const submitData: Parameters<typeof onSubmit>[0] = {
        id: content.id,
        name: name.trim(),
        tags: tagArray,
      };

      // コンテンツタイプごとの追加データ
      if (content.type === "text") {
        submitData.textInfo = {
          content: textContent.trim(),
          writingMode,
          fontFamily,
          textAlign,
          color,
          backgroundColor,
          fontSize,
          scrollType,
          scrollSpeed,
        };
      } else if (content.type === "url" || content.type === "youtube") {
        submitData.urlInfo = {
          title: title.trim() || undefined,
          description: description.trim() || undefined,
        };
      } else if (content.type === "weather") {
        submitData.weatherInfo = {
          locations: selectedLocations,
          weatherType,
          apiUrl: "https://jma-proxy.deno.dev",
        };
      } else if (content.type === "csv") {
        submitData.csvInfo = {
          ...csvData,
          regenerateImage: true, // 編集時は画像を再生成
        };
        submitData.csvBackgroundFile = csvBackgroundFile;
        submitData.csvFile = csvFile;
      }

      await onSubmit(submitData);
      // onSubmitが成功した場合は、親コンポーネントがモーダルを閉じるのを待つ
      // ローディング状態はモーダルが閉じられるまで維持する
    } catch (error) {
      console.error("Content edit failed:", error);
      // エラー時のみローディング状態を解除
      setLoading(false);
    }
  };

  const canSubmit =
    name.trim().length > 0 &&
    (content.type !== "weather" || selectedLocations.length > 0) &&
    (content.type !== "csv" || (csvData.originalCsvData && csvData.selectedRows && csvData.selectedColumns));

  const isText = content.type === "text";
  const isUrl = content.type === "url" || content.type === "youtube";
  const isWeather = content.type === "weather";
  const isCsv = content.type === "csv";
  const isFileType = content.type === "video" || content.type === "image";

  return (
    <Modal opened={opened} onClose={handleClose} title="コンテンツを編集" centered size={isCsv ? "xl" : "lg"}>
      <Stack gap="md">
        {/* 基本情報 */}
        <TextInput
          label="コンテンツ名 *"
          placeholder="コンテンツの名前を入力してください"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          required
          aria-required="true"
          aria-label="コンテンツ名入力"
        />

        <TagsInput
          label="タグ"
          placeholder="タグを入力してEnterキーで追加"
          value={tags}
          onChange={setTags}
          clearable
          aria-label="タグ入力"
        />

        {/* コンテンツタイプ情報 */}
        <Box>
          <Text size="sm" fw={500} mb="xs">
            コンテンツタイプ: {content.type}
          </Text>
        </Box>

        {/* ファイルタイプの場合 */}
        {isFileType && (
          <Box p="md" bg="#f8f9fa" style={{ borderRadius: "4px" }}>
            <Text size="sm" c="dimmed">
              ファイルコンテンツは名前とタグのみ編集可能です。
              {content.size && ` ファイルサイズ: ${formatFileSize(content.size)}`}
            </Text>
          </Box>
        )}

        {/* URLタイプの場合 */}
        {isUrl && (
          <Stack gap="md">
            <Box p="md" bg="#f8f9fa" style={{ borderRadius: "4px" }}>
              <Text size="sm" fw={500} mb="xs">
                URL情報
              </Text>
              {content.url && (
                <Text size="sm" c="dimmed" style={{ wordBreak: "break-all" }}>
                  URL: {content.url}
                </Text>
              )}
            </Box>

            <TextInput
              label="タイトル"
              placeholder="カスタムタイトル（省略可）"
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
            />

            <TextInput
              label="説明"
              placeholder="説明文（省略可）"
              value={description}
              onChange={(event) => setDescription(event.currentTarget.value)}
            />
          </Stack>
        )}

        {/* 気象情報の場合 */}
        {isWeather && (
          <Stack gap="md">
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

        {/* CSVの場合 */}
        {isCsv && (
          <Stack gap="md">
            <Divider label="CSV設定" />
            <CsvContentForm
              initialData={csvData}
              onDataChange={setCsvData}
              onBackgroundFileChange={(file) => setCsvBackgroundFile(file || null)}
              onCsvFileChange={(file) => setCsvFile(file || null)}
              previewUrl={csvPreviewUrl}
              onPreviewRequest={async () => {
                try {
                  // デバッグ: どのデータが使用されているか確認
                  console.log("Edit Preview data:", {
                    hasEditedData: !!csvData.editedCsvData,
                    hasOriginalData: !!csvData.originalCsvData,
                    editedDataLength: csvData.editedCsvData?.length,
                    originalDataLength: csvData.originalCsvData?.length,
                    selectedRows: csvData.selectedRows,
                    selectedColumns: csvData.selectedColumns,
                  });

                  // 編集モードでは、初期データのoriginalCsvDataも使用する必要がある
                  const csvContent = await getContentById(content.id);
                  const originalData = csvContent?.csvInfo?.originalCsvData || "";

                  // プレビュー生成（編集されたデータがあればそれを使用）
                  const previewUrl = await csvRendererService.generatePreview({
                    csvData: csvData.editedCsvData || csvData.originalCsvData || originalData,
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

        {/* テキストの場合 */}
        {isText && (
          <Stack gap="md">
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
              />
            </Group>

            <Group grow>
              <Select
                label="フォント"
                value={fontFamily}
                onChange={(value) => setFontFamily(value || "Inter, sans-serif")}
                data={FONT_FAMILIES}
                searchable
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
                  border: "1px solid #e5e5e5",
                  borderRadius: "4px",
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

        {/* 使用状況 */}
        <Divider />
        <ContentUsageDisplay contentId={content.id} />

        {/* アクションボタン */}
        <Group justify="flex-end" mt="lg">
          <Button variant="subtle" onClick={handleClose} disabled={loading}>
            キャンセル
          </Button>
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={handleSubmit}
            loading={loading}
            disabled={!canSubmit}
          >
            保存
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
});

ContentEditModal.displayName = "ContentEditModal";

// ヘルパー関数
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
};
