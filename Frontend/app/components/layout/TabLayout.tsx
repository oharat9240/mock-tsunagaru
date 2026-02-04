import { Box, Container, Tabs } from "@mantine/core";
import { IconCalendar, IconFolderOpen, IconLayout, IconPlaylist } from "@tabler/icons-react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { AuthGuard } from "~/components/common/AuthGuard";

export default function TabLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // 現在のパスからアクティブなタブを決定
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.startsWith("/playlist")) return "playlist";
    if (path.startsWith("/schedule")) return "schedule";
    if (path.startsWith("/layout")) return "layout";
    if (path.startsWith("/contents")) return "contents";
    return "playlist"; // デフォルト
  };

  const handleTabChange = (value: string | null) => {
    if (value) {
      navigate(`/${value}`);
    }
  };

  const activeTab = getActiveTab();

  return (
    <AuthGuard>
      <Container size="xl" p="md">
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tabs.List>
            <Tabs.Tab value="playlist" leftSection={<IconPlaylist size={12} />}>
              プレイリスト
            </Tabs.Tab>
            <Tabs.Tab value="schedule" leftSection={<IconCalendar size={12} />}>
              スケジュール
            </Tabs.Tab>
            <Tabs.Tab value="layout" leftSection={<IconLayout size={12} />}>
              レイアウト
            </Tabs.Tab>
            <Tabs.Tab value="contents" leftSection={<IconFolderOpen size={12} />}>
              コンテンツ管理
            </Tabs.Tab>
          </Tabs.List>

          <Box pt="md">
            <Outlet />
          </Box>
        </Tabs>
      </Container>
    </AuthGuard>
  );
}
