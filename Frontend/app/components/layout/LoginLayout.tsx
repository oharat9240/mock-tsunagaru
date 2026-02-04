import { Anchor, Group, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router";
import { env } from "~/config/env";
import { ThemeToggle } from "../common/ThemeToggle";

interface LoginLayoutProps {
  children: React.ReactNode;
}

export const LoginLayout = ({ children }: LoginLayoutProps) => {
  return (
    <>
      <Group justify="space-between" p="md">
        <Anchor component={Link} to="/" td="none">
          <Stack gap={0}>
            <Title order={3} c="blue">
              {env.appTitle}
            </Title>
            <Text size="xs" c="dimmed">
              {env.appSubtitle}
            </Text>
          </Stack>
        </Anchor>
        <ThemeToggle />
      </Group>
      {children}
    </>
  );
};
