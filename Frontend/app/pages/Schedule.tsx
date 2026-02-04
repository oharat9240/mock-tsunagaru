import { Button, Container, Group, Stack, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { IconPlus } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { ScheduleEditModal } from "~/components/modals/ScheduleEditModal";
import { ScheduleTimelineView } from "~/components/schedule/ScheduleTimelineView";
import { usePlaylist } from "~/hooks/usePlaylist";
import { useSchedule } from "~/hooks/useSchedule";
import type { PlaylistIndex } from "~/types/playlist";
import type { ScheduleIndex, ScheduleItem } from "~/types/schedule";
import { EVENT_TYPE_LABELS } from "~/types/schedule";

export default function SchedulePage() {
  const { getSchedulesIndex, getScheduleById, deleteSchedule, toggleScheduleEnabled } = useSchedule();
  const { getPlaylistsIndex } = usePlaylist();

  const [schedules, setSchedules] = useState<ScheduleIndex[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistIndex[]>([]);
  const [editModalOpened, setEditModalOpened] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null);
  const [viewMode, setViewMode] = useState<"day" | "week">("week");
  const [_isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  // データの読み込み
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [schedulesData, playlistsData] = await Promise.all([getSchedulesIndex(), getPlaylistsIndex()]);
      setSchedules(schedulesData);
      setPlaylists(playlistsData);
    } catch (_error) {
      notifications.show({
        title: "エラー",
        message: "データの読み込みに失敗しました",
        color: "red",
      });
    } finally {
      setIsLoading(false);
    }
  }, [getSchedulesIndex, getPlaylistsIndex]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // スケジュールの新規作成
  const handleCreate = useCallback(() => {
    setEditingSchedule(null);
    setEditModalOpened(true);
  }, []);

  // スケジュールの編集
  const handleEdit = useCallback(
    async (schedule: ScheduleIndex) => {
      try {
        const fullSchedule = await getScheduleById(schedule.id);
        if (fullSchedule) {
          setEditingSchedule(fullSchedule);
          setEditModalOpened(true);
        }
      } catch (_error) {
        notifications.show({
          title: "エラー",
          message: "スケジュールの読み込みに失敗しました",
          color: "red",
        });
      }
    },
    [getScheduleById],
  );

  // スケジュールの削除
  const handleDelete = useCallback(
    (schedule: ScheduleIndex) => {
      // 表示名を動的に生成
      const playlist =
        schedule.eventType === "playlist" && schedule.playlistId
          ? playlists.find((p) => p.id === schedule.playlistId)
          : null;
      const displayName =
        schedule.eventType === "playlist" && playlist ? playlist.name : EVENT_TYPE_LABELS[schedule.eventType];

      modals.openConfirmModal({
        title: "スケジュールの削除",
        children: `「${displayName}」を削除してもよろしいですか？`,
        labels: { confirm: "削除", cancel: "キャンセル" },
        confirmProps: { color: "red" },
        onConfirm: async () => {
          try {
            await deleteSchedule(schedule.id);
            notifications.show({
              title: "成功",
              message: "スケジュールを削除しました",
              color: "green",
            });
            await loadData();
          } catch (_error) {
            notifications.show({
              title: "エラー",
              message: "スケジュールの削除に失敗しました",
              color: "red",
            });
          }
        },
      });
    },
    [deleteSchedule, loadData, playlists],
  );

  // スケジュールの有効/無効切り替え
  const handleToggleEnabled = useCallback(
    async (schedule: ScheduleIndex) => {
      try {
        await toggleScheduleEnabled(schedule.id);
        await loadData();
      } catch (_error) {
        notifications.show({
          title: "エラー",
          message: "スケジュールの更新に失敗しました",
          color: "red",
        });
      }
    },
    [toggleScheduleEnabled, loadData],
  );

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={2}>スケジュール</Title>
          <Button leftSection={<IconPlus size={20} />} onClick={handleCreate}>
            スケジュールを作成
          </Button>
        </Group>

        <ScheduleTimelineView
          schedules={schedules}
          playlists={playlists}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleEnabled={handleToggleEnabled}
        />
      </Stack>

      <ScheduleEditModal
        opened={editModalOpened}
        onClose={() => setEditModalOpened(false)}
        schedule={editingSchedule}
        onSuccess={loadData}
      />
    </Container>
  );
}
