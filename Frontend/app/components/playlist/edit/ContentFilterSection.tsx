import { Button, Group, SegmentedControl, Text, TextInput } from "@mantine/core";
import {
  IconBrandYoutube,
  IconFile,
  IconFileText,
  IconLink,
  IconPhoto,
  IconSearch,
  IconVideo,
  IconX,
} from "@tabler/icons-react";
import type { ContentType } from "~/types/content";

interface ContentFilterSectionProps {
  contentSearchQuery: string;
  setContentSearchQuery: (query: string) => void;
  contentTypeFilter: ContentType | "all";
  setContentTypeFilter: (filter: ContentType | "all") => void;
}

export const ContentFilterSection = ({
  contentSearchQuery,
  setContentSearchQuery,
  contentTypeFilter,
  setContentTypeFilter,
}: ContentFilterSectionProps) => {
  return (
    <Group gap="md" mb="md">
      <TextInput
        placeholder="コンテンツを検索..."
        leftSection={<IconSearch size={16} />}
        rightSection={
          contentSearchQuery ? (
            <Button variant="subtle" size="xs" p={0} onClick={() => setContentSearchQuery("")} miw="auto" h="auto">
              <IconX size={14} />
            </Button>
          ) : null
        }
        value={contentSearchQuery}
        onChange={(e) => setContentSearchQuery(e.target.value)}
        flex={1}
        size="sm"
      />

      <SegmentedControl
        value={contentTypeFilter}
        onChange={(value) => setContentTypeFilter(value as ContentType | "all")}
        data={[
          {
            value: "all",
            label: (
              <Group gap={4} align="center" justify="center" miw="60px" wrap="nowrap">
                <IconFile size={14} />
                <Text size="xs">すべて</Text>
              </Group>
            ),
          },
          {
            value: "video",
            label: (
              <Group gap={4} align="center" justify="center" miw="60px" wrap="nowrap">
                <IconVideo size={14} />
                <Text size="xs">動画</Text>
              </Group>
            ),
          },
          {
            value: "image",
            label: (
              <Group gap={4} align="center" justify="center" miw="60px" wrap="nowrap">
                <IconPhoto size={14} />
                <Text size="xs">画像</Text>
              </Group>
            ),
          },
          {
            value: "text",
            label: (
              <Group gap={4} align="center" justify="center" miw="60px" wrap="nowrap">
                <IconFileText size={14} />
                <Text size="xs">テキスト</Text>
              </Group>
            ),
          },
          {
            value: "youtube",
            label: (
              <Group gap={4} align="center" justify="center" miw="60px" wrap="nowrap">
                <IconBrandYoutube size={14} />
                <Text size="xs">YouTube</Text>
              </Group>
            ),
          },
          {
            value: "url",
            label: (
              <Group gap={4} align="center" justify="center" miw="60px" wrap="nowrap">
                <IconLink size={14} />
                <Text size="xs">URL</Text>
              </Group>
            ),
          },
        ]}
        size="xs"
        style={{ fontSize: "11px" }}
      />
    </Group>
  );
};
