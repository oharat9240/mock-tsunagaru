import { useCallback } from "react";
import { apiClient } from "~/services/apiClient";
import type { ContentIndex, ContentItem, HlsContent } from "~/types/content";
import { ContentItemSchema, ContentsIndexSchema, getContentTypeFromMimeType } from "~/types/content";
import { type ContentUsageInfo, checkContentUsage } from "~/utils/contentUsage";
import { logger } from "~/utils/logger";
import { usePlaylist } from "./usePlaylist";

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
   * ブラウザで動画のメタデータを取得
   */
  const getVideoMetadataFromBrowser = useCallback(
    async (file: File): Promise<{ duration: number; width?: number; height?: number } | undefined> => {
      return new Promise((resolve) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
          const metadata = {
            duration: video.duration,
            width: video.videoWidth || undefined,
            height: video.videoHeight || undefined,
          };
          URL.revokeObjectURL(video.src);
          resolve(metadata);
        };
        video.onerror = () => {
          URL.revokeObjectURL(video.src);
          resolve(undefined);
        };
        video.src = URL.createObjectURL(file);
      });
    },
    [],
  );

  /**
   * ファイルをアップロードしてコンテンツを作成
   */
  const createFileContent = useCallback(
    async (file: File, name?: string): Promise<ContentItem> => {
      const now = new Date().toISOString();
      const contentType = getContentTypeFromMimeType(file.type);

      // ファイルをサーバーにアップロード（動画の場合はサムネイルも自動生成される）
      const uploadResult = await apiClient.uploadFile(file);
      const id = uploadResult.id;

      // メタデータを取得（サーバーから取得できなかった場合はブラウザで取得）
      let metadata = uploadResult.metadata;
      if (!metadata && contentType === "video") {
        metadata = await getVideoMetadataFromBrowser(file);
        logger.debug("Content", "Video metadata from browser:", metadata);
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
          thumbnailPath: uploadResult.thumbnailPath, // サムネイルパスを追加
          metadata, // 動画のメタデータ（duration, width, height）
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
   * HLSコンテンツを作成
   */
  const createHlsContent = useCallback(
    async (name: string, hlsInfo: HlsContent): Promise<ContentItem> => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      const newContent: ContentItem = {
        id,
        name,
        type: "hls",
        hlsInfo,
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
          url: validated.hlsInfo?.url,
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
        throw new Error(`HLSコンテンツの作成に失敗しました: ${error}`);
      }
    },
    [getContentsIndex],
  );

  /**
   * コンテンツを更新
   */
  const updateContent = useCallback(
    async (id: string, updateData: Partial<Omit<ContentItem, "id" | "createdAt">>): Promise<ContentItem> => {
      try {
        // 既存データを取得
        const existingData = await apiClient.getContent<ContentItem>(id);
        if (!existingData) {
          throw new Error("コンテンツが見つかりません");
        }

        // Zodでバリデーション
        const existingContent = ContentItemSchema.parse(existingData);

        const updatedContent: ContentItem = {
          ...existingContent,
          ...updateData,
          updatedAt: new Date().toISOString(),
        };

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
                url: validated.hlsInfo?.url,
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
    createHlsContent,
    updateContent,
    deleteContent,
    deleteContentSafely,
    deleteContentForced,
    checkContentUsageStatus,
    getFileUrl,
    downloadContent,
    getDownloadUrl,
  };
};
