import type { FileWithPath } from "@mantine/dropzone";
import { useContent } from "~/hooks/useContent";
import { apiClient } from "~/services/apiClient";
import type { HlsContent } from "~/types/content";
import type { Stream } from "~/types/stream";
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
  const { createFileContent, createHlsContent } = useContent();

  const handleFileSubmit = async (files: FileWithPath[], names?: string[]) => {
    for (let i = 0; i < files.length; i++) {
      await createFileContent(files[i], names?.[i]);
    }
    if (onContentAdded) {
      await onContentAdded();
    }
    onClose();
  };

  const handleHlsSubmit = async (data: { name: string; hlsInfo: HlsContent }) => {
    await createHlsContent(data.name, data.hlsInfo);
    if (onContentAdded) {
      await onContentAdded();
    }
    onClose();
  };

  const handleLiveStreamSubmit = async (data: { name: string; description?: string }): Promise<Stream> => {
    const stream = await apiClient.createStream<Stream>(data);
    if (onContentAdded) {
      await onContentAdded();
    }
    // モーダルは閉じずに、OBS接続情報を表示するため返す
    return stream;
  };

  return (
    <ContentAddModal
      opened={opened}
      onClose={onClose}
      onFileSubmit={handleFileSubmit}
      onHlsSubmit={handleHlsSubmit}
      onLiveStreamSubmit={handleLiveStreamSubmit}
    />
  );
};
