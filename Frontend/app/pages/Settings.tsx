import { Alert, Button, ColorInput, Container, Group, List, Paper, Stack, Text, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  IconDatabaseOff,
  IconExclamationCircle,
  IconInfoCircle,
  IconPalette,
  IconPhoto,
  IconPlus,
  IconRefresh,
  IconRefreshDot,
  IconTrash,
} from "@tabler/icons-react";
import { useAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { AuthGuard } from "~/components";
import { getFormattedBuildDate, getFormattedVersion, getVersionInfo } from "~/config/version";
import { useContent } from "~/hooks/useContent";
import { useTestData } from "~/hooks/useTestData";
import { DEFAULT_HEADER_COLOR, headerColorAtom, resetHeaderColorAtom } from "~/states";
import { logger } from "~/utils/logger";
import { OPFSManager } from "~/utils/storage/opfs";
import type { Route } from "./+types/Settings";

export const meta = (_args: Route.MetaArgs) => {
  return [{ title: "設定 - Tsunagaru" }, { name: "description", content: "設定ページ" }];
};

interface StorageInfo {
  directories: string[];
  files: string[];
  estimatedSize?: number;
}

const Settings = () => {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [creatingTestData, setCreatingTestData] = useState(false);

  const opfs = OPFSManager.getInstance();
  const { regenerateAllThumbnails } = useContent();
  const { createTestData } = useTestData();

  // ヘッダー色のstate
  const [headerColor, setHeaderColor] = useAtom(headerColorAtom);
  const [, resetHeaderColor] = useAtom(resetHeaderColorAtom);

  // バージョン情報
  const versionInfo = getVersionInfo();

  const loadStorageInfo = useCallback(async () => {
    try {
      setLoading(true);
      const info = await opfs.getStorageInfo();
      setStorageInfo(info);
    } catch (error) {
      logger.error("Settings", "Failed to load storage info", error);
      notifications.show({
        title: "エラー",
        message: "ストレージ情報の読み込みに失敗しました",
        color: "red",
        icon: <IconExclamationCircle size={16} />,
      });
    } finally {
      setLoading(false);
    }
  }, [opfs]);

  // ページ読み込み時にストレージ情報を取得
  useEffect(() => {
    loadStorageInfo();
  }, [loadStorageInfo]);

  const formatBytes = (bytes?: number): string => {
    if (!bytes) return "不明";
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
  };

  const handleClearOPFS = () => {
    modals.openConfirmModal({
      title: "OPFS データの完全削除",
      children: (
        <Stack gap="md">
          <Alert color="red" icon={<IconExclamationCircle size={16} />}>
            <Text size="sm" fw={500}>
              この操作は元に戻せません！
            </Text>
          </Alert>
          <Text size="sm">以下のデータがすべて削除されます：</Text>
          <List size="sm">
            <List.Item>すべてのプレイリスト</List.Item>
            <List.Item>すべてのレイアウト</List.Item>
            <List.Item>すべてのコンテンツファイル</List.Item>
            <List.Item>アプリケーションの設定</List.Item>
          </List>
          <Text size="sm" c="dimmed">
            現在の使用量: {formatBytes(storageInfo?.estimatedSize)} ({storageInfo?.files.length || 0} ファイル)
          </Text>
        </Stack>
      ),
      labels: { confirm: "すべて削除", cancel: "キャンセル" },
      confirmProps: { color: "red", leftSection: <IconTrash size={16} /> },
      onConfirm: performClearOPFS,
    });
  };

  const performClearOPFS = async () => {
    try {
      setClearing(true);

      await opfs.clearAll();

      notifications.show({
        title: "削除完了",
        message: "OPFSデータをすべて削除しました",
        color: "green",
        icon: <IconDatabaseOff size={16} />,
      });

      // ストレージ情報を再読み込み
      await loadStorageInfo();
    } catch (error) {
      logger.error("Settings", "Failed to clear OPFS", error);
      notifications.show({
        title: "削除失敗",
        message: "データの削除中にエラーが発生しました",
        color: "red",
        icon: <IconExclamationCircle size={16} />,
      });
    } finally {
      setClearing(false);
    }
  };

  const handleRegenerateThumbnails = () => {
    modals.openConfirmModal({
      title: "サムネイル一括再生成",
      children: (
        <Stack gap="md">
          <Alert color="blue" icon={<IconPhoto size={16} />}>
            <Text size="sm" fw={500}>
              すべてのコンテンツのサムネイルを再生成します
            </Text>
          </Alert>
          <Text size="sm">
            この操作により、既存のサムネイル画像がすべて最新の設定で再生成されます。
            アスペクト比の修正が適用され、動画のオリジナルアスペクト比が保持されます。
          </Text>
          <Text size="sm" c="dimmed">
            処理時間はコンテンツ数に応じて数分かかる場合があります。
          </Text>
        </Stack>
      ),
      labels: { confirm: "再生成を開始", cancel: "キャンセル" },
      confirmProps: { color: "blue", leftSection: <IconRefresh size={16} /> },
      onConfirm: performRegenerateThumbnails,
    });
  };

  const performRegenerateThumbnails = async () => {
    try {
      setRegenerating(true);

      const results = await regenerateAllThumbnails();

      if (results.failed.length > 0) {
        notifications.show({
          title: "一部のサムネイル再生成に失敗",
          message: `${results.success}/${results.total} 件が成功しました。失敗: ${results.failed.join(", ")}`,
          color: "yellow",
          icon: <IconExclamationCircle size={16} />,
          autoClose: 10000,
        });
      } else {
        notifications.show({
          title: "サムネイル再生成完了",
          message: `${results.success} 件のサムネイルを再生成しました`,
          color: "green",
          icon: <IconPhoto size={16} />,
        });
      }

      // ストレージ情報を再読み込み
      await loadStorageInfo();
    } catch (error) {
      logger.error("Settings", "Failed to regenerate thumbnails", error);
      notifications.show({
        title: "サムネイル再生成失敗",
        message: "サムネイルの再生成中にエラーが発生しました",
        color: "red",
        icon: <IconExclamationCircle size={16} />,
      });
    } finally {
      setRegenerating(false);
    }
  };

  const handleCreateTestData = () => {
    modals.openConfirmModal({
      title: "テストデータの作成",
      children: (
        <Stack gap="md">
          <Alert color="blue" icon={<IconPlus size={16} />}>
            <Text size="sm" fw={500}>
              テスト用のコンテンツを作成します
            </Text>
          </Alert>
          <Text size="sm">以下のテストデータが作成されます：</Text>
          <List size="sm">
            <List.Item>画像ファイル: 4件</List.Item>
            <List.Item>テキストコンテンツ: 4件</List.Item>
            <List.Item>YouTube動画: 4件</List.Item>
            <List.Item>URLリンク: 4件</List.Item>
            <List.Item>気象情報: 2件（東日本・西日本）</List.Item>
            <List.Item>CSVデータ: 2件（売上データ・成績表）</List.Item>
          </List>
          <Text size="sm" c="dimmed">
            合計27件のテストデータが作成されます。
          </Text>
        </Stack>
      ),
      labels: { confirm: "作成開始", cancel: "キャンセル" },
      confirmProps: { color: "blue", leftSection: <IconPlus size={16} /> },
      onConfirm: performCreateTestData,
    });
  };

  const performCreateTestData = async () => {
    try {
      setCreatingTestData(true);

      const results = await createTestData();

      if (results.failed.length > 0) {
        notifications.show({
          title: "一部のテストデータ作成に失敗",
          message: `${results.success}/${results.total} 件が成功しました。失敗: ${results.failed.join(", ")}`,
          color: "yellow",
          icon: <IconExclamationCircle size={16} />,
          autoClose: 10000,
        });
      } else {
        notifications.show({
          title: "テストデータ作成完了",
          message: `${results.success} 件のテストコンテンツを作成しました`,
          color: "green",
          icon: <IconPlus size={16} />,
        });
      }

      // ストレージ情報を再読み込み
      await loadStorageInfo();
    } catch (error) {
      logger.error("Settings", "Failed to create test data", error);
      notifications.show({
        title: "テストデータ作成失敗",
        message: "テストデータの作成中にエラーが発生しました",
        color: "red",
        icon: <IconExclamationCircle size={16} />,
      });
    } finally {
      setCreatingTestData(false);
    }
  };

  return (
    <AuthGuard>
      <Container size="lg">
        <Stack gap="lg">
          <Title order={1}>設定</Title>

          {/* ストレージ管理セクション */}
          <Paper p="md" withBorder>
            <Stack gap="md">
              <Title order={2} size="h3">
                ストレージ管理
              </Title>

              <Alert color="blue" icon={<IconDatabaseOff size={16} />}>
                <Text size="sm">
                  このアプリケーションはブラウザのOPFS (Origin Private File System) を使用してデータを保存しています。
                </Text>
              </Alert>

              {loading ? (
                <Text size="sm" c="dimmed">
                  読み込み中...
                </Text>
              ) : storageInfo ? (
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>
                      使用容量:
                    </Text>
                    <Text size="sm">{formatBytes(storageInfo.estimatedSize)}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>
                      ディレクトリ数:
                    </Text>
                    <Text size="sm">{storageInfo.directories.length}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>
                      ファイル数:
                    </Text>
                    <Text size="sm">{storageInfo.files.length}</Text>
                  </Group>
                </Stack>
              ) : (
                <Text size="sm" c="red">
                  ストレージ情報の読み込みに失敗しました
                </Text>
              )}

              <Group justify="space-between" mt="md">
                <Button variant="subtle" onClick={loadStorageInfo} loading={loading} size="sm">
                  情報を更新
                </Button>

                <Button
                  color="red"
                  variant="light"
                  leftSection={<IconTrash size={16} />}
                  onClick={handleClearOPFS}
                  loading={clearing}
                  disabled={loading}
                >
                  すべてのデータを削除
                </Button>
              </Group>
            </Stack>
          </Paper>

          {/* サムネイル管理セクション */}
          <Paper p="md" withBorder>
            <Stack gap="md">
              <Title order={2} size="h3">
                サムネイル管理
              </Title>

              <Alert color="blue" icon={<IconPhoto size={16} />}>
                <Text size="sm">
                  コンテンツのサムネイル画像を一括で再生成できます。
                  アスペクト比の修正や品質向上のために使用してください。
                </Text>
              </Alert>

              <Group justify="flex-end">
                <Button
                  color="blue"
                  variant="light"
                  leftSection={<IconRefresh size={16} />}
                  onClick={handleRegenerateThumbnails}
                  loading={regenerating}
                  disabled={loading || clearing}
                >
                  サムネイルを一括再生成
                </Button>
              </Group>
            </Stack>
          </Paper>

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

          {/* テストデータ作成セクション */}
          <Paper p="md" withBorder>
            <Stack gap="md">
              <Title order={2} size="h3">
                テストデータ作成
              </Title>

              <Alert color="blue" icon={<IconPlus size={16} />}>
                <Text size="sm">
                  デモンストレーション用のテストデータを一括作成できます。
                  コンテンツ（画像、テキスト、YouTube、URL、気象情報、CSV）に加えて、
                  レイアウト、プレイリスト、スケジュールも作成されます。
                </Text>
              </Alert>

              <Group justify="flex-end">
                <Button
                  color="blue"
                  variant="light"
                  leftSection={<IconPlus size={16} />}
                  onClick={handleCreateTestData}
                  loading={creatingTestData}
                  disabled={loading || clearing || regenerating}
                >
                  テストデータを作成
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </AuthGuard>
  );
};

export default Settings;
