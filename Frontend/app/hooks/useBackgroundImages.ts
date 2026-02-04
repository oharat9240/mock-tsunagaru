import { useCallback, useEffect, useState } from "react";
import { OPFSManager } from "~/utils/storage/opfs";

export interface BackgroundImage {
  path: string;
  fileName: string;
  url?: string;
}

export const useBackgroundImages = () => {
  const [backgroundImages, setBackgroundImages] = useState<BackgroundImage[]>([]);
  const [loading, setLoading] = useState(false);
  const opfs = OPFSManager.getInstance();

  // 背景画像を収集
  const collectBackgroundImages = useCallback(async (): Promise<BackgroundImage[]> => {
    try {
      const images: BackgroundImage[] = [];

      // contents配下のすべてのディレクトリを探索
      const contentDirs = await opfs.listDirectory("contents");

      for (const dir of contentDirs) {
        if (dir.startsWith("csv-")) {
          // CSVコンテンツのディレクトリ内の背景画像を探す
          try {
            const files = await opfs.listDirectory(`contents/${dir}`);
            for (const file of files) {
              if (file.startsWith("background-")) {
                images.push({
                  path: `contents/${dir}/${file}`,
                  fileName: file.replace("background-", ""),
                });
              }
            }
          } catch {
            // ディレクトリが存在しない場合は無視
          }
        }
      }

      // 重複を除去（同じファイル名の画像は最新のものだけを残す）
      const uniqueImages = images.reduce((acc, img) => {
        const existing = acc.find((i) => i.fileName === img.fileName);
        if (!existing) {
          acc.push(img);
        }
        return acc;
      }, [] as BackgroundImage[]);

      return uniqueImages;
    } catch (error) {
      console.error("Failed to collect background images:", error);
      return [];
    }
  }, [opfs]);

  // 背景画像のURLを生成
  const loadBackgroundImageUrls = useCallback(
    async (images: BackgroundImage[]) => {
      const imagesWithUrls = await Promise.all(
        images.map(async (img) => {
          try {
            const data = await opfs.readFile(img.path);
            const blob = new Blob([data], { type: "image/*" });
            const url = URL.createObjectURL(blob);
            return { ...img, url };
          } catch (error) {
            console.error(`Failed to load image ${img.path}:`, error);
            return img;
          }
        }),
      );
      return imagesWithUrls;
    },
    [opfs],
  );

  // 背景画像一覧を取得
  const loadBackgroundImages = useCallback(async () => {
    setLoading(true);
    try {
      const images = await collectBackgroundImages();
      const imagesWithUrls = await loadBackgroundImageUrls(images);
      setBackgroundImages(imagesWithUrls);
    } finally {
      setLoading(false);
    }
  }, [collectBackgroundImages, loadBackgroundImageUrls]);

  // 初回ロード
  useEffect(() => {
    loadBackgroundImages();
  }, [loadBackgroundImages]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      // コンポーネントアンマウント時にURLを解放
      backgroundImages.forEach((img) => {
        if (img.url) {
          URL.revokeObjectURL(img.url);
        }
      });
    };
  }, [backgroundImages]);

  return {
    backgroundImages,
    loading,
    refresh: loadBackgroundImages,
  };
};
