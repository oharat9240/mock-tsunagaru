import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Divider,
  Grid,
  Group,
  HoverCard,
  Indicator,
  Paper,
  Progress,
  ScrollArea,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  Timeline,
  Title,
  Tooltip,
  useComputedColorScheme,
  useMantineTheme,
} from "@mantine/core";
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconEdit,
  IconPlayerPlay,
  IconPower,
  IconReload,
  IconTrash,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import type { PlaylistIndex } from "~/types/playlist";
import type { ScheduleIndex } from "~/types/schedule";
import { EVENT_TYPE_LABELS, WEEKDAY_LABELS } from "~/types/schedule";
import classes from "./ScheduleTimelineView.module.css";

interface ScheduleTimelineViewProps {
  schedules: ScheduleIndex[];
  playlists: PlaylistIndex[];
  viewMode: "day" | "week";
  onViewModeChange: (mode: "day" | "week") => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onEdit: (schedule: ScheduleIndex) => void;
  onDelete: (schedule: ScheduleIndex) => void;
  onToggleEnabled: (schedule: ScheduleIndex) => void;
}

export function ScheduleTimelineView({
  schedules,
  playlists,
  viewMode,
  onViewModeChange,
  currentDate,
  onDateChange,
  onEdit,
  onDelete,
  onToggleEnabled,
}: ScheduleTimelineViewProps) {
  const theme = useMantineTheme();
  const computedColorScheme = useComputedColorScheme("light");
  const [currentTime] = useState(new Date());
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();

  // 時間帯・曜日別にスケジュールをグループ化
  const groupedSchedules = useMemo(() => {
    const groups: Record<string, ScheduleIndex[]> = {};

    schedules.forEach((schedule) => {
      const [hour] = schedule.time.split(":").map(Number);
      schedule.weekdays.forEach((weekday) => {
        const key = `${hour}-${weekday}`;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(schedule);
      });
    });

    return groups;
  }, [schedules]);

  // 表示する時間範囲
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // 曜日リスト
  const weekDays = ["月", "火", "水", "木", "金", "土", "日"];
  const weekdayKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  // 週の日付を計算
  const getWeekDates = (baseDate: Date) => {
    const currentDayOfWeek = baseDate.getDay();
    const diff = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek; // 月曜日を週の始まりとする
    const monday = new Date(baseDate);
    monday.setDate(baseDate.getDate() + diff);

    return weekdayKeys.map((_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return date;
    });
  };

  const weekDates = getWeekDates(currentDate);

  // 日付操作関数
  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    if (viewMode === "day") {
      newDate.setDate(currentDate.getDate() + (direction === "next" ? 1 : -1));
    } else {
      newDate.setDate(currentDate.getDate() + (direction === "next" ? 7 : -7));
    }
    onDateChange(newDate);
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  const getEventIcon = (eventType: string, size = 18) => {
    switch (eventType) {
      case "playlist":
        return <IconPlayerPlay size={size} />;
      case "power_on":
      case "power_off":
        return <IconPower size={size} />;
      case "reboot":
        return <IconReload size={size} />;
      default:
        return null;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case "playlist":
        return "blue";
      case "power_on":
        return "green";
      case "power_off":
        return "red";
      case "reboot":
        return "orange";
      default:
        return "gray";
    }
  };

  // 各時間帯の最大イベント数を計算
  const maxEventsPerHour = useMemo(() => {
    const maxEvents: Record<number, number> = {};
    hours.forEach((hour) => {
      let maxCount = 0;
      weekdayKeys.forEach((weekday) => {
        const key = `${hour}-${weekday}`;
        const count = groupedSchedules[key]?.length || 0;
        maxCount = Math.max(maxCount, count);
      });
      maxEvents[hour] = maxCount;
    });
    return maxEvents;
  }, [groupedSchedules, hours]);

  const renderScheduleCard = (schedule: ScheduleIndex) => {
    const playlist =
      schedule.eventType === "playlist" && schedule.playlistId
        ? playlists.find((p) => p.id === schedule.playlistId)
        : null;

    // 表示名を動的に生成
    const displayName =
      schedule.eventType === "playlist" && playlist ? playlist.name : EVENT_TYPE_LABELS[schedule.eventType];

    return (
      <HoverCard key={schedule.id} width={280} shadow="md" position="top">
        <HoverCard.Target>
          <Card
            padding="xs"
            radius="md"
            withBorder
            opacity={schedule.enabled ? 1 : 0.6}
            style={{
              borderColor:
                computedColorScheme === "dark"
                  ? theme.colors[getEventColor(schedule.eventType)][7]
                  : theme.colors[getEventColor(schedule.eventType)][3],
              backgroundColor: schedule.enabled
                ? computedColorScheme === "dark"
                  ? `${theme.colors[getEventColor(schedule.eventType)][9]}20`
                  : theme.colors[getEventColor(schedule.eventType)][0]
                : computedColorScheme === "dark"
                  ? theme.colors.gray[8]
                  : theme.colors.gray[0],
            }}
            className={classes.scheduleCard}
          >
            <Group justify="space-between" wrap="nowrap" gap="xs">
              <Group gap="xs" wrap="nowrap">
                {getEventIcon(schedule.eventType)}
                <Stack gap={0}>
                  <Text size="sm" fw={600} lineClamp={1}>
                    {schedule.time}
                  </Text>
                  <Text size="xs" lineClamp={1}>
                    {displayName}
                  </Text>
                </Stack>
              </Group>
              <Switch
                size="xs"
                checked={schedule.enabled}
                onChange={() => onToggleEnabled(schedule)}
                onClick={(e) => e.stopPropagation()}
              />
            </Group>
          </Card>
        </HoverCard.Target>
        <HoverCard.Dropdown>
          <Stack gap="sm">
            <Group gap="xs">
              <Badge
                size="lg"
                color={getEventColor(schedule.eventType)}
                leftSection={getEventIcon(schedule.eventType)}
                variant="filled"
              >
                {EVENT_TYPE_LABELS[schedule.eventType]}
              </Badge>
            </Group>
            <div>
              <Text size="sm" fw={600}>
                {displayName}
              </Text>
              <Text size="xs" c="dimmed">
                {schedule.time} に実行
              </Text>
            </div>
            {playlist && (
              <div>
                <Text size="xs" c="dimmed">
                  プレイリスト
                </Text>
                <Text size="sm">{playlist.name}</Text>
              </div>
            )}
            <Group gap="xs">
              <Text size="xs" c="dimmed">
                実行曜日:
              </Text>
              <Group gap={4}>
                {schedule.weekdays.map((day) => (
                  <Badge key={day} size="xs" variant="dot">
                    {WEEKDAY_LABELS[day]}
                  </Badge>
                ))}
              </Group>
            </Group>
            <Divider />
            <Group gap="xs" justify="flex-end">
              <Tooltip label="編集">
                <ActionIcon
                  variant="subtle"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(schedule);
                  }}
                >
                  <IconEdit size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="削除">
                <ActionIcon
                  variant="subtle"
                  color="red"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(schedule);
                  }}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Stack>
        </HoverCard.Dropdown>
      </HoverCard>
    );
  };

  if (viewMode === "week") {
    // 基本の高さとイベントごとの追加高さ
    const baseHeight = 80;
    const eventHeight = 70;

    return (
      <Stack gap="lg">
        <Group justify="space-between">
          <Group gap="md">
            <IconCalendar size={28} />
            <Title order={3}>週間スケジュール</Title>
            <Group gap="xs">
              <Button size="xs" variant="light" onClick={goToToday}>
                今週
              </Button>
              <ActionIcon variant="subtle" onClick={() => navigateDate("prev")}>
                <IconChevronLeft size={20} />
              </ActionIcon>
              <Text size="sm" c="dimmed" style={{ minWidth: 180, textAlign: "center" }}>
                {weekDates[0].toLocaleDateString("ja-JP", { month: "long", day: "numeric" })} -{" "}
                {weekDates[6].toLocaleDateString("ja-JP", { month: "long", day: "numeric" })}
              </Text>
              <ActionIcon variant="subtle" onClick={() => navigateDate("next")}>
                <IconChevronRight size={20} />
              </ActionIcon>
            </Group>
          </Group>
          <SegmentedControl
            value={viewMode}
            onChange={(value) => onViewModeChange(value as "day" | "week")}
            data={[
              { label: "1日", value: "day" },
              { label: "1週間", value: "week" },
            ]}
          />
        </Group>

        <Paper shadow="sm" radius="md" p="md" withBorder>
          <ScrollArea style={{ width: "100%" }}>
            <Grid gutter="xs" className={classes.gridContainer}>
              <Grid.Col span={1} className={classes.stickyColumn}>
                <Box style={{ height: 50 }} />
                {hours.map((hour) => {
                  const eventCount = maxEventsPerHour[hour] || 0;
                  const rowHeight = eventCount === 0 ? baseHeight : baseHeight + (eventCount - 1) * eventHeight;
                  return (
                    <Center key={hour} style={{ height: rowHeight }}>
                      <Text size="sm" fw={600} c="dimmed">
                        {hour.toString().padStart(2, "0")}:00
                      </Text>
                    </Center>
                  );
                })}
              </Grid.Col>

              {weekdayKeys.map((weekday, dayIndex) => {
                const date = weekDates[dayIndex];
                const isToday = date.toDateString() === new Date().toDateString();
                return (
                  <Grid.Col key={weekday} span="auto">
                    <Center style={{ height: 50 }}>
                      <Stack gap={2} align="center">
                        <Badge
                          size="lg"
                          variant={isToday ? "filled" : "light"}
                          color={dayIndex === 5 || dayIndex === 6 ? "gray" : "blue"}
                        >
                          {weekDays[dayIndex]}
                        </Badge>
                        <Text size="xs" c={isToday ? "blue" : "dimmed"} fw={isToday ? 600 : 400}>
                          {date.getMonth() + 1}/{date.getDate()}
                        </Text>
                      </Stack>
                    </Center>
                    {hours.map((hour) => {
                      const key = `${hour}-${weekday}`;
                      const isCurrentHour = hour === currentHour;
                      const scheduleItems = groupedSchedules[key] || [];
                      const eventCount = maxEventsPerHour[hour] || 0;
                      const rowHeight = eventCount === 0 ? baseHeight : baseHeight + (eventCount - 1) * eventHeight;

                      return (
                        <Box
                          key={hour}
                          className={`${classes.timeCell} ${isCurrentHour ? classes.currentHourCell : ""}`}
                          p="xs"
                          style={{ height: rowHeight }}
                        >
                          <Stack gap="xs">{scheduleItems.map((schedule) => renderScheduleCard(schedule))}</Stack>
                        </Box>
                      );
                    })}
                  </Grid.Col>
                );
              })}
            </Grid>
          </ScrollArea>
        </Paper>
      </Stack>
    );
  }

  // 1日表示（タイムライン形式）
  const displayWeekday = weekdayKeys[currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1];
  const daySchedules = hours
    .map((hour) => {
      const key = `${hour}-${displayWeekday}`;
      return {
        hour,
        schedules: groupedSchedules[key] || [],
      };
    })
    .filter((item) => item.schedules.length > 0);

  const isToday = currentDate.toDateString() === new Date().toDateString();

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Group gap="md">
          <IconClock size={28} />
          <Title order={3}>{isToday ? "本日" : ""}のスケジュール</Title>
          <Group gap="xs">
            <Button size="xs" variant="light" onClick={goToToday}>
              今日
            </Button>
            <ActionIcon variant="subtle" onClick={() => navigateDate("prev")}>
              <IconChevronLeft size={20} />
            </ActionIcon>
            <Text size="sm" c="dimmed" style={{ minWidth: 140, textAlign: "center" }}>
              {currentDate.toLocaleDateString("ja-JP", {
                year: "numeric",
                month: "long",
                day: "numeric",
                weekday: "long",
              })}
            </Text>
            <ActionIcon variant="subtle" onClick={() => navigateDate("next")}>
              <IconChevronRight size={20} />
            </ActionIcon>
          </Group>
        </Group>
        <SegmentedControl
          value={viewMode}
          onChange={(value) => onViewModeChange(value as "day" | "week")}
          data={[
            { label: "1日", value: "day" },
            { label: "1週間", value: "week" },
          ]}
        />
      </Group>

      <Grid>
        <Grid.Col span={8}>
          <Paper shadow="sm" radius="md" p="lg" withBorder style={{ position: "relative" }}>
            <Timeline active={-1} bulletSize={24} lineWidth={2}>
              {hours.map((hour) => {
                const key = `${hour}-${displayWeekday}`;
                const scheduleItems = groupedSchedules[key] || [];
                const isPastHour = isToday && hour < currentHour;
                const isCurrentHour = isToday && hour === currentHour;

                if (scheduleItems.length === 0 && !isCurrentHour) {
                  return null;
                }

                return (
                  <Timeline.Item
                    key={hour}
                    bullet={
                      isCurrentHour ? (
                        <Indicator processing color="red" size={24}>
                          <IconClock size={16} />
                        </Indicator>
                      ) : (
                        <IconClock size={16} />
                      )
                    }
                    color={isPastHour ? "gray" : "blue"}
                  >
                    <Group justify="space-between" mb="xs">
                      <Text size="lg" fw={600} c={isPastHour ? "dimmed" : undefined}>
                        {hour.toString().padStart(2, "0")}:00
                      </Text>
                      {isCurrentHour && (
                        <Badge color="red" variant="filled">
                          現在
                        </Badge>
                      )}
                    </Group>
                    <Stack gap="sm" mb="xl">
                      {scheduleItems.length > 0 ? (
                        scheduleItems.map((schedule) => renderScheduleCard(schedule))
                      ) : isCurrentHour ? (
                        <Text size="sm" c="dimmed">
                          スケジュールなし
                        </Text>
                      ) : null}
                    </Stack>
                  </Timeline.Item>
                );
              })}
            </Timeline>
          </Paper>
        </Grid.Col>

        <Grid.Col span={4}>
          <Stack gap="md">
            <Paper shadow="sm" radius="md" p="md" withBorder>
              <Stack gap="sm">
                <Text size="sm" fw={600}>
                  {isToday ? "本日" : "選択日"}の概要
                </Text>
                <Group gap="xs">
                  <IconCalendar size={16} />
                  <Text size="sm">
                    {currentDate.toLocaleDateString("ja-JP", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      weekday: "long",
                    })}
                  </Text>
                </Group>
                <Divider />
                <Text size="sm" fw={600}>
                  スケジュール数
                </Text>
                <Text size="xl" fw={700}>
                  {daySchedules.reduce((sum, item) => sum + item.schedules.length, 0)}件
                </Text>
                {isToday && (
                  <>
                    <div>
                      <Progress value={((currentHour + currentMinute / 60) / 24) * 100} size="xl" radius="md" />
                      <Text size="xs" c="dimmed" ta="center" mt={4}>
                        {Math.round(((currentHour + currentMinute / 60) / 24) * 100)}%
                      </Text>
                    </div>
                    <Text size="xs" c="dimmed">
                      本日の進捗
                    </Text>
                  </>
                )}
              </Stack>
            </Paper>

            <Paper shadow="sm" radius="md" p="md" withBorder>
              <Stack gap="sm">
                <Text size="sm" fw={600}>
                  イベントタイプ別
                </Text>
                {Object.entries(EVENT_TYPE_LABELS).map(([type, label]) => {
                  const count = daySchedules.reduce(
                    (sum, item) => sum + item.schedules.filter((s) => s.eventType === type).length,
                    0,
                  );
                  if (count === 0) return null;

                  return (
                    <Group key={type} justify="space-between">
                      <Group gap="xs">
                        {getEventIcon(type, 16)}
                        <Text size="sm">{label}</Text>
                      </Group>
                      <Badge color={getEventColor(type)} variant="filled">
                        {count}
                      </Badge>
                    </Group>
                  );
                })}
              </Stack>
            </Paper>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
