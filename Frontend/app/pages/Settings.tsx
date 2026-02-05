import { Alert, Button, ColorInput, Container, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconInfoCircle, IconPalette, IconRefreshDot } from "@tabler/icons-react";
import { useAtom } from "jotai";
import { AuthGuard } from "~/components";
import { getFormattedBuildDate, getFormattedVersion, getVersionInfo } from "~/config/version";
import { DEFAULT_HEADER_COLOR, headerColorAtom, resetHeaderColorAtom } from "~/states";
import type { Route } from "./+types/Settings";

export const meta = (_args: Route.MetaArgs) => {
  return [{ title: "設定 - Tsunagaru" }, { name: "description", content: "設定ページ" }];
};

const Settings = () => {
  // ヘッダー色のstate
  const [headerColor, setHeaderColor] = useAtom(headerColorAtom);
  const [, resetHeaderColor] = useAtom(resetHeaderColorAtom);

  // バージョン情報
  const versionInfo = getVersionInfo();

  return (
    <AuthGuard>
      <Container size="lg">
        <Stack gap="lg">
          <Title order={1}>設定</Title>

          {/* テーマ設定セクション */}
          <Paper p="md" withBorder>
            <Stack gap="md">
              <Title order={2} size="h3">
                テーマ設定
              </Title>

              <Alert color="blue" icon={<IconPalette size={16} />}>
                <Text size="sm">
                  アプリケーションの外観をカスタマイズできます。 変更は自動的に保存され、リロード後も保持されます。
                </Text>
              </Alert>

              <Stack gap="sm">
                <Group align="end" gap="md">
                  <ColorInput
                    label="ヘッダー色"
                    description="アプリケーションヘッダーの背景色を変更します"
                    value={headerColor}
                    onChange={setHeaderColor}
                    format="hex"
                    swatches={[
                      DEFAULT_HEADER_COLOR,
                      "#0A529C",
                      "#1971C2",
                      "#0C8599",
                      "#087F5B",
                      "#2F9E44",
                      "#66A80F",
                      "#E8590C",
                      "#D9480F",
                    ]}
                    flex={1}
                  />
                  <Button
                    variant="light"
                    leftSection={<IconRefreshDot size={16} />}
                    onClick={() => resetHeaderColor()}
                    disabled={headerColor === DEFAULT_HEADER_COLOR}
                  >
                    デフォルトに戻す
                  </Button>
                </Group>
                <Text size="xs" c="dimmed">
                  デフォルト色: {DEFAULT_HEADER_COLOR}
                </Text>
              </Stack>
            </Stack>
          </Paper>

          {/* バージョン情報セクション */}
          <Paper p="md" withBorder>
            <Stack gap="md">
              <Title order={2} size="h3">
                バージョン情報
              </Title>

              <Alert color="gray" icon={<IconInfoCircle size={16} />}>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>
                      アプリケーション:
                    </Text>
                    <Text size="sm">{getFormattedVersion()}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>
                      ビルド:
                    </Text>
                    <Text size="sm">{getFormattedBuildDate()}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>
                      環境:
                    </Text>
                    <Text size="sm">{versionInfo.environment}</Text>
                  </Group>
                </Stack>
              </Alert>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </AuthGuard>
  );
};

export default Settings;
