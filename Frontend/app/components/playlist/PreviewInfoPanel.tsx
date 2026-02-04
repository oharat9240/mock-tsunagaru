import { Box, Group, Progress, Stack, Text, useMantineColorScheme } from "@mantine/core";
import type { RegionProgressInfo } from "./RegionPlayer";

interface PreviewInfoPanelProps {
  progressInfos: RegionProgressInfo[];
  playlistName: string;
}

export function PreviewInfoPanel({ progressInfos, playlistName }: PreviewInfoPanelProps) {
  const { colorScheme } = useMantineColorScheme();

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Box
      w={300}
      p="md"
      style={{
        borderLeft: `1px solid ${colorScheme === "dark" ? "var(--mantine-color-dark-4)" : "var(--mantine-color-gray-3)"}`,
      }}
    >
      <Stack gap="lg">
        {/* プレイリスト情報 */}
        <Box>
          <Text size="lg" fw={600} mb="xs">
            {playlistName}
          </Text>
        </Box>

        {/* リージョン別の詳細情報 */}
        <Stack gap="md">
          <Text size="md" fw={500}>
            リージョン別進行状況
          </Text>

          {progressInfos.map((info, index) => (
            <Box
              key={info.regionId}
              p="sm"
              style={{
                backgroundColor: colorScheme === "dark" ? "var(--mantine-color-dark-6)" : "var(--mantine-color-gray-0)",
                borderRadius: "6px",
                border: `1px solid ${colorScheme === "dark" ? "var(--mantine-color-dark-4)" : "var(--mantine-color-gray-3)"}`,
              }}
            >
              <Group justify="space-between" mb="xs">
                <Text size="sm" fw={500}>
                  リージョン {index + 1}
                </Text>
                <Text size="xs" c="dimmed">
                  {info.currentContentIndex + 1} / {info.totalContents}
                </Text>
              </Group>

              <Text size="sm" mb="xs" truncate>
                {info.currentContentName}
              </Text>

              <Group justify="space-between" mb="xs">
                <Text size="xs" c="dimmed">
                  進行状況
                </Text>
                <Text size="xs" c="dimmed">
                  残り {formatTime(info.remainingTime)}
                </Text>
              </Group>

              <Progress value={info.totalProgress} size="sm" mb="xs" />

              {/* 現在のコンテンツの進行状況 */}
              <Group justify="space-between" mb="4">
                <Text size="xs" c="dimmed">
                  現在のコンテンツ
                </Text>
                <Text size="xs" c="dimmed">
                  {Math.round(info.currentContentProgress)}%
                </Text>
              </Group>
              <Progress value={info.currentContentProgress} size="xs" />
            </Box>
          ))}
        </Stack>

        {/* 統計情報 */}
        <Box
          style={{
            backgroundColor: colorScheme === "dark" ? "var(--mantine-color-dark-6)" : "var(--mantine-color-blue-0)",
            padding: "12px",
            borderRadius: "6px",
            border: `1px solid ${colorScheme === "dark" ? "var(--mantine-color-dark-4)" : "var(--mantine-color-blue-2)"}`,
          }}
        >
          <Text size="sm" fw={500} mb="xs">
            統計情報
          </Text>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              リージョン数
            </Text>
            <Text size="xs">{progressInfos.length}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              総コンテンツ数
            </Text>
            <Text size="xs">{progressInfos.reduce((sum, info) => sum + info.totalContents, 0)}</Text>
          </Group>
        </Box>
      </Stack>
    </Box>
  );
}
