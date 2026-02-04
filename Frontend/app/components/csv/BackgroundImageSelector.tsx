import {
  Box,
  Button,
  FileInput,
  Grid,
  Group,
  Image,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Text,
  UnstyledButton,
  useMantineColorScheme,
  useMantineTheme,
} from "@mantine/core";
import { IconCheck, IconPhoto, IconUpload } from "@tabler/icons-react";
import { memo, useCallback, useState } from "react";
import { useBackgroundImages } from "~/hooks/useBackgroundImages";

interface BackgroundImageSelectorProps {
  value: File | null;
  onChange: (file: File | null) => void;
  onFileChange?: (file: File | undefined) => void;
}

export const BackgroundImageSelector = memo(({ value, onChange, onFileChange }: BackgroundImageSelectorProps) => {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const { backgroundImages, refresh } = useBackgroundImages();
  const [showGallery, setShowGallery] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  // 既存の画像を選択
  const handleSelectExistingImage = useCallback(
    async (_imagePath: string, fileName: string, imageUrl?: string) => {
      try {
        // OPFSから画像データを取得してFileオブジェクトを作成
        const response = await fetch(imageUrl || "");
        const blob = await response.blob();
        const file = new File([blob], fileName, { type: blob.type });

        onChange(file);
        onFileChange?.(file);
        setSelectedImageUrl(imageUrl || null);
        setShowGallery(false);
      } catch (error) {
        console.error("Failed to select existing image:", error);
      }
    },
    [onChange, onFileChange],
  );

  // 新しい画像をアップロード
  const handleNewImageUpload = useCallback(
    (file: File | null) => {
      onChange(file);
      onFileChange?.(file || undefined);
      setSelectedImageUrl(null);

      // 新しい画像がアップロードされたらギャラリーを更新
      if (file) {
        setTimeout(refresh, 500);
      }
    },
    [onChange, onFileChange, refresh],
  );

  return (
    <>
      <Stack gap="sm">
        <Group justify="space-between">
          <Text size="sm" fw={500}>
            背景画像（オプション）
          </Text>
          {backgroundImages.length > 0 && (
            <Button
              size="xs"
              variant="subtle"
              leftSection={<IconPhoto size={14} />}
              onClick={() => setShowGallery(true)}
            >
              既存の画像から選択
            </Button>
          )}
        </Group>

        <FileInput
          accept="image/jpeg,image/jpg,image/png"
          placeholder="背景画像を選択"
          value={value}
          onChange={handleNewImageUpload}
          leftSection={<IconUpload size={16} />}
          rightSection={
            value && (
              <Button
                size="xs"
                variant="subtle"
                onClick={() => {
                  onChange(null);
                  onFileChange?.(undefined);
                  setSelectedImageUrl(null);
                }}
              >
                クリア
              </Button>
            )
          }
        />

        {(value || selectedImageUrl) && (
          <Box>
            <img
              src={selectedImageUrl || (value ? URL.createObjectURL(value) : "")}
              alt="背景プレビュー"
              style={{ maxWidth: 200, maxHeight: 150, objectFit: "contain" }}
            />
          </Box>
        )}
      </Stack>

      <Modal opened={showGallery} onClose={() => setShowGallery(false)} title="既存の背景画像から選択" size="lg">
        <ScrollArea h={400}>
          <Grid>
            {backgroundImages.map((img) => (
              <Grid.Col key={img.path} span={4}>
                <UnstyledButton
                  onClick={() => handleSelectExistingImage(img.path, img.fileName, img.url)}
                  style={{ width: "100%" }}
                >
                  <Paper
                    p="xs"
                    withBorder
                    style={{
                      borderColor:
                        selectedImageUrl === img.url
                          ? theme.colors.blue[6]
                          : colorScheme === "dark"
                            ? theme.colors.dark[4]
                            : theme.colors.gray[3],
                      borderWidth: selectedImageUrl === img.url ? 2 : 1,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {img.url ? (
                      <Image src={img.url} alt={img.fileName} height={100} fit="cover" radius="sm" />
                    ) : (
                      <Box
                        h={100}
                        style={{
                          backgroundColor: colorScheme === "dark" ? theme.colors.dark[6] : theme.colors.gray[1],
                          borderRadius: theme.radius.sm,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <IconPhoto size={32} color={theme.colors.gray[5]} />
                      </Box>
                    )}
                    {selectedImageUrl === img.url && (
                      <Box
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          backgroundColor: theme.colors.blue[6],
                          borderRadius: "50%",
                          width: 24,
                          height: 24,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <IconCheck size={16} color="white" />
                      </Box>
                    )}
                    <Text size="xs" mt="xs" truncate>
                      {img.fileName}
                    </Text>
                  </Paper>
                </UnstyledButton>
              </Grid.Col>
            ))}
          </Grid>
        </ScrollArea>
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={() => setShowGallery(false)}>
            キャンセル
          </Button>
        </Group>
      </Modal>
    </>
  );
});

BackgroundImageSelector.displayName = "BackgroundImageSelector";
