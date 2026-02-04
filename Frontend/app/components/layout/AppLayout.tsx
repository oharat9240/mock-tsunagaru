import { Anchor, AppShell, Avatar, Button, Group, Menu, Text, Title, UnstyledButton } from "@mantine/core";
import { IconDoorExit, IconHome, IconMenu2, IconSettings } from "@tabler/icons-react";
import { useAtom } from "jotai";
import { Link, useLocation } from "react-router";
import { env } from "~/config/env";
import { useAuth } from "~/hooks/useAuth";
import { useLastTab } from "~/hooks/useLastTab";
import { headerColorAtom, logoutAtom } from "~/states";
import { ThemeToggle } from "../common/ThemeToggle";
import { LoginLayout } from "./LoginLayout";

interface AppLayoutProps {
  children: React.ReactNode;
}

const navigationItems = [
  { label: "ホーム", href: "/", icon: <IconHome size={16} />, isHome: true },
  { label: "設定", href: "/settings", icon: <IconSettings size={16} />, isHome: false },
];

export const AppLayout = ({ children }: AppLayoutProps) => {
  const { user, isInitialized } = useAuth();
  const [, logout] = useAtom(logoutAtom);
  const [headerColor] = useAtom(headerColorAtom);
  const location = useLocation();
  const { navigateToLastTab } = useLastTab();

  const handleLogout = () => {
    logout();
  };

  const handleHomeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigateToLastTab();
  };

  // 初期化中は何も表示しない
  if (!isInitialized) {
    return null;
  }

  if (!user) {
    return <LoginLayout>{children}</LoginLayout>;
  }

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header bg={headerColor}>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Anchor component={Link} to="/" td="none" onClick={handleHomeClick}>
              <Title order={3} c="white">
                {env.appTitle}
              </Title>
            </Anchor>
          </Group>

          <Group gap="sm">
            {/* Desktop Navigation */}
            <Group gap="xs" visibleFrom="sm">
              {navigationItems.map((item) => (
                <Button
                  key={item.href}
                  component={Link}
                  to={item.href}
                  color="white"
                  bg={location.pathname === item.href ? "#ffffff20" : "#ffffff00"}
                  variant={location.pathname === item.href ? "outline" : "subtle"}
                  leftSection={item.icon}
                  size="sm"
                  onClick={item.isHome ? handleHomeClick : undefined}
                >
                  {item.label}
                </Button>
              ))}
            </Group>

            {/* Mobile Navigation Menu */}
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <Button variant="subtle" size="sm" hiddenFrom="sm" leftSection={<IconMenu2 size={16} />}>
                  メニュー
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>ナビゲーション</Menu.Label>
                {navigationItems.map((item) => (
                  <Menu.Item
                    key={item.href}
                    component={Link}
                    to={item.href}
                    leftSection={item.icon}
                    onClick={item.isHome ? handleHomeClick : undefined}
                  >
                    {item.label}
                  </Menu.Item>
                ))}
                <Menu.Divider />
                <Menu.Label>アカウント</Menu.Label>
                <Menu.Item leftSection={<IconDoorExit size={16} />} color="red" onClick={handleLogout}>
                  ログアウト
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>

            <ThemeToggle />

            {/* Desktop User Menu */}
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <UnstyledButton visibleFrom="sm">
                  <Group gap="xs">
                    <Avatar size="sm" color="white">
                      {user.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Text size="sm" fw={500} c="white">
                      {user.name}
                    </Text>
                  </Group>
                </UnstyledButton>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>アカウント</Menu.Label>
                <Menu.Divider />
                <Menu.Item leftSection={<IconDoorExit size={16} />} color="red" onClick={handleLogout}>
                  ログアウト
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
};
