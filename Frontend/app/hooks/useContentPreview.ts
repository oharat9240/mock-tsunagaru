import { useCallback, useEffect, useState } from "react";
import { useContent } from "~/hooks/useContent";
import type { ContentIndex } from "~/types/content";

export interface PreviewState {
  loading: boolean;
  previewUrl?: string;
  error?: string;
}

export const useContentPreview = (content: ContentIndex) => {
  const [previewState, setPreviewState] = useState<PreviewState>({ loading: false });
  const { getFileUrl } = useContent();

  const generateVideoPreview = useCallback(() => {
    // サムネイルがある場合はそれを使用
    if (content.thumbnailPath) {
      const thumbnailUrl = getFileUrl(content.thumbnailPath);
      setPreviewState({
        loading: false,
        previewUrl: thumbnailUrl,
      });
      return;
    }

    // サムネイルがない場合はプレースホルダーを表示
    setPreviewState({
      loading: false,
      previewUrl:
        "data:image/svg+xml;base64," +
        btoa(`
          <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#228be6"/>
            <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-size="14">
              動画プレビュー
            </text>
          </svg>
        `),
    });
  }, [content.thumbnailPath, getFileUrl]);

  const generateImagePreview = useCallback(() => {
    // ContentIndexから直接filePathを使用（APIから返される静的ファイルパス）
    if (content.filePath) {
      const fileUrl = getFileUrl(content.filePath);
      setPreviewState({
        loading: false,
        previewUrl: fileUrl,
      });
    } else {
      // フォールバック: プレースホルダー
      setPreviewState({
        loading: false,
        previewUrl:
          "data:image/svg+xml;base64," +
          btoa(`
            <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
              <rect width="100%" height="100%" fill="#40c057"/>
              <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-size="14">
                画像プレビュー
              </text>
            </svg>
          `),
      });
    }
  }, [content.filePath, getFileUrl]);

  const generateHlsPreview = useCallback(() => {
    // HLS用のプレースホルダープレビュー
    setPreviewState({
      loading: false,
      previewUrl:
        "data:image/svg+xml;base64," +
        btoa(`
          <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#7950f2"/>
            <text x="50%" y="40%" text-anchor="middle" dy=".3em" fill="white" font-size="14">
              HLSストリーム
            </text>
            <text x="50%" y="60%" text-anchor="middle" dy=".3em" fill="white" font-size="10">
              ライブ配信
            </text>
          </svg>
        `),
    });
  }, []);

  const generatePreview = useCallback(() => {
    setPreviewState({ loading: true });

    switch (content.type) {
      case "video":
        generateVideoPreview();
        break;
      case "image":
        generateImagePreview();
        break;
      case "hls":
        generateHlsPreview();
        break;
      default:
        setPreviewState({ loading: false, error: "Unknown content type" });
    }
  }, [content.type, generateVideoPreview, generateImagePreview, generateHlsPreview]);

  useEffect(() => {
    generatePreview();
  }, [generatePreview]);

  return previewState;
};
