import { useCallback } from "react";
import { apiClient } from "~/services/apiClient";
import { csvRendererService } from "~/services/csvRenderer";
import type { ContentIndex, ContentItem, ContentType, CsvContent, TextContent, WeatherContent } from "~/types/content";
import {
  ContentItemSchema,
  ContentsIndexSchema,
  CsvContentSchema,
  getContentTypeFromMimeType,
  isYouTubeUrl,
} from "~/types/content";
import { type ContentUsageInfo, checkContentUsage } from "~/utils/contentUsage";
import { logger } from "~/utils/logger";
import { thumbnailGenerator } from "~/utils/media/thumbnailGenerator";
import { usePlaylist } from "./usePlaylist";

// テキストファイルかどうかを判定する関数
const isTextFile = (file: File): boolean => {
  // MIMEタイプでの判定
  if (file.type.startsWith("text/")) {
    return true;
  }

  // 拡張子での判定
  const textExtensions = [
    ".txt",
    ".md",
    ".markdown",
    ".json",
    ".xml",
    ".csv",
    ".log",
    ".ini",
    ".cfg",
    ".conf",
    ".yml",
    ".yaml",
    ".toml",
  ];

  const fileName = file.name.toLowerCase();
  return textExtensions.some((ext) => fileName.endsWith(ext));
};

// テキストファイルからテキストコンテンツを読み取る関数
const readTextFromFile = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Failed to read text from file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file, "utf-8");
  });
};

// パスからファイル名を抽出
const getFilenameFromPath = (path: string): string => {
  const parts = path.split("/");
  return parts[parts.length - 1];
};

export const useContent = () => {
  const { getPlaylistsIndex, getPlaylistById, updatePlaylist } = usePlaylist();

  /**
   * コンテンツ一覧を取得
   */
  const getContentsIndex = useCallback(async (): Promise<ContentIndex[]> => {
    try {
      const indexData = await apiClient.getContentsIndex<ContentIndex>();
      if (!indexData || indexData.length === 0) {
        return [];
      }

      // Zodでバリデーション
      const validated = ContentsIndexSchema.parse(indexData);
      return validated;
    } catch (error) {
      logger.error("Content", "コンテンツ一覧の取得に失敗しました", error);
      return [];
    }
  }, []);

  /**
   * 個別のコンテンツ詳細を取得
   */
  const getContentById = useCallback(async (id: string): Promise<ContentItem | null> => {
    try {
      const contentData = await apiClient.getContent<ContentItem>(id);
      if (!contentData) {
        return null;
      }

      // Zodでバリデーション
      const validated = ContentItemSchema.parse(contentData);
      return validated;
    } catch (error) {
      logger.error("Content", `コンテンツ詳細の取得に失敗しました: ${id}`, error);
      return null;
    }
  }, []);

  /**
   * ファイルをアップロードしてコンテンツを作成
   */
  const createFileContent = useCallback(
    async (file: File, name?: string): Promise<ContentItem> => {
      const now = new Date().toISOString();
      const contentType = getContentTypeFromMimeType(file.type);

      // ファイルをサーバーにアップロード
      const uploadResult = await apiClient.uploadFile(file);
      const id = uploadResult.id;

      // サムネイル生成
      let thumbnailPath: string | undefined;
      let metadata: { width?: number; height?: number; duration?: number } | undefined;

      try {
        const thumbnailResult = await thumbnailGenerator.generateThumbnail(file, {
          width: 400,
          quality: 0.8,
        });
        metadata = thumbnailResult.metadata;

        // サムネイルをサーバーにアップロード
        const thumbnailUploadResult = await apiClient.uploadThumbnailBase64(id, thumbnailResult.thumbnailData, "image/jpeg");
        thumbnailPath = thumbnailUploadResult.path;
      } catch (error) {
        logger.warn("Content", `Failed to generate thumbnail for ${file.name}`, error);
      }

      const newContent: ContentItem = {
        id,
        name: name || file.name,
        type: contentType,
        fileInfo: {
          originalName: file.name,
          size: file.size,
          mimeType: file.type,
          storagePath: uploadResult.path,
          thumbnailPath,
          metadata,
        },
        tags: [],
        createdAt: now,
        updatedAt: now,
      };

      // Zodでバリデーション
      const validated = ContentItemSchema.parse(newContent);

      try {
        // メタデータを保存
        await apiClient.saveContent(id, validated);

        // インデックスを更新
        const currentIndex = await getContentsIndex();
        const newIndex: ContentIndex = {
          id: validated.id,
          name: validated.name,
          type: validated.type,
          size: validated.fileInfo?.size,
          tags: validated.tags,
          createdAt: validated.createdAt,
          updatedAt: validated.updatedAt,
        };

        const updatedIndex = [...currentIndex, newIndex];
        await apiClient.saveContentsIndex(updatedIndex);

        return validated;
      } catch (error) {
        // エラーが発生した場合はクリーンアップ
        try {
          await apiClient.deleteFile(getFilenameFromPath(uploadResult.path));
          if (thumbnailPath) {
            await apiClient.deleteThumbnail(getFilenameFromPath(thumbnailPath));
          }
          await apiClient.deleteContent(id);
        } catch {
          // クリーンアップエラーは無視
        }
        throw new Error(`ファイルコンテンツの作成に失敗しました: ${error}`);
      }
    },
    [getContentsIndex],
  );

  /**
   * URLコンテンツを作成
   */
  const createUrlContent = useCallback(
    async (url: string, name?: string, title?: string, description?: string): Promise<ContentItem> => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const contentType: ContentType = isYouTubeUrl(url) ? "youtube" : "url";

      const newContent: ContentItem = {
        id,
        name: name || title || url,
        type: contentType,
        urlInfo: {
          url,
          title,
          description,
        },
        tags: [],
        createdAt: now,
        updatedAt: now,
      };

      // Zodでバリデーション
      const validated = ContentItemSchema.parse(newContent);

      try {
        // メタデータを保存
        await apiClient.saveContent(id, validated);

        // インデックスを更新
        const currentIndex = await getContentsIndex();
        const newIndex: ContentIndex = {
          id: validated.id,
          name: validated.name,
          type: validated.type,
          url: validated.urlInfo?.url,
          tags: validated.tags,
          createdAt: validated.createdAt,
          updatedAt: validated.updatedAt,
        };

        const updatedIndex = [...currentIndex, newIndex];
        await apiClient.saveContentsIndex(updatedIndex);

        return validated;
      } catch (error) {
        // エラーが発生した場合はクリーンアップ
        try {
          await apiClient.deleteContent(id);
        } catch {
          // クリーンアップエラーは無視
        }
        throw new Error(`URLコンテンツの作成に失敗しました: ${error}`);
      }
    },
    [getContentsIndex],
  );

  /**
   * テキストコンテンツを作成
   */
  const createTextContent = useCallback(
    async (name: string, textInfo: TextContent): Promise<ContentItem> => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      const newContent: ContentItem = {
        id,
        name,
        type: "text",
        textInfo,
        tags: [],
        createdAt: now,
        updatedAt: now,
      };

      // Zodでバリデーション
      const validated = ContentItemSchema.parse(newContent);

      try {
        // メタデータを保存
        await apiClient.saveContent(id, validated);

        // インデックスを更新
        const currentIndex = await getContentsIndex();
        const newIndex: ContentIndex = {
          id: validated.id,
          name: validated.name,
          type: validated.type,
          tags: validated.tags,
          createdAt: validated.createdAt,
          updatedAt: validated.updatedAt,
        };

        const updatedIndex = [...currentIndex, newIndex];
        await apiClient.saveContentsIndex(updatedIndex);

        return validated;
      } catch (error) {
        // エラーが発生した場合はクリーンアップ
        try {
          await apiClient.deleteContent(id);
        } catch {
          // クリーンアップエラーは無視
        }
        throw new Error(`テキストコンテンツの作成に失敗しました: ${error}`);
      }
    },
    [getContentsIndex],
  );

  /**
   * 気象情報コンテンツを作成
   */
  const createWeatherContent = useCallback(
    async (name: string, weatherInfo: WeatherContent): Promise<ContentItem> => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      const newContent: ContentItem = {
        id,
        name,
        type: "weather",
        weatherInfo,
        tags: [],
        createdAt: now,
        updatedAt: now,
      };

      // Zodでバリデーション
      const validated = ContentItemSchema.parse(newContent);

      try {
        // メタデータを保存
        await apiClient.saveContent(id, validated);

        // インデックスを更新
        const currentIndex = await getContentsIndex();
        const newIndex: ContentIndex = {
          id: validated.id,
          name: validated.name,
          type: validated.type,
          tags: validated.tags,
          createdAt: validated.createdAt,
          updatedAt: validated.updatedAt,
        };

        const updatedIndex = [...currentIndex, newIndex];
        await apiClient.saveContentsIndex(updatedIndex);

        return validated;
      } catch (error) {
        // エラーが発生した場合はクリーンアップ
        try {
          await apiClient.deleteContent(id);
        } catch {
          // クリーンアップエラーは無視
        }
        throw new Error(`気象情報コンテンツの作成に失敗しました: ${error}`);
      }
    },
    [getContentsIndex],
  );

  /**
   * CSVコンテンツを作成
   */
  const createCsvContent = useCallback(
    async (name: string, csvData: Partial<CsvContent>, backgroundFile?: File, csvFile?: File): Promise<ContentItem> => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      try {
        // CSV画像を生成してサーバーにアップロード
        const renderedImageResult = await csvRendererService.generateCsvImageData(csvData, backgroundFile);
        const renderedImagePath = await apiClient.uploadCsvRenderedBase64(
          id,
          renderedImageResult.data,
          csvData.format || "png",
        );

        // オリジナルCSVファイルを保存
        let originalCsvFilePath: string | undefined;
        let originalCsvFileName: string | undefined;
        if (csvFile) {
          originalCsvFileName = csvFile.name;
          originalCsvFilePath = await apiClient.uploadCsvFile(id, csvFile, "original");
        }

        // 背景画像のパスを取得
        let backgroundPath: string | undefined;
        let backgroundFileName: string | undefined;
        if (backgroundFile) {
          backgroundFileName = backgroundFile.name;
          backgroundPath = await apiClient.uploadCsvFile(id, backgroundFile, "background");
        }

        // 必須フィールドの存在確認
        if (!csvData.originalCsvData || !csvData.selectedRows || !csvData.selectedColumns) {
          throw new Error("必須のCSVデータが不足しています");
        }

        const csvInfo: CsvContent = {
          originalCsvData: csvData.originalCsvData,
          originalCsvFilePath,
          originalCsvFileName,
          selectedRows: csvData.selectedRows,
          selectedColumns: csvData.selectedColumns,
          layout: csvData.layout,
          style: csvData.style,
          backgroundPath,
          backgroundFileName,
          format: csvData.format || "png",
          renderedImagePath,
          apiUrl: csvData.apiUrl || "https://csv-renderer.onrender.com",
        };

        const newContent: ContentItem = {
          id,
          name,
          type: "csv",
          csvInfo,
          tags: [],
          createdAt: now,
          updatedAt: now,
        };

        // Zodでバリデーション
        const validated = ContentItemSchema.parse(newContent);

        try {
          // メタデータを保存
          await apiClient.saveContent(id, validated);

          // インデックスを更新
          const currentIndex = await getContentsIndex();
          const newIndex: ContentIndex = {
            id: validated.id,
            name: validated.name,
            type: validated.type,
            tags: validated.tags,
            createdAt: validated.createdAt,
            updatedAt: validated.updatedAt,
          };

          const updatedIndex = [...currentIndex, newIndex];
          await apiClient.saveContentsIndex(updatedIndex);

          return validated;
        } catch (error) {
          // エラーが発生した場合はクリーンアップ
          try {
            await apiClient.deleteContent(id);
            await apiClient.deleteCsvFiles(id);
          } catch {
            // クリーンアップエラーは無視
          }
          throw error;
        }
      } catch (error) {
        throw new Error(`CSVコンテンツの作成に失敗しました: ${error}`);
      }
    },
    [getContentsIndex],
  );

  /**
   * コンテンツを更新
   */
  const updateContent = useCallback(
    async (
      id: string,
      updateData: Partial<Omit<ContentItem, "id" | "createdAt">> & {
        csvBackgroundFile?: File;
        csvFile?: File;
      },
    ): Promise<ContentItem> => {
      try {
        // 既存データを取得
        const existingData = await apiClient.getContent<ContentItem>(id);
        if (!existingData) {
          throw new Error("コンテンツが見つかりません");
        }

        // Zodでバリデーション
        const existingContent = ContentItemSchema.parse(existingData);

        // CSVコンテンツの場合、画像の再生成が必要かチェック
        let csvUpdateData: Partial<CsvContent> | undefined = updateData.csvInfo;
        if (
          existingContent.type === "csv" &&
          updateData.csvInfo &&
          "regenerateImage" in updateData.csvInfo &&
          updateData.csvInfo.regenerateImage
        ) {
          // 新しいCSVファイルがある場合は保存
          if (updateData.csvFile) {
            const csvFileName = updateData.csvFile.name;
            const csvFilePath = await apiClient.uploadCsvFile(id, updateData.csvFile, "original");
            csvUpdateData = {
              ...updateData.csvInfo,
              originalCsvFilePath: csvFilePath,
              originalCsvFileName: csvFileName,
            };
          }

          // 新しい背景画像がある場合は保存
          if (updateData.csvBackgroundFile) {
            const bgFileName = updateData.csvBackgroundFile.name;
            const bgFilePath = await apiClient.uploadCsvFile(id, updateData.csvBackgroundFile, "background");
            csvUpdateData = {
              ...csvUpdateData,
              backgroundPath: bgFilePath,
              backgroundFileName: bgFileName,
            };
          }

          // 画像を再生成
          const mergedCsvContent = { ...existingContent.csvInfo, ...csvUpdateData };
          const validatedCsvContent = CsvContentSchema.parse(mergedCsvContent);
          const renderedImageResult = await csvRendererService.generateCsvImageData(
            validatedCsvContent,
            updateData.csvBackgroundFile,
          );
          const newImagePath = await apiClient.uploadCsvRenderedBase64(
            id,
            renderedImageResult.data,
            validatedCsvContent.format || "png",
          );

          // 再生成フラグを削除し、新しい画像パスを設定
          csvUpdateData = {
            ...csvUpdateData,
            renderedImagePath: newImagePath,
          };
          if (csvUpdateData && "regenerateImage" in csvUpdateData) {
            // biome-ignore lint/correctness/noUnusedVariables: regenerateImage is excluded intentionally
            const { regenerateImage, ...rest } = csvUpdateData;
            csvUpdateData = rest;
          }
        }

        let updatedContent: ContentItem = {
          ...existingContent,
          ...updateData,
          updatedAt: new Date().toISOString(),
        };

        // CSVコンテンツの場合、csvInfoを適切にマージしてバリデーション
        if (csvUpdateData && existingContent.csvInfo) {
          const mergedCsvInfo = { ...existingContent.csvInfo, ...csvUpdateData };
          try {
            updatedContent.csvInfo = CsvContentSchema.parse(mergedCsvInfo);
          } catch (error) {
            throw new Error(`CSVコンテンツのバリデーションに失敗しました: ${error}`);
          }
        }

        // csvBackgroundFileは保存しない
        if ("csvBackgroundFile" in updatedContent) {
          // biome-ignore lint/correctness/noUnusedVariables: csvBackgroundFile is excluded intentionally
          const { csvBackgroundFile, ...rest } = updatedContent;
          updatedContent = rest;
        }

        // Zodでバリデーション
        const validated = ContentItemSchema.parse(updatedContent);

        // メタデータを更新
        await apiClient.saveContent(id, validated);

        // インデックスを更新
        const currentIndex = await getContentsIndex();
        const updatedIndex = currentIndex.map((item) =>
          item.id === id
            ? {
                id: validated.id,
                name: validated.name,
                type: validated.type,
                size: validated.fileInfo?.size,
                url: validated.urlInfo?.url,
                tags: validated.tags,
                createdAt: validated.createdAt,
                updatedAt: validated.updatedAt,
              }
            : item,
        );

        await apiClient.saveContentsIndex(updatedIndex);

        return validated;
      } catch (error) {
        throw new Error(`コンテンツの更新に失敗しました: ${error}`);
      }
    },
    [getContentsIndex],
  );

  /**
   * コンテンツを削除
   */
  const deleteContent = useCallback(
    async (id: string): Promise<void> => {
      try {
        // 既存データを取得してファイルパスを確認
        const existingData = await apiClient.getContent<ContentItem>(id);
        const existingContent = existingData ? ContentItemSchema.parse(existingData) : null;

        // ファイルコンテンツの場合は実ファイルも削除
        if (existingContent?.fileInfo?.storagePath) {
          try {
            await apiClient.deleteFile(getFilenameFromPath(existingContent.fileInfo.storagePath));
          } catch {
            // ファイルが存在しない場合は無視
          }
        }

        // サムネイルファイルも削除
        if (existingContent?.fileInfo?.thumbnailPath) {
          try {
            await apiClient.deleteThumbnail(getFilenameFromPath(existingContent.fileInfo.thumbnailPath));
          } catch {
            // サムネイルファイルが存在しない場合は無視
          }
        }

        // CSVコンテンツの場合はCSVディレクトリを削除
        if (existingContent?.type === "csv") {
          try {
            await apiClient.deleteCsvFiles(id);
          } catch {
            // CSVファイルが存在しない場合は無視
          }
        }

        // メタデータファイルを削除
        await apiClient.deleteContent(id);

        // インデックスから削除
        const currentIndex = await getContentsIndex();
        const updatedIndex = currentIndex.filter((item) => item.id !== id);
        await apiClient.saveContentsIndex(updatedIndex);
      } catch (error) {
        throw new Error(`コンテンツの削除に失敗しました: ${error}`);
      }
    },
    [getContentsIndex],
  );

  /**
   * コンテンツの使用状況をチェック
   */
  const checkContentUsageStatus = useCallback(
    async (contentId: string): Promise<ContentUsageInfo> => {
      return await checkContentUsage(contentId, getPlaylistsIndex, getPlaylistById);
    },
    [getPlaylistsIndex, getPlaylistById],
  );

  /**
   * 使用状況をチェックしてからコンテンツを削除
   * プレイリストで使用中の場合はエラーを投げる
   */
  const deleteContentSafely = useCallback(
    async (id: string): Promise<void> => {
      // 使用状況をチェック
      const usageInfo = await checkContentUsageStatus(id);

      if (usageInfo.isUsed) {
        const playlistNames = usageInfo.playlists.map((p) => p.name).join("、");
        throw new Error(
          `このコンテンツは以下のプレイリストで使用されているため削除できません：${playlistNames}\n\n` +
            "削除するには、まずプレイリストからコンテンツを削除してください。",
        );
      }

      // 使用されていない場合は通常の削除を実行
      await deleteContent(id);
    },
    [checkContentUsageStatus, deleteContent],
  );

  /**
   * プレイリストで使用中でも強制的にコンテンツを削除
   * 使用中のプレイリストからも自動的に削除される
   */
  const deleteContentForced = useCallback(
    async (id: string): Promise<void> => {
      // プレイリストからコンテンツを削除
      const usageInfo = await checkContentUsageStatus(id);

      if (usageInfo.isUsed) {
        // 使用中のプレイリストからコンテンツを削除
        for (const playlistInfo of usageInfo.playlists) {
          try {
            const playlist = await getPlaylistById(playlistInfo.id);
            if (playlist) {
              // コンテンツ割り当てからIDを削除
              const updatedContentAssignments = playlist.contentAssignments.map((assignment) => ({
                ...assignment,
                contentIds: assignment.contentIds.filter((contentId) => contentId !== id),
              }));

              // プレイリストを更新
              await updatePlaylist(playlistInfo.id, {
                ...playlist,
                contentAssignments: updatedContentAssignments,
              });
            }
          } catch (error) {
            console.warn(`Failed to remove content from playlist ${playlistInfo.id}:`, error);
          }
        }
      }

      // コンテンツを削除
      await deleteContent(id);
    },
    [checkContentUsageStatus, deleteContent, getPlaylistById, updatePlaylist],
  );

  /**
   * ファイルコンテンツのURLを取得
   */
  const getFileUrl = useCallback((storagePath: string): string => {
    return apiClient.getFileUrl(storagePath);
  }, []);

  /**
   * ファイルコンテンツのバイナリデータを取得
   */
  const getFileContent = useCallback(async (storagePath: string): Promise<ArrayBuffer> => {
    try {
      const url = apiClient.getFileUrl(storagePath);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`ファイルの取得に失敗しました: ${response.status}`);
      }
      return await response.arrayBuffer();
    } catch (error) {
      throw new Error(`ファイルの読み込みに失敗しました: ${error}`);
    }
  }, []);

  /**
   * サムネイルのURLを取得
   */
  const getThumbnailUrl = useCallback(
    async (contentId: string): Promise<string | null> => {
      try {
        const content = await getContentById(contentId);

        // CSVコンテンツの場合
        if (content?.type === "csv" && content.csvInfo?.renderedImagePath) {
          return apiClient.getFileUrl(content.csvInfo.renderedImagePath);
        }

        // 通常のファイルコンテンツの場合
        if (!content?.fileInfo?.thumbnailPath) {
          return null;
        }

        return apiClient.getFileUrl(content.fileInfo.thumbnailPath);
      } catch (error) {
        logger.warn("Content", `Failed to get thumbnail URL for ${contentId}`, error);
        return null;
      }
    },
    [getContentById],
  );

  /**
   * 全コンテンツのサムネイルを一括再生成
   */
  const regenerateAllThumbnails = useCallback(async (): Promise<{
    total: number;
    success: number;
    failed: string[];
  }> => {
    const results = {
      total: 0,
      success: 0,
      failed: [] as string[],
    };

    try {
      // 全コンテンツを取得
      const allContents = await getContentsIndex();
      results.total = allContents.length;

      for (const contentIndex of allContents) {
        try {
          // 詳細情報を取得
          const content = await getContentById(contentIndex.id);
          if (!content?.fileInfo?.storagePath) {
            // ファイルコンテンツでない場合はスキップ
            continue;
          }

          // 元のファイルを取得
          const fileData = await getFileContent(content.fileInfo.storagePath);
          const file = new File([fileData], content.fileInfo.originalName, {
            type: content.fileInfo.mimeType,
          });

          // サムネイル再生成
          const thumbnailResult = await thumbnailGenerator.generateThumbnail(file, {
            width: 400,
            quality: 0.8,
          });

          // 既存のサムネイルファイルを削除（存在する場合）
          if (content.fileInfo.thumbnailPath) {
            try {
              await apiClient.deleteThumbnail(getFilenameFromPath(content.fileInfo.thumbnailPath));
            } catch {
              // 既存ファイルが存在しない場合は無視
            }
          }

          // 新しいサムネイルをアップロード
          const thumbnailUploadResult = await apiClient.uploadThumbnailBase64(
            content.id,
            thumbnailResult.thumbnailData,
            "image/jpeg",
          );

          // メタデータを更新
          const updatedContent = {
            ...content,
            fileInfo: {
              ...content.fileInfo,
              thumbnailPath: thumbnailUploadResult.path,
              metadata: thumbnailResult.metadata,
            },
            updatedAt: new Date().toISOString(),
          };

          await apiClient.saveContent(content.id, updatedContent);

          results.success++;
        } catch (error) {
          logger.error("Content", `Failed to regenerate thumbnail for ${contentIndex.id}`, error);
          results.failed.push(contentIndex.name);
        }
      }

      return results;
    } catch (error) {
      throw new Error(`サムネイル一括再生成に失敗しました: ${error}`);
    }
  }, [getContentsIndex, getContentById, getFileContent]);

  /**
   * ファイルをアップロードして適切なコンテンツタイプで作成
   * テキストファイルの場合はテキストコンテンツとして、それ以外はファイルコンテンツとして作成
   */
  const createFileOrTextContent = useCallback(
    async (file: File, name?: string): Promise<ContentItem> => {
      if (isTextFile(file)) {
        // テキストファイルの場合はテキストコンテンツとして作成
        try {
          const textContent = await readTextFromFile(file);
          const textInfo: TextContent = {
            content: textContent,
            writingMode: "horizontal",
            fontFamily: "Noto Sans JP",
            textAlign: "start",
            color: "#000000",
            backgroundColor: "#ffffff",
            fontSize: 24,
            scrollType: "none",
            scrollSpeed: 3,
          };

          return await createTextContent(name || file.name.replace(/\.[^/.]+$/, ""), textInfo);
        } catch (error) {
          logger.error("Content", `Failed to read text from file ${file.name}`, error);
          // テキスト読み込みに失敗した場合は通常のファイルコンテンツとして作成
          return await createFileContent(file, name);
        }
      } else {
        // テキストファイル以外は通常のファイルコンテンツとして作成
        return await createFileContent(file, name);
      }
    },
    [createFileContent, createTextContent],
  );

  /**
   * コンテンツのファイルをダウンロード
   */
  const downloadContent = useCallback(async (contentId: string): Promise<void> => {
    try {
      await apiClient.downloadContentFile(contentId);
    } catch (error) {
      throw new Error(`ファイルのダウンロードに失敗しました: ${error}`);
    }
  }, []);

  /**
   * コンテンツのダウンロードURLを取得
   */
  const getDownloadUrl = useCallback((contentId: string): string => {
    return apiClient.getContentDownloadUrl(contentId);
  }, []);

  return {
    getContentsIndex,
    getContentById,
    createFileContent,
    createFileOrTextContent,
    createUrlContent,
    createTextContent,
    createWeatherContent,
    createCsvContent,
    updateContent,
    deleteContent,
    deleteContentSafely,
    deleteContentForced,
    checkContentUsageStatus,
    getFileUrl,
    getFileContent,
    getThumbnailUrl,
    regenerateAllThumbnails,
    downloadContent,
    getDownloadUrl,
  };
};
