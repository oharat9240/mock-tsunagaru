import { Button, Group, SegmentedControl, Text, TextInput } from "@mantine/core";
import {
  IconBrandYoutube,
  IconCloud,
  IconFile,
  IconFileSpreadsheet,
  IconFileText,
  IconLink,
  IconPhoto,
  IconSearch,
  IconTrash,
  IconVideo,
  IconX,
} from "@tabler/icons-react";
import { useAtom } from "jotai";
import { memo } from "react";
import { contentSearchQueryAtom, contentTypeFilterAtom } from "~/states/content";
import type { ContentType } from "~/types/content";

export const ContentFilters = memo(() => {
  const [typeFilter, setTypeFilter] = useAtom(contentTypeFilterAtom);
  const [searchQuery, setSearchQuery] = useAtom(contentSearchQueryAtom);

  const getFilterIcon = (type: ContentType | "all" | "unused") => {
    switch (type) {
      case "all":
        return <IconFile size={14} />;
      case "video":
        return <IconVideo size={14} />;
      case "image":
        return <IconPhoto size={14} />;
      case "text":
        return <IconFileText size={14} />;
      case "youtube":
        return <IconBrandYoutube size={14} />;
      case "url":
        return <IconLink size={14} />;
      case "weather":
        return <IconCloud size={14} />;
      case "csv":
        return <IconFileSpreadsheet size={14} />;
      case "unused":
        return <IconTrash size={14} />;
      default:
        return <IconFile size={14} />;
    }
  };

  const getFilterLabel = (type: ContentType | "all" | "unused") => {
    switch (type) {
      case "all":
        return "すべて";
      case "video":
        return "動画";
      case "image":
        return "画像";
      case "text":
        return "テキスト";
      case "youtube":
        return "YouTube";
      case "url":
        return "URL";
      case "weather":
        return "気象情報";
      case "csv":
        return "CSV";
      case "unused":
        return "未使用";
      default:
        return "すべて";
    }
  };

  const getFilterOption = (type: ContentType | "all" | "unused") => ({
    value: type,
    label: (
      <Group gap={4} align="center" justify="center" miw="80px" wrap="nowrap">
        {getFilterIcon(type)}
        <Text size="xs" style={{ whiteSpace: "nowrap" }}>
          {getFilterLabel(type)}
        </Text>
      </Group>
    ),
  });

  const filterOptions = [
    getFilterOption("all"),
    getFilterOption("video"),
    getFilterOption("image"),
    getFilterOption("text"),
    getFilterOption("youtube"),
    getFilterOption("url"),
    getFilterOption("weather"),
    getFilterOption("csv"),
    getFilterOption("unused"),
  ];

  return (
    <Group gap="md">
      <TextInput
        placeholder="コンテンツを検索..."
        aria-label="コンテンツを検索"
        leftSection={<IconSearch size={16} />}
        rightSection={
          searchQuery ? (
            <Button
              variant="subtle"
              size="xs"
              p={0}
              onClick={() => setSearchQuery("")}
              miw="auto"
              h="auto"
              aria-label="検索をクリア"
            >
              <IconX size={14} />
            </Button>
          ) : null
        }
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        flex={1}
        miw={200}
      />

      <SegmentedControl
        value={typeFilter}
        onChange={(value) => setTypeFilter(value as ContentType | "all" | "unused")}
        data={filterOptions}
        size="sm"
        aria-label="コンテンツタイプフィルター"
        miw="520px"
        fullWidth={false}
        styles={{
          label: { padding: "2px 0px" },
        }}
      />
    </Group>
  );
});

ContentFilters.displayName = "ContentFilters";
