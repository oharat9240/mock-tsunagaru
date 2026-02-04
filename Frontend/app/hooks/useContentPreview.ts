import { useCallback, useEffect, useState } from "react";
import { useContent } from "~/hooks/useContent";
import type { ContentIndex } from "~/types/content";

export interface PreviewState {
  loading: boolean;
  previewUrl?: string;
  error?: string;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
  };
}

const extractYouTubeVideoId = (url: string): string | null => {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

export const useContentPreview = (content: ContentIndex) => {
  const [previewState, setPreviewState] = useState<PreviewState>({ loading: false });
  const { getThumbnailUrl } = useContent();

  const generateFilePreview = useCallback(async () => {
    try {
      // 事前生成されたサムネイルを取得
      const thumbnailUrl = await getThumbnailUrl(content.id);

      if (thumbnailUrl) {
        setPreviewState({
          loading: false,
          previewUrl: thumbnailUrl,
          metadata: {}, // メタデータは必要に応じて別途取得
        });
      } else {
        // サムネイルが存在しない場合はプレースホルダー
        throw new Error("サムネイルが見つかりません");
      }
    } catch (_error) {
      // フォールバック: タイプ別プレースホルダー
      const typeLabels = {
        video: "動画",
        image: "画像",
        text: "テキスト",
      };
      const typeColors = {
        video: "#228be6",
        image: "#40c057",
        text: "#fd7e14",
      };

      const label = typeLabels[content.type as keyof typeof typeLabels] || "ファイル";
      const color = typeColors[content.type as keyof typeof typeColors] || "#6c757d";

      setPreviewState({
        loading: false,
        previewUrl:
          "data:image/svg+xml;base64," +
          btoa(`
            <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
              <rect width="100%" height="100%" fill="${color}"/>
              <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-size="14">
                ${label}プレビュー
              </text>
            </svg>
          `),
      });
    }
  }, [content.id, content.type, getThumbnailUrl]);

  const generateYouTubePreview = useCallback(async () => {
    try {
      if (!content.url) {
        throw new Error("YouTube URL が見つかりません");
      }

      // YouTube動画IDを抽出
      const videoId = extractYouTubeVideoId(content.url);
      if (videoId) {
        // YouTubeサムネイルを使用
        setPreviewState({
          loading: false,
          previewUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        });
      } else {
        throw new Error("YouTube動画IDの抽出に失敗");
      }
    } catch (_error) {
      setPreviewState({
        loading: false,
        error: "YouTubeプレビュー生成に失敗",
      });
    }
  }, [content.url]);

  const generateUrlPreview = useCallback(async () => {
    try {
      // URL用のプレースホルダープレビュー
      setPreviewState({
        loading: false,
        previewUrl:
          "data:image/svg+xml;base64," +
          btoa(`
          <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#7950f2"/>
            <text x="50%" y="30%" text-anchor="middle" dy=".3em" fill="white" font-size="12">
              Webページ
            </text>
            <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-size="10">
              ${new URL(content.url || "").hostname}
            </text>
            <text x="50%" y="70%" text-anchor="middle" dy=".3em" fill="white" font-size="8">
              クリックしてアクセス
            </text>
          </svg>
        `),
      });
    } catch (_error) {
      setPreviewState({
        loading: false,
        error: "URLプレビュー生成に失敗",
      });
    }
  }, [content.url]);

  const generatePreview = useCallback(async () => {
    setPreviewState({ loading: true });

    try {
      switch (content.type) {
        case "video":
        case "image":
        case "text":
          await generateFilePreview();
          break;
        case "youtube":
          await generateYouTubePreview();
          break;
        case "url":
          await generateUrlPreview();
          break;
        default:
          setPreviewState({ loading: false, error: "Unknown content type" });
      }
    } catch (error) {
      console.error("Preview generation failed:", error);
      setPreviewState({
        loading: false,
        error: error instanceof Error ? error.message : "プレビュー生成に失敗しました",
      });
    }
  }, [content.type, generateFilePreview, generateYouTubePreview, generateUrlPreview]);

  useEffect(() => {
    generatePreview();
  }, [generatePreview]);

  return previewState;
};
