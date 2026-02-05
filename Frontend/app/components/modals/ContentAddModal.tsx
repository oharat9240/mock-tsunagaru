import {
  Box,
  Button,
  Group,
  Modal,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  TextInput,
  useMantineColorScheme,
} from "@mantine/core";
import { Dropzone, type FileWithPath } from "@mantine/dropzone";
import { IconBroadcast, IconCloudUpload, IconDeviceFloppy, IconFile, IconLivePhoto, IconX } from "@tabler/icons-react";
import { memo, useState } from "react";
import { ACCEPTED_MIME_TYPES, type HlsContent } from "~/types/content";
import type { Stream } from "~/types/stream";

type ContentMode = "file" | "hls" | "live";

interface ContentAddModalProps {
  opened: boolean;
  onClose: () => void;
  onFileSubmit: (files: FileWithPath[], names?: string[]) => Promise<void>;
  onHlsSubmit: (data: { name: string; hlsInfo: HlsContent }) => Promise<void>;
  onLiveStreamSubmit: (data: { name: string; description?: string }) => Promise<Stream>;
}

// 定数
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

// 受け入れ可能なMIMEタイプを配列に変換
const getAllAcceptedMimeTypes = () => {
  return [...ACCEPTED_MIME_TYPES.video, ...ACCEPTED_MIME_TYPES.image];
};

export const ContentAddModal = memo(
  ({ opened, onClose, onFileSubmit, onHlsSubmit, onLiveStreamSubmit }: ContentAddModalProps) => {
    const { colorScheme } = useMantineColorScheme();
    const [mode, setMode] = useState<ContentMode>("file");
    const [loading, setLoading] = useState(false);

    // ファイルアップロード関連の状態
    const [selectedFiles, setSelectedFiles] = useState<FileWithPath[]>([]);
    const [fileNames, setFileNames] = useState<string[]>([]);

    // HLS関連の状態
    const [hlsName, setHlsName] = useState("");
    const [hlsUrl, setHlsUrl] = useState("");

    // ライブ配信関連の状態
    const [liveName, setLiveName] = useState("");
    const [liveDescription, setLiveDescription] = useState("");
    const [createdStream, setCreatedStream] = useState<Stream | null>(null);

    const handleClose = () => {
      if (loading) return;

      // 状態をリセット
      setMode("file");
      setSelectedFiles([]);
      setFileNames([]);
      setHlsName("");
      setHlsUrl("");
      setLiveName("");
      setLiveDescription("");
      setCreatedStream(null);

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

    const handleHlsSubmit = async () => {
      if (!hlsName.trim() || !hlsUrl.trim()) return;

      setLoading(true);
      try {
        await onHlsSubmit({
          name: hlsName.trim(),
          hlsInfo: {
            url: hlsUrl.trim(),
          },
        });
        handleClose();
      } catch (error) {
        console.error("HLS content creation failed:", error);
      } finally {
        setLoading(false);
      }
    };

    const handleLiveStreamSubmit = async () => {
      if (!liveName.trim()) return;

      setLoading(true);
      try {
        const stream = await onLiveStreamSubmit({
          name: liveName.trim(),
          description: liveDescription.trim() || undefined,
        });
        setCreatedStream(stream);
      } catch (error) {
        console.error("Live stream creation failed:", error);
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
    const isHlsMode = mode === "hls";
    const isLiveMode = mode === "live";

    const canSubmit = isFileMode
      ? selectedFiles.length > 0
      : isHlsMode
        ? hlsName.trim().length > 0 && hlsUrl.trim().length > 0
        : liveName.trim().length > 0;

    return (
      <Modal opened={opened} onClose={handleClose} title="コンテンツを追加" centered size="lg">
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
                    <IconBroadcast size={16} />
                    <Text size="sm">HLSストリーム</Text>
                  </Group>
                ),
                value: "hls",
              },
              {
                label: (
                  <Group gap="xs" justify="center">
                    <IconLivePhoto size={16} />
                    <Text size="sm">ライブ配信</Text>
                  </Group>
                ),
                value: "live",
              },
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
                      動画、画像ファイルをアップロードできます（最大500MB）
                    </Text>
                    <Text size="xs" c="dimmed" mt="xs" display="block">
                      対応形式：MP4, WebM, AVI, MOV, WMV / PNG, JPG, GIF, WebP
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

          {/* HLSモード */}
          {isHlsMode && (
            <Stack gap="md">
              <TextInput
                label="コンテンツ名 *"
                placeholder="HLSストリームの名前を入力"
                value={hlsName}
                onChange={(event) => setHlsName(event.currentTarget.value)}
                required
                aria-required="true"
                aria-label="コンテンツ名入力"
              />
              <TextInput
                label="HLS URL (m3u8) *"
                placeholder="https://example.com/stream.m3u8"
                value={hlsUrl}
                onChange={(event) => setHlsUrl(event.currentTarget.value)}
                required
                aria-required="true"
                aria-label="HLS URL入力"
              />
              <Text size="xs" c="dimmed">
                HLSストリームのマニフェストファイル（.m3u8）のURLを入力してください
              </Text>
            </Stack>
          )}

          {/* ライブ配信モード */}
          {isLiveMode && !createdStream && (
            <Stack gap="md">
              <TextInput
                label="配信名 *"
                placeholder="ライブ配信の名前を入力"
                value={liveName}
                onChange={(event) => setLiveName(event.currentTarget.value)}
                required
                aria-required="true"
                aria-label="配信名入力"
              />
              <Textarea
                label="説明"
                placeholder="配信の説明（任意）"
                value={liveDescription}
                onChange={(event) => setLiveDescription(event.currentTarget.value)}
                rows={3}
              />
              <Text size="xs" c="dimmed">
                ライブ配信を作成すると、OBSなどの配信ソフトで使用するストリームキーが発行されます。
              </Text>
            </Stack>
          )}

          {/* ライブ配信作成完了後の表示 */}
          {isLiveMode && createdStream && (
            <Stack gap="md">
              <Text fw={500} c="green">
                ライブ配信を作成しました
              </Text>
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  OBS接続設定
                </Text>
                <TextInput label="サーバー URL" value={createdStream.rtmpUrl} readOnly />
                <TextInput label="ストリームキー" value={createdStream.streamKey} readOnly />
                <Text size="xs" c="dimmed">
                  これらの情報をOBS Studioの「設定」→「配信」に入力してください。
                </Text>
              </Stack>
            </Stack>
          )}

          {/* アクションボタン */}
          <Group justify="flex-end">
            <Button variant="subtle" onClick={handleClose} disabled={loading}>
              {createdStream ? "閉じる" : "キャンセル"}
            </Button>
            {!createdStream && (
              <Button
                leftSection={
                  isFileMode ? (
                    <IconDeviceFloppy size={16} />
                  ) : isHlsMode ? (
                    <IconBroadcast size={16} />
                  ) : (
                    <IconLivePhoto size={16} />
                  )
                }
                onClick={isFileMode ? handleFileSubmit : isHlsMode ? handleHlsSubmit : handleLiveStreamSubmit}
                loading={loading}
                disabled={!canSubmit}
              >
                {isFileMode ? "アップロード" : isHlsMode ? "HLSストリームを追加" : "ライブ配信を作成"}
              </Button>
            )}
          </Group>
        </Stack>
      </Modal>
    );
  },
);

ContentAddModal.displayName = "ContentAddModal";
