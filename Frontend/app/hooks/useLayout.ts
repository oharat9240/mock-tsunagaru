import { useCallback } from "react";
import { usePlaylist } from "~/hooks/usePlaylist";
import { apiClient } from "~/services/apiClient";
import type { LayoutIndex, LayoutItem } from "~/types/layout";
import { LayoutItemSchema, LayoutsIndexSchema } from "~/types/layout";
import { checkLayoutUsage, type LayoutUsageInfo } from "~/utils/layoutUsage";
import { logger } from "~/utils/logger";
import { generateUUID } from "~/utils/uuid";

export const useLayout = () => {
  const { getPlaylistsIndex, getPlaylistById } = usePlaylist();

  /**
   * レイアウト一覧を取得
   */
  const getLayoutsIndex = useCallback(async (): Promise<LayoutIndex[]> => {
    try {
      const indexData = await apiClient.getLayoutsIndex<LayoutIndex>();
      if (!indexData || indexData.length === 0) {
        return [];
      }

      // Zodでバリデーション
      const validated = LayoutsIndexSchema.parse(indexData);
      return validated;
    } catch (error) {
      logger.error("Layout", "レイアウト一覧の取得に失敗しました", error);
      return [];
    }
  }, []);

  /**
   * 個別のレイアウト詳細を取得
   */
  const getLayoutById = useCallback(async (id: string): Promise<LayoutItem | null> => {
    try {
      const layoutData = await apiClient.getLayout<LayoutItem>(id);
      if (!layoutData) {
        return null;
      }

      // 後方互換性のためzIndexを追加
      const layoutWithZIndex = {
        ...layoutData,
        regions:
          layoutData.regions?.map((region, index) => ({
            ...region,
            zIndex: region.zIndex ?? index,
          })) || [],
      };

      // Zodでバリデーション
      const validated = LayoutItemSchema.parse(layoutWithZIndex);
      return validated;
    } catch (error) {
      logger.error("Layout", `レイアウト詳細の取得に失敗しました: ${id}`, error);
      return null;
    }
  }, []);

  /**
   * レイアウトを作成
   */
  const createLayout = useCallback(
    async (layoutData: Omit<LayoutItem, "id" | "createdAt" | "updatedAt">): Promise<LayoutItem> => {
      const id = generateUUID();
      const now = new Date().toISOString();

      const newLayout: LayoutItem = {
        id,
        ...layoutData,
        createdAt: now,
        updatedAt: now,
      };

      // Zodでバリデーション
      const validated = LayoutItemSchema.parse(newLayout);

      try {
        // 個別ファイルに保存
        await apiClient.saveLayout(id, validated);

        // インデックスを更新
        const currentIndex = await getLayoutsIndex();
        const newIndex: LayoutIndex = {
          id: validated.id,
          name: validated.name,
          orientation: validated.orientation,
          regionCount: validated.regions.length,
          createdAt: validated.createdAt,
          updatedAt: validated.updatedAt,
        };

        const updatedIndex = [...currentIndex, newIndex];
        await apiClient.saveLayoutsIndex(updatedIndex);

        return validated;
      } catch (error) {
        // エラーが発生した場合はクリーンアップ
        try {
          await apiClient.deleteLayout(id);
        } catch {
          // クリーンアップエラーは無視
        }
        throw new Error(`レイアウトの作成に失敗しました: ${error}`);
      }
    },
    [getLayoutsIndex],
  );

  /**
   * レイアウトを更新
   */
  const updateLayout = useCallback(
    async (id: string, updateData: Partial<Omit<LayoutItem, "id" | "createdAt">>): Promise<LayoutItem> => {
      try {
        // 既存データを取得
        const existingLayoutData = await apiClient.getLayout<LayoutItem>(id);
        if (!existingLayoutData) {
          throw new Error("レイアウトが見つかりません");
        }

        // 後方互換性のためzIndexを追加
        const layoutWithZIndex = {
          ...existingLayoutData,
          regions:
            existingLayoutData.regions?.map((region, index) => ({
              ...region,
              zIndex: region.zIndex ?? index,
            })) || [],
        };

        const existingLayout = LayoutItemSchema.parse(layoutWithZIndex);

        const updatedLayout: LayoutItem = {
          ...existingLayout,
          ...updateData,
          updatedAt: new Date().toISOString(),
        };

        // Zodでバリデーション
        const validated = LayoutItemSchema.parse(updatedLayout);

        // 個別ファイルを更新
        await apiClient.saveLayout(id, validated);

        // インデックスを更新
        const currentIndex = await getLayoutsIndex();
        const updatedIndex = currentIndex.map((item) =>
          item.id === id
            ? {
                id: validated.id,
                name: validated.name,
                orientation: validated.orientation,
                regionCount: validated.regions.length,
                createdAt: validated.createdAt,
                updatedAt: validated.updatedAt,
              }
            : item,
        );

        await apiClient.saveLayoutsIndex(updatedIndex);

        return validated;
      } catch (error) {
        throw new Error(`レイアウトの更新に失敗しました: ${error}`);
      }
    },
    [getLayoutsIndex],
  );

  /**
   * レイアウトを削除
   */
  const deleteLayout = useCallback(
    async (id: string): Promise<void> => {
      try {
        // 個別ファイルを削除
        await apiClient.deleteLayout(id);

        // インデックスから削除
        const currentIndex = await getLayoutsIndex();
        const updatedIndex = currentIndex.filter((item) => item.id !== id);
        await apiClient.saveLayoutsIndex(updatedIndex);
      } catch (error) {
        throw new Error(`レイアウトの削除に失敗しました: ${error}`);
      }
    },
    [getLayoutsIndex],
  );

  /**
   * レイアウトの使用状況をチェック
   */
  const checkLayoutUsageStatus = useCallback(
    async (layoutId: string): Promise<LayoutUsageInfo> => {
      return await checkLayoutUsage(layoutId, getPlaylistsIndex, getPlaylistById);
    },
    [getPlaylistsIndex, getPlaylistById],
  );

  return {
    getLayoutsIndex,
    getLayoutById,
    createLayout,
    updateLayout,
    deleteLayout,
    checkLayoutUsageStatus,
  };
};
