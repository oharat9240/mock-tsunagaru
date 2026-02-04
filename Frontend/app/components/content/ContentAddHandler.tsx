import type { FileWithPath } from "@mantine/dropzone";
import { useContent } from "~/hooks/useContent";
import type { CsvContent, TextContent, WeatherContent } from "~/types/content";
import { ContentAddModal } from "../modals/ContentAddModal";

interface ContentAddHandlerProps {
  opened: boolean;
  onClose: () => void;
  onContentAdded?: () => void | Promise<void>;
}

/**
 * コンテンツ追加モーダルの共通ハンドラーコンポーネント
 *
 * このコンポーネントは、ContentAddModalとuseContentフックのロジックを統合し、
 * コンテンツ管理ページとプレイリスト編集ページの両方で使用できるようにします。
 */
export const ContentAddHandler = ({ opened, onClose, onContentAdded }: ContentAddHandlerProps) => {
  const { createFileOrTextContent, createUrlContent, createTextContent, createWeatherContent, createCsvContent } =
    useContent();

  const handleFileSubmit = async (files: FileWithPath[], names?: string[]) => {
    for (let i = 0; i < files.length; i++) {
      await createFileOrTextContent(files[i], names?.[i]);
    }
    if (onContentAdded) {
      await onContentAdded();
    }
    onClose();
  };

  const handleUrlSubmit = async (data: { url: string; name?: string; title?: string; description?: string }) => {
    await createUrlContent(data.url, data.name, data.title, data.description);
    if (onContentAdded) {
      await onContentAdded();
    }
    onClose();
  };

  const handleTextSubmit = async (data: { name: string; textInfo: TextContent }) => {
    await createTextContent(data.name, data.textInfo);
    if (onContentAdded) {
      await onContentAdded();
    }
    onClose();
  };

  const handleWeatherSubmit = async (data: { name: string; weatherInfo: WeatherContent }) => {
    await createWeatherContent(data.name, data.weatherInfo);
    if (onContentAdded) {
      await onContentAdded();
    }
    onClose();
  };

  const handleCsvSubmit = async (data: {
    name: string;
    csvData: Partial<CsvContent>;
    backgroundFile?: File;
    csvFile?: File;
  }) => {
    await createCsvContent(data.name, data.csvData, data.backgroundFile, data.csvFile);
    if (onContentAdded) {
      await onContentAdded();
    }
    onClose();
  };

  return (
    <ContentAddModal
      opened={opened}
      onClose={onClose}
      onFileSubmit={handleFileSubmit}
      onUrlSubmit={handleUrlSubmit}
      onTextSubmit={handleTextSubmit}
      onWeatherSubmit={handleWeatherSubmit}
      onCsvSubmit={handleCsvSubmit}
    />
  );
};
