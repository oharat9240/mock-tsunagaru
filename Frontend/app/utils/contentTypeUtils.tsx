import { Badge } from "@mantine/core";
import {
  IconBrandYoutube,
  IconCloud,
  IconFile,
  IconFileText,
  IconLink,
  IconPhoto,
  IconTableOptions,
  IconVideo,
} from "@tabler/icons-react";
import type { ContentType } from "~/types/content";

export const getContentTypeIcon = (type: ContentType) => {
  switch (type) {
    case "video":
      return <IconVideo size={16} />;
    case "image":
      return <IconPhoto size={16} />;
    case "text":
      return <IconFileText size={16} />;
    case "youtube":
      return <IconBrandYoutube size={16} />;
    case "url":
      return <IconLink size={16} />;
    case "weather":
      return <IconCloud size={16} />;
    case "csv":
      return <IconTableOptions size={16} />;
    default:
      return <IconFile size={16} />;
  }
};

export const getContentTypeBadge = (type: ContentType) => {
  const colors: Record<ContentType, string> = {
    video: "blue",
    image: "green",
    text: "orange",
    youtube: "red",
    url: "purple",
    weather: "teal",
    csv: "cyan",
  };

  const labels: Record<ContentType, string> = {
    video: "動画",
    image: "画像",
    text: "テキスト",
    youtube: "YouTube",
    url: "URL",
    weather: "気象情報",
    csv: "CSV",
  };

  return (
    <Badge color={colors[type]} variant="light" leftSection={getContentTypeIcon(type)}>
      {labels[type]}
    </Badge>
  );
};

export const formatFileSize = (bytes?: number): string => {
  if (!bytes) return "";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
};
