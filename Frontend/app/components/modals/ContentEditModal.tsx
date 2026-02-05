import { Button, Group, Modal, Stack, TagsInput, TextInput } from "@mantine/core";
import { IconDeviceFloppy } from "@tabler/icons-react";
import { memo, useEffect, useState } from "react";
import { ContentUsageDisplay } from "~/components/content/ContentUsageDisplay";
import { useContent } from "~/hooks/useContent";
import type { ContentIndex, HlsContent } from "~/types/content";

interface ContentEditModalProps {
  opened: boolean;
  onClose: () => void;
  content: ContentIndex;
  onSubmit: (data: { id: string; name: string; tags: string[]; hlsInfo?: HlsContent }) => Promise<void>;
}

export const ContentEditModal = memo(({ opened, onClose, content, onSubmit }: ContentEditModalProps) => {
  const { getContentById } = useContent();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  // HLS専用
  const [hlsUrl, setHlsUrl] = useState("");

  useEffect(() => {
    const loadContent = async () => {
      if (!content?.id) return;

      setName(content.name);
      setTags(content.tags);

      // HLSコンテンツの場合、詳細を取得
      if (content.type === "hls") {
        const fullContent = await getContentById(content.id);
        if (fullContent?.hlsInfo) {
          setHlsUrl(fullContent.hlsInfo.url || "");
        }
      }
    };

    if (opened) {
      loadContent();
    }
  }, [content, opened, getContentById]);

  const handleClose = () => {
    if (loading) return;
    setName("");
    setTags([]);
    setHlsUrl("");
    onClose();
  };

  const handleSubmit = async () => {
    if (!content || !name.trim()) return;

    setLoading(true);
    try {
      const updateData: {
        id: string;
        name: string;
        tags: string[];
        hlsInfo?: HlsContent;
      } = {
        id: content.id,
        name: name.trim(),
        tags,
      };

      // HLSコンテンツの場合、URLを更新
      if (content.type === "hls" && hlsUrl.trim()) {
        updateData.hlsInfo = {
          url: hlsUrl.trim(),
        };
      }

      await onSubmit(updateData);
      handleClose();
    } catch (error) {
      console.error("Content update failed:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!content) return null;

  const isHlsType = content.type === "hls";
  const isFileType = content.type === "video" || content.type === "image";

  return (
    <Modal opened={opened} onClose={handleClose} title="コンテンツを編集" centered size="md">
      <Stack gap="md">
        <TextInput
          label="コンテンツ名"
          placeholder="コンテンツの名前を入力"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          required
        />

        <TagsInput label="タグ" placeholder="タグを入力してEnterキーで追加" value={tags} onChange={setTags} />

        {isHlsType && (
          <TextInput
            label="HLS URL (m3u8)"
            placeholder="https://example.com/stream.m3u8"
            value={hlsUrl}
            onChange={(event) => setHlsUrl(event.currentTarget.value)}
          />
        )}

        {/* コンテンツ使用状況の表示（ファイルコンテンツのみ） */}
        {isFileType && <ContentUsageDisplay contentId={content.id} />}

        <Group justify="flex-end">
          <Button variant="subtle" onClick={handleClose} disabled={loading}>
            キャンセル
          </Button>
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={handleSubmit}
            loading={loading}
            disabled={!name.trim()}
          >
            保存
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
});

ContentEditModal.displayName = "ContentEditModal";
