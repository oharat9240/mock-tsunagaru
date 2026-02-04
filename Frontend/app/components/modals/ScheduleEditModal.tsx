import { Button, Group, Modal, MultiSelect, Select, Stack, Switch } from "@mantine/core";
import { TimeInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePlaylist } from "~/hooks/usePlaylist";
import { useSchedule } from "~/hooks/useSchedule";
import type { EventType, ScheduleItem, Weekday } from "~/types/schedule";
import { EVENT_TYPE_LABELS, WEEKDAY_LABELS } from "~/types/schedule";

interface ScheduleEditModalProps {
  opened: boolean;
  onClose: () => void;
  schedule?: ScheduleItem | null;
  onSuccess?: () => void;
}

type FormValues = {
  time: string;
  weekdays: Weekday[];
  eventType: EventType;
  playlistId?: string;
  enabled: boolean;
};

export function ScheduleEditModal({ opened, onClose, schedule, onSuccess }: ScheduleEditModalProps) {
  const { createSchedule, updateSchedule } = useSchedule();
  const { getPlaylistsIndex } = usePlaylist();

  const form = useForm<FormValues>({
    initialValues: {
      time: "00:00",
      weekdays: [] as Weekday[],
      eventType: "playlist",
      playlistId: undefined,
      enabled: true,
    },
    validate: {
      time: (value: string) => {
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        return !timeRegex.test(value) ? "時刻は HH:MM 形式で入力してください" : null;
      },
      weekdays: (value: Weekday[]) => (value.length === 0 ? "少なくとも1つの曜日を選択してください" : null),
      playlistId: (value: string | undefined, values: FormValues) => {
        return values.eventType === "playlist" && !value ? "プレイリストを選択してください" : null;
      },
    },
  });

  // プレイリストの選択肢を取得
  const [playlists, setPlaylists] = useState<Array<{ value: string; label: string }>>([]);

  useEffect(() => {
    const loadPlaylists = async () => {
      try {
        const playlistsIndex = await getPlaylistsIndex();
        setPlaylists(
          playlistsIndex.map((playlist) => ({
            value: playlist.id,
            label: playlist.name,
          })),
        );
      } catch (error) {
        console.error("プレイリストの取得に失敗しました:", error);
      }
    };

    if (opened) {
      loadPlaylists();
    }
  }, [opened, getPlaylistsIndex]);

  // スケジュール情報をフォームに反映
  // biome-ignore lint/correctness/useExhaustiveDependencies: form methods are stable
  useEffect(() => {
    if (schedule) {
      form.setValues({
        time: schedule.time,
        weekdays: schedule.weekdays,
        eventType: schedule.event.type,
        playlistId: schedule.event.type === "playlist" ? schedule.event.playlistId : undefined,
        enabled: schedule.enabled,
      });
    } else {
      form.reset();
    }
  }, [schedule]);

  const handleSubmit = useCallback(
    async (values: FormValues) => {
      try {
        // 名前を自動生成
        let name: string;
        if (values.eventType === "playlist" && values.playlistId) {
          const playlist = playlists.find((p) => p.value === values.playlistId);
          name = playlist ? playlist.label : "プレイリスト";
        } else {
          name = EVENT_TYPE_LABELS[values.eventType];
        }

        const scheduleData = {
          name,
          time: values.time,
          weekdays: values.weekdays,
          event:
            values.eventType === "playlist" && values.playlistId
              ? { type: "playlist" as const, playlistId: values.playlistId }
              : values.eventType === "power_on"
                ? { type: "power_on" as const }
                : values.eventType === "power_off"
                  ? { type: "power_off" as const }
                  : { type: "reboot" as const },
          enabled: values.enabled,
        };

        if (schedule) {
          await updateSchedule(schedule.id, scheduleData);
        } else {
          await createSchedule(scheduleData);
        }

        onSuccess?.();
        onClose();
        form.reset();
      } catch (error) {
        console.error("スケジュールの保存に失敗しました:", error);
      }
    },
    [schedule, createSchedule, updateSchedule, onSuccess, onClose, form, playlists],
  );

  const eventTypeOptions = useMemo(
    () =>
      Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    [],
  );

  const weekdayOptions = useMemo(
    () =>
      Object.entries(WEEKDAY_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    [],
  );

  return (
    <Modal opened={opened} onClose={onClose} title={schedule ? "スケジュールを編集" : "スケジュールを作成"} size="md">
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <TimeInput label="実行時刻" required {...form.getInputProps("time")} />

          <MultiSelect
            label="実行曜日"
            placeholder="曜日を選択"
            data={weekdayOptions}
            required
            searchable
            clearable
            {...form.getInputProps("weekdays")}
          />

          <Select
            label="イベントタイプ"
            placeholder="イベントを選択"
            data={eventTypeOptions}
            required
            {...form.getInputProps("eventType")}
          />

          {form.values.eventType === "playlist" && (
            <Select
              label="プレイリスト"
              placeholder={playlists.length === 0 ? "プレイリストがありません" : "プレイリストを選択"}
              data={playlists}
              required
              searchable
              disabled={playlists.length === 0}
              {...form.getInputProps("playlistId")}
              description={
                playlists.length === 0 ? "プレイリストを作成してから、スケジュールを設定してください" : undefined
              }
            />
          )}

          <Switch label="有効" {...form.getInputProps("enabled", { type: "checkbox" })} />

          <Group justify="flex-end" mt="xl">
            <Button variant="default" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" loading={form.submitting}>
              {schedule ? "更新" : "作成"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
