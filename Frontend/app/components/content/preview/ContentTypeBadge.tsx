import { Flex } from "@mantine/core";
import { IconBroadcast, IconFile, IconPhoto, IconVideo } from "@tabler/icons-react";
import type { ContentType } from "~/types/content";

interface ContentTypeBadgeProps {
  contentType: ContentType;
}

export const ContentTypeBadge = ({ contentType }: ContentTypeBadgeProps) => {
  const getTypeIcon = (type: ContentType) => {
    const iconProps = { size: 16 };
    switch (type) {
      case "video":
        return <IconVideo {...iconProps} />;
      case "image":
        return <IconPhoto {...iconProps} />;
      case "hls":
        return <IconBroadcast {...iconProps} />;
      default:
        return <IconFile {...iconProps} />;
    }
  };

  const getTypeColor = (type: ContentType) => {
    switch (type) {
      case "video":
        return "blue";
      case "image":
        return "green";
      case "hls":
        return "violet";
      default:
        return "gray";
    }
  };

  return (
    <Flex
      pos="absolute"
      top="4px"
      left="4px"
      bg={`${getTypeColor(contentType)}.6`}
      c="white"
      p="2px 6px"
      style={{ borderRadius: "4px", fontSize: "10px" }}
      align="center"
      gap="4px"
    >
      {getTypeIcon(contentType)}
    </Flex>
  );
};
