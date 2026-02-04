import { useCallback } from "react";
import { apiClient } from "~/services/apiClient";
import type { ScheduleIndex, ScheduleItem } from "~/types/schedule";
import { ScheduleItemSchema, SchedulesIndexSchema } from "~/types/schedule";
import { logger } from "~/utils/logger";

export const useSchedule = () => {
  /**
   * スケジュール一覧を取得
   */
  const getSchedulesIndex = useCallback(async (): Promise<ScheduleIndex[]> => {
    try {
      const indexData = await apiClient.getSchedulesIndex<ScheduleIndex>();
      if (!indexData || indexData.length === 0) {
        return [];
      }

      // 古い形式のデータの移行処理
      interface MigrationItem {
        weekdays?: string[];
        [key: string]: unknown;
      }

      const migrated = (indexData as unknown[]).map((item) => {
        const migrationItem = item as MigrationItem;
        if (!migrationItem.weekdays) {
          // 古い形式の場合、全曜日に設定
          return {
            ...migrationItem,
            weekdays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
          };
        }
        return migrationItem;
      });

      // Zodでバリデーション
      const validated = SchedulesIndexSchema.parse(migrated);
      return validated;
    } catch (error) {
      logger.error("Schedule", "スケジュール一覧の取得に失敗しました", error);
      return [];
    }
  }, []);

  /**
   * 個別のスケジュール詳細を取得
   */
  const getScheduleById = useCallback(async (id: string): Promise<ScheduleItem | null> => {
    try {
      const scheduleData = await apiClient.getSchedule<ScheduleItem>(id);
      if (!scheduleData) {
        return null;
      }

      // Zodでバリデーション
      const validated = ScheduleItemSchema.parse(scheduleData);
      return validated;
    } catch (error) {
      logger.error("Schedule", `スケジュール詳細の取得に失敗しました: ${id}`, error);
      return null;
    }
  }, []);

  /**
   * スケジュールを作成
   */
  const createSchedule = useCallback(
    async (scheduleData: Omit<ScheduleItem, "id" | "createdAt" | "updatedAt">): Promise<ScheduleItem> => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      const newSchedule: ScheduleItem = {
        id,
        ...scheduleData,
        createdAt: now,
        updatedAt: now,
      };

      // Zodでバリデーション
      const validated = ScheduleItemSchema.parse(newSchedule);

      try {
        // 個別ファイルに保存
        await apiClient.saveSchedule(id, validated);

        // インデックスを更新
        const currentIndex = await getSchedulesIndex();

        const newIndex: ScheduleIndex = {
          id: validated.id,
          name: validated.name,
          time: validated.time,
          weekdays: validated.weekdays,
          eventType: validated.event.type,
          playlistId: validated.event.type === "playlist" ? validated.event.playlistId : undefined,
          enabled: validated.enabled,
          createdAt: validated.createdAt,
          updatedAt: validated.updatedAt,
        };

        const updatedIndex = [...currentIndex, newIndex];
        // 時刻順にソート
        updatedIndex.sort((a, b) => a.time.localeCompare(b.time));

        await apiClient.saveSchedulesIndex(updatedIndex);

        return validated;
      } catch (error) {
        // エラーが発生した場合はクリーンアップ
        try {
          await apiClient.deleteSchedule(id);
        } catch {
          // クリーンアップエラーは無視
        }
        throw new Error(`スケジュールの作成に失敗しました: ${error}`);
      }
    },
    [getSchedulesIndex],
  );

  /**
   * スケジュールを更新
   */
  const updateSchedule = useCallback(
    async (id: string, updateData: Partial<Omit<ScheduleItem, "id" | "createdAt">>): Promise<ScheduleItem> => {
      try {
        // 既存データを取得
        const scheduleData = await apiClient.getSchedule<ScheduleItem>(id);
        if (!scheduleData) {
          throw new Error("スケジュールが見つかりません");
        }

        // Zodでバリデーション
        const existingSchedule = ScheduleItemSchema.parse(scheduleData);

        const updatedSchedule: ScheduleItem = {
          ...existingSchedule,
          ...updateData,
          updatedAt: new Date().toISOString(),
        };

        // Zodでバリデーション
        const validated = ScheduleItemSchema.parse(updatedSchedule);

        // 個別ファイルを更新
        await apiClient.saveSchedule(id, validated);

        // インデックスを更新
        const currentIndex = await getSchedulesIndex();

        const updatedIndex = currentIndex.map((item) =>
          item.id === id
            ? {
                id: validated.id,
                name: validated.name,
                time: validated.time,
                weekdays: validated.weekdays,
                eventType: validated.event.type,
                playlistId: validated.event.type === "playlist" ? validated.event.playlistId : undefined,
                enabled: validated.enabled,
                createdAt: validated.createdAt,
                updatedAt: validated.updatedAt,
              }
            : item,
        );

        // 時刻順にソート
        updatedIndex.sort((a, b) => a.time.localeCompare(b.time));

        await apiClient.saveSchedulesIndex(updatedIndex);

        return validated;
      } catch (error) {
        throw new Error(`スケジュールの更新に失敗しました: ${error}`);
      }
    },
    [getSchedulesIndex],
  );

  /**
   * スケジュールを削除
   */
  const deleteSchedule = useCallback(
    async (id: string): Promise<void> => {
      try {
        // 個別ファイルを削除
        await apiClient.deleteSchedule(id);

        // インデックスから削除
        const currentIndex = await getSchedulesIndex();
        const updatedIndex = currentIndex.filter((item) => item.id !== id);
        await apiClient.saveSchedulesIndex(updatedIndex);
      } catch (error) {
        throw new Error(`スケジュールの削除に失敗しました: ${error}`);
      }
    },
    [getSchedulesIndex],
  );

  /**
   * スケジュールの有効/無効を切り替え
   */
  const toggleScheduleEnabled = useCallback(
    async (id: string): Promise<ScheduleItem> => {
      const schedule = await getScheduleById(id);
      if (!schedule) {
        throw new Error("スケジュールが見つかりません");
      }

      return await updateSchedule(id, { enabled: !schedule.enabled });
    },
    [getScheduleById, updateSchedule],
  );

  return {
    getSchedulesIndex,
    getScheduleById,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    toggleScheduleEnabled,
  };
};
